import { KErr } from "../core/err.js";
import type { Errno } from "../core/err.js";
import type { Sys } from "../core/sys.js";
import { norm } from "../fs/vfs.js";
import { dec, enc } from "../io/stream.js";

const E: Record<Errno, number> = {
  EACCES: 2, EAGAIN: 6, EBADF: 8, EBUSY: 10, ECHILD: 12, EEXIST: 20,
  EFBIG: 22, EINTR: 27, EINVAL: 28, EIO: 29, EISDIR: 31, ELOOP: 32, EMFILE: 33,
  ENAMETOOLONG: 37, ENFILE: 41, ENOENT: 44, ENOEXEC: 45, ENOMEM: 48,
  ENETUNREACH: 46, ENOSPC: 51, ENOSYS: 52, ENOTDIR: 54, ENOTEMPTY: 55, ENOTSUP: 58,
  EPERM: 63, EPIPE: 64, EPROTO: 65, ERANGE: 68, EROFS: 69, ESRCH: 71, ETIMEDOUT: 73,
};

class WExit extends Error {
  constructor(readonly code: number) { super(`WASI exit ${code}`); }
}

interface Wfd {
  path: string;
  sys?: number;
  dir?: boolean;
}

const eno = (e: unknown): number => e instanceof KErr ? E[e.code] : 29;

export class Wasi {
  private mem?: WebAssembly.Memory;
  private sin: Uint8Array<ArrayBufferLike> = new Uint8Array();
  private ip = 0;
  private readonly out: Uint8Array[] = [];
  private readonly err: Uint8Array[] = [];
  private readonly fds = new Map<number, Wfd>();
  private nfd = 5;
  private argv: string[] = [];
  private env: string[] = [];

  constructor(private readonly s: Sys) {}

  async run(bin: Uint8Array, argv: string[]): Promise<number> {
    this.argv = argv;
    this.env = [...(this.s.env() as Map<string, string>)].map(([k, v]) => `${k}=${v}`);
    this.sin = this.s.p.fds.get(0)?.input?.tty ? new Uint8Array() : await this.s.inb();
    this.fds.set(3, { path: "/", dir: true });
    this.fds.set(4, { path: this.s.cwd, dir: true });
    let code = 0;
    try {
      const mod = await WebAssembly.compile(Uint8Array.from(bin) as BufferSource);
      const x = await WebAssembly.instantiate(mod, this.imports());
      const ex = x.exports;
      if (!(ex.memory instanceof WebAssembly.Memory)) throw new KErr("ENOEXEC", "WASM module exports no memory");
      this.mem = ex.memory;
      const fn = ex._start ?? ex.main;
      if (typeof fn !== "function") throw new KErr("ENOEXEC", "WASM module exports neither _start nor main");
      const r = fn();
      if (typeof r === "number") code = r;
    } catch (e) {
      if (e instanceof WExit) code = e.code;
      else throw e;
    } finally {
      for (const b of this.out) await this.s.out(b);
      for (const b of this.err) await this.s.err(b);
      for (const f of this.fds.values()) if (f.sys !== undefined) {
        try { this.s.close(f.sys); } catch { /* the module may already have closed it */ }
      }
    }
    return code & 0xff;
  }

