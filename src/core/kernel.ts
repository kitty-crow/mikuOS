import { App } from "../apps/base.js";
import { bad, KErr, msg } from "./err.js";
import { MemIn, MemOut, enc } from "../io/stream.js";
import type { In, Out } from "../io/stream.js";
import { Reg, Vfs } from "../fs/vfs.js";
import type { Cred } from "../fs/vfs.js";
import { Fd, Proc } from "./proc.js";
import type { Io, Sig } from "./proc.js";
import { Sys } from "./sys.js";
import { Wasi } from "../wasm/wasi.js";
import { Sched } from "./sched.js";

export interface Start {
  io?: Partial<Io>;
  pgid?: number;
  cwd?: string;
  env?: Map<string, string>;
}

export interface PInfo {
  pid: number;
  ppid: number;
  pgid: number;
  uid: number;
  state: string;
  ms: number;
  cmd: string;
}

const root: Cred = { uid: 0, gid: 0, groups: [0] };

export class Kern {
  readonly fs = new Vfs();
  readonly apps = new Map<string, App>();
  readonly procs = new Map<number, Proc>();
  readonly logs: string[] = [];
  readonly sched = new Sched();
  readonly born = Date.now();
  readonly release = "1.0.0-thistle";
  host = "thistle";
  ttyFn: (s: string, err: boolean) => void = () => {};
  private seq = 1;
  private haltFn?: () => void;

  setHalt(fn: () => void): void { this.haltFn = fn; }
  tty(s: string, err = false): void { this.ttyFn(s, err); }

  log(s: string): void {
    const t = ((Date.now() - this.born) / 1000).toFixed(3).padStart(8);
    this.logs.push(`[${t}] ${s}`);
  }

  init(): Proc {
    if (this.procs.has(1)) return this.procs.get(1)!;
    const z = new MemOut();
    const p = new Proc(1, 0, 1, "init", ["init"], "/", this.baseEnv(), root, { sin: new MemIn(), sout: z, serr: z });
    p.state = "sleep";
    this.procs.set(1, p);
    this.seq = 2;
    this.log("init: process 1 entered service loop");
    return p;
  }

  session(io: Io, cred: Cred = root): Proc {
    this.init();
    const pid = this.seq++;
    const home = cred.uid === 0 ? "/root" : "/home/guest";
    const env = this.baseEnv();
    env.set("HOME", home);
    env.set("USER", cred.uid === 0 ? "root" : "guest");
    env.set("PWD", home);
    const p = new Proc(pid, 1, pid, "thsh", ["thsh"], home, env, { ...cred, groups: [...cred.groups] }, io);
    p.state = "run";
    this.procs.set(pid, p);
    this.procs.get(1)!.kids.add(pid);
    this.log(`tty: session pid=${pid} uid=${cred.uid}`);
    return p;
  }

  private baseEnv(): Map<string, string> {
    return new Map([
      ["PATH", "/bin:/usr/bin"], ["HOME", "/root"], ["USER", "root"],
      ["SHELL", "/bin/thsh"], ["TERM", "thistle-256"], ["LANG", "en_GB.UTF-8"],
      ["HOSTNAME", this.host], ["PS1", "\\u@\\h:\\w\\$ "],
    ]);
  }

  reg(a: App): void { this.apps.set(a.name, a); }

  install(a: App): void {
    this.reg(a);
    const p = `/bin/${a.name}`;
    const c = root;
    try { this.fs.mkfile(p, `#!thistle:${a.name}\n`, "/", c, 0o755); }
    catch (e) { if (!(e instanceof KErr) || e.code !== "EEXIST") throw e; }
  }

  which(name: string, p: Proc): string {
    if (name.includes("/")) {
      const q = this.fs.at(name, p.cwd, p.cred).path;
      this.fs.need(this.fs.at(q, "/", p.cred).node, p.cred, 1, q);
      return q;
    }
    for (const d of (p.env.get("PATH") ?? "/bin").split(":")) {
      const q = `${d.replace(/\/$/, "")}/${name}`;
      try {
        const h = this.fs.at(q, p.cwd, p.cred);
        this.fs.need(h.node, p.cred, 1, q);
        if (h.node instanceof Reg) return h.path;
      } catch { /* PATH lookup is allowed to miss. Quite often, in fact. */ }
    }
    return bad("ENOENT", `${name}: command not found`);
  }

