import { bad, KErr } from "./err.js";
import type { Kern, PInfo, Start } from "./kernel.js";
import { Fd, Proc } from "./proc.js";
import type { Sig } from "./proc.js";
import { Chr, Dir, Reg, norm } from "../fs/vfs.js";
import type { St, VNode } from "../fs/vfs.js";
import { dec, enc, Pipe } from "../io/stream.js";
import { ttyOf } from "../io/tty.js";
import type { NReq, NRes } from "../net/net.js";

export class Sys {
  constructor(readonly k: Kern, readonly p: Proc) {}

  get pid(): number { return this.p.pid; }
  get ppid(): number { return this.p.ppid; }
  get uid(): number { return this.p.cred.uid; }
  get gid(): number { return this.p.cred.gid; }
  get cwd(): string { return this.p.cwd; }
  get umask(): number { return this.p.mask; }
  set umask(n: number) { this.p.mask = n & 0o777; }

  async inb(): Promise<Uint8Array> {
    const input = this.p.fds.get(0)?.input ?? bad("EBADF", "stdin");
    const q: Uint8Array[] = [];
    let n = 0;
    for (;;) {
      const b = await input.rd();
      if (!b.length) break;
      q.push(b);
      n += b.length;
    }
    const out = new Uint8Array(n);
    let at = 0;
    for (const b of q) { out.set(b, at); at += b.length; }
    return out;
  }

  async chunkb(): Promise<Uint8Array> {
    const input = this.p.fds.get(0)?.input ?? bad("EBADF", "stdin");
    return input.rd();
  }

  async chunk(): Promise<string> { return dec(await this.chunkb()); }

  async input(): Promise<string> { return dec(await this.inb()); }

  async out(s: string | Uint8Array): Promise<number> {
    const out = this.p.fds.get(1)?.output ?? bad("EBADF", "stdout");
    return out.wr(typeof s === "string" ? enc(s) : s);
  }

  async err(s: string | Uint8Array): Promise<number> {
    const out = this.p.fds.get(2)?.output ?? bad("EBADF", "stderr");
    return out.wr(typeof s === "string" ? enc(s) : s);
  }

  env(k?: string): string | Map<string, string> | undefined {
    return k === undefined ? new Map(this.p.env) : this.p.env.get(k);
  }

  setenv(k: string, v: string): void { this.p.env.set(k, v); }
  unset(k: string): void { this.p.env.delete(k); }

  cd(p: string): void {
    const h = this.k.fs.at(p, this.cwd, this.p.cred);
    if (!(h.node instanceof Dir)) bad("ENOTDIR", p);
    this.k.fs.need(h.node, this.p.cred, 1, h.path);
    this.setenv("OLDPWD", this.p.cwd);
    this.p.cwd = h.path;
    this.setenv("PWD", h.path);
  }

  read(p: string): string { return this.k.fs.read(p, this.cwd, this.p.cred); }
  readb(p: string): Uint8Array { return this.k.fs.readb(p, this.cwd, this.p.cred); }
  write(p: string, x: string, add = false, mode = 0o666): void { this.k.fs.write(p, x, this.cwd, this.p.cred, add, mode & ~this.umask); }
  writeb(p: string, x: Uint8Array, add = false, mode = 0o666): void { this.k.fs.writeb(p, x, this.cwd, this.p.cred, add, mode & ~this.umask); }
  mkfile(p: string, x: string | Uint8Array = "", mode = 0o666): void { this.k.fs.mkfile(p, x, this.cwd, this.p.cred, mode & ~this.umask); }
  mkdir(p: string, mode = 0o777): void { this.k.fs.mkdir(p, this.cwd, this.p.cred, mode & ~this.umask); }
  list(p = "."): Array<[string, VNode]> { return this.k.fs.list(p, this.cwd, this.p.cred); }
  rm(p: string, dir = false): void { this.k.fs.rm(p, this.cwd, this.p.cred, dir); }
  mv(a: string, b: string): void { this.k.fs.rename(a, b, this.cwd, this.p.cred); }
  link(a: string, b: string): void { this.k.fs.link(a, b, this.cwd, this.p.cred); }
  symlink(a: string, b: string): void { this.k.fs.symlink(a, b, this.cwd, this.p.cred); }
  readlink(p: string): string { return this.k.fs.readlink(p, this.cwd, this.p.cred); }
  chmod(p: string, mode: number): void { this.k.fs.chmod(p, mode, this.cwd, this.p.cred); }
  chown(p: string, uid: number, gid: number): void { this.k.fs.chown(p, uid, gid, this.cwd, this.p.cred); }
  utime(p: string, at: number, mt: number, follow = true): void { this.k.fs.utime(p, at, mt, this.cwd, this.p.cred, follow); }
  stat(p: string, follow = true): St { return this.k.fs.stat(p, this.cwd, this.p.cred, follow); }
  paths(p = "."): string[] { return this.k.fs.paths(p, this.cwd, this.p.cred); }
  glob(p: string): string[] { return this.k.fs.glob(p, this.cwd, this.p.cred); }