  private imports(): WebAssembly.Imports {
    const safe = <A extends unknown[]>(fn: (...a: A) => number) => (...a: A): number => {
      try { return fn(...a); } catch (e) { if (e instanceof WExit) throw e; return eno(e); }
    };

    const wasi = {
      args_sizes_get: safe((a: number, b: number) => this.sizes(this.argv, a, b)),
      args_get: safe((a: number, b: number) => this.putv(this.argv, a, b)),
      environ_sizes_get: safe((a: number, b: number) => this.sizes(this.env, a, b)),
      environ_get: safe((a: number, b: number) => this.putv(this.env, a, b)),
      fd_write: safe((fd: number, io: number, ni: number, nw: number) => this.fdWrite(fd, io, ni, nw)),
      fd_read: safe((fd: number, io: number, ni: number, nr: number) => this.fdRead(fd, io, ni, nr)),
      fd_pwrite: safe((fd: number, io: number, ni: number, off: bigint, nw: number) => this.fdPwrite(fd, io, ni, off, nw)),
      fd_pread: safe((fd: number, io: number, ni: number, off: bigint, nr: number) => this.fdPread(fd, io, ni, off, nr)),
      fd_close: safe((fd: number) => this.fdClose(fd)),
      fd_renumber: safe((a: number, b: number) => this.renumber(a, b)),
      fd_seek: safe((fd: number, off: bigint, wh: number, p: number) => this.fdSeek(fd, off, wh, p)),
      fd_tell: safe((fd: number, p: number) => this.fdSeek(fd, 0n, 1, p)),
      fd_sync: safe((_fd: number) => 0),
      fd_datasync: safe((_fd: number) => 0),
      fd_advise: safe((_fd: number, _o: bigint, _l: bigint, _a: number) => 0),
      fd_allocate: safe((fd: number, off: bigint, len: bigint) => this.alloc(fd, off, len)),
      fd_fdstat_get: safe((fd: number, p: number) => this.fdstat(fd, p)),
      fd_fdstat_set_flags: safe((fd: number, fl: number) => this.setFlags(fd, fl)),
      fd_fdstat_set_rights: safe((_fd: number, _a: bigint, _b: bigint) => 0),
      fd_filestat_get: safe((fd: number, p: number) => fd <= 2 ? this.stdstat(fd, p) : this.filestat(this.file(fd).path, p)),
      fd_filestat_set_size: safe((fd: number, n: bigint) => this.resize(fd, n)),
      fd_filestat_set_times: safe((fd: number, at: bigint, mt: bigint, fl: number) => this.setTimes(this.file(fd).path, at, mt, fl)),
      fd_prestat_get: safe((fd: number, p: number) => this.prestat(fd, p)),
      fd_prestat_dir_name: safe((fd: number, p: number, n: number) => this.prename(fd, p, n)),
      fd_readdir: safe((fd: number, p: number, n: number, c: bigint, used: number) => this.readdir(fd, p, n, c, used)),
      path_open: safe((fd: number, _df: number, p: number, n: number, of: number, rb: bigint, _ri: bigint, ff: number, out: number) => this.pathOpen(fd, p, n, of, rb, ff, out)),
      path_create_directory: safe((fd: number, p: number, n: number) => { this.s.mkdir(this.path(fd, p, n)); return 0; }),
      path_remove_directory: safe((fd: number, p: number, n: number) => { this.s.rm(this.path(fd, p, n), true); return 0; }),
      path_unlink_file: safe((fd: number, p: number, n: number) => { this.s.rm(this.path(fd, p, n)); return 0; }),
      path_rename: safe((a: number, ap: number, an: number, b: number, bp: number, bn: number) => { this.s.mv(this.path(a, ap, an), this.path(b, bp, bn)); return 0; }),
      path_link: safe((a: number, _af: number, ap: number, an: number, b: number, bp: number, bn: number) => { this.s.link(this.path(a, ap, an), this.path(b, bp, bn)); return 0; }),
      path_symlink: safe((a: number, an: number, fd: number, p: number, n: number) => { this.s.symlink(this.str(a, an), this.path(fd, p, n)); return 0; }),
      path_readlink: safe((fd: number, p: number, n: number, b: number, z: number, used: number) => this.readlink(fd, p, n, b, z, used)),
      path_filestat_get: safe((fd: number, _fl: number, p: number, n: number, out: number) => this.filestat(this.path(fd, p, n), out)),
      path_filestat_set_times: safe((fd: number, _lf: number, p: number, n: number, at: bigint, mt: bigint, fl: number) => this.setTimes(this.path(fd, p, n), at, mt, fl)),
      random_get: safe((p: number, n: number) => { this.random(p, n); return 0; }),
      clock_time_get: safe((_id: number, _pre: bigint, p: number) => { this.dv().setBigUint64(p, BigInt(Date.now()) * 1_000_000n, true); return 0; }),
      clock_res_get: safe((_id: number, p: number) => { this.dv().setBigUint64(p, 1_000_000n, true); return 0; }),
      sched_yield: safe(() => 0),
      poll_oneoff: safe((a: number, b: number, n: number, out: number) => this.poll(a, b, n, out)),
      proc_raise: safe((n: number) => { this.s.kill(this.s.pid, n === 2 ? 2 : 15); return 0; }),
      proc_exit: (n: number): never => { throw new WExit(n); },
      sock_accept: safe((_fd: number, _fl: number, _out: number) => 58),
      sock_recv: safe((_fd: number, _ri: number, _n: number, _fl: number, _got: number, _rof: number) => 58),
      sock_send: safe((_fd: number, _si: number, _n: number, _fl: number, _got: number) => 58),
      sock_shutdown: safe((_fd: number, _how: number) => 58),
    };

    const thistle = {
      write: (fd: number, p: number, n: number): number => this.rawWrite(fd, this.buf(p, n)),
      read: (fd: number, p: number, n: number): number => this.rawRead(fd, p, n),
      exit: (n: number): never => { throw new WExit(n); },
      getpid: (): number => this.s.pid,
      now: (): number => Date.now(),
      random: (p: number, n: number): number => { this.random(p, n); return n; },
    };
    return { wasi_snapshot_preview1: wasi, wasi_unstable: wasi, thistle };
  }

