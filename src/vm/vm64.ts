import { hostNumber, randomFill, readString } from "./mem64.js";
import { NativeIo } from "./io.js";
import { withValue } from "../core/err.js";
import { requireValue } from "../core/err.js";
import { bad, KErr } from "../core/err.js";
import type { Errno } from "../core/err.js";
import type { Sig } from "../core/proc.js";
import type { Sys } from "../core/sys.js";
import { enc } from "../io/stream.js";
import { Exe } from "../asm/fmt.js";
import { BY64_OP, I64_SZ, Op64 } from "../asm/isa64.js";
import { Sc } from "./vm.js";
import { Mem64 } from "./mem64.js";

const eno: Record<Errno, number> = {
  EACCES: 2, EAGAIN: 6, EBADF: 8, EBUSY: 10, ECHILD: 12, EEXIST: 20,
  EFAULT: 21, EFBIG: 22, EINTR: 27, EINVAL: 28, EIO: 29, EISDIR: 31, ELOOP: 32, EMFILE: 33,
  ENAMETOOLONG: 37, ENFILE: 41, ENOENT: 44, ENOEXEC: 45, ENOMEM: 48,
  ENETUNREACH: 46, ENOSPC: 51, ENOSYS: 52, ENOTDIR: 54, ENOTEMPTY: 55, ENOTSUP: 58,
  EPERM: 63, EPIPE: 64, EPROTO: 65, ERANGE: 68, EROFS: 69, ESRCH: 71, ETIMEDOUT: 73,
};

const MASK = (1n << 64n) - 1n;
const MAX_IO = 64 * 1024 * 1024;

const s64 = (n: bigint): bigint => BigInt.asIntN(64, n);
const u64 = (n: bigint): bigint => BigInt.asUintN(64, n);

/** Saturate floating-point conversions at the Thistle64 integer ABI limits. */
function ftoi(n: number, uns: boolean): bigint {
  if (Number.isNaN(n) || (uns && n <= 0)) return 0n;
  if (uns && n >= 18446744073709551615) return MASK;
  if (uns) return u64(BigInt(Math.trunc(n)));
  if (n <= -9223372036854775808) return -(1n << 63n);
  if (n >= 9223372036854775807) return (1n << 63n) - 1n;
  return BigInt(Math.trunc(n));
}

export class Vm64 {
  readonly r = new BigInt64Array(32);
  readonly f = new Float64Array(16);
  private memoryState: Mem64 | null = null;
  private get m(): Mem64 { return requireValue(this.memoryState, "m before VM initialisation"); }
  private set m(value: Mem64) { this.memoryState = value; }
  private pc = 0n;
  private z = false;
  private n = false;
  private c = false;
  private o = false;
  private done = false;
  private code = 0;
  private brk = 0n;
  private floor = 0n;
  private stackAt = 0n;
  private executableState: Exe | null = null;
  private get exe(): Exe { return requireValue(this.executableState, "exe before VM initialisation"); }
  private set exe(value: Exe) { this.executableState = value; }

  private readonly io: NativeIo;
  constructor(private readonly s: Sys) { this.io = new NativeIo(s); }

  async run(exe: Exe, argv: string[]): Promise<number> {
    // Reject overlapping or unaligned sections before loading bytes, then reserve the heap and stack before execution.
    if (exe.machine !== "thistle64") bad("ENOEXEC", "thistle64 VM received another machine");
    this.exe = exe;
    this.m = new Mem64(BigInt(exe.mem), this.s.k.lim.mem);
    const seen: Array<{ at: bigint; end: bigint; name: string }> = [];
    for (const q of exe.sec) {
      const at = BigInt(q.addr), end = at + BigInt(q.size);
      if (q.addr < 0x10000 || q.addr % q.align || end > this.m.top || q.data.length > q.size) bad("ENOEXEC", `section ${q.name} has an invalid mapping`);
      if (seen.some(x => at < x.end && end > x.at)) bad("ENOEXEC", `section ${q.name} overlaps another section`);
      seen.push({ at, end, name: q.name });
      this.m.write(at, q.data);
      if (end > this.floor) this.floor = end;
    }
    this.brk = this.align(this.floor, 16n);
    this.pc = BigInt(exe.entry);
    this.stack(argv);
    let tick = 0, fuel = this.s.k.lim.fuel;
    while (!this.done) {
      if (fuel && --fuel < 0) bad("ELOOP", "thistle64 instruction limit reached");
      this.s.chk();
      await this.step();
      if (++tick === 4096) { tick = 0; await this.s.yield(); }
    }
    return this.code & 0xff;
  }

