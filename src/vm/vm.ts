import { NativeIo } from "./io.js";
import { withValue } from "../core/err.js";
import { requireValue } from "../core/err.js";
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


export class Vm {
  readonly r = new Int32Array(16);
  private memoryState: Uint8Array | null = null;
  private get m(): Uint8Array { return requireValue(this.memoryState, "m before VM initialisation"); }
  private set m(value: Uint8Array) { this.memoryState = value; }
  private vState: DataView | null = null;
  private get v(): DataView { return requireValue(this.vState, "v before VM initialisation"); }
  private set v(value: DataView) { this.vState = value; }
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
  private executableState: Exe | null = null;
  private get exe(): Exe { return requireValue(this.executableState, "exe before VM initialisation"); }
  private set exe(value: Exe) { this.executableState = value; }

  private readonly io: NativeIo;
  constructor(private readonly s: Sys) { this.io = new NativeIo(s); }

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

  // One instruction step commits its register, flag and memory effects in ABI order.
  //@cg-expect-warning
  private async step(): Promise<void> {
    this.exec(this.pc, I_SZ);
    const op = requireValue(this.m[this.pc] ?? null, "src/vm/vm.ts:72") as Op;
    if (!BY_OP.has(op)) bad("ENOEXEC", `bad thistle32 opcode ${op} at 0x${this.pc.toString(16)}`);
    const d = requireValue(this.m[this.pc + 1] ?? null, "src/vm/vm.ts:74"), a = requireValue(this.m[this.pc + 2] ?? null, "src/vm/vm.ts:74"), b = requireValue(this.m[this.pc + 3] ?? null, "src/vm/vm.ts:74"), im = this.v.getInt32(this.pc + 4, true);
    if (d > 15 || a > 15 || b > 15) bad("ENOEXEC", `bad register at 0x${this.pc.toString(16)}`);
    this.pc = this.pc + I_SZ >>> 0;
    const x = requireValue(this.r[a] ?? null, "src/vm/vm.ts:77"), y = requireValue(this.r[b] ?? null, "src/vm/vm.ts:77");
    switch (op) {
      case Op.Nop: break;
      case Op.Halt: this.exit(requireValue(this.r[0] ?? null, "src/vm/vm.ts:80")); break;
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
      case Op.CallR: this.push(this.pc); this.pc = requireValue(this.r[d] ?? null, "src/vm/vm.ts:122") >>> 0; break;
      case Op.Ret: { const q = this.pop(); if (!q) this.exit(requireValue(this.r[0] ?? null, "src/vm/vm.ts:123")); else this.pc = q >>> 0; break; }
      case Op.Push: this.push(requireValue(this.r[d] ?? null, "src/vm/vm.ts:124")); break;
      case Op.Pop: this.r[d] = this.pop(); break;
      case Op.Enter: this.push(requireValue(this.r[13] ?? null, "src/vm/vm.ts:126")); this.r[13] = requireValue(this.r[14] ?? null, "src/vm/vm.ts:126"); this.r[14] = requireValue(this.r[14] ?? null, "src/vm/vm.ts:126") - im | 0; this.mem(requireValue(this.r[14] ?? null, "src/vm/vm.ts:126") >>> 0, im, true); break;
      case Op.Leave: this.r[14] = requireValue(this.r[13] ?? null, "src/vm/vm.ts:127"); this.r[13] = this.pop(); break;
      case Op.Ld8U: this.r[d] = this.u8(x + im >>> 0); break;
      case Op.Ld8S: this.r[d] = this.u8(x + im >>> 0) << 24 >> 24; break;
      case Op.Ld16U: this.r[d] = this.u16(x + im >>> 0); break;
      case Op.Ld16S: this.r[d] = this.u16(x + im >>> 0) << 16 >> 16; break;
      case Op.Ld32: this.r[d] = this.u32(x + im >>> 0); break;
      case Op.St8: this.set8(x + im >>> 0, requireValue(this.r[d] ?? null, "src/vm/vm.ts:133")); break;
      case Op.St16: this.set16(x + im >>> 0, requireValue(this.r[d] ?? null, "src/vm/vm.ts:134")); break;
      case Op.St32: this.set32(x + im >>> 0, requireValue(this.r[d] ?? null, "src/vm/vm.ts:135")); break;
      case Op.Sys: await this.sys(im); break;
      case Op.Xchg: { const q = requireValue(this.r[d] ?? null, "src/vm/vm.ts:137"); this.r[d] = x; this.r[a] = q; break; }
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
    catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  if (e instanceof KErr) this.r[0] = -(eno[e.code] ?? 29); else throw e; }
  }

