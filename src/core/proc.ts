import type { In, Out } from "../io/stream.js";
import type { Cred } from "../fs/vfs.js";

export type PState = "ready" | "run" | "sleep" | "stop" | "zombie";
export type Sig = 1 | 2 | 9 | 13 | 15;

export interface Io {
  sin: In;
  sout: Out;
  serr: Out;
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

  signal(s: Sig): void {
    if (this.code !== null) return;
    this.sig = s;
    this.ac.abort(new Error(`signal ${s}`));
  }

  ms(): number { return Date.now() - this.born; }
}