  private arithmetic(op: Op64, d: number, x: bigint, y: bigint, im: bigint): boolean {
    // Integer arithmetic preserves 64-bit wrapping and checks divisors before mutation.
    const sh = (n: bigint): bigint => u64(n) & 63n;
    switch (op) {
      case Op64.Add: this.set(d, x + y); break;
      case Op64.AddI: this.set(d, x + im); break;
      case Op64.Sub: this.set(d, x - y); break;
      case Op64.SubI: this.set(d, x - im); break;
      case Op64.Mul: this.set(d, x * y); break;
      case Op64.MulI: this.set(d, x * im); break;
      case Op64.Div: if (!y) bad("EINVAL", "integer division by zero"); this.set(d, x / y); break;
      case Op64.DivU: if (!y) bad("EINVAL", "integer division by zero"); this.set(d, u64(x) / u64(y)); break;
      case Op64.Mod: if (!y) bad("EINVAL", "integer division by zero"); this.set(d, x % y); break;
      case Op64.ModU: if (!y) bad("EINVAL", "integer division by zero"); this.set(d, u64(x) % u64(y)); break;
      case Op64.And: this.set(d, x & y); break;
      case Op64.AndI: this.set(d, x & im); break;
      case Op64.Or: this.set(d, x | y); break;
      case Op64.OrI: this.set(d, x | im); break;
      case Op64.Xor: this.set(d, x ^ y); break;
      case Op64.XorI: this.set(d, x ^ im); break;
      case Op64.Not: this.set(d, ~x); break;
      case Op64.Neg: this.set(d, -x); break;
      case Op64.Shl: this.set(d, u64(x) << sh(y)); break;
      case Op64.ShlI: this.set(d, u64(x) << sh(im)); break;
      case Op64.Shr: this.set(d, u64(x) >> sh(y)); break;
      case Op64.ShrI: this.set(d, u64(x) >> sh(im)); break;
      case Op64.Sar: this.set(d, x >> sh(y)); break;
      case Op64.SarI: this.set(d, x >> sh(im)); break;
      case Op64.Cmp: this.cmp(x, y); break;
      case Op64.CmpI: this.cmp(x, im); break;
      case Op64.Test: this.logic(x & y); break;
      case Op64.Clz: { const q = u64(x); this.set(d, BigInt(q ? 64 - q.toString(2).length : 64)); break; }
      case Op64.Ctz: { let q = u64(x), z = 0; if (!q) z = 64; else while (!(q & 1n)) { z++; q >>= 1n; } this.set(d, BigInt(z)); break; }
      case Op64.Popcnt: { let q = u64(x), z = 0; while (q) { q &= q - 1n; z++; } this.set(d, BigInt(z)); break; }
      default: return false;
    }
    return true;
  }