  start(name: string, argv: string[], par: Proc, opt: Start = {}): Proc {
    const path = this.which(name, par);
    const h = this.fs.at(path, par.cwd, par.cred);
    const node = h.node instanceof Reg ? h.node : bad("ENOEXEC", path);
    const pid = this.seq++;
    const io: Io = {
      sin: opt.io?.sin ?? par.fds.get(0)?.input ?? new MemIn(),
      sout: opt.io?.sout ?? par.fds.get(1)?.output ?? new MemOut(),
      serr: opt.io?.serr ?? par.fds.get(2)?.output ?? new MemOut(),
    };
    io.sin.holdR?.();
    io.sout.hold?.();
    if (io.serr !== io.sout) io.serr.hold?.();
    const p = new Proc(
      pid, par.pid, opt.pgid ?? pid, path, [name, ...argv], opt.cwd ?? par.cwd,
      new Map(opt.env ?? par.env), { ...par.cred, groups: [...par.cred.groups] }, io,
    );
    p.mask = par.mask;
    this.procs.set(pid, p);
    par.kids.add(pid);
    this.sched.add(p, () => this.run(p, path, node.data.slice(), argv));
    return p;
  }

  private async run(p: Proc, path: string, bin: Uint8Array, argv: string[]): Promise<void> {
    p.state = "run";
    let code = 126;
    try {
      if (bin.length >= 4 && bin[0] === 0 && bin[1] === 0x61 && bin[2] === 0x73 && bin[3] === 0x6d) {
        code = await new Wasi(new Sys(this, p)).run(bin, [path, ...argv]);
      } else {
        const src = new TextDecoder().decode(bin);
        const m = /^#!thistle:([^\n]+)\n/.exec(src);
        if (m) {
          const a = this.apps.get(m[1]!) ?? bad("ENOEXEC", `${path}: missing app ${m[1]}`);
          const s = new Sys(this, p);
          code = argv.includes("--help") ? await a.help(s) : await a.run(s, argv);
        } else if (src.startsWith("#!/bin/thsh\n") || src.startsWith("#!/bin/sh\n")) {
          const a = this.apps.get("thsh") ?? bad("ENOEXEC", "shell is not installed");
          code = await a.run(new Sys(this, p), [path, ...argv]);
        } else bad("ENOEXEC", `${path}: unknown executable format`);
      }
    } catch (e) {
      if (p.sig) code = 128 + p.sig;
      else if (e instanceof KErr && e.code === "EPIPE") code = 141;
      else {
        code = e instanceof KErr ? e.code === "EINTR" ? 130 : e.code === "ENOEXEC" || e.code === "EACCES" ? 126 : e.code === "ENOENT" ? 127 : 1 : 1;
        await p.fds.get(2)?.output?.wr(enc(`${p.argv[0]}: ${msg(e)}\n`));
      }
    } finally {
      p.fds.get(0)?.input?.releaseR?.();
      p.fds.get(1)?.output?.close?.();
      if (p.fds.get(2)?.output !== p.fds.get(1)?.output) p.fds.get(2)?.output?.close?.();
      p.end(code);
      this.log(`proc: pid=${p.pid} exit=${code} cmd=${path}`);
    }
  }

  async wait(pid: number, par: Proc): Promise<number> {
    const p = this.procs.get(pid) ?? bad("ESRCH", String(pid));
    if (p.ppid !== par.pid && par.cred.uid !== 0) bad("ECHILD", String(pid));
    const n = await p.done;
    this.reap(pid, par);
    return n;
  }

  reap(pid: number, par?: Proc): void {
    if (pid <= 2) return;
    const p = this.procs.get(pid);
    if (!p || p.code === null) return;
    this.procs.delete(pid);
    (par ?? this.procs.get(p.ppid))?.kids.delete(pid);
  }

  kill(id: number, sig: Sig, by: Proc): number {
    const q = [...this.procs.values()].filter(p => id < 0 ? p.pgid === -id : p.pid === id);
    if (!q.length) bad("ESRCH", String(id));
    let n = 0;
    for (const p of q) {
      if (p.pid === 1) continue;
      if (by.cred.uid !== 0 && by.cred.uid !== p.cred.uid) bad("EPERM", String(p.pid));
      p.signal(sig);
      if (sig === 9 || p.state === "sleep") p.end(128 + sig);
      n++;
    }
    this.log(`signal: sig=${sig} target=${id} sender=${by.pid}`);
    return n;
  }

  ps(): PInfo[] {
    return [...this.procs.values()].sort((a, b) => a.pid - b.pid).map(p => ({
      pid: p.pid, ppid: p.ppid, pgid: p.pgid, uid: p.cred.uid,
      state: p.state, ms: p.ms(), cmd: p.argv.join(" "),
    }));
  }

  stop(by: Proc): void {
    if (by.cred.uid !== 0) bad("EPERM", "reboot");
    for (const p of this.procs.values()) if (p.pid !== 1 && p.pid !== by.pid) p.signal(15);
    this.log("system: reboot requested");
    this.haltFn?.();
  }

  fd(p: Proc): number {
    for (let n = 3; n < 256; n++) if (!p.fds.has(n)) return n;
    return bad("EMFILE", "descriptor table full");
  }

  cloneFd(p: Proc, old: number, nu?: number): number {
    const f = p.fds.get(old) ?? bad("EBADF", String(old));
    const n = nu ?? this.fd(p);
    p.fds.set(n, new Fd(f.input, f.output, f.path, f.rd, f.wr, f.add));
    return n;
  }
}
