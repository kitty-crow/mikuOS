import { bad, KErr } from "./err.js";
import type { Kern, PInfo, Start } from "./kernel.js";
import { Fd, Proc } from "./proc.js";
import type { Sig } from "./proc.js";
import { Chr, Dir, Reg, credGid, credUid } from "../fs/vfs.js";
import type { Cred, St, VNode } from "../fs/vfs.js";
import { dec, enc, Pipe } from "../io/stream.js";
import type { NReq, NRes } from "../net/net.js";

export class Sys {
  constructor(readonly k: Kern, readonly p: Proc) {}

  get pid(): number { return this.p.pid; }
  get ppid(): number { return this.p.ppid; }
  get uid(): number { return this.ruid; }
  get euid(): number { return this.p.cred.euid ?? credUid(this.p.cred); }
  get suid(): number { return this.p.cred.suid ?? this.euid; }
  get ruid(): number { return this.p.cred.ruid ?? this.p.cred.uid ?? this.euid; }
  get gid(): number { return this.rgid; }
  get egid(): number { return this.p.cred.egid ?? credGid(this.p.cred); }
  get sgid(): number { return this.p.cred.sgid ?? this.egid; }
  get rgid(): number { return this.p.cred.rgid ?? this.p.cred.gid ?? this.egid; }
  get groups(): number[] { return [...this.p.cred.groups]; }
  get cwd(): string { return this.p.cwd; }
  get umask(): number { return this.p.mask; }
  set umask(n: number) { this.p.mask = n & 0o777; }

  private get fcred(): Cred { return { uid: this.p.fsuid, gid: this.p.fsgid, groups: [...this.p.cred.groups] }; }
  private get privileged(): boolean { return this.euid === 0; }

  private validId(n: number): boolean { return Number.isInteger(n) && n >= 0 && n < 0xffffffff; }
  private requested(id: number | undefined): id is number { return id !== undefined; }
  private canSetUid(id: number): boolean { return this.privileged || id === this.ruid || id === this.euid || id === this.suid; }
  private canSetGid(id: number): boolean { return this.privileged || id === this.rgid || id === this.egid || id === this.sgid; }
  private ids(a: Array<number | undefined>, group = false): void {
    for (const id of a) if (this.requested(id) && (!this.validId(id) || !(group ? this.canSetGid(id) : this.canSetUid(id)))) bad("EPERM", String(id));
  }

  setResuid(ruid?: number, euid?: number, suid?: number): void {
    this.ids([ruid, euid, suid]);
    const next = { ruid: this.ruid, euid: this.euid, suid: this.suid };
    if (this.requested(ruid)) next.ruid = ruid;
    if (this.requested(euid)) next.euid = euid;
    if (this.requested(suid)) next.suid = suid;
    this.p.cred = { ...this.p.cred, ...next, uid: next.euid };
    this.p.fsuid = next.euid;
  }

  setResgid(rgid?: number, egid?: number, sgid?: number): void {
    this.ids([rgid, egid, sgid], true);
    const next = { rgid: this.rgid, egid: this.egid, sgid: this.sgid };
    if (this.requested(rgid)) next.rgid = rgid;
    if (this.requested(egid)) next.egid = egid;
    if (this.requested(sgid)) next.sgid = sgid;
    this.p.cred = { ...this.p.cred, ...next, gid: next.egid };
    this.p.fsgid = next.egid;
  }

  setReuid(ruid?: number, euid?: number): void {
    const oldRuid = this.ruid;
    this.ids([ruid, euid]);
    const nextR = this.requested(ruid) ? ruid : this.ruid;
    const nextE = this.requested(euid) ? euid : this.euid;
    const nextS = this.requested(ruid) || (this.requested(euid) && euid !== oldRuid) ? nextE : this.suid;
    this.p.cred = { ...this.p.cred, ruid: nextR, euid: nextE, suid: nextS, uid: nextE };
    this.p.fsuid = nextE;
  }

  setRegid(rgid?: number, egid?: number): void {
    const oldRgid = this.rgid;
    this.ids([rgid, egid], true);
    const nextR = this.requested(rgid) ? rgid : this.rgid;
    const nextE = this.requested(egid) ? egid : this.egid;
    const nextS = this.requested(rgid) || (this.requested(egid) && egid !== oldRgid) ? nextE : this.sgid;
    this.p.cred = { ...this.p.cred, rgid: nextR, egid: nextE, sgid: nextS, gid: nextE };
    this.p.fsgid = nextE;
  }

  setUid(uid: number): void {
    this.ids([uid]);
    if (this.privileged) this.setResuid(uid, uid, uid);
    else this.setResuid(undefined, uid, undefined);
  }

  setGid(gid: number): void {
    this.ids([gid], true);
    if (this.privileged) this.setResgid(gid, gid, gid);
    else this.setResgid(undefined, gid, undefined);
  }

  setFsuid(uid: number): number {
    const old = this.p.fsuid;
    if (this.validId(uid) && this.canSetUid(uid)) this.p.fsuid = uid;
    return old;
  }

  setFsgid(gid: number): number {
    const old = this.p.fsgid;
    if (this.validId(gid) && this.canSetGid(gid)) this.p.fsgid = gid;
    return old;
  }