  private flow(op: Op64, d: number, im: bigint): boolean {
    // The caller has advanced the PC, so calls save the next instruction address.
    switch (op) {
      case Op64.Jmp: this.jump(im); break;
      case Op64.JmpR: this.pc = u64(requireValue(this.r[d] ?? null, "src/vm/vm64.ts:116")); break;
      case Op64.Je: if (this.z) this.jump(im); break;
      case Op64.Jne: if (!this.z) this.jump(im); break;
      case Op64.Jl: if (this.n !== this.o) this.jump(im); break;
      case Op64.Jle: if (this.z || this.n !== this.o) this.jump(im); break;
      case Op64.Jg: if (!this.z && this.n === this.o) this.jump(im); break;
      case Op64.Jge: if (this.n === this.o) this.jump(im); break;
      case Op64.Jb: if (!this.c) this.jump(im); break;
      case Op64.Jbe: if (!this.c || this.z) this.jump(im); break;
      case Op64.Ja: if (this.c && !this.z) this.jump(im); break;
      case Op64.Jae: if (this.c) this.jump(im); break;
      case Op64.Call: this.push(this.pc); this.jump(im); break;
      case Op64.CallR: this.push(this.pc); this.pc = u64(requireValue(this.r[d] ?? null, "src/vm/vm64.ts:128")); break;
      case Op64.Ret: { const q = this.pop(); if (!q) this.exit(requireValue(this.r[0] ?? null, "src/vm/vm64.ts:129")); else this.pc = u64(q); break; }
      case Op64.Push: this.push(requireValue(this.r[d] ?? null, "src/vm/vm64.ts:130")); break;
      case Op64.Pop: this.set(d, this.pop()); break;
      case Op64.Enter: { const z = this.nat(im, "frame size", this.s.k.lim.stack); this.push(requireValue(this.r[29] ?? null, "src/vm/vm64.ts:132")); this.r[29] = requireValue(this.r[30] ?? null, "src/vm/vm64.ts:132"); this.r[30] = s64(requireValue(this.r[30] ?? null, "src/vm/vm64.ts:132") - BigInt(z)); this.mem(u64(requireValue(this.r[30] ?? null, "src/vm/vm64.ts:132")), z, true); break; }
      case Op64.Leave: this.r[30] = requireValue(this.r[29] ?? null, "src/vm/vm64.ts:133"); this.r[29] = this.pop(); break;
      default: return false;
    }
    return true;
  }

  private floating(op: Op64, d: number, a: number, b: number, v: DataView): boolean {
    // Floating loads and stores use the same checked address calculation as integer memory operations.
    const x = requireValue(this.r[a] ?? null, "floating address register"), im = v.getBigInt64(8, true);
    switch (op) {
      case Op64.FMov: this.f[d] = requireValue(this.f[a] ?? null, "src/vm/vm64.ts:163"); break;
      case Op64.FLi: this.f[d] = v.getFloat64(8, true); break;
      case Op64.FAdd: this.f[d] = requireValue(this.f[a] ?? null, "src/vm/vm64.ts:165") + requireValue(this.f[b] ?? null, "src/vm/vm64.ts:165"); break;
      case Op64.FSub: this.f[d] = requireValue(this.f[a] ?? null, "src/vm/vm64.ts:166") - requireValue(this.f[b] ?? null, "src/vm/vm64.ts:166"); break;
      case Op64.FMul: this.f[d] = requireValue(this.f[a] ?? null, "src/vm/vm64.ts:167") * requireValue(this.f[b] ?? null, "src/vm/vm64.ts:167"); break;
      case Op64.FDiv: this.f[d] = requireValue(this.f[a] ?? null, "src/vm/vm64.ts:168") / requireValue(this.f[b] ?? null, "src/vm/vm64.ts:168"); break;
      case Op64.FNeg: this.f[d] = -requireValue(this.f[a] ?? null, "src/vm/vm64.ts:169"); break;
      case Op64.FAbs: this.f[d] = Math.abs(requireValue(this.f[a] ?? null, "src/vm/vm64.ts:170")); break;
      case Op64.FSqrt: this.f[d] = Math.sqrt(requireValue(this.f[a] ?? null, "src/vm/vm64.ts:171")); break;
      case Op64.FCmp: this.fcmp(requireValue(this.f[a] ?? null, "src/vm/vm64.ts:172"), requireValue(this.f[b] ?? null, "src/vm/vm64.ts:172")); break;
      case Op64.FSetE: this.set(d, this.frel(requireValue(this.f[a] ?? null, "src/vm/vm64.ts:173"), requireValue(this.f[b] ?? null, "src/vm/vm64.ts:173"), "eq") ? 1n : 0n); break;
      case Op64.FSetNe: this.set(d, this.frel(requireValue(this.f[a] ?? null, "src/vm/vm64.ts:174"), requireValue(this.f[b] ?? null, "src/vm/vm64.ts:174"), "ne") ? 1n : 0n); break;
      case Op64.FSetL: this.set(d, this.frel(requireValue(this.f[a] ?? null, "src/vm/vm64.ts:175"), requireValue(this.f[b] ?? null, "src/vm/vm64.ts:175"), "lt") ? 1n : 0n); break;
      case Op64.FSetLe: this.set(d, this.frel(requireValue(this.f[a] ?? null, "src/vm/vm64.ts:176"), requireValue(this.f[b] ?? null, "src/vm/vm64.ts:176"), "le") ? 1n : 0n); break;
      case Op64.FSetG: this.set(d, this.frel(requireValue(this.f[a] ?? null, "src/vm/vm64.ts:177"), requireValue(this.f[b] ?? null, "src/vm/vm64.ts:177"), "gt") ? 1n : 0n); break;
      case Op64.FSetGe: this.set(d, this.frel(requireValue(this.f[a] ?? null, "src/vm/vm64.ts:178"), requireValue(this.f[b] ?? null, "src/vm/vm64.ts:178"), "ge") ? 1n : 0n); break;
      case Op64.IToF: this.f[d] = Number(x); break;
      case Op64.UToF: this.f[d] = Number(u64(x)); break;
      case Op64.FToI: this.set(d, ftoi(requireValue(this.f[a] ?? null, "src/vm/vm64.ts:181"), false)); break;
      case Op64.FToU: this.set(d, ftoi(requireValue(this.f[a] ?? null, "src/vm/vm64.ts:182"), true)); break;
      case Op64.FLd32: { const q = u64(x + im); this.mem(q, 4); this.f[d] = this.m.f32(q); break; }
      case Op64.FLd64: { const q = u64(x + im); this.mem(q, 8); this.f[d] = this.m.f64(q); break; }
      case Op64.FSt32: { const q = u64(x + im); this.mem(q, 4, true); this.m.setF32(q, requireValue(this.f[d] ?? null, "src/vm/vm64.ts:185")); break; }
      case Op64.FSt64: { const q = u64(x + im); this.mem(q, 8, true); this.m.setF64(q, requireValue(this.f[d] ?? null, "src/vm/vm64.ts:186")); break; }
      default: return false;
    }
    return true;
  }

