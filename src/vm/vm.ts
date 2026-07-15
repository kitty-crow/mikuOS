import { bad, KErr } from "../core/err.js";
import type { Errno } from "../core/err.js";
import type { Sig } from "../core/proc.js";
import type { Sys } from "../core/sys.js";
import { enc } from "../io/stream.js";
import { Exe } from "../asm/fmt.js";
import { BY_OP, I_SZ, Op } from "../asm/isa.js";
import { align } from "../asm/syn.js";

export enum Sc {
  Exit, Read, Write, Open, Close, Seek, Unlink, Mkdir, GetPid, GetPPid,
  Brk, Clock, Yield, Stat, GetCwd, Chdir, Rmdir, Rename, Chmod, Random,
  Spawn, Wait, Kill, Sleep, GetUid, GetGid, Dup, Link, Symlink, Readlink, Truncate,
}

const eno: Record<Errno, number> = {
  EACCES: 2, EAGAIN: 6, EBADF: 8, EBUSY: 10, ECHILD: 12, EEXIST: 20,
  EFAULT: 21, EFBIG: 22, EINTR: 27, EINVAL: 28, EIO: 29, EISDIR: 31, ELOOP: 32, EMFILE: 33,
  ENAMETOOLONG: 37, ENFILE: 41, ENOENT: 44, ENOEXEC: 45, ENOMEM: 48,
  ENETUNREACH: 46, ENOSPC: 51, ENOSYS: 52, ENOTDIR: 54, ENOTEMPTY: 55, ENOTSUP: 58,
  EPERM: 63, EPIPE: 64, EPROTO: 65, ERANGE: 68, EROFS: 69, ESRCH: 71, ETIMEDOUT: 73,
};

const O_WRONLY = 1, O_RDWR = 2, O_CREAT = 0x40, O_EXCL = 0x80, O_TRUNC = 0x200, O_APPEND = 0x400;

export class Vm {
  readonly r = new Int32Array(16);
  private m!: Uint8Array;
  private v!: DataView;
  private pc = 0;
  private z = false;
  private n = false;
  private c = false;
  private o = false;
  private done = false;
  private code = 0;
  private brk = 0;
  private floor = 0;
  private stackAt = 0;
  private sin: Uint8Array<ArrayBufferLike> = new Uint8Array();
  private ip = 0;
  private exe!: Exe;

  constructor(private readonly s: Sys) {}

  async run(exe: Exe, argv: string[]): Promise<number> {
    this.exe = exe;
    if (exe.mem < 1024 * 1024 || exe.mem > 256 * 1024 * 1024) bad("ENOEXEC", "native memory size is outside ABI limits");
    this.m = new Uint8Array(exe.mem); this.v = new DataView(this.m.buffer);
    const seen: Array<{ at: number; end: number; name: string }> = [];
    for (const q of exe.sec) {
      if (q.addr < 0x1000 || q.addr % q.align || q.addr + q.size > this.m.length || q.data.length > q.size) bad("ENOEXEC", `section ${q.name} has an invalid mapping`);
      if (seen.some(x => q.addr < x.end && q.addr + q.size > x.at)) bad("ENOEXEC", `section ${q.name} overlaps another section`);
      seen.push({ at: q.addr, end: q.addr + q.size, name: q.name });
      this.m.set(q.data, q.addr);
      this.floor = Math.max(this.floor, q.addr + q.size);
    }
    this.brk = align(this.floor, 16); this.pc = exe.entry >>> 0;
    this.stack(argv);
    let tick = 0, fuel = 100_000_000;
    while (!this.done) {
      if (--fuel < 0) bad("ELOOP", "native instruction limit reached");
      this.s.chk();
      await this.step();
      if (++tick === 4096) { tick = 0; await this.s.yield(); }
    }
    return this.code & 0xff;
  }