  private u8(): Uint8Array {
    if (!this.mem) throw new KErr("EIO", "WASM memory is not ready");
    return new Uint8Array(this.mem.buffer);
  }

  private dv(): DataView {
    if (!this.mem) throw new KErr("EIO", "WASM memory is not ready");
    return new DataView(this.mem.buffer);
  }

  private buf(p: number, n: number): Uint8Array {
    if (p < 0 || n < 0 || p + n > this.u8().length) throw new KErr("ERANGE", "WASM memory access");
    return this.u8().slice(p, p + n);
  }

  private str(p: number, n: number): string { return dec(this.buf(p, n)); }

  private sizes(a: string[], np: number, bp: number): number {
    this.dv().setUint32(np, a.length, true);
    this.dv().setUint32(bp, a.reduce((n, x) => n + enc(x).length + 1, 0), true);
    return 0;
  }

  private putv(a: string[], vp: number, bp: number): number {
    const m = this.u8();
    let at = bp;
    for (let i = 0; i < a.length; i++) {
      const b = enc(a[i]!);
      this.dv().setUint32(vp + i * 4, at, true);
      m.set(b, at);
      m[at + b.length] = 0;
      at += b.length + 1;
    }
    return 0;
  }

  private rawWrite(fd: number, b: Uint8Array): number {
    if (fd === 1) this.out.push(b.slice());
    else if (fd === 2) this.err.push(b.slice());
    else {
      const f = this.file(fd);
      if (f.sys === undefined) throw new KErr("EBADF", String(fd));
      this.s.fdw(f.sys, b);
    }
    return b.length;
  }

  private rawRead(fd: number, p: number, n: number): number {
    let b: Uint8Array;
    if (fd === 0) {
      b = this.sin.slice(this.ip, this.ip + n);
      this.ip += b.length;
    } else {
      const f = this.file(fd);
      if (f.sys === undefined) throw new KErr("EBADF", String(fd));
      b = this.s.fdr(f.sys, n);
    }
    this.u8().set(b, p);
    return b.length;
  }

  private fdWrite(fd: number, p: number, n: number, nw: number): number {
    let z = 0;
    for (let i = 0; i < n; i++) {
      const at = p + i * 8;
      z += this.rawWrite(fd, this.buf(this.dv().getUint32(at, true), this.dv().getUint32(at + 4, true)));
    }
    this.dv().setUint32(nw, z, true);
    return 0;
  }

  private fdRead(fd: number, p: number, n: number, nr: number): number {
    let z = 0;
    for (let i = 0; i < n; i++) {
      const at = p + i * 8;
      const dst = this.dv().getUint32(at, true);
      const len = this.dv().getUint32(at + 4, true);
      const got = this.rawRead(fd, dst, len);
      z += got;
      if (got < len) break;
    }
    this.dv().setUint32(nr, z, true);
    return 0;
  }

  private fdPread(fd: number, p: number, n: number, off: bigint, nr: number): number {
    const f = this.file(fd);
    if (f.sys === undefined) throw new KErr("EBADF", String(fd));
    const old = this.s.seek(f.sys, 0, 1);
    try { this.s.seek(f.sys, Number(off), 0); return this.fdRead(fd, p, n, nr); }
    finally { this.s.seek(f.sys, old, 0); }
  }

  private fdPwrite(fd: number, p: number, n: number, off: bigint, nw: number): number {
    const f = this.file(fd);
    if (f.sys === undefined) throw new KErr("EBADF", String(fd));
    const old = this.s.seek(f.sys, 0, 1);
    try { this.s.seek(f.sys, Number(off), 0); return this.fdWrite(fd, p, n, nw); }
    finally { this.s.seek(f.sys, old, 0); }
  }

  private file(fd: number): Wfd {
    const f = this.fds.get(fd);
    if (!f) throw new KErr("EBADF", String(fd));
    return f;
  }

  private fdClose(fd: number): number {
    const f = this.file(fd);
    if (fd < 5) throw new KErr("EBADF", String(fd));
    if (f.sys !== undefined) this.s.close(f.sys);
    this.fds.delete(fd);
    return 0;
  }

  private renumber(a: number, b: number): number {
    if (a < 5 || b < 5) throw new KErr("ENOTSUP", "renumbering standard descriptors");
    const f = this.file(a);
    const old = this.fds.get(b);
    if (old?.sys !== undefined) this.s.close(old.sys);
    this.fds.set(b, f);
    this.fds.delete(a);
    return 0;
  }

