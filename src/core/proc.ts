import type { In, Out } from "../io/stream.js";
import { credGid, credUid } from "../fs/vfs.js";
import type { Cred } from "../fs/vfs.js";

export type PState = "ready" | "run" | "sleep" | "stop" | "zombie";
export type Sig = 0 | 1 | 2 | 9 | 13 | 15;

export interface Io {
  sin: In;
  sout: Out;
  serr: Out;
}

/** Internal control transfer used to replace a process image without changing its PID. */
export class ExecReplace extends Error {
  constructor(
    public readonly path: string,
    public readonly image: Uint8Array,
    public readonly args: string[],
    public readonly argv: string[],
    public readonly env: Map<string, string>,
    public readonly cred: Cred,
  ) {
    super(`exec ${path}`);
    this.name = "ExecReplace";
  }
}

export class Fd {
  pos = 0;

  constructor(
    public input?: In,
    public output?: Out,
    public path?: string,
    public rd = false,
    public wr = false,
    public add = false,
    public clo = false,
  ) {}
}

export class Proc {
  state: PState = "ready";
  code: number | null = null;
  sig: Sig | null = null;
  readonly born = Date.now();
  readonly ac = new AbortController();
  readonly fds = new Map<number, Fd>();
  readonly kids = new Set<number>();
  mask = 0o022;
  allHeld = false;
  fsuid: number;
  fsgid: number;
  signalMask = 0n;
  private pending: Sig | null = null;
  readonly done: Promise<number>;
  private fin!: (n: number) => void;

  constructor(
    public readonly pid: number,
    public readonly ppid: number,
    public pgid: number,
    public cmd: string,
    public argv: string[],
    public cwd: string,
    public env: Map<string, string>,
    public cred: Cred,
    io: Io,
  ) {
    this.fsuid = credUid(cred);
    this.fsgid = credGid(cred);
    this.fds.set(0, new Fd(io.sin, undefined, "/dev/stdin", true));
    this.fds.set(1, new Fd(undefined, io.sout, "/dev/stdout", false, true));
    this.fds.set(2, new Fd(undefined, io.serr, "/dev/stderr", false, true));
    this.done = new Promise(ok => { this.fin = ok; });
  }

  end(n: number): void {
    if (this.code !== null) return;
    this.code = n & 0xff;
    this.state = "zombie";
    this.fin(this.code);
  }

  signal(s: Sig): boolean {
    if (s === 0) return true;
    if (this.code !== null) return false;
    const bit = 1n << BigInt(s - 1);
    if (s !== 9 && (this.signalMask & bit)) { this.pending = s; return false; }
    this.sig = s;
    this.ac.abort(new Error(`signal ${s}`));
    return true;
  }

  setSignalMask(how: 0 | 1 | 2, mask: bigint): bigint {
    const old = this.signalMask, kill = 1n << 8n;
    if (how === 0) this.signalMask |= mask;
    else if (how === 1) this.signalMask &= ~mask;
    else this.signalMask = mask;
    this.signalMask &= ~kill;
    const p = this.pending;
    if (p !== null && !(this.signalMask & (1n << BigInt(p - 1)))) {
      this.pending = null;
      this.signal(p);
    }
    return old;
  }

  ms(): number { return Date.now() - this.born; }
}