  private async step(): Promise<void> {
    this.exec(this.pc, I_SZ);
    const op = this.m[this.pc]! as Op;
    if (!BY_OP.has(op)) bad("ENOEXEC", `bad thistle32 opcode ${op} at 0x${this.pc.toString(16)}`);
    const d = this.m[this.pc + 1]!, a = this.m[this.pc + 2]!, b = this.m[this.pc + 3]!, im = this.v.getInt32(this.pc + 4, true);
    if (d > 15 || a > 15 || b > 15) bad("ENOEXEC", `bad register at 0x${this.pc.toString(16)}`);
    this.pc = this.pc + I_SZ >>> 0;
    const x = this.r[a]!, y = this.r[b]!;
    switch (op) {
      case Op.Nop: break;
      case Op.Halt: this.exit(this.r[0]!); break;
      case Op.Mov: this.r[d] = x; break;
      case Op.Li: this.r[d] = im; break;
      case Op.Add: this.r[d] = x + y | 0; break;
      case Op.AddI: this.r[d] = x + im | 0; break;
      case Op.Sub: this.r[d] = x - y | 0; break;
      case Op.SubI: this.r[d] = x - im | 0; break;
      case Op.Mul: this.r[d] = Math.imul(x, y); break;
      case Op.MulI: this.r[d] = Math.imul(x, im); break;
      case Op.Div: if (!y) bad("EINVAL", "integer division by zero"); this.r[d] = x / y | 0; break;
      case Op.DivU: if (!y) bad("EINVAL", "integer division by zero"); this.r[d] = (x >>> 0) / (y >>> 0) | 0; break;
      case Op.Mod: if (!y) bad("EINVAL", "integer division by zero"); this.r[d] = x % y; break;
      case Op.ModU: if (!y) bad("EINVAL", "integer division by zero"); this.r[d] = (x >>> 0) % (y >>> 0); break;
      case Op.And: this.r[d] = x & y; break;
      case Op.AndI: this.r[d] = x & im; break;
      case Op.Or: this.r[d] = x | y; break;
      case Op.OrI: this.r[d] = x | im; break;
      case Op.Xor: this.r[d] = x ^ y; break;
      case Op.XorI: this.r[d] = x ^ im; break;
      case Op.Not: this.r[d] = ~x; break;
      case Op.Neg: this.r[d] = -x | 0; break;
      case Op.Shl: this.r[d] = x << (y & 31); break;
      case Op.ShlI: this.r[d] = x << (im & 31); break;
      case Op.Shr: this.r[d] = x >>> (y & 31); break;
      case Op.ShrI: this.r[d] = x >>> (im & 31); break;
      case Op.Sar: this.r[d] = x >> (y & 31); break;
      case Op.SarI: this.r[d] = x >> (im & 31); break;
      case Op.Cmp: this.cmp(x, y); break;
      case Op.CmpI: this.cmp(x, im); break;
      case Op.Test: this.logic(x & y); break;
      case Op.Jmp: this.jump(im); break;
      case Op.Je: if (this.z) this.jump(im); break;
      case Op.Jne: if (!this.z) this.jump(im); break;
      case Op.Jl: if (this.n !== this.o) this.jump(im); break;
      case Op.Jle: if (this.z || this.n !== this.o) this.jump(im); break;
      case Op.Jg: if (!this.z && this.n === this.o) this.jump(im); break;
      case Op.Jge: if (this.n === this.o) this.jump(im); break;
      case Op.Jb: if (!this.c) this.jump(im); break;
      case Op.Jbe: if (!this.c || this.z) this.jump(im); break;
      case Op.Ja: if (this.c && !this.z) this.jump(im); break;
      case Op.Jae: if (this.c) this.jump(im); break;
      case Op.Call: this.push(this.pc); this.jump(im); break;
      case Op.CallR: this.push(this.pc); this.pc = this.r[d]! >>> 0; break;
      case Op.Ret: { const q = this.pop(); if (!q) this.exit(this.r[0]!); else this.pc = q >>> 0; break; }
      case Op.Push: this.push(this.r[d]!); break;
      case Op.Pop: this.r[d] = this.pop(); break;
      case Op.Enter: this.push(this.r[13]!); this.r[13] = this.r[14]!; this.r[14] = this.r[14]! - im | 0; this.mem(this.r[14]! >>> 0, im, true); break;
      case Op.Leave: this.r[14] = this.r[13]!; this.r[13] = this.pop(); break;
      case Op.Ld8U: this.r[d] = this.u8(x + im >>> 0); break;
      case Op.Ld8S: this.r[d] = this.u8(x + im >>> 0) << 24 >> 24; break;
      case Op.Ld16U: this.r[d] = this.u16(x + im >>> 0); break;
      case Op.Ld16S: this.r[d] = this.u16(x + im >>> 0) << 16 >> 16; break;
      case Op.Ld32: this.r[d] = this.u32(x + im >>> 0); break;
      case Op.St8: this.set8(x + im >>> 0, this.r[d]!); break;
      case Op.St16: this.set16(x + im >>> 0, this.r[d]!); break;
      case Op.St32: this.set32(x + im >>> 0, this.r[d]!); break;
      case Op.Sys: await this.sys(im); break;
      case Op.Xchg: { const q = this.r[d]!; this.r[d] = x; this.r[a] = q; break; }
      case Op.Sex8: this.r[d] = x << 24 >> 24; break;
      case Op.Sex16: this.r[d] = x << 16 >> 16; break;
      case Op.SetE: this.r[d] = Number(this.z); break;
      case Op.SetNe: this.r[d] = Number(!this.z); break;
      case Op.SetL: this.r[d] = Number(this.n !== this.o); break;
      case Op.SetLe: this.r[d] = Number(this.z || this.n !== this.o); break;
      case Op.SetG: this.r[d] = Number(!this.z && this.n === this.o); break;
      case Op.SetGe: this.r[d] = Number(this.n === this.o); break;
      case Op.SetB: this.r[d] = Number(!this.c); break;
      case Op.SetBe: this.r[d] = Number(!this.c || this.z); break;
      case Op.SetA: this.r[d] = Number(this.c && !this.z); break;
      case Op.SetAe: this.r[d] = Number(this.c); break;
    }
  }

