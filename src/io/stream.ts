import { withValue } from "../core/err.js";
import { KErr } from "../core/err.js";

const te = new TextEncoder();
const td = new TextDecoder();

export const enc = (s: string): Uint8Array => te.encode(s);
export const dec = (b: Uint8Array): string => td.decode(b);

/** Terminal state shared by descriptors and the guest terminal ioctl bridge. */
export interface TerminalState {
  termios(): Uint8Array;
  setTermios(raw: Uint8Array, flush: boolean): void;
  size(): { rows: number; cols: number };
  resize(rows: number, cols: number): void;
}

export interface In {
  tty: TerminalState | null;
  rd(): Promise<Uint8Array>;
  holdR: (() => void) | null;
  releaseR: (() => void) | null;
  close: (() => void) | null;
  cancel: (() => void) | null;
}

export interface Out {
  tty: TerminalState | null;
  wr(b: Uint8Array): Promise<number>;
  hold: (() => void) | null;
  close: (() => void) | null;
}

export class MemIn implements In {
  "tty": TerminalState | null = null;

  "holdR": (() => void) | null = null;
  "releaseR": (() => void) | null = null;
  "close": (() => void) | null = null;
  "cancel": (() => void) | null = null;

  private hit = false;

  constructor(private readonly b: Uint8Array<ArrayBufferLike> = new Uint8Array()) {}

  async rd(): Promise<Uint8Array> {
    if (this.hit) return new Uint8Array();
    this.hit = true;
    return this.b.slice();
  }
}

export class MemOut implements Out {
  "tty": TerminalState | null = null;

  "hold": (() => void) | null = null;
  "close": (() => void) | null = null;

  private readonly q: Uint8Array[] = [];

  async wr(b: Uint8Array): Promise<number> {
    this.q.push(b.slice());
    return b.length;
  }

  bytes(): Uint8Array {
    const n = this.q.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(n);
    let p = 0;
    for (const b of this.q) {
      out.set(b, p);
      p += b.length;
    }
    return out;
  }

  text(): string { return dec(this.bytes()); }
  clear(): void { this.q.length = 0; }
}

export class FnOut implements Out {
  "tty": TerminalState | null = null;

  "hold": (() => void) | null = null;
  "close": (() => void) | null = null;

  constructor(private readonly fn: (s: string) => void | Promise<void>) {}

  async wr(b: Uint8Array): Promise<number> {
    await this.fn(dec(b));
    return b.length;
  }
}

export class Pipe implements In, Out {
  "tty": TerminalState | null = null;

  private readonly q: Uint8Array[] = [];
  private readonly w: Array<(b: Uint8Array) => void> = [];
  private shut = false;
  private refs = 0;
  private rrefs = 0;
  private readonly subscribers = new Set<() => void>();

  get readable(): boolean { return this.q.length > 0 || this.shut; }
  get writable(): boolean { return !this.shut && this.rrefs > 0; }

  onChange(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(): void {
    for (const callback of this.subscribers) callback();
  }

  hold(): void { this.refs++; }
  holdR(): void { this.rrefs++; }

  async wr(b: Uint8Array): Promise<number> {
    if (this.shut) throw new KErr("EPIPE", "pipe is closed");
    if (!b.length) return 0;
    const x = b.slice();
    const fn = (this.w.shift() ?? null);
    if (fn) fn(x);
    else this.q.push(x);
    this.notify();
    return x.length;
  }

  async rd(): Promise<Uint8Array> {
    const b = (this.q.shift() ?? null);
    if (b) { this.notify(); return b; }
    if (this.shut) return new Uint8Array();
    return new Promise<Uint8Array>(ok => this.w.push(ok));
  }

  close(): void {
    if (this.refs > 0 && --this.refs > 0) return;
    this.end();
  }

  cancel(): void { this.end(); }

  releaseR(): void {
    if (this.rrefs > 0 && --this.rrefs > 0) return;
    this.end();
  }

  private end(): void {
    if (this.shut) return;
    this.shut = true;
    this.notify();
    for (const ok of this.w.splice(0)) ok(new Uint8Array());
  }
}

export class TeeOut implements Out {
  "tty": TerminalState | null = null;

  "hold": (() => void) | null = null;
  "close": (() => void) | null = null;

  constructor(private readonly a: Out, private readonly b: Out) {}

  async wr(x: Uint8Array): Promise<number> {
    await Promise.all([this.a.wr(x), this.b.wr(x)]);
    return x.length;
  }
}