  private fdSeek(fd: number, off: bigint, wh: number, p: number): number {
    const f = this.file(fd);
    if (f.sys === undefined) throw new KErr("EBADF", String(fd));
    const n = this.s.seek(f.sys, Number(off), wh);
    this.dv().setBigUint64(p, BigInt(n), true);
    return 0;
  }

  private path(fd: number, p: number, n: number): string {
    const f = this.file(fd);
    if (!f.dir) throw new KErr("ENOTDIR", String(fd));
    return norm(this.str(p, n), f.path);
  }

  private pathOpen(fd: number, p: number, n: number, of: number, rights: bigint, ff: number, out: number): number {
    const path = this.path(fd, p, n);
    const wantDir = !!(of & 2);
    if (wantDir) {
      const st = this.s.stat(path);
      if (st.kind !== "dir") throw new KErr("ENOTDIR", path);
      const w = this.nfd++;
      this.fds.set(w, { path, dir: true });
      this.dv().setUint32(out, w, true);
      return 0;
    }
    const wr = !!(rights & 64n) || !!(rights & 1n << 6n);
    const rd = !!(rights & 2n) || !wr;
    const fl = ff & 1 ? "a+" : of & 8 ? "w+" : of & 1 ? "a+" : rd && wr ? "r+" : wr ? "w" : "r";
    if ((of & 4) && this.exists(path)) throw new KErr("EEXIST", path);
    const sys = this.s.open(path, fl);
    const w = this.nfd++;
    this.fds.set(w, { path, sys });
    this.dv().setUint32(out, w, true);
    return 0;
  }

  private exists(path: string): boolean { try { this.s.stat(path); return true; } catch { return false; } }

  private type(path: string): number {
    const k = this.s.stat(path, false).kind;
    return k === "dir" ? 3 : k === "link" ? 7 : k === "char" ? 2 : 4;
  }

  private fdstat(fd: number, p: number): number {
    const d = this.dv();
    const type = fd <= 2 ? 2 : this.type(this.file(fd).path);
    d.setUint8(p, type);
    d.setUint16(p + 2, 0, true);
    d.setBigUint64(p + 8, 0xffffffffffffffffn, true);
    d.setBigUint64(p + 16, 0xffffffffffffffffn, true);
    return 0;
  }

  private setFlags(fd: number, fl: number): number {
    if (fd <= 2) return 0;
    const f = this.file(fd);
    if (f.sys === undefined) return 0;
    const x = this.s.p.fds.get(f.sys) ?? (() => { throw new KErr("EBADF", String(fd)); })();
    x.add = !!(fl & 1);
    return 0;
  }

  private filestat(path: string, p: number): number {
    const s = this.s.stat(path, false);
    const d = this.dv();
    d.setBigUint64(p, 1n, true);
    d.setBigUint64(p + 8, BigInt(s.ino), true);
    d.setUint8(p + 16, this.type(path));
    d.setBigUint64(p + 24, BigInt(s.nlink), true);
    d.setBigUint64(p + 32, BigInt(s.size), true);
    d.setBigUint64(p + 40, BigInt(s.at) * 1_000_000n, true);
    d.setBigUint64(p + 48, BigInt(s.mt) * 1_000_000n, true);
    d.setBigUint64(p + 56, BigInt(s.ct) * 1_000_000n, true);
    return 0;
  }

  private stdstat(fd: number, p: number): number {
    const d = this.dv();
    d.setBigUint64(p, 1n, true);
    d.setBigUint64(p + 8, BigInt(fd + 1), true);
    d.setUint8(p + 16, 2);
    d.setBigUint64(p + 24, 1n, true);
    d.setBigUint64(p + 32, 0n, true);
    const t = BigInt(Date.now()) * 1_000_000n;
    d.setBigUint64(p + 40, t, true); d.setBigUint64(p + 48, t, true); d.setBigUint64(p + 56, t, true);
    return 0;
  }

  private prestat(fd: number, p: number): number {
    const f = this.file(fd);
    if (!f.dir || fd > 4) throw new KErr("EBADF", String(fd));
    this.dv().setUint8(p, 0);
    this.dv().setUint32(p + 4, enc(f.path).length, true);
    return 0;
  }

  private prename(fd: number, p: number, n: number): number {
    const f = this.file(fd);
    if (!f.dir || fd > 4) throw new KErr("EBADF", String(fd));
    const b = enc(f.path).slice(0, n);
    this.u8().set(b, p);
    return 0;
  }