  open(path: string, flags = "r", mode = 0o666): number {
    const requested = norm(path, this.cwd);
    const rd = flags.includes("r") || flags.includes("+");
    const wr = /[wa+]/.test(flags);
    const add = flags.startsWith("a");
    try {
      const h = this.k.fs.at(path, this.cwd, this.p.cred);
      if (h.node instanceof Dir) bad("EISDIR", path);
      if (rd) this.k.fs.need(h.node, this.p.cred, 4, h.path);
      if (wr) this.k.fs.need(h.node, this.p.cred, 2, h.path);

      if (requested === "/dev/tty") {
        const all = [...this.p.fds.values()];
        const dev = all.map(f => ttyOf(f.input) ?? ttyOf(f.output)).find(Boolean);
        const input = rd ? all.map(f => f.input).find(x => ttyOf(x) === dev) : undefined;
        const output = wr ? all.map(f => f.output).find(x => ttyOf(x) === dev) : undefined;
        if (!dev || (rd && !input) || (wr && !output)) bad("ENOTSUP", "/dev/tty: no controlling terminal");
        input?.holdR?.();
        output?.hold?.();
        const n = this.k.fd(this.p);
        this.p.fds.set(n, new Fd(input, output, requested, rd, wr));
        return n;
      }

      if (flags.startsWith("w")) this.writeb(h.path, new Uint8Array());
      path = h.path;
    } catch (e) {
      if (!(e instanceof KErr) || e.code !== "ENOENT" || !wr) throw e;
      this.mkfile(path, new Uint8Array(), mode);
      path = this.k.fs.at(path, this.cwd, this.p.cred).path;
    }
    const n = this.k.fd(this.p);
    const f = new Fd(undefined, undefined, path, rd, wr, add);
    if (add) f.pos = this.stat(path).size;
    this.p.fds.set(n, f);
    return n;
  }

  openDir(path: string): number {
    const h = this.k.fs.at(path, this.cwd, this.p.cred);
    if (!(h.node instanceof Dir)) bad("ENOTDIR", path);
    this.k.fs.need(h.node, this.p.cred, 5, h.path);
    const n = this.k.fd(this.p);
    this.p.fds.set(n, new Fd(undefined, undefined, h.path, true));
    return n;
  }

  pipe(): [number, number] {
    const p = new Pipe(), rd = this.k.fd(this.p);
    this.p.fds.set(rd, new Fd(p, undefined, undefined, true));
    p.holdR();
    const wr = this.k.fd(this.p);
    this.p.fds.set(wr, new Fd(undefined, p, undefined, false, true));
    p.hold();
    return [rd, wr];
  }

  close(fd: number): void {
    const f = this.p.fds.get(fd) ?? bad("EBADF", String(fd));
    this.p.fds.delete(fd);
    f.input?.releaseR?.();
    f.output?.close?.();
  }

  dup(fd: number, nu?: number): number { return this.k.cloneFd(this.p, fd, nu); }

  fdr(fd: number, len = 65536): Uint8Array {
    const f = this.p.fds.get(fd) ?? bad("EBADF", String(fd));
    const path = f.path ?? bad("EBADF", String(fd));
    if (!f.rd) bad("EBADF", String(fd));
    const h = this.k.fs.at(path, this.cwd, this.p.cred);
    if (h.node instanceof Reg) {
      const b = h.node.data.slice(f.pos, f.pos + len);
      f.pos += b.length;
      return b;
    }
    if (h.node instanceof Chr && f.pos > 0 && !h.node.repeat) return new Uint8Array();
    const b = this.readb(path).slice(0, len);
    f.pos += b.length;
    return b;
  }

  fdw(fd: number, b: Uint8Array): number {
    const f = this.p.fds.get(fd) ?? bad("EBADF", String(fd));
    const path = f.path ?? bad("EBADF", String(fd));
    if (!f.wr) bad("EBADF", String(fd));
    const h = this.k.fs.at(path, this.cwd, this.p.cred);
    if (h.node instanceof Reg) {
      const at = f.add ? h.node.data.length : f.pos;
      const n = Math.max(h.node.data.length, at + b.length);
      const x = new Uint8Array(n);
      x.set(h.node.data);
      x.set(b, at);
      this.writeb(path, x);
      f.pos = at + b.length;
      return b.length;
    }
    this.writeb(path, b, true);
    f.pos += b.length;
    return b.length;
  }

  seek(fd: number, off: number, whence = 0): number {
    const f = this.p.fds.get(fd) ?? bad("EBADF", String(fd));
    const path = f.path ?? bad("EBADF", String(fd));
    const base = whence === 0 ? 0 : whence === 1 ? f.pos : this.stat(path).size;
    const n = base + off;
    if (n < 0) bad("EINVAL", "negative seek");
    f.pos = n;
    return n;
  }

  start(name: string, a: string[], opt: Start = {}): Proc { return this.k.start(name, a, this.p, opt); }
  wait(pid: number): Promise<number> { return this.k.wait(pid, this.p); }
  reap(pid: number): void { this.k.reap(pid, this.p); }
  kill(pid: number, sig: Sig = 15): number { return this.k.kill(pid, sig, this.p); }
  ps(): PInfo[] { return this.k.ps(); }
  which(name: string): string { return this.k.which(name, this.p); }
  apps(): AppInfo[] { return [...this.k.apps.values()].map(x => ({ name: x.name, desc: x.desc, use: x.use })).sort((a, b) => a.name.localeCompare(b.name)); }
  uptime(): number { return Date.now() - this.k.born; }
  logs(): string[] { return [...this.k.logs]; }
  net(r: NReq): Promise<NRes> { return this.k.net.req(r, this.p.ac.signal); }
  reboot(): void { this.k.stop(this.p); }

  async sleep(ms: number): Promise<void> {
    if (!Number.isFinite(ms) || ms < 0) bad("EINVAL", String(ms));
    this.p.state = "sleep";
    try {
      await new Promise<void>((ok, no) => {
        const id = setTimeout(ok, ms);
        this.p.ac.signal.addEventListener("abort", () => { clearTimeout(id); no(new KErr("EINTR", "interrupted")); }, { once: true });
      });
    } finally {
      if (this.p.code === null) this.p.state = "run";
    }
  }

  yield(): Promise<void> { return this.k.sched.yield(this.p); }

  chk(): void { if (this.p.ac.signal.aborted) bad("EINTR", "interrupted"); }
}

export interface AppInfo { name: string; desc: string; use: string; }