  private async sys(n: number): Promise<void> {
    try { this.r[0] = await this.call(n) | 0; }
    catch (e) { if (e instanceof KErr) this.r[0] = -(eno[e.code] ?? 29); else throw e; }
  }

  private async call(n: number): Promise<number> {
    const a = this.r;
    switch (n) {
      case Sc.Exit: this.exit(a[0]!); return 0;
      case Sc.Read: { const at = a[1]! >>> 0, n = a[2]! >>> 0; this.mem(at, n, true); const b = await this.read(a[0]!, n); this.slice(at, b.length, true).set(b); return b.length; }
      case Sc.Write: { const b = this.slice(a[1]! >>> 0, a[2]! >>> 0); return a[0] === 1 ? this.s.out(b) : a[0] === 2 ? this.s.err(b) : this.s.fdw(a[0]!, b); }
      case Sc.Open: return this.open(this.str(a[0]!), a[1]! >>> 0, a[2]! >>> 0);
      case Sc.Close: this.s.close(a[0]!); return 0;
      case Sc.Seek: if (![0, 1, 2].includes(a[2]!)) bad("EINVAL", `seek whence ${a[2]}`); return this.s.seek(a[0]!, a[1]!, a[2]!);
      case Sc.Unlink: this.s.rm(this.str(a[0]!)); return 0;
      case Sc.Mkdir: this.s.mkdir(this.str(a[0]!), a[1]!); return 0;
      case Sc.GetPid: return this.s.pid;
      case Sc.GetPPid: return this.s.ppid;
      case Sc.Brk: return this.doBrk(a[0]! >>> 0);
      case Sc.Clock: return Date.now() | 0;
      case Sc.Yield: await this.s.yield(); return 0;
      case Sc.Stat: return this.stat(this.str(a[0]!), a[1]! >>> 0);
      case Sc.GetCwd: return this.copy(enc(this.s.cwd + "\0"), a[0]! >>> 0, a[1]! >>> 0);
      case Sc.Chdir: this.s.cd(this.str(a[0]!)); return 0;
      case Sc.Rmdir: this.s.rm(this.str(a[0]!), true); return 0;
      case Sc.Rename: this.s.mv(this.str(a[0]!), this.str(a[1]!)); return 0;
      case Sc.Chmod: this.s.chmod(this.str(a[0]!), a[1]!); return 0;
      case Sc.Random: return this.random(a[0]! >>> 0, a[1]! >>> 0);
      case Sc.Spawn: { const p = this.str(a[0]!), av = this.vec(a[1]! >>> 0, a[2]! >>> 0); return this.s.start(p, av).pid; }
      case Sc.Wait: return this.s.wait(a[0]!);
      case Sc.Kill: { const q = a[1]!; if (![1, 2, 9, 13, 15].includes(q)) bad("EINVAL", `signal ${q}`); return this.s.kill(a[0]!, q as Sig); }
      case Sc.Sleep: await this.s.sleep(a[0]! >>> 0); return 0;
      case Sc.GetUid: return this.s.uid;
      case Sc.GetGid: return this.s.gid;
      case Sc.Dup: return this.s.dup(a[0]!, a[1]! < 0 ? undefined : a[1]!);
      case Sc.Link: this.s.link(this.str(a[0]!), this.str(a[1]!)); return 0;
      case Sc.Symlink: this.s.symlink(this.str(a[0]!), this.str(a[1]!)); return 0;
      case Sc.Readlink: return this.copy(enc(this.s.readlink(this.str(a[0]!))), a[1]! >>> 0, a[2]! >>> 0);
      case Sc.Truncate: { const p = this.str(a[0]!), z = a[1]! >>> 0; if (z > this.s.k.fs.cap) bad("EFBIG", p); const b = this.s.readb(p), q = new Uint8Array(z); q.set(b.subarray(0, z)); this.s.writeb(p, q); return 0; }
      default: return bad("ENOSYS", `native syscall ${n}`);
    }
  }