  private condition(op: Op64, d: number): boolean {
    // Set-on-condition instructions read the flags and store a normalised integer result.
    switch (op) {
      case Op64.SetE: this.set(d, this.z ? 1n : 0n); break;
      case Op64.SetNe: this.set(d, this.z ? 0n : 1n); break;
      case Op64.SetL: this.set(d, this.n !== this.o ? 1n : 0n); break;
      case Op64.SetLe: this.set(d, this.z || this.n !== this.o ? 1n : 0n); break;
      case Op64.SetG: this.set(d, !this.z && this.n === this.o ? 1n : 0n); break;
      case Op64.SetGe: this.set(d, this.n === this.o ? 1n : 0n); break;
      case Op64.SetB: this.set(d, this.c ? 0n : 1n); break;
      case Op64.SetBe: this.set(d, !this.c || this.z ? 1n : 0n); break;
      case Op64.SetA: this.set(d, this.c && !this.z ? 1n : 0n); break;
      case Op64.SetAe: this.set(d, this.c ? 1n : 0n); break;
      default: return false;
    }
    return true;
  }

  /** Decode and validate once before dispatching the selected instruction family. */
  private async step(): Promise<void> {
    // Advance the PC only after opcode and register checks; calls then save the next instruction address.
    this.exec(this.pc, I64_SZ);
    const raw = this.m.read(this.pc, I64_SZ), v = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const op = requireValue(raw[0] ?? null, "src/vm/vm64.ts:75") as Op64, d = requireValue(raw[1] ?? null, "src/vm/vm64.ts:75"), a = requireValue(raw[2] ?? null, "src/vm/vm64.ts:75"), b = requireValue(raw[3] ?? null, "src/vm/vm64.ts:75"), im = v.getBigInt64(8, true);
    const ins = (BY64_OP.get(op) ?? null);
    if (!ins) return bad("ENOEXEC", `bad thistle64 opcode ${op} at 0x${this.pc.toString(16)}`);
    if (d > 31 || a > 31 || b > 31) bad("ENOEXEC", `bad thistle64 register at 0x${this.pc.toString(16)}`);
    const badf = ["f", "ff", "fff", "fi", "fx", "fmemr", "fmemw"].includes(ins.form) && d > 15 || ["ff", "fff", "fcmp", "xf", "xff"].includes(ins.form) && a > 15 || ["fff", "fcmp", "xff"].includes(ins.form) && b > 15;
    if (badf) bad("ENOEXEC", `bad floating register at 0x${this.pc.toString(16)}`);
    this.pc += BigInt(I64_SZ);
    const x = requireValue(this.r[a] ?? null, "src/vm/vm64.ts:82"), y = requireValue(this.r[b] ?? null, "src/vm/vm64.ts:82");
    if (this.arithmetic(op, d, x, y, im) || this.flow(op, d, im) || this.floating(op, d, a, b, v) || this.condition(op, d)) return;
    switch (op) {
      case Op64.Nop: break;
      case Op64.Halt: this.exit(requireValue(this.r[0] ?? null, "src/vm/vm64.ts:85")); break;
      case Op64.Mov: this.set(d, x); break;
      case Op64.Li: this.set(d, im); break;
      case Op64.Ld8U: { const q = u64(x + im); this.mem(q, 1); this.set(d, BigInt(this.m.u8(q))); break; }
      case Op64.Ld8S: { const q = u64(x + im); this.mem(q, 1); this.set(d, this.m.i8(q)); break; }
      case Op64.Ld16U: { const q = u64(x + im); this.mem(q, 2); this.set(d, BigInt(this.m.u16(q))); break; }
      case Op64.Ld16S: { const q = u64(x + im); this.mem(q, 2); this.set(d, this.m.i16(q)); break; }
      case Op64.Ld32U: { const q = u64(x + im); this.mem(q, 4); this.set(d, BigInt(this.m.u32(q))); break; }
      case Op64.Ld32S: { const q = u64(x + im); this.mem(q, 4); this.set(d, this.m.i32(q)); break; }
      case Op64.Ld64: { const q = u64(x + im); this.mem(q, 8); this.set(d, this.m.i64(q)); break; }
      case Op64.St8: this.wr(u64(x + im), 1); this.m.set8(u64(x + im), requireValue(this.r[d] ?? null, "src/vm/vm64.ts:141")); break;
      case Op64.St16: this.wr(u64(x + im), 2); this.m.set16(u64(x + im), requireValue(this.r[d] ?? null, "src/vm/vm64.ts:142")); break;
      case Op64.St32: this.wr(u64(x + im), 4); this.m.set32(u64(x + im), requireValue(this.r[d] ?? null, "src/vm/vm64.ts:143")); break;
      case Op64.St64: this.wr(u64(x + im), 8); this.m.set64(u64(x + im), requireValue(this.r[d] ?? null, "src/vm/vm64.ts:144")); break;
      case Op64.Sys: await this.sys(this.nat(im, "syscall", 65535)); break;
      case Op64.Xchg: { const q = requireValue(this.r[d] ?? null, "src/vm/vm64.ts:146"); this.r[d] = x; this.r[a] = q; break; }
      case Op64.Sex8: this.set(d, BigInt.asIntN(8, x)); break;
      case Op64.Sex16: this.set(d, BigInt.asIntN(16, x)); break;
      case Op64.Sex32: this.set(d, BigInt.asIntN(32, x)); break;
    }
  }