  private async call(n: number): Promise<number> {
    // Guest registers carry ABI arguments; validate memory before host I/O and return the scalar syscall result.
    const a = this.r;
    switch (n) {
      case Sc.Exit: this.exit(requireValue(a[0] ?? null, "src/vm/vm.ts:161")); return 0;
      case Sc.Read: { const at = requireValue(a[1] ?? null, "src/vm/vm.ts:162") >>> 0, n = requireValue(a[2] ?? null, "src/vm/vm.ts:162") >>> 0; this.mem(at, n, true); const b = await this.io.read(requireValue(a[0] ?? null, "src/vm/vm.ts:162"), n); this.slice(at, b.length, true).set(b); return b.length; }
      case Sc.Write: { const b = this.slice(requireValue(a[1] ?? null, "src/vm/vm.ts:163") >>> 0, requireValue(a[2] ?? null, "src/vm/vm.ts:163") >>> 0); return (a[0] ?? null) === 1 ? this.s.out(b) : (a[0] ?? null) === 2 ? this.s.err(b) : this.s.fdw(requireValue(a[0] ?? null, "src/vm/vm.ts:163"), b); }
      case Sc.Open: return this.io.open(this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:164")), requireValue(a[1] ?? null, "src/vm/vm.ts:164") >>> 0, requireValue(a[2] ?? null, "src/vm/vm.ts:164") >>> 0);
      case Sc.Close: this.s.close(requireValue(a[0] ?? null, "src/vm/vm.ts:165")); return 0;
      case Sc.Seek: if (![0, 1, 2].includes(requireValue(a[2] ?? null, "src/vm/vm.ts:166"))) bad("EINVAL", `seek whence ${(a[2] ?? null)}`); return this.s.seek(requireValue(a[0] ?? null, "src/vm/vm.ts:166"), requireValue(a[1] ?? null, "src/vm/vm.ts:166"), requireValue(a[2] ?? null, "src/vm/vm.ts:166"));
      case Sc.Unlink: this.s.rm(this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:167"))); return 0;
      case Sc.Mkdir: this.s.mkdir(this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:168")), requireValue(a[1] ?? null, "src/vm/vm.ts:168")); return 0;
      case Sc.GetPid: return this.s.pid;
      case Sc.GetPPid: return this.s.ppid;
      case Sc.Brk: return this.doBrk(requireValue(a[0] ?? null, "src/vm/vm.ts:171") >>> 0);
      case Sc.Clock: return Date.now() | 0;
      case Sc.Yield: await this.s.yield(); return 0;
      case Sc.Stat: return this.stat(this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:174")), requireValue(a[1] ?? null, "src/vm/vm.ts:174") >>> 0);
      case Sc.GetCwd: return this.copy(enc(this.s.cwd + "\0"), requireValue(a[0] ?? null, "src/vm/vm.ts:175") >>> 0, requireValue(a[1] ?? null, "src/vm/vm.ts:175") >>> 0);
      case Sc.Chdir: this.s.cd(this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:176"))); return 0;
      case Sc.Rmdir: this.s.rm(this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:177")), true); return 0;
      case Sc.Rename: this.s.mv(this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:178")), this.str(requireValue(a[1] ?? null, "src/vm/vm.ts:178"))); return 0;
      case Sc.Chmod: this.s.chmod(this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:179")), requireValue(a[1] ?? null, "src/vm/vm.ts:179")); return 0;
      case Sc.Random: return this.random(requireValue(a[0] ?? null, "src/vm/vm.ts:180") >>> 0, requireValue(a[1] ?? null, "src/vm/vm.ts:180") >>> 0);
      case Sc.Spawn: { const p = this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:181")), av = this.vec(requireValue(a[1] ?? null, "src/vm/vm.ts:181") >>> 0, requireValue(a[2] ?? null, "src/vm/vm.ts:181") >>> 0); return this.s.start(p, av).pid; }
      case Sc.Wait: return this.s.wait(requireValue(a[0] ?? null, "src/vm/vm.ts:182"));
      case Sc.Kill: { const q = requireValue(a[1] ?? null, "src/vm/vm.ts:183"); if (![1, 2, 9, 13, 15].includes(q)) bad("EINVAL", `signal ${q}`); return this.s.kill(requireValue(a[0] ?? null, "src/vm/vm.ts:183"), q as Sig); }
      case Sc.Sleep: await this.s.sleep(requireValue(a[0] ?? null, "src/vm/vm.ts:184") >>> 0); return 0;
      case Sc.GetUid: return this.s.uid;
      case Sc.GetGid: return this.s.gid;
      case Sc.Dup: return this.s.dup(requireValue(a[0] ?? null, "src/vm/vm.ts:187"), requireValue(a[1] ?? null, "src/vm/vm.ts:187") < 0 ? null : requireValue(a[1] ?? null, "src/vm/vm.ts:187"));
      case Sc.Link: this.s.link(this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:188")), this.str(requireValue(a[1] ?? null, "src/vm/vm.ts:188"))); return 0;
      case Sc.Symlink: this.s.symlink(this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:189")), this.str(requireValue(a[1] ?? null, "src/vm/vm.ts:189"))); return 0;
      case Sc.Readlink: return this.copy(enc(this.s.readlink(this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:190")))), requireValue(a[1] ?? null, "src/vm/vm.ts:190") >>> 0, requireValue(a[2] ?? null, "src/vm/vm.ts:190") >>> 0);
      case Sc.Truncate: { const p = this.str(requireValue(a[0] ?? null, "src/vm/vm.ts:191")), z = requireValue(a[1] ?? null, "src/vm/vm.ts:191") >>> 0; if (z > this.s.k.fs.cap) bad("EFBIG", p); const b = this.s.readb(p), q = new Uint8Array(z); q.set(b.subarray(0, z)); this.s.writeb(p, q); return 0; }
      default: return bad("ENOSYS", `native syscall ${n}`);
    }
  }





  private stat(p: string, at: number): number {
    const q = this.s.stat(p), b = this.slice(at, 56, true), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    v.setUint32(0, q.ino, true); v.setUint32(4, q.mode, true); v.setUint32(8, q.uid, true); v.setUint32(12, q.gid, true);
    v.setUint32(16, q.nlink, true); v.setUint32(20, q.size, true); v.setUint32(24, q.kind === "file" ? 1 : q.kind === "dir" ? 2 : q.kind === "link" ? 3 : 4, true);
    v.setBigUint64(32, BigInt(Math.trunc(q.at)), true); v.setBigUint64(40, BigInt(Math.trunc(q.mt)), true); v.setBigUint64(48, BigInt(Math.trunc(q.ct)), true); return 0;
  }

  private doBrk(n: number): number {
    if (!n) return this.brk;
    if (n < this.floor || n + 65536 >= (requireValue(this.r[14] ?? null, "src/vm/vm.ts:225") >>> 0)) bad("ENOMEM", "native heap collided with stack");
    this.brk = n; return n;
  }

  private random(at: number, n: number): number {
    const bytes = this.slice(at, n, true);
    for (let offset = 0; offset < bytes.length; offset += 65536) crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65536, bytes.length)));
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
    const env = [...(this.s.env(null) as Map<string, string>)].map(([k, v]) => `${k}=${v}`);
    let sp = this.m.length - 16;
    this.stackAt = Math.max(this.floor + 65536, this.m.length - Math.min(4 * 1024 * 1024, this.m.length >>> 2));
    const put = (a: string[]): number[] => a.map(x => { const b = enc(x + "\0"); sp -= b.length; if (sp < this.stackAt) bad("EFBIG", "native argument block exceeds the stack"); this.m.set(b, sp); return sp; });
    const ep = put(env), ap = put(argv); sp &= -4;
    const vec = (a: number[]): number => { sp -= (a.length + 1) * 4; for (let i = 0; i < a.length; i++) this.v.setUint32(sp + i * 4, requireValue(a[i] ?? null, "src/vm/vm.ts:250"), true); this.v.setUint32(sp + a.length * 4, 0, true); return sp; };
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
  private push(n: number): void { const sp = (requireValue(this.r[14] ?? null, "src/vm/vm.ts:263") - 4) >>> 0; this.set32(sp, n); this.r[14] = sp; }
  private pop(): number { const sp = requireValue(this.r[14] ?? null, "src/vm/vm.ts:264") >>> 0, n = this.u32(sp); this.r[14] = sp + 4 | 0; return n; }

  private exec(at: number, n: number): void {
    const q = (this.exe.sec.find(x => x.flg.includes("x") && at >= x.addr && at + n <= x.addr + x.size) ?? null);
    if (!q) bad("EACCES", `execute at 0x${at.toString(16)}`);
  }

  private mem(at: number, n: number, wr = false): void {
    if (!Number.isSafeInteger(at) || !Number.isSafeInteger(n) || n < 0 || at + n > this.m.length) bad("ERANGE", `native memory access at 0x${at.toString(16)}`);
    if (!n) return;
    const q = (this.exe.sec.find(x => at >= x.addr && at + n <= x.addr + x.size) ?? null);
    const mapped = !!q || at >= this.floor && at + n <= this.brk || at >= Math.max(this.stackAt, this.brk + 65536);
    if (!mapped) bad("ERANGE", `unmapped native memory at 0x${at.toString(16)}`);
    if (wr && q && !q.flg.includes("w")) bad("EACCES", `write to ${q.name}`);
  }

  private slice(at: number, n: number, wr = false): Uint8Array { this.mem(at, n, wr); return this.m.subarray(at, at + n); }
  private u8(at: number): number { this.mem(at, 1); return requireValue(this.m[at] ?? null, "src/vm/vm.ts:281"); }
  private u16(at: number): number { this.mem(at, 2); return this.v.getUint16(at, true); }
  private u32(at: number): number { this.mem(at, 4); return this.v.getInt32(at, true); }
  private set8(at: number, n: number): void { this.mem(at, 1, true); this.m[at] = n; }
  private set16(at: number, n: number): void { this.mem(at, 2, true); this.v.setUint16(at, n, true); }
  private set32(at: number, n: number): void { this.mem(at, 4, true); this.v.setInt32(at, n, true); }

  private str(at: number): string {
    this.mem(at, 1); let end = at;
    while (end < this.m.length && (this.m[end] ?? null) && end - at < 4096) end++;
    if (end === this.m.length || end - at >= 4096) bad("ENAMETOOLONG", "native string");
    return new TextDecoder().decode(this.m.subarray(at, end));
  }
}
