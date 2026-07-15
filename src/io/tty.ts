import { dec, enc } from "./stream.js";
import type { In, Out } from "./stream.js";

const ICRNL = 0x100;
const OPOST = 0x1, ONLCR = 0x4;
const ISIG = 0x1, ICANON = 0x2, ECHO = 0x8, ECHOE = 0x10, ECHOK = 0x20, ECHONL = 0x40, IEXTEN = 0x8000;
const CREAD = 0x80, CS8 = 0x30;
const VINTR = 0, VERASE = 2, VKILL = 3, VEOF = 4, VTIME = 5, VMIN = 6, VSTART = 8, VSTOP = 9, VSUSP = 10;
export const TERMIOS_SIZE = 36;

export interface TtySize { rows: number; cols: number; }

export interface TtyDevice {
  size(): TtySize;
  resize(rows: number, cols: number): void;
  termios(): Uint8Array;
  setTermios(b: Uint8Array, flush: boolean): void;
  available(): number;
}

export const ttyOf = (x: In | Out | undefined): TtyDevice | undefined => x?.tty;

export class Tty implements TtyDevice {
  readonly input: In;
  readonly output: Out;
  readonly error: Out;
  private readonly q: Uint8Array[] = [];
  private readonly wait: Array<(b: Uint8Array) => void> = [];
  private readonly line: number[] = [];
  private refs = 0;
  private rrefs = 0;
  private rows = 24;
  private cols = 80;
  private iflag = ICRNL;
  private oflag = OPOST | ONLCR;
  private cflag = CREAD | CS8;
  private lflag = ISIG | ICANON | ECHO | ECHOE | ECHOK | IEXTEN;
  private lineDiscipline = 0;
  private readonly cc = new Uint8Array(19);
  private stopped = false;

  constructor(
    private readonly writeHost: (s: string, err: boolean) => void | Promise<void>,
    private readonly signal: (n: 2 | 15) => void,
  ) {
    this.cc[VINTR] = 3;
    this.cc[VERASE] = 127;
    this.cc[VKILL] = 21;
    this.cc[VEOF] = 4;
    this.cc[VTIME] = 0;
    this.cc[VMIN] = 1;
    this.cc[VSTART] = 17;
    this.cc[VSTOP] = 19;
    this.cc[VSUSP] = 26;
    this.input = new TtyInput(this);
    this.output = new TtyOutput(this, false);
    this.error = new TtyOutput(this, true);
  }

  feed(s: string | Uint8Array): void {
    const src = typeof s === "string" ? enc(s) : s;
    if (!(this.lflag & ICANON)) {
      const out: number[] = [];
      for (let b of src) {
        if ((this.iflag & ICRNL) && b === 13) b = 10;
        if (this.flow(b)) continue;
        if ((this.lflag & ISIG) && this.sig(b)) continue;
        out.push(b);
        if (this.lflag & ECHO) void this.echo(Uint8Array.of(b));
      }
      if (out.length) this.put(Uint8Array.from(out));
      return;
    }

    for (let b of src) {
      if ((this.iflag & ICRNL) && b === 13) b = 10;
      if (this.flow(b)) continue;
      if ((this.lflag & ISIG) && this.sig(b)) { this.line.length = 0; continue; }
      if (b === this.cc[VEOF]) {
        if (this.line.length) this.commit(false);
        else this.put(new Uint8Array());
        continue;
      }
      if (b === this.cc[VERASE] || b === 8) {
        if (this.line.length) {
          this.line.pop();
          if (this.lflag & ECHOE) void this.writeHost("\b \b", false);
        }
        continue;
      }
      if (b === this.cc[VKILL]) {
        if (this.line.length && this.lflag & ECHOK) void this.writeHost("^U\r\n", false);
        this.line.length = 0;
        continue;
      }
      this.line.push(b);
      if ((this.lflag & ECHO) || (b === 10 && this.lflag & ECHONL)) void this.echo(Uint8Array.of(b));
      if (b === 10) this.commit(false);
    }
  }