  private async read(fd: number, n: number): Promise<Uint8Array> {
    if (fd !== 0) return this.s.fdr(fd, n);
    if (this.ip >= this.sin.length) { this.sin = await (this.s.p.fds.get(0)?.input ?? bad("EBADF", "stdin")).rd(); this.ip = 0; }
    const b = this.sin.slice(this.ip, this.ip + n); this.ip += b.length; return b;
  }

  private open(p: string, fl: number, mode: number): number {
    if ((fl & 3) === 3) bad("EINVAL", "invalid open access mode");
    let made = false;
    try { this.s.stat(p); if (fl & O_CREAT && fl & O_EXCL) bad("EEXIST", p); }
    catch (e) {
      if (!(e instanceof KErr) || e.code !== "ENOENT" || !(fl & O_CREAT)) throw e;
      this.s.mkfile(p, new Uint8Array(), mode || 0o666); made = true;
    }
    const ac = fl & 3, plus = ac === O_RDWR, wr = ac === O_WRONLY || plus;
    if (!made && fl & O_TRUNC && wr) this.s.writeb(p, new Uint8Array());
    const kind = fl & O_APPEND ? plus ? "a+" : "a" : plus ? fl & O_TRUNC ? "w+" : "r+" : wr ? fl & O_TRUNC ? "w" : "ow" : "r";
    return this.s.open(p, kind, mode || 0o666);
  }

  private stat(p: string, at: number): number {
    const q = this.s.stat(p), b = this.slice(at, 56, true), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    v.setUint32(0, q.ino, true); v.setUint32(4, q.mode, true); v.setUint32(8, q.uid, true); v.setUint32(12, q.gid, true);
    v.setUint32(16, q.nlink, true); v.setUint32(20, q.size, true); v.setUint32(24, q.kind === "file" ? 1 : q.kind === "dir" ? 2 : q.kind === "link" ? 3 : 4, true);
    v.setBigUint64(32, BigInt(Math.trunc(q.at)), true); v.setBigUint64(40, BigInt(Math.trunc(q.mt)), true); v.setBigUint64(48, BigInt(Math.trunc(q.ct)), true); return 0;
  }

  private doBrk(n: number): number {
    if (!n) return this.brk;
    if (n < this.floor || n + 65536 >= (this.r[14]! >>> 0)) bad("ENOMEM", "native heap collided with stack");
    this.brk = n; return n;
  }

  private random(at: number, n: number): number {
    const b = this.slice(at, n, true);
    for (let i = 0; i < b.length; i += 65536) crypto.getRandomValues(b.subarray(i, Math.min(i + 65536, b.length)));
    return n;
  }

  private copy(b: Uint8Array, at: number, n: number): number {
    if (b.length > n) bad("ERANGE", "native output buffer is too small"); this.slice(at, b.length, true).set(b); return b.length;
  }