  private async sys(n: number): Promise<void> {
    try { this.set(0, await this.call(n)); }
    catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  if (e instanceof KErr) this.set(0, -BigInt(eno[e.code] ?? 29)); else throw e; }
  }

  private async call(n: number): Promise<bigint> {
    // Convert the 64-bit ABI arguments at the host boundary and validate guest memory before performing host I/O.
    const a = this.r;
    switch (n) {
      case Sc.Exit: this.exit(requireValue(a[0] ?? null, "src/vm/vm64.ts:198")); return 0n;
      case Sc.Read: { const at = u64(requireValue(a[1] ?? null, "src/vm/vm64.ts:199")), z = this.nat(requireValue(a[2] ?? null, "src/vm/vm64.ts:199"), "read length", MAX_IO); this.mem(at, z, true); const b = await this.io.read(this.fd(requireValue(a[0] ?? null, "src/vm/vm64.ts:199")), z); this.m.write(at, b); return BigInt(b.length); }
      case Sc.Write: { const at = u64(requireValue(a[1] ?? null, "src/vm/vm64.ts:200")), z = this.nat(requireValue(a[2] ?? null, "src/vm/vm64.ts:200"), "write length", MAX_IO); this.mem(at, z); const b = this.m.read(at, z), fd = this.fd(requireValue(a[0] ?? null, "src/vm/vm64.ts:200")); return BigInt(fd === 1 ? await this.s.out(b) : fd === 2 ? await this.s.err(b) : this.s.fdw(fd, b)); }
      case Sc.Open: return BigInt(this.io.open(this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:201")), this.nat(requireValue(a[1] ?? null, "src/vm/vm64.ts:201"), "open flags", 0xffffffff), this.nat(requireValue(a[2] ?? null, "src/vm/vm64.ts:201"), "open mode", 0xffff)));
      case Sc.Close: this.s.close(this.fd(requireValue(a[0] ?? null, "src/vm/vm64.ts:202"))); return 0n;
      case Sc.Seek: { const w = this.nat(requireValue(a[2] ?? null, "src/vm/vm64.ts:203"), "seek whence", 2); return BigInt(this.s.seek(this.fd(requireValue(a[0] ?? null, "src/vm/vm64.ts:203")), hostNumber(requireValue(a[1] ?? null, "src/vm/vm64.ts:203"), "seek offset"), w)); }
      case Sc.Unlink: this.s.rm(this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:204"))); return 0n;
      case Sc.Mkdir: this.s.mkdir(this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:205")), this.nat(requireValue(a[1] ?? null, "src/vm/vm64.ts:205"), "mode", 0xffff)); return 0n;
      case Sc.GetPid: return BigInt(this.s.pid);
      case Sc.GetPPid: return BigInt(this.s.ppid);
      case Sc.Brk: return this.doBrk(u64(requireValue(a[0] ?? null, "src/vm/vm64.ts:208")));
      case Sc.Clock: return BigInt(Date.now());
      case Sc.Yield: await this.s.yield(); return 0n;
      case Sc.Stat: return this.stat(this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:211")), u64(requireValue(a[1] ?? null, "src/vm/vm64.ts:211")));
      case Sc.GetCwd: return BigInt(this.copy(enc(this.s.cwd + "\0"), u64(requireValue(a[0] ?? null, "src/vm/vm64.ts:212")), this.nat(requireValue(a[1] ?? null, "src/vm/vm64.ts:212"), "getcwd length", MAX_IO)));
      case Sc.Chdir: this.s.cd(this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:213"))); return 0n;
      case Sc.Rmdir: this.s.rm(this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:214")), true); return 0n;
      case Sc.Rename: this.s.mv(this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:215")), this.str(requireValue(a[1] ?? null, "src/vm/vm64.ts:215"))); return 0n;
      case Sc.Chmod: this.s.chmod(this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:216")), this.nat(requireValue(a[1] ?? null, "src/vm/vm64.ts:216"), "mode", 0xffff)); return 0n;
      case Sc.Random: return BigInt(this.random(u64(requireValue(a[0] ?? null, "src/vm/vm64.ts:217")), this.nat(requireValue(a[1] ?? null, "src/vm/vm64.ts:217"), "random length", MAX_IO)));
      case Sc.Spawn: { const p = this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:218")), av = this.vec(u64(requireValue(a[1] ?? null, "src/vm/vm64.ts:218")), this.nat(requireValue(a[2] ?? null, "src/vm/vm64.ts:218"), "argument count", 65536)); return BigInt(this.s.start(p, av).pid); }
      case Sc.Wait: return BigInt(await this.s.wait(this.fd(requireValue(a[0] ?? null, "src/vm/vm64.ts:219"))));
      case Sc.Kill: { const q = hostNumber(requireValue(a[1] ?? null, "src/vm/vm64.ts:220"), "signal"); if (![1, 2, 9, 13, 15].includes(q)) bad("EINVAL", `signal ${q}`); return BigInt(this.s.kill(hostNumber(requireValue(a[0] ?? null, "src/vm/vm64.ts:220"), "pid"), q as Sig)); }
      case Sc.Sleep: await this.s.sleep(this.nat(requireValue(a[0] ?? null, "src/vm/vm64.ts:221"), "sleep duration", Number.MAX_SAFE_INTEGER)); return 0n;
      case Sc.GetUid: return BigInt(this.s.uid);
      case Sc.GetGid: return BigInt(this.s.gid);
      case Sc.Dup: return BigInt(this.s.dup(this.fd(requireValue(a[0] ?? null, "src/vm/vm64.ts:224")), requireValue(a[1] ?? null, "src/vm/vm64.ts:224") < 0n ? null : this.fd(requireValue(a[1] ?? null, "src/vm/vm64.ts:224"))));
      case Sc.Link: this.s.link(this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:225")), this.str(requireValue(a[1] ?? null, "src/vm/vm64.ts:225"))); return 0n;
      case Sc.Symlink: this.s.symlink(this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:226")), this.str(requireValue(a[1] ?? null, "src/vm/vm64.ts:226"))); return 0n;
      case Sc.Readlink: return BigInt(this.copy(enc(this.s.readlink(this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:227")))), u64(requireValue(a[1] ?? null, "src/vm/vm64.ts:227")), this.nat(requireValue(a[2] ?? null, "src/vm/vm64.ts:227"), "readlink length", MAX_IO)));
      case Sc.Truncate: { const p = this.str(requireValue(a[0] ?? null, "src/vm/vm64.ts:228")), z = this.nat(requireValue(a[1] ?? null, "src/vm/vm64.ts:228"), "file length", this.s.k.fs.cap); const b = this.s.readb(p), q = new Uint8Array(z); q.set(b.subarray(0, z)); this.s.writeb(p, q); return 0n; }
      default: return bad("ENOSYS", `thistle64 syscall ${n}`);
    }
  }





  private stat(p: string, at: bigint): bigint {
    this.mem(at, 64, true);
    const q = this.s.stat(p);
    this.m.set64(at, q.ino); this.m.set32(at + 8n, q.mode); this.m.set32(at + 12n, q.kind === "file" ? 1 : q.kind === "dir" ? 2 : q.kind === "link" ? 3 : 4);
    this.m.set32(at + 16n, q.uid); this.m.set32(at + 20n, q.gid); this.m.set64(at + 24n, q.nlink); this.m.set64(at + 32n, q.size);
    this.m.set64(at + 40n, Math.trunc(q.at)); this.m.set64(at + 48n, Math.trunc(q.mt)); this.m.set64(at + 56n, Math.trunc(q.ct));
    return 0n;
  }

  private doBrk(n: bigint): bigint {
    if (!n) return this.brk;
    if (n < this.floor || n + 1024n * 1024n >= this.stackAt) bad("ENOMEM", "thistle64 heap collided with stack");
    this.brk = n; return n;
  }

  private random(at: bigint, n: number): number { return randomFill(this.m, this.mem.bind(this), at, n); }

  private copy(b: Uint8Array, at: bigint, n: number): number {
    if (b.length > n) bad("ERANGE", "native output buffer is too small");
    this.mem(at, b.length, true); this.m.write(at, b); return b.length;
  }

  private vec(at: bigint, n: number): string[] {
    this.mem(at, n * 8);
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(this.str(this.m.u64(at + BigInt(i * 8))));
    return out;
  }

  private stack(argv: string[]): void {
    const env = [...(this.s.env(null) as Map<string, string>)].map(([k, v]) => `${k}=${v}`);
    let sp = this.m.top - 16n;
    const z = BigInt(Math.min(this.s.k.lim.stack, Math.max(1024 * 1024, Math.floor(Number(this.m.top > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : this.m.top) / 8))));
    this.stackAt = this.m.top - z;
    const put = (a: string[]): bigint[] => a.map(x => {
      const b = enc(x + "\0"); sp -= BigInt(b.length);
      if (sp < this.stackAt) bad("EFBIG", "thistle64 argument block exceeds the stack");
      this.m.write(sp, b); return sp;
    });
    const ep = put(env), ap = put(argv); sp &= -8n;
    const vec = (a: bigint[]): bigint => { sp -= BigInt((a.length + 1) * 8); for (let i = 0; i < a.length; i++) this.m.set64(sp + BigInt(i * 8), requireValue(a[i] ?? null, "src/vm/vm64.ts:297")); this.m.set64(sp + BigInt(a.length * 8), 0n); return sp; };
    const ev = vec(ep), av = vec(ap); sp = (sp - 8n) & -16n; this.m.set64(sp, 0n);
    if (sp < this.stackAt || sp < this.brk + 1024n * 1024n) bad("ENOMEM", "arguments leave no thistle64 stack");
    this.r[0] = BigInt(argv.length); this.r[1] = s64(av); this.r[2] = BigInt(env.length); this.r[3] = s64(ev); this.r[29] = 0n; this.r[30] = s64(sp); this.r[31] = 0n;
  }

  private cmp(a: bigint, b: bigint): void {
    const r = s64(a - b), ua = u64(a), ub = u64(b), ur = u64(r), sign = 1n << 63n;
    this.z = r === 0n; this.n = r < 0n; this.c = ua >= ub; this.o = !!((ua ^ ub) & (ua ^ ur) & sign);
  }

  private fcmp(a: number, b: number): void {
    this.o = Number.isNaN(a) || Number.isNaN(b);
    this.z = !this.o && a === b; this.n = !this.o && a < b; this.c = !this.o && a >= b;
  }

  private logic(n: bigint): void { const q = s64(n); this.z = q === 0n; this.n = q < 0n; this.c = false; this.o = false; }
  private jump(n: bigint): void { this.pc = u64(this.pc + n); }
  private exit(n: bigint): void { this.code = Number(u64(n) & 0xffffffffn); this.done = true; }
  private set(d: number, n: bigint): void { this.r[d] = s64(n); }


  private push(n: bigint): void {
    const sp = u64(requireValue(this.r[30] ?? null, "src/vm/vm64.ts:320") - 8n); this.mem(sp, 8, true); this.m.set64(sp, n); this.r[30] = s64(sp);
  }

  private pop(): bigint {
    const sp = u64(requireValue(this.r[30] ?? null, "src/vm/vm64.ts:324")); this.mem(sp, 8); const n = this.m.i64(sp); this.r[30] = s64(sp + 8n); return n;
  }

  private exec(at: bigint, n: number): void {
    const end = at + BigInt(n), q = (this.exe.sec.find(x => x.flg.includes("x") && at >= BigInt(x.addr) && end <= BigInt(x.addr + x.size)) ?? null);
    if (!q) bad("EACCES", `execute at 0x${at.toString(16)}`);
  }

  private mem(at: bigint, n: number, wr = false): void {
    const end = at + BigInt(n);
    if (at < 0n || !Number.isSafeInteger(n) || n < 0 || end > this.m.top) bad("ERANGE", `thistle64 memory at 0x${at.toString(16)}`);
    if (!n) return;
    const q = (this.exe.sec.find(x => at >= BigInt(x.addr) && end <= BigInt(x.addr + x.size)) ?? null);
    const mapped = !!q || at >= this.floor && end <= this.brk || at >= (this.stackAt > this.brk + 1024n * 1024n ? this.stackAt : this.brk + 1024n * 1024n);
    if (!mapped) bad("ERANGE", `unmapped thistle64 memory at 0x${at.toString(16)}`);
    if (wr && q && !q.flg.includes("w")) bad("EACCES", `write to ${q.name}`);
  }

  private wr(at: bigint, n: number): void { this.mem(at, n, true); }

  private str(at0: bigint): string { return readString(this.m, this.mem.bind(this), at0, "thistle64 string"); }

  private nat(n: bigint, k: string, max: number): number {
    const u = u64(n);
    if (n < 0n || u > BigInt(max) || u > BigInt(Number.MAX_SAFE_INTEGER)) bad("ERANGE", `${k} is out of range`);
    return Number(u);
  }



  private fd(n: bigint): number { return this.nat(n, "file descriptor", 0x7fffffff); }
  private align(n: bigint, a: bigint): bigint { return (n + a - 1n) & -a; }

  private frel(a: number, b: number, op: "eq" | "ne" | "lt" | "le" | "gt" | "ge"): boolean {
    if (op === "ne") return a !== b;
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return op === "eq" ? a === b : op === "lt" ? a < b : op === "le" ? a <= b : op === "gt" ? a > b : a >= b;
  }
}