  reset(): void {
    this.iflag = ICRNL;
    this.oflag = OPOST | ONLCR;
    this.cflag = CREAD | CS8;
    this.lflag = ISIG | ICANON | ECHO | ECHOE | ECHOK | IEXTEN;
    this.lineDiscipline = 0;
    this.cc[VINTR] = 3;
    this.cc[VERASE] = 127;
    this.cc[VKILL] = 21;
    this.cc[VEOF] = 4;
    this.cc[VTIME] = 0;
    this.cc[VMIN] = 1;
    this.cc[VSTART] = 17;
    this.cc[VSTOP] = 19;
    this.cc[VSUSP] = 26;
    this.line.length = 0;
    this.stopped = false;
  }

  size(): TtySize { return { rows: this.rows, cols: this.cols }; }
  resize(rows: number, cols: number): void {
    if (Number.isFinite(rows) && rows > 0) this.rows = Math.min(65535, Math.floor(rows));
    if (Number.isFinite(cols) && cols > 0) this.cols = Math.min(65535, Math.floor(cols));
  }

  termios(): Uint8Array {
    const b = new Uint8Array(TERMIOS_SIZE), v = new DataView(b.buffer);
    v.setUint32(0, this.iflag, true);
    v.setUint32(4, this.oflag, true);
    v.setUint32(8, this.cflag, true);
    v.setUint32(12, this.lflag, true);
    b[16] = this.lineDiscipline;
    b.set(this.cc, 17);
    return b;
  }

  setTermios(b: Uint8Array, flush: boolean): void {
    if (b.length < TERMIOS_SIZE) throw new Error("short termios buffer");
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    this.iflag = v.getUint32(0, true);
    this.oflag = v.getUint32(4, true);
    this.cflag = v.getUint32(8, true);
    this.lflag = v.getUint32(12, true);
    this.lineDiscipline = b[16] ?? 0;
    this.cc.set(b.subarray(17, 36));
    if (flush) { this.q.length = 0; this.line.length = 0; }
  }

  available(): number { return this.q.reduce((n, b) => n + b.length, 0); }

  async read(): Promise<Uint8Array> {
    const b = this.q.shift();
    if (b !== undefined) return b;
    return new Promise(ok => this.wait.push(ok));
  }

  async write(b: Uint8Array, err = false): Promise<number> {
    if (!this.stopped) await this.writeHost(dec(b), err);
    return b.length;
  }

  hold(): void { this.refs++; }
  close(): void { if (this.refs > 0) this.refs--; }
  holdR(): void { this.rrefs++; }
  releaseR(): void { if (this.rrefs > 0) this.rrefs--; }
  cancel(): void { /* A controlling terminal survives individual processes. */ }

  private put(b: Uint8Array): void {
    const fn = this.wait.shift();
    if (fn) fn(b);
    else this.q.push(b);
  }

  private commit(addNewline: boolean): void {
    if (addNewline) this.line.push(10);
    this.put(Uint8Array.from(this.line));
    this.line.length = 0;
  }

  private async echo(b: Uint8Array): Promise<void> {
    if (b.length === 1 && b[0] === 10) await this.writeHost("\r\n", false);
    else await this.writeHost(dec(b), false);
  }

  private sig(b: number): boolean {
    if (b === this.cc[VINTR]) { void this.writeHost("^C\r\n", false); this.signal(2); return true; }
    if (b === this.cc[VSUSP]) { void this.writeHost("^Z\r\n", false); this.signal(15); return true; }
    return false;
  }

  private flow(b: number): boolean {
    if (b === this.cc[VSTOP]) { this.stopped = true; return true; }
    if (b === this.cc[VSTART]) { this.stopped = false; return true; }
    return false;
  }
}

class TtyInput implements In {
  readonly tty: TtyDevice;
  constructor(private readonly dev: Tty) { this.tty = dev; }
  rd(): Promise<Uint8Array> { return this.dev.read(); }
  holdR(): void { this.dev.holdR(); }
  releaseR(): void { this.dev.releaseR(); }
  cancel(): void { this.dev.cancel(); }
}

class TtyOutput implements Out {
  readonly tty: TtyDevice;
  constructor(private readonly dev: Tty, private readonly err: boolean) { this.tty = dev; }
  wr(b: Uint8Array): Promise<number> { return this.dev.write(b, this.err); }
  hold(): void { this.dev.hold(); }
  close(): void { this.dev.close(); }
}