  private vec(at: number, n: number): string[] {
    if (n > 4096) bad("EFBIG", "native argument vector is too large");
    const out: string[] = []; for (let i = 0; i < n; i++) out.push(this.str(this.u32(at + i * 4))); return out;
  }

  private stack(argv: string[]): void {
    const env = [...(this.s.env() as Map<string, string>)].map(([k, v]) => `${k}=${v}`);
    let sp = this.m.length - 16;
    this.stackAt = Math.max(this.floor + 65536, this.m.length - Math.min(4 * 1024 * 1024, this.m.length >>> 2));
    const put = (a: string[]): number[] => a.map(x => { const b = enc(x + "\0"); sp -= b.length; if (sp < this.stackAt) bad("EFBIG", "native argument block exceeds the stack"); this.m.set(b, sp); return sp; });
    const ep = put(env), ap = put(argv); sp &= -4;
    const vec = (a: number[]): number => { sp -= (a.length + 1) * 4; for (let i = 0; i < a.length; i++) this.v.setUint32(sp + i * 4, a[i]!, true); this.v.setUint32(sp + a.length * 4, 0, true); return sp; };
    const ev = vec(ep), av = vec(ap); sp -= 4; this.v.setUint32(sp, 0, true);
    if (sp < this.stackAt || sp < this.brk + 65536) bad("ENOMEM", "arguments leave no native stack");
    this.r[0] = argv.length; this.r[1] = av; this.r[2] = env.length; this.r[3] = ev; this.r[13] = 0; this.r[14] = sp; this.r[15] = 0;
  }

  private cmp(a: number, b: number): void {
    const r = a - b | 0; this.z = r === 0; this.n = r < 0; this.c = (a >>> 0) >= (b >>> 0); this.o = !!((a ^ b) & (a ^ r) & 0x80000000);
  }

  private logic(n: number): void { this.z = n === 0; this.n = n < 0; this.c = false; this.o = false; }
  private jump(n: number): void { this.pc = this.pc + n >>> 0; }
  private exit(n: number): void { this.code = n; this.done = true; }
  private push(n: number): void { const sp = (this.r[14]! - 4) >>> 0; this.set32(sp, n); this.r[14] = sp; }
  private pop(): number { const sp = this.r[14]! >>> 0, n = this.u32(sp); this.r[14] = sp + 4 | 0; return n; }

  private exec(at: number, n: number): void {
    const q = this.exe.sec.find(x => x.flg.includes("x") && at >= x.addr && at + n <= x.addr + x.size);
    if (!q) bad("EACCES", `execute at 0x${at.toString(16)}`);
  }

  private mem(at: number, n: number, wr = false): void {
    if (!Number.isSafeInteger(at) || !Number.isSafeInteger(n) || n < 0 || at + n > this.m.length) bad("ERANGE", `native memory access at 0x${at.toString(16)}`);
    if (!n) return;
    const q = this.exe.sec.find(x => at >= x.addr && at + n <= x.addr + x.size);
    const mapped = !!q || at >= this.floor && at + n <= this.brk || at >= Math.max(this.stackAt, this.brk + 65536);
    if (!mapped) bad("ERANGE", `unmapped native memory at 0x${at.toString(16)}`);
    if (wr && q && !q.flg.includes("w")) bad("EACCES", `write to ${q.name}`);
  }

  private slice(at: number, n: number, wr = false): Uint8Array { this.mem(at, n, wr); return this.m.subarray(at, at + n); }
  private u8(at: number): number { this.mem(at, 1); return this.m[at]!; }
  private u16(at: number): number { this.mem(at, 2); return this.v.getUint16(at, true); }
  private u32(at: number): number { this.mem(at, 4); return this.v.getInt32(at, true); }
  private set8(at: number, n: number): void { this.mem(at, 1, true); this.m[at] = n; }
  private set16(at: number, n: number): void { this.mem(at, 2, true); this.v.setUint16(at, n, true); }
  private set32(at: number, n: number): void { this.mem(at, 4, true); this.v.setInt32(at, n, true); }

  private str(at: number): string {
    this.mem(at, 1); let end = at;
    while (end < this.m.length && this.m[end] && end - at < 4096) end++;
    if (end === this.m.length || end - at >= 4096) bad("ENAMETOOLONG", "native string");
    return new TextDecoder().decode(this.m.subarray(at, end));
  }
}