  setGroups(groups: number[]): void {
    if (!this.privileged) bad("EPERM", "setgroups");
    if (!groups.every(x => this.validId(x))) bad("EINVAL", "group id");
    this.p.cred = { ...this.p.cred, groups: [...groups] };
  }

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
    const h = this.k.fs.at(p, this.cwd, this.fcred);
    if (!(h.node instanceof Dir)) bad("ENOTDIR", p);
    this.k.fs.need(h.node, this.fcred, 1, h.path);
    this.setenv("OLDPWD", this.p.cwd);
    this.p.cwd = h.path;
    this.setenv("PWD", h.path);
  }

  read(p: string): string { return this.k.fs.read(p, this.cwd, this.fcred); }
  readb(p: string): Uint8Array { return this.k.fs.readb(p, this.cwd, this.fcred); }
  async materialise(p: string): Promise<Reg> {
    const h = this.k.fs.at(p, this.cwd, this.fcred);
    this.k.fs.need(h.node, this.fcred, 4, h.path);
    const node = h.node instanceof Reg ? h.node : bad("EISDIR", h.path);
    await node.materialise();
    return node;
  }
  write(p: string, x: string, add = false, mode = 0o666): void { this.k.fs.write(p, x, this.cwd, this.fcred, add, mode & ~this.umask); }
  writeb(p: string, x: Uint8Array, add = false, mode = 0o666): void { this.k.fs.writeb(p, x, this.cwd, this.fcred, add, mode & ~this.umask); }
  mkfile(p: string, x: string | Uint8Array = "", mode = 0o666): void { this.k.fs.mkfile(p, x, this.cwd, this.fcred, mode & ~this.umask); }
  mkdir(p: string, mode = 0o777): void { this.k.fs.mkdir(p, this.cwd, this.fcred, mode & ~this.umask); }
  list(p = "."): Array<[string, VNode]> { return this.k.fs.list(p, this.cwd, this.fcred); }
  rm(p: string, dir = false): void { this.k.fs.rm(p, this.cwd, this.fcred, dir); }
  mv(a: string, b: string): void { this.k.fs.rename(a, b, this.cwd, this.fcred); }
  link(a: string, b: string): void { this.k.fs.link(a, b, this.cwd, this.fcred); }
  symlink(a: string, b: string): void { this.k.fs.symlink(a, b, this.cwd, this.fcred); }
  readlink(p: string): string { return this.k.fs.readlink(p, this.cwd, this.fcred); }
  chmod(p: string, mode: number): void { this.k.fs.chmod(p, mode, this.cwd, this.fcred); }
  chown(p: string, uid: number, gid: number): void { this.k.fs.chown(p, uid, gid, this.cwd, this.fcred); }
  utime(p: string, at: number, mt: number, follow = true): void { this.k.fs.utime(p, at, mt, this.cwd, this.fcred, follow); }
  stat(p: string, follow = true): St { return this.k.fs.stat(p, this.cwd, this.fcred, follow); }
  node(p: string, follow = true): VNode { return this.k.fs.at(p, this.cwd, this.fcred, follow).node; }
  paths(p = "."): string[] { return this.k.fs.paths(p, this.cwd, this.fcred); }
  glob(p: string): string[] { return this.k.fs.glob(p, this.cwd, this.fcred); }

  open(path: string, flags = "r", mode = 0o666): number {
    const rd = flags.includes("r") || flags.includes("+");
    const wr = /[wa+]/.test(flags);
    const add = flags.startsWith("a");
    if (path === "/dev/tty") {
      const n = this.k.fd(this.p);
      this.p.fds.set(n, new Fd(this.p.fds.get(0)?.input, this.p.fds.get(1)?.output, undefined, rd, wr, add));
      return n;
    }
    try {
      const h = this.k.fs.at(path, this.cwd, this.fcred);
      if (h.node instanceof Dir) bad("EISDIR", path);
      if (rd) this.k.fs.need(h.node, this.fcred, 4, h.path);
      if (wr) this.k.fs.need(h.node, this.fcred, 2, h.path);
      if (flags.startsWith("w")) this.writeb(h.path, new Uint8Array());
      path = h.path;
    } catch (e) {
      if (!(e instanceof KErr) || e.code !== "ENOENT" || !wr) throw e;
      this.mkfile(path, new Uint8Array(), mode);
      path = this.k.fs.at(path, this.cwd, this.fcred).path;
    }
    const n = this.k.fd(this.p);
    const f = new Fd(undefined, undefined, path, rd, wr, add);
    if (add) f.pos = this.stat(path).size;
    this.p.fds.set(n, f);
    return n;
  }

  openDir(path: string): number {
    const h = this.k.fs.at(path, this.cwd, this.fcred);
    if (!(h.node instanceof Dir)) bad("ENOTDIR", path);
    this.k.fs.need(h.node, this.fcred, 5, h.path);
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
    const h = this.k.fs.at(path, this.cwd, this.fcred);
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
    const h = this.k.fs.at(path, this.cwd, this.fcred);
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
  exec(name: string, argv: string[], env: Map<string, string>): Promise<never> { return this.k.exec(name, argv, env, this.p); }
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