  private readdir(fd: number, p: number, n: number, cookie: bigint, used: number): number {
    const f = this.file(fd);
    if (!f.dir) throw new KErr("ENOTDIR", f.path);
    const a = [[".", f.path], ["..", norm("..", f.path)], ...this.s.list(f.path).map(([x]) => [x, norm(x, f.path)])] as Array<[string, string]>;
    let at = 0;
    for (let i = Number(cookie); i < a.length; i++) {
      const [name, path] = a[i]!;
      const b = enc(name);
      if (at + 24 + b.length > n) break;
      const q = p + at;
      const d = this.dv();
      d.setBigUint64(q, BigInt(i + 1), true);
      d.setBigUint64(q + 8, BigInt(this.s.stat(path, false).ino), true);
      d.setUint32(q + 16, b.length, true);
      d.setUint8(q + 20, this.type(path));
      this.u8().set(b, q + 24);
      at += 24 + b.length;
    }
    this.dv().setUint32(used, at, true);
    return 0;
  }

  private readlink(fd: number, p: number, n: number, b: number, z: number, used: number): number {
    const x = enc(this.s.readlink(this.path(fd, p, n))).slice(0, z);
    this.u8().set(x, b);
    this.dv().setUint32(used, x.length, true);
    return 0;
  }

  private resize(fd: number, n: bigint): number {
    const f = this.file(fd);
    if (f.sys === undefined) throw new KErr("EBADF", String(fd));
    const old = this.s.readb(f.path);
    const b = new Uint8Array(Number(n));
    b.set(old.slice(0, b.length));
    this.s.writeb(f.path, b);
    return 0;
  }

  private setTimes(path: string, at: bigint, mt: bigint, fl: number): number {
    const st = this.s.stat(path, false), now = Date.now();
    const a = fl & 2 ? now : fl & 1 ? Number(at / 1_000_000n) : st.at;
    const m = fl & 8 ? now : fl & 4 ? Number(mt / 1_000_000n) : st.mt;
    this.s.utime(path, a, m);
    return 0;
  }

  private poll(inp: number, out: number, n: number, ne: number): number {
    const ev: Array<{ user: bigint; type: number; err: number; bytes: bigint }> = [];
    let wait = 0;
    for (let i = 0; i < n; i++) {
      const p = inp + i * 48, user = this.dv().getBigUint64(p, true), type = this.dv().getUint8(p + 8);
      if (type === 0) {
        const ns = this.dv().getBigUint64(p + 24, true), abs = !!(this.dv().getUint16(p + 40, true) & 1);
        const ms = Number(ns / 1_000_000n);
        wait = Math.max(wait, abs ? ms - Date.now() : ms);
        ev.push({ user, type, err: 0, bytes: 0n });
      } else if (type === 1 || type === 2) {
        const fd = this.dv().getUint32(p + 16, true);
        let bytes = 0n;
        try {
          if (fd === 0) bytes = BigInt(this.sin.length - this.ip);
          else if (fd > 2) { const f = this.file(fd); bytes = BigInt(Math.max(0, this.s.stat(f.path).size - (f.sys === undefined ? 0 : this.s.p.fds.get(f.sys)?.pos ?? 0))); }
          ev.push({ user, type, err: 0, bytes });
        } catch (e) { ev.push({ user, type, err: eno(e), bytes: 0n }); }
      } else ev.push({ user, type, err: 28, bytes: 0n });
    }
    if (wait > 0 && !ev.some(x => x.type !== 0 && x.err === 0)) {
      const end = performance.now() + wait;
      while (performance.now() < end) { /* WASI Preview 1 is synchronous. Yep, even here. */ }
    }
    for (let i = 0; i < ev.length; i++) {
      const p = out + i * 32, x = ev[i]!;
      this.dv().setBigUint64(p, x.user, true);
      this.dv().setUint16(p + 8, x.err, true);
      this.dv().setUint8(p + 10, x.type);
      this.dv().setBigUint64(p + 16, x.bytes, true);
      this.dv().setUint16(p + 24, 0, true);
    }
    this.dv().setUint32(ne, ev.length, true);
    return 0;
  }

  private alloc(fd: number, off: bigint, len: bigint): number {
    const f = this.file(fd);
    const need = Number(off + len);
    if (this.s.stat(f.path).size < need) this.resize(fd, BigInt(need));
    return 0;
  }

  private random(p: number, n: number): void {
    const b = this.u8().subarray(p, p + n);
    for (let at = 0; at < b.length; at += 65536) crypto.getRandomValues(b.subarray(at, Math.min(at + 65536, b.length)));
  }
}
