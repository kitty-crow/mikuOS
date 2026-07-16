import { bad, KErr } from "../core/err.js";
import type { Errno } from "../core/err.js";
import type { Sys } from "../core/sys.js";
import { enc } from "../io/stream.js";
import type { Exe } from "../asm/fmt.js";
import { norm } from "../fs/vfs.js";
import { treeFs } from "../fs/tree.js";
import { Mem64 } from "./mem64.js";
import type { RvMemory } from "./mem64.js";
import { Fd } from "../core/proc.js";
import type { Io } from "../core/proc.js";
import { directMemory, loadI32, loadU32, wasmMemory } from "../teto/memory.js";
import type { TetoMemory } from "../teto/memory.js";
import { TetoMem64 } from "../teto/mem64.js";
import { loadTeto } from "../teto/loader.js";
import type { TetoExports } from "../teto/loader.js";
import {
  tetoHartInit,
  tetoHartMetric,
  tetoHartPc,
  tetoHartSetPc,
  tetoHartExitCode,
  tetoHartImageFloor,
  tetoHartStackBottom,
  tetoHartStackPointer,
  tetoHartBreak,
  tetoHartVirtualTop,
  tetoGuestPage,
  tetoHostAddress,
  tetoHostDescriptor,
  tetoHostLength,
  tetoHostOperation,
  tetoKernelInit,
  tetoImageRelease,
  tetoImageReserve,
  tetoImageBegin,
  tetoImageSegment,
  tetoImageFinish,
  tetoProcessInit,
  tetoProcessCount,
  tetoProcessSegmentCount,
  tetoProcessMapCount,
  tetoProcessMapAddress,
  tetoProcessMapEnd,
  tetoProcessMapProtection,
  tetoProcessSetGroup,
  tetoResolvePath,
  tetoAccessInode,
  tetoOpenPath,
  tetoReadDescriptor,
  tetoSeekDescriptor,
  tetoCloseDescriptor,
  tetoDescriptorKind,
  tetoDescriptorInode,
  tetoDescriptorOffset,
  tetoResumeHost,
  tetoResumeSyscall,
  tetoRunRv64Batch,
  tetoRunSchedulerBatch,
  tetoWorkerMetric,
} from "../teto/kernel.js";
import { tetoLoadThx } from "../teto/thx.js";
import { tetoBuildInitialStack } from "../teto/start.js";
import { serializeTetoVfs } from "../teto/vfs-host.js";
import {
  tetoLoadVfs,
  tetoVfsDentryCount,
  tetoVfsFileSize,
  tetoVfsGid,
  tetoVfsInodeCount,
  tetoVfsKind,
  tetoVfsLoaded,
  tetoVfsLookup,
  tetoVfsMode,
  tetoVfsNlink,
  tetoVfsReadData,
  tetoVfsRoot,
  tetoVfsUid,
} from "../teto/vfs.js";
import {
  C_PROCESS_TABLE_BASE,
  H_FAULT,
  H_INSTRUCTIONS,
  H_LAST_INSTRUCTION,
  H_F,
  H_X,
  H_PROCESS_SLOT,
  P_EGID,
  P_EUID,
  P_FSGID,
  P_FSUID,
  P_GROUP_COUNT,
  P_GROUPS,
  P_RGID,
  P_RUID,
  P_SGID,
  P_SUID,
  TETO_BATCH_BUSY,
  TETO_BATCH_CONTENDED,
  TETO_BATCH_EXITED,
  TETO_BATCH_FAULT,
  TETO_BATCH_HOST,
  TETO_BATCH_SYSCALL,
  TETO_FAULT_BREAKPOINT,
  TETO_HART_BASE,
  TETO_HART_STRIDE,
  TETO_HOST_WRITE,
  TETO_CONTROL_BASE,
  TETO_GROUP_CAPACITY,
  TETO_PROCESS_STRIDE,
  TETO_STARTUP_MAGIC,
  TETO_START_OK,
  TETO_THX_OK,
  TETO_VFS_OK,
} from "../teto/abi.js";

const MAX_IO = 64 * 1024 * 1024;
const PAGE = 4096n;
const MASK = (1n << 64n) - 1n;
const MIN = -(1n << 63n);
const AT_FDCWD = -100;
const O_WRONLY = 1, O_RDWR = 2, O_CREAT = 0x40, O_EXCL = 0x80, O_TRUNC = 0x200, O_APPEND = 0x400;
const O_NONBLOCK = 0x800, O_DIRECTORY = 0x10000, O_CLOEXEC = 0x80000;

const AF_UNIX = 1;
const SOCK_STREAM = 1;
const SOCK_TYPE_MASK = 0x0f;
const SOCK_CLOEXEC = 0x80000;

const TCGETS = 0x5401;
const TCSETS = 0x5402;
const TCSETSW = 0x5403;
const TCSETSF = 0x5404;
const TIOCGWINSZ = 0x5413;
const TIOCSWINSZ = 0x5414;

const LINUX_TERMIOS_SIZE = 36;
const LINUX_WINSIZE_SIZE = 8;

interface TerminalIo {
  termios(): Uint8Array;
  setTermios(
    raw: Uint8Array,
    flush: boolean,
  ): void;
  size(): {
    rows: number;
    cols: number;
  };
  resize(
    rows: number,
    cols: number,
  ): void;
}

const terminalIo = (
  value: unknown,
): TerminalIo | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<TerminalIo>;

  if (
    typeof candidate.termios !== "function" ||
    typeof candidate.setTermios !== "function" ||
    typeof candidate.size !== "function" ||
    typeof candidate.resize !== "function"
  ) {
    return undefined;
  }

  return candidate as TerminalIo;
};

const terminalFromFd = (
  fd: Fd,
): TerminalIo | undefined =>
  terminalIo(fd.input?.tty) ??
  terminalIo(fd.output?.tty);

interface Vf {
  x: BigInt64Array;
  f: BigUint64Array;
  pc: bigint;
  cwd: string;
  env: Map<string, string>;
  fds: Map<number, Fd>;
}

interface Seg { name: string; at: bigint; end: bigint; flg: string; }
interface MapEnt { at: bigint; end: bigint; prot: number; shared: boolean; path?: string; off?: number; }

interface TetoCore {
  memory: TetoMemory;
  exports: TetoExports;
  label: string;
}

const eno: Record<Errno, number> = {
  EPERM: 1, ENOENT: 2, ESRCH: 3, EINTR: 4, EIO: 5, ECHILD: 10, EAGAIN: 11,
  ENOMEM: 12, EACCES: 13, EFAULT: 14, EBUSY: 16, EEXIST: 17, ENOTDIR: 20, EISDIR: 21,
  EINVAL: 22, ENFILE: 23, EMFILE: 24, EFBIG: 27, ENOSPC: 28, EPIPE: 32,
  ERANGE: 34, ENAMETOOLONG: 36, ENOSYS: 38, ENOTEMPTY: 39, ELOOP: 40,
  ENOEXEC: 8, EBADF: 9, EPROTO: 71, ENOTSUP: 95, ENETUNREACH: 101,
  ETIMEDOUT: 110, EROFS: 30,
};

const sx = (n: bigint, z: number): bigint => BigInt.asIntN(z, n);
const ux = (n: bigint): bigint => BigInt.asUintN(64, n);
const al = (n: bigint, z = PAGE): bigint => (n + z - 1n) & -z;
const fpb = new ArrayBuffer(8), fpv = new DataView(fpb);
const f32 = (n: bigint): number => { fpv.setUint32(0, Number(n & 0xffffffffn), true); return fpv.getFloat32(0, true); };
const f64 = (n: bigint): number => { fpv.setBigUint64(0, n, true); return fpv.getFloat64(0, true); };
const b32 = (n: number): bigint => { fpv.setFloat32(0, Math.fround(n), true); return BigInt(fpv.getUint32(0, true)); };
const b64 = (n: number): bigint => { fpv.setFloat64(0, n, true); return fpv.getBigUint64(0, true); };

/** RV64 is a compiler-facing Thistle64 instruction profile; Linux is not hiding underneath it. */
export class Rv64 {
  private xState: BigInt64Array<ArrayBufferLike> = new BigInt64Array(32);
  private fState: BigUint64Array<ArrayBufferLike> = new BigUint64Array(32);
  private m!: RvMemory;
  private exe!: Exe;
  private pc = 0n;
  private floor = 0n;
  private brk = 0n;
  private stackAt = 0n;
  private res = -1n;
  private fcsr = 0;
  private mapAt = 0n;
  private readonly maps: MapEnt[] = [];
  private readonly miss = new Set<number>();
  private readonly localSockets = new Set<number>();
  private readonly rlim = new Map<number, [bigint, bigint]>();
  private done = false;
  private code = 0;
  private trace = false;
  private readonly ins = new Map<number, { b: Uint8Array; at: number }>();
  private readonly seg: Seg[] = [];
  private eat = 0n;
  private eend = 0n;
  private vf: Vf | undefined;

  constructor(private readonly s: Sys) {}

  get x(): BigInt64Array<ArrayBufferLike> { return this.xState; }
  get f(): BigUint64Array<ArrayBufferLike> { return this.fState; }

  async run(exe: Exe, argv: string[], image?: Uint8Array): Promise<number> {
    if (this.s.env("THISTLE_RV_CORE") === "teto-source") return this.runTetoSource(exe, argv, image);
    if (this.s.env("THISTLE_RV_CORE") === "teto-wasm-core") return this.runTetoWasm(exe, argv, image);
    if (exe.machine !== "thistle64" || exe.isa !== "rv64gc") bad("ENOEXEC", "RV64 VM received another instruction profile");
    this.exe = exe;
    this.m = new Mem64(BigInt(exe.mem), this.s.k.lim.mem);
    this.seg.length = 0; this.eat = 0n; this.eend = 0n;
    const seen: Array<[bigint, bigint]> = [];
    for (const q of exe.sec) {
      const at = BigInt(q.addr), end = at + BigInt(q.size);
      if (q.addr < 0x10000 || q.addr % q.align || end > this.m.top || q.data.length > q.size) bad("ENOEXEC", `section ${q.name} has an invalid mapping`);
      if (seen.some(([a, b]) => at < b && end > a)) bad("ENOEXEC", `section ${q.name} overlaps another section`);
      seen.push([at, end]);
      this.seg.push({ name: q.name, at, end, flg: q.flg });
      this.m.write(at, q.data);
      if (end > this.floor) this.floor = end;
    }
    this.brk = al(this.floor);
    this.mapAt = 0x4000000000n;
    this.pc = BigInt(exe.entry);
    this.trace = this.s.env("THISTLE_RV_TRACE") === "1";
    this.stack(argv);
    let tick = 0, fuel = this.s.k.lim.fuel;
    while (!this.done) {
      if (fuel && --fuel < 0) bad("ELOOP", "RV64 instruction limit reached");
      if (!(tick & 1023)) this.s.chk();
      const wait = this.step();
      if (wait) await wait;
      if (++tick === 16384) { tick = 0; await this.s.yield(); }
    }
    return this.code & 0xff;
  }

  /** Development parity path: the shared Thistle source core owns instruction execution. */
  private async runTetoSource(exe: Exe, argv: string[], image?: Uint8Array): Promise<number> {
    const physicalBytes = 64 * 1024 * 1024;
    const memory = directMemory(physicalBytes);
    const exports: TetoExports = {
      tetoKernelInit: (_memory, maxHarts, threaded) => tetoKernelInit(memory, maxHarts, threaded !== 0),
      tetoKernelValid: () => 1,
      tetoHartInit: (_memory, hart, virtualTop, pc) => tetoHartInit(memory, hart, virtualTop, pc),
      tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
        tetoProcessInit(memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
      tetoProcessSetGroup: (_memory, hart, index, gid) => tetoProcessSetGroup(memory, hart, index, gid),
      tetoProcessCount: () => tetoProcessCount(memory),
      tetoResolvePath: (_memory, hart, start, path, length, follow) => tetoResolvePath(memory, hart, start, path, length, follow !== 0),
      tetoAccessInode: (_memory, hart, inode, bits) => tetoAccessInode(memory, hart, inode, bits),
      tetoOpenPath: (_memory, hart, start, path, length, flags) => tetoOpenPath(memory, hart, start, path, length, flags),
      tetoReadDescriptor: (_memory, hart, descriptor, output, length) => tetoReadDescriptor(memory, hart, descriptor, output, length),
      tetoSeekDescriptor: (_memory, hart, descriptor, offset, whence) => tetoSeekDescriptor(memory, hart, descriptor, offset, whence),
      tetoCloseDescriptor: (_memory, hart, descriptor) => tetoCloseDescriptor(memory, hart, descriptor),
      tetoDescriptorKind: (_memory, hart, descriptor) => tetoDescriptorKind(memory, hart, descriptor),
      tetoDescriptorInode: (_memory, hart, descriptor) => tetoDescriptorInode(memory, hart, descriptor),
      tetoDescriptorOffset: (_memory, hart, descriptor) => tetoDescriptorOffset(memory, hart, descriptor),
      tetoLoadVfs: (_memory, at, size) => tetoLoadVfs(memory, at, size),
      tetoVfsLoaded: () => tetoVfsLoaded(memory) ? 1 : 0,
      tetoVfsRoot: () => tetoVfsRoot(memory),
      tetoVfsInodeCount: () => tetoVfsInodeCount(memory),
      tetoVfsDentryCount: () => tetoVfsDentryCount(memory),
      tetoVfsKind: (_memory, inode) => tetoVfsKind(memory, inode),
      tetoVfsFileSize: (_memory, inode) => tetoVfsFileSize(memory, inode),
      tetoVfsMode: (_memory, inode) => tetoVfsMode(memory, inode),
      tetoVfsUid: (_memory, inode) => tetoVfsUid(memory, inode),
      tetoVfsGid: (_memory, inode) => tetoVfsGid(memory, inode),
      tetoVfsNlink: (_memory, inode) => tetoVfsNlink(memory, inode),
      tetoVfsLookup: (_memory, parent, name, size) => tetoVfsLookup(memory, parent, name, size),
      tetoVfsReadData: (_memory, inode, offset, output, size) => tetoVfsReadData(memory, inode, offset, output, size),
      tetoProcessSegmentCount: (_memory, hart) => tetoProcessSegmentCount(memory, hart),
      tetoProcessMapCount: (_memory, hart) => tetoProcessMapCount(memory, hart),
      tetoProcessMapAddress: (_memory, hart, index) => tetoProcessMapAddress(memory, hart, index),
      tetoProcessMapEnd: (_memory, hart, index) => tetoProcessMapEnd(memory, hart, index),
      tetoProcessMapProtection: (_memory, hart, index) => tetoProcessMapProtection(memory, hart, index),
      tetoImageReserve: (_memory, size) => tetoImageReserve(memory, size),
      tetoImageRelease: (_memory, at, size) => tetoImageRelease(memory, at, size),
      tetoImageBegin: (_memory, hart, virtualTop, entry, phdr, phent, phnum) => tetoImageBegin(memory, hart, virtualTop, entry, phdr, phent, phnum),
      tetoImageSegment: (_memory, hart, nameHash, nameLength, address, size, flags, at, length) =>
        tetoImageSegment(memory, hart, nameHash, nameLength, address, size, flags, at, length),
      tetoImageFinish: (_memory, hart, size) => tetoImageFinish(memory, hart, size),
      tetoLoadThx: (_memory, hart, at, size) => tetoLoadThx(memory, hart, at, size),
      tetoBuildInitialStack: (_memory, hart, at, size, stackBytes) => tetoBuildInitialStack(memory, hart, at, size, stackBytes),
      tetoGuestPage: (_memory, hart, address, create) => tetoGuestPage(memory, hart, address, create !== 0),
      tetoHartGetX: (_memory, hart, register) => this.tetoRegister(memory, hart, H_X, register),
      tetoHartSetX: (_memory, hart, register, value) => this.tetoSetRegister(memory, hart, H_X, register, value),
      tetoHartGetF: (_memory, hart, register) => BigInt.asUintN(64, this.tetoRegister(memory, hart, H_F, register)),
      tetoHartSetF: (_memory, hart, register, value) => this.tetoSetRegister(memory, hart, H_F, register, value),
      tetoHartPc: (_memory, hart) => tetoHartPc(memory, hart),
      tetoHartVirtualTop: (_memory, hart) => tetoHartVirtualTop(memory, hart),
      tetoHartImageFloor: (_memory, hart) => tetoHartImageFloor(memory, hart),
      tetoHartStackBottom: (_memory, hart) => tetoHartStackBottom(memory, hart),
      tetoHartStackPointer: (_memory, hart) => tetoHartStackPointer(memory, hart),
      tetoHartBreak: (_memory, hart) => tetoHartBreak(memory, hart),
      tetoHartSetPc: (_memory, hart, pc) => tetoHartSetPc(memory, hart, pc),
      tetoHartStatus: () => 0,
      tetoHartMetric: (_memory, hart, offset) => tetoHartMetric(memory, hart, offset),
      tetoHostOperation: (_memory, hart) => tetoHostOperation(memory, hart),
      tetoHostDescriptor: (_memory, hart) => tetoHostDescriptor(memory, hart),
      tetoHostAddress: (_memory, hart) => tetoHostAddress(memory, hart),
      tetoHostLength: (_memory, hart) => tetoHostLength(memory, hart),
      tetoHartExitCode: (_memory, hart) => tetoHartExitCode(memory, hart),
      tetoRunRv64Batch: (_memory, hart, budget, nowMicros, worker) => tetoRunRv64Batch(memory, hart, budget, nowMicros, worker),
      tetoRunSchedulerBatch: (_memory, budget, nowMicros, worker) => tetoRunSchedulerBatch(memory, budget, nowMicros, worker),
      tetoWorkerMetric: (_memory, worker, offset) => tetoWorkerMetric(memory, worker, offset),
      tetoResumeSyscall: (_memory, hart, result) => tetoResumeSyscall(memory, hart, result),
      tetoResumeHost: (_memory, hart, result) => tetoResumeHost(memory, hart, result),
      tetoExitHart: () => 0,
    };
    return this.runTetoCore(exe, argv, image, { memory, exports, label: "Teto source core" }, physicalBytes);
  }

  /** Development parity path: generated WebAssembly owns the RV64GC instruction batch. */
  private async runTetoWasm(exe: Exe, argv: string[], image?: Uint8Array): Promise<number> {
    const provider = this.s.k.teto;
    if (!provider) return bad("ENOEXEC", "the experimental Teto WebAssembly core is unavailable from this host");
    const bytes = await provider.load("baseline");
    const runtime = await loadTeto(bytes, { initialPages: 1024, maximumPages: 32768 });
    const memory = wasmMemory(runtime.memory, false);
    return this.runTetoCore(exe, argv, image, { memory, exports: runtime.exports, label: "Teto WebAssembly core" }, memory.bytes.length);
  }

  private tetoRegister(memory: TetoMemory, hart: number, offset: number, register: number): bigint {
    if (register < 0 || register >= 32) return 0n;
    return new BigInt64Array(memory.buffer, TETO_HART_BASE + hart * TETO_HART_STRIDE + offset, 32)[register]!;
  }

  private tetoSetRegister(memory: TetoMemory, hart: number, offset: number, register: number, value: bigint): number {
    if (register < 0 || register >= 32 || (offset === H_X && register === 0)) return register === 0 ? 0 : -1;
    new BigInt64Array(memory.buffer, TETO_HART_BASE + hart * TETO_HART_STRIDE + offset, 32)[register] = BigInt.asIntN(64, value);
    return 0;
  }

  /** Thin-host packaging for strings and the random capability consumed by Teto. */
  private startup(argv: string[]): Uint8Array {
    const env = [...(this.s.env() as Map<string, string>)].map(([key, value]) => enc(`${key}=${value}`));
    const args = argv.map(value => enc(value));
    let size = 32;
    for (const value of env) size += 4 + value.length;
    for (const value of args) size += 4 + value.length;
    if (!Number.isSafeInteger(size) || size > 0x7fffffff) bad("EFBIG", "RV64 startup block is too large");
    const output = new Uint8Array(size);
    const view = new DataView(output.buffer);
    view.setUint32(0, TETO_STARTUP_MAGIC, true);
    view.setUint32(4, args.length, true);
    view.setUint32(8, env.length, true);
    crypto.getRandomValues(output.subarray(16, 32));
    let at = 32;
    for (const value of [...env, ...args]) {
      view.setUint32(at, value.length, true);
      at += 4;
      output.set(value, at);
      at += value.length;
    }
    return output;
  }

  private async runTetoCore(exe: Exe, argv: string[], image: Uint8Array | undefined, core: TetoCore, physicalBytes: number): Promise<number> {
    if (exe.machine !== "thistle64" || exe.isa !== "rv64gc") bad("ENOEXEC", "RV64 VM received another instruction profile");
    const raw = image ?? bad("ENOEXEC", `${core.label} needs the original THX image`);
    const { memory, exports } = core;
    if (exports.tetoKernelInit(0, 1, 0) !== 0 || exports.tetoHartInit(0, 0, 0x0000ffffffffffffn, 0n) !== 0) {
      bad("ENOMEM", `${core.label} memory initialisation failed`);
    }
    if (exports.tetoProcessInit(0, 0, this.s.pid, this.s.ppid, this.s.uid, this.s.euid, this.s.suid, this.s.gid, this.s.egid, this.s.sgid) !== 0) {
      bad("EPROTO", `${core.label} process initialisation failed`);
    }
    for (let index = 0; index < this.s.groups.length; index++) {
      if (exports.tetoProcessSetGroup(0, 0, index, this.s.groups[index]!) !== 0) {
        bad("EPROTO", `${core.label} supplementary-group initialisation failed`);
      }
    }
    // Teto's in-WASM VFS is still a bounded development mirror and is not yet
    // the syscall-authoritative filesystem. A mature persistent mikuOS root may
    // legitimately exceed its current inode/data capacities. Mirror the root
    // when possible, but keep the established Thistle compatibility bridge
    // authoritative until the complete writable VFS and syscall cohort moves.
    try {
      const rootImage = serializeTetoVfs(treeFs.dump(this.s.k.fs));
      const rootAt = exports.tetoImageReserve(0, rootImage.length) >>> 0;
      if (rootAt === 0xffffffff || rootAt + rootImage.length > memory.bytes.length) {
        throw new Error(`${core.label} root reservation failed`);
      }
      memory.bytes.set(rootImage, rootAt);
      const rootLoaded = exports.tetoLoadVfs(0, rootAt, rootImage.length);
      const rootReleased = exports.tetoImageRelease(0, rootAt, rootImage.length);
      if (rootReleased !== TETO_THX_OK) throw new Error(`${core.label} root release failed (${rootReleased})`);
      if (rootLoaded !== TETO_VFS_OK) throw new Error(`${core.label} rejected root image (${rootLoaded})`);
    } catch (error) {
      this.s.k.log(`teto: VFS mirror skipped; compatibility filesystem remains active: ${error instanceof Error ? error.message : String(error)}`);
    }
    const imageAt = exports.tetoImageReserve(0, raw.length) >>> 0;
    if (imageAt === 0xffffffff || imageAt + raw.length > memory.bytes.length) bad("ENOMEM", `${core.label} image reservation failed`);
    memory.bytes.set(raw, imageAt);
    const loaded = exports.tetoLoadThx(0, 0, imageAt, raw.length);
    const released = exports.tetoImageRelease(0, imageAt, raw.length);
    if (released !== TETO_THX_OK) bad("EPROTO", `${core.label} image release failed (${released})`);
    if (loaded !== TETO_THX_OK) bad("ENOEXEC", `${core.label} rejected THX image (${loaded})`);
    const startup = this.startup(argv);
    const startupAt = exports.tetoImageReserve(0, startup.length) >>> 0;
    if (startupAt === 0xffffffff || startupAt + startup.length > memory.bytes.length) bad("ENOMEM", `${core.label} startup reservation failed`);
    memory.bytes.set(startup, startupAt);
    const stackLimit = this.s.k.lim.stack;
    if (!Number.isSafeInteger(stackLimit) || stackLimit < 0 || stackLimit > 0xffffffff) bad("EINVAL", "invalid RV64 stack limit");
    const started = exports.tetoBuildInitialStack(0, 0, startupAt, startup.length, stackLimit);
    const startupReleased = exports.tetoImageRelease(0, startupAt, startup.length);
    if (startupReleased !== TETO_THX_OK) bad("EPROTO", `${core.label} startup release failed (${startupReleased})`);
    if (started !== TETO_START_OK) bad("ENOEXEC", `${core.label} rejected startup block (${started})`);
    this.xState = new BigInt64Array(memory.buffer, TETO_HART_BASE + H_X, 32);
    this.fState = new BigUint64Array(memory.buffer, TETO_HART_BASE + H_F, 32);
    this.exe = exe;
    this.m = new TetoMem64(memory, 0, exports.tetoHartVirtualTop(0, 0), physicalBytes,
      (hart, address, create) => exports.tetoGuestPage(0, hart, address, create ? 1 : 0));
    this.seg.length = 0;
    this.eat = 0n;
    this.eend = 0n;
    const seen: Array<[bigint, bigint]> = [];
    for (const section of exe.sec) {
      const at = BigInt(section.addr), end = at + BigInt(section.size);
      if (section.addr < 0x10000 || section.addr % section.align || end > this.m.top || section.data.length > section.size) {
        bad("ENOEXEC", `section ${section.name} has an invalid mapping`);
      }
      if (seen.some(([left, right]) => at < right && end > left)) bad("ENOEXEC", `section ${section.name} overlaps another section`);
      seen.push([at, end]);
      this.seg.push({ name: section.name, at, end, flg: section.flg });
    }
    this.floor = exports.tetoHartImageFloor(0, 0);
    this.brk = al(this.floor);
    this.mapAt = 0x4000000000n;
    this.pc = exports.tetoHartPc(0, 0);
    this.stackAt = exports.tetoHartStackBottom(0, 0);
    this.trace = false;
    let fuel = this.s.k.lim.fuel;
    while (!this.done) {
      this.s.chk();
      const before = exports.tetoHartMetric(0, 0, H_INSTRUCTIONS);
      const result = exports.tetoRunRv64Batch(0, 0, 16384, BigInt(Date.now()) * 1000n, 0);
      const after = exports.tetoHartMetric(0, 0, H_INSTRUCTIONS);
      if (fuel) {
        fuel -= Number(after - before);
        if (fuel < 0) bad("ELOOP", "RV64 instruction limit reached");
      }
      this.pc = exports.tetoHartPc(0, 0);
      this.brk = exports.tetoHartBreak(0, 0);
      if (result === TETO_BATCH_SYSCALL) {
        if (this.s.env("THISTLE_TETO_STRICT") === "1") bad("ENOSYS", `${core.label} requested a direct-Thistle syscall fallback`);

        // Teto owns credentials, brk and anonymous mmap state.
        // Synchronise the compatibility bridge before a fallback syscall.
        this.syncTetoCredentials(memory);
        this.syncTetoMemoryState(exports);

        await this.sys();
        if (this.done) break;
        if (exports.tetoHartSetPc(0, 0, ux(this.pc)) !== 0 || exports.tetoResumeSyscall(0, 0, this.x[10]!) !== 0) {
          bad("EPROTO", `${core.label} syscall resume failed`);
        }
      } else if (result === TETO_BATCH_HOST) {
        const operation = exports.tetoHostOperation(0, 0);
        if (operation !== TETO_HOST_WRITE) bad("ENOSYS", `${core.label} requested unsupported host operation ${operation}`);
        const descriptor = exports.tetoHostDescriptor(0, 0);
        const address = exports.tetoHostAddress(0, 0);
        const length = exports.tetoHostLength(0, 0);
        const fd = this.s.p.fds.get(descriptor);
        let hostResult: bigint;
        try {
          hostResult = fd?.output ? BigInt(await fd.output.wr(this.m.read(address, length))) : -9n;
        } catch (error) {
          if (!(error instanceof KErr)) throw error;
          hostResult = -BigInt(eno[error.code] ?? 5);
        }
        if (exports.tetoResumeHost(0, 0, hostResult) !== 0) bad("EPROTO", `${core.label} host-operation resume failed`);
      } else if (result === TETO_BATCH_EXITED) {
        this.exit(BigInt(exports.tetoHartExitCode(0, 0)));
        break;
      } else if (result === TETO_BATCH_FAULT) {
        const fault = loadI32(memory, TETO_HART_BASE + H_FAULT);
        const instruction = loadU32(memory, TETO_HART_BASE + H_LAST_INSTRUCTION);
        if (fault === TETO_FAULT_BREAKPOINT) bad("EINTR", `RV64 breakpoint at 0x${this.pc.toString(16)}`);
        bad("ENOEXEC", `${core.label} fault ${fault} on instruction 0x${instruction.toString(16).padStart(8, "0")} at 0x${this.pc.toString(16)}`);
      } else if (result === TETO_BATCH_BUSY || result === TETO_BATCH_CONTENDED) {
        await this.s.yield();
        continue;
      }
      await this.s.yield();
    }
    return this.code & 0xff;
  }

  private syncTetoCredentials(memory: TetoMemory): void {
    const slot = loadU32(memory, TETO_HART_BASE + H_PROCESS_SLOT);
    if (slot === 0xffffffff) return;

    const table = loadU32(
      memory,
      TETO_CONTROL_BASE + C_PROCESS_TABLE_BASE,
    );
    const proc = table + slot * TETO_PROCESS_STRIDE;

    const ruid = loadU32(memory, proc + P_RUID);
    const euid = loadU32(memory, proc + P_EUID);
    const suid = loadU32(memory, proc + P_SUID);
    const fsuid = loadU32(memory, proc + P_FSUID);

    const rgid = loadU32(memory, proc + P_RGID);
    const egid = loadU32(memory, proc + P_EGID);
    const sgid = loadU32(memory, proc + P_SGID);
    const fsgid = loadU32(memory, proc + P_FSGID);

    const count = Math.min(
      loadU32(memory, proc + P_GROUP_COUNT),
      TETO_GROUP_CAPACITY,
    );

    const groups: number[] = [];

    for (let index = 0; index < count; index++) {
      groups.push(
        loadU32(memory, proc + P_GROUPS + index * 4),
      );
    }

    this.s.p.cred = {
      uid: euid,
      gid: egid,
      ruid,
      euid,
      suid,
      rgid,
      egid,
      sgid,
      groups,
    };

    this.s.p.fsuid = fsuid;
    this.s.p.fsgid = fsgid;
  }

  private syncTetoMemoryState(exports: TetoExports): void {
    this.brk = exports.tetoHartBreak(0, 0);

    // Retain file-backed mappings maintained by the compatibility bridge.
    const hostOwned = this.maps.filter(
      mapping => mapping.path !== undefined,
    );

    this.maps.length = 0;
    this.maps.push(...hostOwned);

    const count = exports.tetoProcessMapCount(0, 0);

    for (let index = 0; index < count; index++) {
      const at = exports.tetoProcessMapAddress(0, 0, index);
      const end = exports.tetoProcessMapEnd(0, 0, index);
      const prot = exports.tetoProcessMapProtection(0, 0, index);

      if (end > at) {
        this.maps.push({
          at,
          end,
          prot,
          shared: false,
        });
      }
    }
  }

  private step(): void | Promise<void> {
    const at = this.pc;
    if (this.trace) console.log(`${at.toString(16)} ${[...this.x].map(n => ux(n).toString(16)).join(" ")}`);
    this.exec(at, 2);
    const h = this.m.u16(at);
    if ((h & 3) !== 3) { this.pc = ux(at + 2n); this.cstep(h, at); return; }
    this.exec(at, 4);
    const i = this.m.u32(at);
    this.pc = ux(at + 4n);
    const op = i & 0x7f, d = i >>> 7 & 31, f3 = i >>> 12 & 7, a = i >>> 15 & 31, b = i >>> 20 & 31, f7 = i >>> 25;
    const xv = this.x[a]!, yv = this.x[b]!;
    const put = (n: bigint): void => { if (d) this.x[d] = sx(n, 64); };
    switch (op) {
      case 0x03: this.load(d, f3, xv + this.immI(i)); break;
      case 0x07: this.fload(d, f3, xv + this.immI(i)); break;
      case 0x0f: break;
      case 0x13: this.opI(d, f3, i, xv); break;
      case 0x17: put(at + this.immU(i)); break;
      case 0x1b: this.opIW(d, f3, i, xv); break;
      case 0x23: this.store(f3, xv + this.immS(i), yv); break;
      case 0x27: this.fstore(b, f3, xv + this.immS(i)); break;
      case 0x2f: this.atomic(d, f3, i, xv, yv); break;
      case 0x33: this.opR(d, f3, f7, xv, yv); break;
      case 0x37: put(this.immU(i)); break;
      case 0x3b: this.opRW(d, f3, f7, xv, yv); break;
      case 0x43: case 0x47: case 0x4b: case 0x4f: this.fma(op, d, i, a, b); break;
      case 0x53: this.fop(d, f3, f7, a, b, i); break;
      case 0x63: if (this.branch(f3, xv, yv)) this.pc = ux(at + this.immB(i)); break;
      case 0x67: if (f3) this.bad(i, at); else { const q = ux(xv + this.immI(i)) & ~1n; put(at + 4n); this.pc = q; } break;
      case 0x6f: put(at + 4n); this.pc = ux(at + this.immJ(i)); break;
      case 0x73:
        if (i === 0x00000073) return this.sys();
        else if (i === 0x00100073) bad("EINTR", `RV64 breakpoint at 0x${at.toString(16)}`);
        else this.csr(d, f3, i, xv, a);
        break;
      default: this.bad(i, at);
    }
  }

  private cstep(i: number, at: bigint): void {
    const q = i & 3, f = i >>> 13, rd = i >>> 7 & 31, rs = i >>> 2 & 31;
    const rp = 8 + (i >>> 7 & 7), sp = 8 + (i >>> 2 & 7), ci = sx(BigInt((i >>> 7 & 0x20) | (i >>> 2 & 0x1f)), 6);
    if (q === 0) {
      if (f === 0) {
        const n = (i >>> 1 & 0x3c0) | (i >>> 7 & 0x30) | (i >>> 2 & 8) | (i >>> 4 & 4);
        if (!n) this.bad(i, at); this.set(sp, this.x[2]! + BigInt(n));
      } else if (f === 1) {
        const n = (i << 1 & 0xc0) | (i >>> 7 & 0x38); this.fload(sp, 3, this.x[rp]! + BigInt(n));
      } else if (f === 2) {
        const n = (i << 1 & 0x40) | (i >>> 7 & 0x38) | (i >>> 4 & 4); this.load(sp, 2, this.x[rp]! + BigInt(n));
      } else if (f === 3) {
        const n = (i << 1 & 0xc0) | (i >>> 7 & 0x38); this.load(sp, 3, this.x[rp]! + BigInt(n));
      } else if (f === 5) {
        const n = (i << 1 & 0xc0) | (i >>> 7 & 0x38); this.fstore(sp, 3, this.x[rp]! + BigInt(n));
      } else if (f === 6) {
        const n = (i << 1 & 0x40) | (i >>> 7 & 0x38) | (i >>> 4 & 4); this.store(2, this.x[rp]! + BigInt(n), this.x[sp]!);
      } else if (f === 7) {
        const n = (i << 1 & 0xc0) | (i >>> 7 & 0x38); this.store(3, this.x[rp]! + BigInt(n), this.x[sp]!);
      } else this.bad(i, at);
      return;
    }
    if (q === 1) {
      if (f === 0) this.set(rd, this.x[rd]! + ci);
      else if (f === 1) { if (!rd) this.bad(i, at); this.set(rd, sx(this.x[rd]! + ci, 32)); }
      else if (f === 2) this.set(rd, ci);
      else if (f === 3) {
        if (rd === 2) {
          const n = (i >>> 3 & 0x200) | (i >>> 2 & 0x10) | (i << 1 & 0x40) | (i << 4 & 0x180) | (i << 3 & 0x20);
          const z = sx(BigInt(n), 10); if (!z) this.bad(i, at); this.set(2, this.x[2]! + z);
        } else { const z = sx(BigInt((i << 5 & 0x20000) | (i << 10 & 0x1f000)), 18); if (!rd || !z) this.bad(i, at); this.set(rd, z); }
      } else if (f === 4) {
        const f2 = i >>> 10 & 3, sh = BigInt((i >>> 7 & 0x20) | (i >>> 2 & 0x1f));
        if (f2 === 0) this.set(rp, ux(this.x[rp]!) >> sh);
        else if (f2 === 1) this.set(rp, this.x[rp]! >> sh);
        else if (f2 === 2) this.set(rp, this.x[rp]! & ci);
        else {
          const hi = i >>> 12 & 1, lo = i >>> 5 & 3;
          if (!hi && lo === 0) this.set(rp, this.x[rp]! - this.x[sp]!);
          else if (!hi && lo === 1) this.set(rp, this.x[rp]! ^ this.x[sp]!);
          else if (!hi && lo === 2) this.set(rp, this.x[rp]! | this.x[sp]!);
          else if (!hi && lo === 3) this.set(rp, this.x[rp]! & this.x[sp]!);
          else if (hi && lo === 0) this.set(rp, sx(this.x[rp]! - this.x[sp]!, 32));
          else if (hi && lo === 1) this.set(rp, sx(this.x[rp]! + this.x[sp]!, 32));
          else this.bad(i, at);
        }
      } else if (f === 5) this.pc = ux(at + this.cj(i));
      else if (f === 6 || f === 7) {
        const n = (i >>> 4 & 0x100) | (i << 1 & 0xc0) | (i << 3 & 0x20) | (i >>> 7 & 0x18) | (i >>> 2 & 6);
        if ((f === 6 ? this.x[rp] === 0n : this.x[rp] !== 0n)) this.pc = ux(at + sx(BigInt(n), 9));
      } else this.bad(i, at);
      return;
    }
    if (q === 2) {
      if (f === 0) { const sh = BigInt((i >>> 7 & 0x20) | (i >>> 2 & 0x1f)); if (!rd) this.bad(i, at); this.set(rd, ux(this.x[rd]!) << sh); }
      else if (f === 1) { const n = (i << 4 & 0x1c0) | (i >>> 7 & 0x20) | (i >>> 2 & 0x18); if (!rd) this.bad(i, at); this.fload(rd, 3, this.x[2]! + BigInt(n)); }
      else if (f === 2) { const n = (i << 4 & 0xc0) | (i >>> 7 & 0x20) | (i >>> 2 & 0x1c); if (!rd) this.bad(i, at); this.load(rd, 2, this.x[2]! + BigInt(n)); }
      else if (f === 3) { const n = (i << 4 & 0x1c0) | (i >>> 7 & 0x20) | (i >>> 2 & 0x18); if (!rd) this.bad(i, at); this.load(rd, 3, this.x[2]! + BigInt(n)); }
      else if (f === 4) {
        const hi = i >>> 12 & 1;
        if (!hi && !rs) { if (!rd) this.bad(i, at); this.pc = ux(this.x[rd]!); }
        else if (!hi) { if (!rd) this.bad(i, at); this.set(rd, this.x[rs]!); }
        else if (!rs && !rd) bad("EINTR", `RV64 breakpoint at 0x${at.toString(16)}`);
        else if (!rs) { const to = ux(this.x[rd]!); this.set(1, at + 2n); this.pc = to; }
        else { if (!rd) this.bad(i, at); this.set(rd, this.x[rd]! + this.x[rs]!); }
      } else if (f === 5) { const n = (i >>> 1 & 0x1c0) | (i >>> 7 & 0x38); this.fstore(rs, 3, this.x[2]! + BigInt(n)); }
      else if (f === 6) { const n = (i >>> 1 & 0xc0) | (i >>> 7 & 0x3c); this.store(2, this.x[2]! + BigInt(n), this.x[rs]!); }
      else if (f === 7) { const n = (i >>> 1 & 0x1c0) | (i >>> 7 & 0x38); this.store(3, this.x[2]! + BigInt(n), this.x[rs]!); }
      else this.bad(i, at);
      return;
    }
    this.bad(i, at);
  }

  private cj(i: number): bigint {
    const n = (i >>> 1 & 0x800) | (i << 2 & 0x400) | (i >>> 1 & 0x300) | (i << 1 & 0x80) | (i >>> 1 & 0x40) | (i << 3 & 0x20) | (i >>> 7 & 0x10) | (i >>> 2 & 0xe);
    return sx(BigInt(n), 12);
  }

  private opI(d: number, f: number, i: number, a: bigint): void {
    const im = this.immI(i), sh = BigInt(i >>> 20 & 63);
    switch (f) {
      case 0: this.set(d, a + im); break;
      case 1: if (i >>> 26) this.bad(i); else this.set(d, ux(a) << sh); break;
      case 2: this.set(d, a < im ? 1n : 0n); break;
      case 3: this.set(d, ux(a) < ux(im) ? 1n : 0n); break;
      case 4: this.set(d, a ^ im); break;
      case 5: {
        const top = i >>> 26;
        if (top === 0) this.set(d, ux(a) >> sh);
        else if (top === 0x10) this.set(d, a >> sh);
        else this.bad(i);
        break;
      }
      case 6: this.set(d, a | im); break;
      case 7: this.set(d, a & im); break;
    }
  }

  private opIW(d: number, f: number, i: number, a: bigint): void {
    const sh = BigInt(i >>> 20 & 31);
    if (f === 0) this.set(d, sx(a + this.immI(i), 32));
    else if (f === 1 && i >>> 25 === 0) this.set(d, sx(sx(a, 32) << sh, 32));
    else if (f === 5 && i >>> 25 === 0) this.set(d, sx(BigInt.asUintN(32, a) >> sh, 32));
    else if (f === 5 && i >>> 25 === 0x20) this.set(d, sx(sx(a, 32) >> sh, 32));
    else this.bad(i);
  }

  private opR(d: number, f: number, top: number, a: bigint, b: bigint): void {
    const sh = ux(b) & 63n;
    if (top === 1) {
      switch (f) {
        case 0: this.set(d, a * b); break;
        case 1: this.set(d, a * b >> 64n); break;
        case 2: this.set(d, a * ux(b) >> 64n); break;
        case 3: this.set(d, ux(a) * ux(b) >> 64n); break;
        case 4: this.set(d, this.div(a, b, false)); break;
        case 5: this.set(d, this.div(ux(a), ux(b), true)); break;
        case 6: this.set(d, this.rem(a, b, false)); break;
        case 7: this.set(d, this.rem(ux(a), ux(b), true)); break;
      }
      return;
    }
    switch (f) {
      case 0: if (top === 0) this.set(d, a + b); else if (top === 0x20) this.set(d, a - b); else this.badR(top, f); break;
      case 1: if (!top) this.set(d, ux(a) << sh); else this.badR(top, f); break;
      case 2: if (!top) this.set(d, a < b ? 1n : 0n); else this.badR(top, f); break;
      case 3: if (!top) this.set(d, ux(a) < ux(b) ? 1n : 0n); else this.badR(top, f); break;
      case 4: if (!top) this.set(d, a ^ b); else this.badR(top, f); break;
      case 5: if (!top) this.set(d, ux(a) >> sh); else if (top === 0x20) this.set(d, a >> sh); else this.badR(top, f); break;
      case 6: if (!top) this.set(d, a | b); else this.badR(top, f); break;
      case 7: if (!top) this.set(d, a & b); else this.badR(top, f); break;
    }
  }

  private opRW(d: number, f: number, top: number, a: bigint, b: bigint): void {
    const sh = ux(b) & 31n;
    if (top === 1) {
      const x = sx(a, 32), y = sx(b, 32), xu = BigInt.asUintN(32, a), yu = BigInt.asUintN(32, b);
      if (f === 0) this.set(d, sx(x * y, 32));
      else if (f === 4) this.set(d, sx(this.div(x, y, false), 32));
      else if (f === 5) this.set(d, sx(this.div(xu, yu, true, 32), 32));
      else if (f === 6) this.set(d, sx(this.rem(x, y, false), 32));
      else if (f === 7) this.set(d, sx(this.rem(xu, yu, true), 32));
      else this.badR(top, f);
      return;
    }
    if (f === 0 && top === 0) this.set(d, sx(a + b, 32));
    else if (f === 0 && top === 0x20) this.set(d, sx(a - b, 32));
    else if (f === 1 && top === 0) this.set(d, sx(sx(a, 32) << sh, 32));
    else if (f === 5 && top === 0) this.set(d, sx(BigInt.asUintN(32, a) >> sh, 32));
    else if (f === 5 && top === 0x20) this.set(d, sx(sx(a, 32) >> sh, 32));
    else this.badR(top, f);
  }

  private fma(op: number, d: number, i: number, a: number, b: number): void {
    const c = i >>> 27 & 31, fmt = i >>> 25 & 3, single = fmt === 0;
    if (!single && fmt !== 1) this.bad(i);
    this.rm(i >>> 12 & 7);
    const x = this.fr(a, single), y = this.fr(b, single), z = this.fr(c, single);
    const n = op === 0x43 ? x * y + z : op === 0x47 ? x * y - z : op === 0x4b ? -x * y + z : -x * y - z;
    this.fp(d, n, single);
  }

  private fop(d: number, f3: number, top: number, a: number, b: number, i: number): void {
    const single = !(top & 1), x = (): number => this.fr(a, single), y = (): number => this.fr(b, single);
    if (top === 0x00 || top === 0x01) { this.rm(f3); this.fp(d, x() + y(), single); return; }
    if (top === 0x04 || top === 0x05) { this.rm(f3); this.fp(d, x() - y(), single); return; }
    if (top === 0x08 || top === 0x09) { this.rm(f3); this.fp(d, x() * y(), single); return; }
    if (top === 0x0c || top === 0x0d) {
      this.rm(f3); const q = x(), z = y();
      if (!z && q) this.fcsr |= 8; else if (!z && !q) this.fcsr |= 16;
      this.fp(d, q / z, single); return;
    }
    if (top === 0x10 || top === 0x11) {
      if (f3 > 2) this.bad(i);
      const sign = single ? 0x80000000n : 0x8000000000000000n, mag = this.fraw(a, single) & ~sign;
      const sa = this.fraw(a, single) & sign, sb = this.fraw(b, single) & sign;
      this.fbits(d, mag | (f3 === 0 ? sb : f3 === 1 ? sb ^ sign : sa ^ sb), single); return;
    }
    if (top === 0x14 || top === 0x15) {
      if (f3 > 1) this.bad(i);
      const q = x(), z = y();
      if (Number.isNaN(q) && Number.isNaN(z)) this.fbits(d, single ? 0x7fc00000n : 0x7ff8000000000000n, single);
      else if (Number.isNaN(q)) this.fbits(d, this.fraw(b, single), single);
      else if (Number.isNaN(z)) this.fbits(d, this.fraw(a, single), single);
      else this.fp(d, f3 ? Math.max(q, z) : Math.min(q, z), single);
      return;
    }
    if (top === 0x20) { if (b !== 1) this.bad(i); this.rm(f3); this.fp(d, this.fr(a, false), true); return; }
    if (top === 0x21) { if (b !== 0) this.bad(i); this.rm(f3); this.fp(d, this.fr(a, true), false); return; }
    if (top === 0x2c || top === 0x2d) { if (b) this.bad(i); this.rm(f3); this.fp(d, Math.sqrt(x()), single); return; }
    if (top === 0x50 || top === 0x51) {
      const q = x(), z = y(); if (f3 > 2) this.bad(i);
      if (Number.isNaN(q) || Number.isNaN(z)) { if (f3 !== 2) this.fcsr |= 16; this.set(d, 0n); }
      else this.set(d, f3 === 0 ? q <= z ? 1n : 0n : f3 === 1 ? q < z ? 1n : 0n : q === z ? 1n : 0n);
      return;
    }
    if (top === 0x60 || top === 0x61) {
      if (b > 3) this.bad(i); const bits = b < 2 ? 32 : 64, uns = !!(b & 1), q = this.toInt(x(), bits, uns, this.rm(f3));
      this.set(d, bits === 32 ? sx(q, 32) : q); return;
    }
    if (top === 0x68 || top === 0x69) {
      if (b > 3) this.bad(i); this.rm(f3);
      const q = b === 0 ? sx(this.x[a]!, 32) : b === 1 ? BigInt.asUintN(32, this.x[a]!) : b === 2 ? this.x[a]! : ux(this.x[a]!);
      this.fp(d, Number(q), single); return;
    }
    if (top === 0x70 || top === 0x71) {
      if (b) this.bad(i);
      if (f3 === 0) this.set(d, single ? sx(this.fraw(a, true), 32) : this.fraw(a, false));
      else if (f3 === 1) this.set(d, this.fclass(a, single));
      else this.bad(i);
      return;
    }
    if (top === 0x78 || top === 0x79) {
      if (b || f3) this.bad(i);
      this.fbits(d, single ? BigInt.asUintN(32, this.x[a]!) : ux(this.x[a]!), single); return;
    }
    this.bad(i);
  }

  private fr(n: number, single: boolean): number {
    if (!single) return f64(this.f[n]!);
    return this.f[n]! >> 32n === 0xffffffffn ? f32(this.f[n]!) : NaN;
  }

  private fraw(n: number, single: boolean): bigint {
    if (!single) return this.f[n]!;
    return this.f[n]! >> 32n === 0xffffffffn ? this.f[n]! & 0xffffffffn : 0x7fc00000n;
  }

  private fp(d: number, n: number, single: boolean): void { this.fbits(d, single ? b32(n) : b64(n), single); }
  private fbits(d: number, n: bigint, single: boolean): void { this.f[d] = single ? 0xffffffff00000000n | BigInt.asUintN(32, n) : ux(n); }

  private fclass(n: number, single: boolean): bigint {
    const q = this.fraw(n, single), eb = single ? 8n : 11n, fb = single ? 23n : 52n;
    const sign = q >> (eb + fb) & 1n, exp = q >> fb & ((1n << eb) - 1n), frac = q & ((1n << fb) - 1n), all = (1n << eb) - 1n;
    if (exp === all) {
      if (!frac) return 1n << (sign ? 0n : 7n);
      return 1n << (frac & (1n << (fb - 1n)) ? 9n : 8n);
    }
    if (!exp) {
      if (!frac) return 1n << (sign ? 3n : 4n);
      return 1n << (sign ? 2n : 5n);
    }
    return 1n << (sign ? 1n : 6n);
  }

  private rm(n: number): number {
    const q = n === 7 ? this.fcsr >>> 5 & 7 : n;
    if (q > 4) bad("ENOEXEC", `bad RV64 rounding mode ${q}`);
    return q;
  }

  private toInt(n: number, bits: number, uns: boolean, rm: number): bigint {
    let q: number;
    if (rm === 1) q = Math.trunc(n);
    else if (rm === 2) q = Math.floor(n);
    else if (rm === 3) q = Math.ceil(n);
    else {
      const lo = Math.floor(n), f = n - lo;
      q = f < 0.5 ? lo : f > 0.5 ? lo + 1 : rm === 4 ? n < 0 ? lo : lo + 1 : lo % 2 ? lo + 1 : lo;
    }
    const min = uns ? 0n : -(1n << BigInt(bits - 1)), max = uns ? (1n << BigInt(bits)) - 1n : (1n << BigInt(bits - 1)) - 1n;
    if (Number.isNaN(q)) { this.fcsr |= 16; return max; }
    if (q <= Number(min)) { if (q < Number(min)) this.fcsr |= 16; return min; }
    if (q >= Number(max)) { if (q > Number(max)) this.fcsr |= 16; return max; }
    return BigInt(q);
  }

  private load(d: number, f: number, at0: bigint): void {
    const at = ux(at0);
    if (f === 0) { this.mem(at, 1); this.set(d, this.m.i8(at)); }
    else if (f === 1) { this.mem(at, 2); this.set(d, this.m.i16(at)); }
    else if (f === 2) { this.mem(at, 4); this.set(d, this.m.i32(at)); }
    else if (f === 3) { this.mem(at, 8); this.set(d, this.m.i64(at)); }
    else if (f === 4) { this.mem(at, 1); this.set(d, BigInt(this.m.u8(at))); }
    else if (f === 5) { this.mem(at, 2); this.set(d, BigInt(this.m.u16(at))); }
    else if (f === 6) { this.mem(at, 4); this.set(d, BigInt(this.m.u32(at))); }
    else this.badR(0, f);
  }

  private store(f: number, at0: bigint, n: bigint): void {
    const at = ux(at0);
    if (f === 0) { this.mem(at, 1, true); this.m.set8(at, n); }
    else if (f === 1) { this.mem(at, 2, true); this.m.set16(at, n); }
    else if (f === 2) { this.mem(at, 4, true); this.m.set32(at, n); }
    else if (f === 3) { this.mem(at, 8, true); this.m.set64(at, n); }
    else this.badR(0, f);
  }

  private fload(d: number, f: number, at0: bigint): void {
    const at = ux(at0);
    if (f === 2) { this.mem(at, 4); this.f[d] = 0xffffffff00000000n | BigInt(this.m.u32(at)); }
    else if (f === 3) { this.mem(at, 8); this.f[d] = this.m.u64(at); }
    else this.badR(0, f);
  }

  private fstore(s: number, f: number, at0: bigint): void {
    const at = ux(at0);
    if (f === 2) { this.mem(at, 4, true); this.m.set32(at, this.f[s]!); }
    else if (f === 3) { this.mem(at, 8, true); this.m.set64(at, this.f[s]!); }
    else this.badR(0, f);
  }

  private atomic(d: number, f: number, i: number, at0: bigint, n: bigint): void {
    if (f !== 2 && f !== 3) this.bad(i);
    const at = ux(at0), z = f === 2 ? 4 : 8, fn = i >>> 27;
    this.mem(at, z, fn !== 2);
    const old = f === 2 ? this.m.i32(at) : this.m.i64(at);
    if (fn === 2) { if ((i >>> 20 & 31) !== 0) this.bad(i); this.res = at; this.set(d, old); return; }
    if (fn === 3) {
      const ok = this.res === at; this.res = -1n;
      if (ok) f === 2 ? this.m.set32(at, n) : this.m.set64(at, n);
      this.set(d, ok ? 0n : 1n); return;
    }
    const a = f === 2 ? sx(old, 32) : old, b = f === 2 ? sx(n, 32) : n;
    const au = f === 2 ? BigInt.asUintN(32, old) : ux(old), bu = f === 2 ? BigInt.asUintN(32, n) : ux(n);
    let out: bigint;
    if (fn === 0) out = a + b;
    else if (fn === 1) out = b;
    else if (fn === 4) out = a ^ b;
    else if (fn === 8) out = a | b;
    else if (fn === 12) out = a & b;
    else if (fn === 16) out = a < b ? a : b;
    else if (fn === 20) out = a > b ? a : b;
    else if (fn === 24) out = au < bu ? au : bu;
    else if (fn === 28) out = au > bu ? au : bu;
    else return this.bad(i);
    if (f === 2) this.m.set32(at, out); else this.m.set64(at, out);
    this.res = -1n; this.set(d, old);
  }

  private branch(f: number, a: bigint, b: bigint): boolean {
    if (f === 0) return a === b;
    if (f === 1) return a !== b;
    if (f === 4) return a < b;
    if (f === 5) return a >= b;
    if (f === 6) return ux(a) < ux(b);
    if (f === 7) return ux(a) >= ux(b);
    return this.badR(0, f);
  }

  private csr(d: number, f: number, i: number, a: bigint, ai: number): void {
    const id = i >>> 20, now = BigInt(Date.now()) * 1000n, rw = id >= 1 && id <= 3;
    const old = id === 0xc00 || id === 0xc02 ? 0n : id === 0xc01 ? now : id === 1 ? BigInt(this.fcsr & 31) : id === 2 ? BigInt(this.fcsr >>> 5 & 7) : id === 3 ? BigInt(this.fcsr & 255) : this.bad(i);
    if (![1, 2, 3, 5, 6, 7].includes(f)) this.bad(i);
    const n = f >= 5 ? BigInt(ai) : ux(a), wr = f === 1 || f === 5 ? n : f === 2 || f === 6 ? old | n : old & ~n;
    const hit = f === 1 || f === 5 || n !== 0n;
    if (hit && !rw) this.bad(i);
    if (hit) {
      if (id === 1) this.fcsr = this.fcsr & ~31 | Number(wr & 31n);
      else if (id === 2) this.fcsr = this.fcsr & 31 | Number(wr & 7n) << 5;
      else this.fcsr = Number(wr & 255n);
    }
    this.set(d, old);
  }

  private async sys(): Promise<void> {
    try { this.set(10, await this.call(Number(ux(this.x[17]!)))); }
    catch (e) { if (e instanceof KErr) this.set(10, -BigInt(eno[e.code] ?? 5)); else throw e; }
  }

  private async call(n: number): Promise<bigint> {
    const a = this.x;
    switch (n) {
      case 17: { const b = enc(this.s.cwd + "\0"); return BigInt(this.copy(b, this.addr(a[10]!), this.nat(a[11]!, "getcwd length", MAX_IO))); }
      case 23: return BigInt(this.s.dup(this.fd(a[10]!)));
      case 24: return BigInt(this.dup3(a[10]!, a[11]!, a[12]!));
      case 25: return BigInt(this.fcntl(this.fd(a[10]!), this.nat(a[11]!, "fcntl command", 0x7fffffff), a[12]!));
      case 29: return this.ioctl(this.fd(a[10]!), this.nat(a[11]!, "ioctl request", 0xffffffff), this.addr(a[12]!));
      case 34: this.s.mkdir(this.path(a[10]!, this.str(a[11]!)), this.nat(a[12]!, "mode", 0xffff)); return 0n;
      case 35: { const p = this.path(a[10]!, this.str(a[11]!)); this.s.rm(p, !!(this.nat(a[12]!, "unlink flags", 0xffff) & 0x200)); return 0n; }
      case 36: this.s.symlink(this.str(a[10]!), this.path(a[11]!, this.str(a[12]!))); return 0n;
      case 37: this.s.link(this.path(a[10]!, this.str(a[11]!)), this.path(a[12]!, this.str(a[13]!))); return 0n;
      case 38: this.s.mv(this.path(a[10]!, this.str(a[11]!)), this.path(a[12]!, this.str(a[13]!))); return 0n;
      case 276: {
        const flags = this.nat(a[14]!, "renameat2 flags", 0xffffffff);

        // Linux RENAME_NOREPLACE is useful to musl and account-management
        // transactions. Exchange and whiteout semantics are not implemented.
        if (flags & ~1) {
          bad("EINVAL", "unsupported renameat2 flags");
        }

        const from = this.path(a[10]!, this.str(a[11]!));
        const to = this.path(a[12]!, this.str(a[13]!));

        if (flags & 1) {
          let exists = true;

          try {
            this.s.stat(to, false);
          } catch (error) {
            if (!(error instanceof KErr) || error.code !== "ENOENT") {
              throw error;
            }
            exists = false;
          }

          if (exists) bad("EEXIST", to);
        }

        this.s.mv(from, to);
        return 0n;
      }
      case 43: this.s.stat(this.str(a[10]!)); return this.statfs(this.addr(a[11]!));
      case 44: { const fd = this.fd(a[10]!), f = this.s.p.fds.get(fd) ?? bad("EBADF", String(a[10])); if (fd >= 3) this.s.stat(f.path ?? bad("EBADF", String(fd))); return this.statfs(this.addr(a[11]!)); }
      case 45: this.trunc(this.str(a[10]!), this.nat(a[11]!, "file length", this.s.k.fs.cap)); return 0n;
      case 46: { const f = this.s.p.fds.get(this.fd(a[10]!)) ?? bad("EBADF", String(a[10])); this.trunc(f.path ?? bad("EBADF", String(a[10])), this.nat(a[11]!, "file length", this.s.k.fs.cap)); return 0n; }
      case 48: this.s.stat(this.path(a[10]!, this.str(a[11]!))); return 0n;
      case 49: this.s.cd(this.str(a[10]!)); return 0n;
      case 50: { const f = this.s.p.fds.get(this.fd(a[10]!)) ?? bad("EBADF", String(a[10])); this.s.cd(f.path ?? bad("EBADF", String(a[10]))); return 0n; }
      case 52: { const f = this.s.p.fds.get(this.fd(a[10]!)) ?? bad("EBADF", String(a[10])); this.s.chmod(f.path ?? bad("EBADF", String(a[10])), this.nat(a[11]!, "mode", 0xffff)); return 0n; }
      case 53: this.s.chmod(this.path(a[10]!, this.str(a[11]!)), this.nat(a[12]!, "mode", 0xffff)); return 0n;
      case 54: this.s.chown(this.path(a[10]!, this.str(a[11]!)), this.owner(a[12]!, "uid"), this.owner(a[13]!, "gid")); return 0n;
      case 55: { const f = this.s.p.fds.get(this.fd(a[10]!)) ?? bad("EBADF", String(a[10])); this.s.chown(f.path ?? bad("EBADF", String(a[10])), this.owner(a[11]!, "uid"), this.owner(a[12]!, "gid")); return 0n; }
      case 56: return BigInt(await this.openat(a[10]!, this.str(a[11]!), this.nat(a[12]!, "open flags", 0xffffffff), this.nat(a[13]!, "open mode", 0xffff)));
      case 57: {
        const fd = this.fd(a[10]!);
        this.localSockets.delete(fd);
        this.s.close(fd);
        return 0n;
      }
      case 59: {
        const at = this.addr(a[10]!), fl = this.nat(a[11]!, "pipe flags", 0xffffffff); this.mem(at, 8, true);
        if (fl & ~(O_CLOEXEC | O_NONBLOCK)) bad("EINVAL", "unsupported pipe flags");
        const [rd, wr] = this.s.pipe();
        if (fl & O_CLOEXEC) { this.s.p.fds.get(rd)!.clo = true; this.s.p.fds.get(wr)!.clo = true; }
        this.m.set32(at, rd); this.m.set32(at + 4n, wr); return 0n;
      }
      case 61: return BigInt(this.getdents(this.fd(a[10]!), this.addr(a[11]!), this.nat(a[12]!, "directory buffer length", MAX_IO)));
      case 62: return BigInt(this.s.seek(this.fd(a[10]!), this.num(a[11]!, "seek offset"), this.nat(a[12]!, "seek whence", 2)));
      case 63: {
        const fd = this.fd(a[10]!), at = this.addr(a[11]!), z = this.nat(a[12]!, "read length", MAX_IO);
        this.mem(at, z, true); const b = await this.read(fd, z); this.m.write(at, b); return BigInt(b.length);
      }
      case 64: {
        const fd = this.fd(a[10]!), at = this.addr(a[11]!), z = this.nat(a[12]!, "write length", MAX_IO);
        this.mem(at, z); return BigInt(await this.write(fd, this.m.read(at, z)));
      }
      case 65: return BigInt(await this.readv(this.fd(a[10]!), this.addr(a[11]!), this.nat(a[12]!, "iovec count", 1024)));
      case 66: return BigInt(await this.writev(this.fd(a[10]!), this.addr(a[11]!), this.nat(a[12]!, "iovec count", 1024)));
      case 67: return BigInt(this.pread(this.fd(a[10]!), this.addr(a[11]!), this.nat(a[12]!, "read length", MAX_IO), this.num(a[13]!, "read offset")));
      case 68: return BigInt(this.pwrite(this.fd(a[10]!), this.addr(a[11]!), this.nat(a[12]!, "write length", MAX_IO), this.num(a[13]!, "write offset")));
      case 73: return BigInt(this.ppoll(this.addr(a[10]!), this.nat(a[11]!, "poll descriptor count", 1024)));
      case 78: { const b = enc(this.s.readlink(this.path(a[10]!, this.str(a[11]!)))); return BigInt(this.copy(b, this.addr(a[12]!), this.nat(a[13]!, "readlink length", MAX_IO), true)); }
      case 79: { const p = this.str(a[11]!), fl = this.nat(a[13]!, "stat flags", 0xffff); return this.stat(this.path(a[10]!, p), this.addr(a[12]!), !(fl & 0x100)); }
      case 80: return this.fstat(this.fd(a[10]!), this.addr(a[11]!));
      case 81: case 82: case 83: return 0n;
      case 88: return this.utimens(a[10]!, a[11]!, a[12]!, a[13]!);
      case 93: case 94: return this.vf ? this.vfExit(a[10]!) : (this.exit(a[10]!), 0n);
      case 96: return BigInt(this.s.pid);
      case 98: return this.futex(a[10]!, a[11]!, a[12]!, a[13]!);
      case 99: return 0n;
      case 101: await this.sleepTs(this.addr(a[10]!)); return 0n;
      case 113: return this.clock(this.num(a[10]!, "clock id"), this.addr(a[11]!));
      case 114: return this.clockRes(this.num(a[10]!, "clock id"), this.addr(a[11]!));
      case 115: return this.clockSleep(a[10]!, a[11]!, a[12]!);
      case 122: return this.setAffinity(a[10]!, a[11]!, a[12]!);
      case 123: return this.getAffinity(a[10]!, a[11]!, a[12]!);
      case 124: await this.s.yield(); return 0n;
      case 129: case 130: case 131: return BigInt(this.s.kill(this.num(n === 129 ? a[10]! : a[11]!, "pid"), this.nat(n === 129 ? a[11]! : a[12]!, "signal", 64) as 0 | 1 | 2 | 9 | 13 | 15));
      case 132: case 134: case 135: return 0n;
      case 160: return this.uname(this.addr(a[10]!));
      case 153: return this.times(this.addr(a[10]!));
      case 163: return this.limit(0n, a[10]!, 0n, a[11]!);
      case 164: return this.limit(0n, a[10]!, a[11]!, 0n);
      case 165: return this.usage(a[10]!, this.addr(a[11]!));
      case 166: { const old = this.s.umask; this.s.umask = this.nat(a[10]!, "umask", 0o777); return BigInt(old); }
      case 168: return this.getcpu(a[10]!, a[11]!);
      case 169: return this.timeval(this.addr(a[10]!));
      case 143: this.s.setRegid(this.idOrKeep(a[10]!), this.idOrKeep(a[11]!)); return 0n;
      case 144: this.s.setGid(this.owner(a[10]!, "gid")); return 0n;
      case 145: this.s.setReuid(this.idOrKeep(a[10]!), this.idOrKeep(a[11]!)); return 0n;
      case 146: this.s.setUid(this.owner(a[10]!, "uid")); return 0n;
      case 147: this.s.setResuid(this.idOrKeep(a[10]!), this.idOrKeep(a[11]!), this.idOrKeep(a[12]!)); return 0n;
      case 148: return this.getres(this.addrPtr(a[10]!), this.addrPtr(a[11]!), this.addrPtr(a[12]!), false);
      case 149: this.s.setResgid(this.idOrKeep(a[10]!), this.idOrKeep(a[11]!), this.idOrKeep(a[12]!)); return 0n;
      case 150: return this.getres(this.addrPtr(a[10]!), this.addrPtr(a[11]!), this.addrPtr(a[12]!), true);
      case 151: return BigInt(this.s.setFsuid(this.owner(a[10]!, "uid")));
      case 152: return BigInt(this.s.setFsgid(this.owner(a[10]!, "gid")));
      case 158: return BigInt(this.getgroups(a[10]!, a[11]!));
      case 159: this.setgroups(a[10]!, a[11]!); return 0n;
      case 172: return BigInt(this.s.pid);
      case 173: return BigInt(this.s.ppid);
      case 174: return BigInt(this.s.uid);
      case 175: return BigInt(this.s.euid);
      case 176: return BigInt(this.s.gid);
      case 177: return BigInt(this.s.egid);
      case 178: return BigInt(this.s.pid);
      case 179: return this.sysinfo(this.addr(a[10]!));
      case 198: return BigInt(this.socket(
        this.nat(a[10]!, "socket domain", 0x7fffffff),
        this.nat(a[11]!, "socket type", 0xffffffff),
        this.nat(a[12]!, "socket protocol", 0x7fffffff),
      ));
      case 203: return this.connect(
        this.fd(a[10]!),
        this.addr(a[11]!),
        this.nat(a[12]!, "socket address length", 4096),
      );
      case 214: return this.doBrk(this.addr(a[10]!));
      case 215: this.unmap(this.addr(a[10]!), this.nat(a[11]!, "mapping length", Number.MAX_SAFE_INTEGER)); return 0n;
      case 216: return this.remap(a[10]!, a[11]!, a[12]!, a[13]!, a[14]!);
      case 220: return this.clone(a[10]!, a[11]!, a[13]!);
      case 221: return this.execve(this.str(a[10]!), this.addr(a[11]!), this.addr(a[12]!));
      case 222: return this.mmap(a[10]!, a[11]!, a[12]!, a[13]!, a[14]!, a[15]!);
      case 227: this.flushShared(this.addr(a[10]!), this.nat(a[11]!, "sync length", Number.MAX_SAFE_INTEGER)); return 0n;
      case 226: return 0n;
      case 233: return 0n;
      case 261: return this.limit(a[10]!, a[11]!, a[12]!, a[13]!);
      case 278: return BigInt(this.random(this.addr(a[10]!), this.nat(a[11]!, "random length", MAX_IO)));
      case 260: return this.wait4(a[10]!, this.addr(a[11]!), a[12]!, this.addr(a[13]!));
      default: if (!this.miss.has(n)) { this.miss.add(n); this.s.k.log(`rv64: unsupported syscall ${n}`); } return -38n;
    }
  }

  private async read(fd: number, n: number): Promise<Uint8Array> {
    const f = this.s.p.fds.get(fd) ?? bad("EBADF", String(fd));
    if (!f.input) return this.s.fdr(fd, n);
    let q = this.ins.get(fd);
    if (!q || q.at >= q.b.length) { q = { b: await f.input.rd(), at: 0 }; this.ins.set(fd, q); }
    const b = q.b.slice(q.at, q.at + n); q.at += b.length; return b;
  }

  private write(fd: number, b: Uint8Array): Promise<number> | number {
    const f = this.s.p.fds.get(fd) ?? bad("EBADF", String(fd));
    return f.output ? f.output.wr(b) : this.s.fdw(fd, b);
  }

  private clone(flags: bigint, sp: bigint, tls: bigint): bigint {
    if (this.vf) bad("EAGAIN", "nested RV64 clone");
    const par = this.copyFds(this.s.p.fds), kid = this.copyFds(this.s.p.fds, true);
    this.vf = { x: this.x.slice(), f: this.f.slice(), pc: this.pc, cwd: this.s.p.cwd, env: new Map(this.s.p.env), fds: par };
    this.s.p.fds.clear(); for (const [n, q] of kid) this.s.p.fds.set(n, q);
    if (sp) this.x[2] = sx(sp, 64);
    if (ux(flags) & 0x80000n) this.x[4] = sx(tls, 64);
    return 0n;
  }

  private async execve(path: string, av: bigint, ev: bigint): Promise<bigint> {
    const argv = this.vec(av), env = new Map<string, string>();

    for (const q of this.vec(ev)) {
      const n = q.indexOf("=");

      if (n > 0) {
        env.set(q.slice(0, n), q.slice(n + 1));
      }
    }

    if (!this.vf) {
      this.flushAllShared();
      await this.s.exec(path, argv.length ? argv : [path], env);
    }

    const io: Partial<Io> = {}, f0 = this.s.p.fds.get(0), f1 = this.s.p.fds.get(1), f2 = this.s.p.fds.get(2);
    if (f0?.input) io.sin = f0.input;
    if (f1?.output) io.sout = f1.output;
    if (f2?.output) io.serr = f2.output;
    const cwd = this.s.p.cwd, kid = [...this.s.p.fds.values()];
    const pass = new Map([...this.s.p.fds].filter(([, f]) => !f.clo));
    const p = this.s.start(path, (argv.length ? argv : [path]).slice(1), { io, fds: pass, cwd, env });
    this.restoreVf();
    this.dropFds(kid);
    return BigInt(p.pid);
  }

  private vfExit(code: bigint): bigint {
    const kid = [...this.s.p.fds.values()], n = Number(ux(code) & 255n);
    const p = this.s.start("thsh", ["-c", `exit ${n}`], { cwd: this.s.p.cwd, env: new Map(this.s.p.env) });
    this.restoreVf();
    this.dropFds(kid);
    return BigInt(p.pid);
  }

  private async wait4(pid0: bigint, st: bigint, fl0: bigint, ru: bigint): Promise<bigint> {
    const pid = this.num(pid0, "wait pid"), fl = this.nat(fl0, "wait flags", 0x7fffffff);
    const p = (pid > 0 ? this.s.k.procs.get(pid) : [...this.s.p.kids].map(n => this.s.k.procs.get(n)).find(q => q !== undefined)) ?? bad("ECHILD", String(pid));
    if (p.ppid !== this.s.pid) bad("ECHILD", String(pid));
    if ((fl & 1) && p.code === null) return 0n;
    const code = await p.done, sig = p.sig;
    if (st) { this.mem(st, 4, true); this.m.set32(st, sig ? sig & 0x7f : (code & 255) << 8); }
    if (ru) this.putUsage(ru, p.ms());
    this.s.reap(p.pid); return BigInt(p.pid);
  }

  private restoreVf(): void {
    const q = this.vf ?? bad("EPROTO", "missing RV64 parent context");
    this.x.set(q.x); this.f.set(q.f); this.pc = q.pc;
    this.s.p.cwd = q.cwd; this.s.p.env = new Map(q.env);
    this.s.p.fds.clear(); for (const [n, f] of q.fds) this.s.p.fds.set(n, f);
    this.vf = undefined;
  }

  private copyFds(src: Map<number, Fd>, hold = false): Map<number, Fd> {
    const out = new Map<number, Fd>();
    for (const [n, f] of src) {
      if (hold) { f.input?.holdR?.(); f.output?.hold?.(); }
      const q = new Fd(f.input, f.output, f.path, f.rd, f.wr, f.add, f.clo); q.pos = f.pos; out.set(n, q);
    }
    return out;
  }

  private dropFds(a: Fd[]): void { for (const f of a) { f.input?.releaseR?.(); f.output?.close?.(); } }

  private vec(at0: bigint): string[] {
    if (!at0) return [];
    const out: string[] = [], at = this.addr(at0);
    for (let i = 0; i < 4096; i++) { this.mem(at + BigInt(i * 8), 8); const p = this.m.u64(at + BigInt(i * 8)); if (!p) return out; out.push(this.str(p)); }
    return bad("EFBIG", "RV64 argument vector");
  }

  private async openat(fd0: bigint, p: string, fl: number, mode: number): Promise<number> {
    const path = this.path(fd0, p);
    const ac = fl & 3;
    if (ac === 3) bad("EINVAL", "invalid open access mode");

    let made = false;
    try {
      const st = this.s.stat(path);

      /*
       * Linux permits a directory to be opened read-only without requiring
       * O_DIRECTORY. Native software commonly does this to obtain a stable
       * directory descriptor for openat(), fstat() and getdents().
       */
      if (st.kind === "dir") {
        if (ac !== 0 || fl & (O_CREAT | O_TRUNC)) bad("EISDIR", path);

        const n = this.s.openDir(path);
        this.s.p.fds.get(n)!.clo = !!(fl & O_CLOEXEC);
        return n;
      }

      if (fl & O_DIRECTORY) bad("ENOTDIR", path);
      if (fl & O_CREAT && fl & O_EXCL) bad("EEXIST", path);
      await this.s.materialise(path);
    } catch (e) {
      if (!(e instanceof KErr) || e.code !== "ENOENT" || !(fl & O_CREAT)) {
        throw e;
      }

      if (fl & O_DIRECTORY) throw e;

      this.s.mkfile(path, new Uint8Array(), mode || 0o666);
      made = true;
    }

    const plus = ac === O_RDWR;
    const wr = ac === O_WRONLY || plus;

    if (!made && fl & O_TRUNC && wr) {
      this.s.writeb(path, new Uint8Array());
    }

    const kind = fl & O_APPEND
      ? plus ? "a+" : "a"
      : plus
        ? fl & O_TRUNC ? "w+" : "r+"
        : wr
          ? fl & O_TRUNC ? "w" : "ow"
          : "r";

    const n = this.s.open(path, kind, mode || 0o666);
    this.s.p.fds.get(n)!.clo = !!(fl & O_CLOEXEC);
    return n;
  }

  private socket(
    domain: number,
    type: number,
    protocol: number,
  ): number {
    if (domain !== AF_UNIX) return -97;
    if (protocol !== 0) return -93;

    const kind = type & SOCK_TYPE_MASK;
    const flags = type & ~SOCK_TYPE_MASK;

    if (kind !== SOCK_STREAM) return -94;
    if (flags & ~SOCK_CLOEXEC) return -22;

    const fd = this.s.k.fd(this.s.p);

    this.s.p.fds.set(
      fd,
      new Fd(
        undefined,
        undefined,
        undefined,
        true,
        true,
        false,
        !!(flags & SOCK_CLOEXEC),
      ),
    );

    this.localSockets.add(fd);
    return fd;
  }

  private connect(
    fd: number,
    at: bigint,
    length: number,
  ): bigint {
    if (!this.s.p.fds.has(fd)) return -9n;
    if (!this.localSockets.has(fd)) return -88n;
    if (length < 2) return -22n;
    if (at === 0n) return -14n;

    this.mem(at, length);

    if (this.m.u16(at) !== AF_UNIX) {
      return -97n;
    }

    const name = this.m.read(
      at + 2n,
      length - 2,
    );

    /*
     * There is not yet an AF_UNIX namespace in mikuOS. A pathname
     * socket therefore behaves like an absent socket node.
     *
     * This lets musl probe /var/run/nscd/socket and then fall back to
     * the local passwd and group databases.
     */
    if (name.length === 0 || name[0] === 0) {
      return -111n;
    }

    return -2n;
  }

  private dup3(old0: bigint, nu0: bigint, fl0: bigint): number {
    const old = this.fd(old0), nu = this.fd(nu0), fl = this.nat(fl0, "dup flags", 0xffffffff);
    if (old === nu || fl & ~O_CLOEXEC) bad("EINVAL", "invalid dup3 arguments");
    const n = this.s.dup(old, nu);
    this.s.p.fds.get(n)!.clo = !!(fl & O_CLOEXEC);
    if (this.localSockets.has(old)) this.localSockets.add(n);
    return n;
  }

  private path(fd0: bigint, p: string): string {
    if (p.startsWith("/")) return norm(p);
    const fd = this.num(fd0, "directory descriptor");
    if (fd === AT_FDCWD) return norm(p, this.s.cwd);
    const f = this.s.p.fds.get(fd) ?? bad("EBADF", String(fd)), base = f.path ?? bad("EBADF", String(fd));
    if (this.s.stat(base).kind !== "dir") bad("ENOTDIR", base);
    return norm(p, base);
  }

  private fcntl(fd: number, cmd: number, arg: bigint): number {
    const f = this.s.p.fds.get(fd) ?? bad("EBADF", String(fd));
    if (cmd === 0 || cmd === 1030) {
      const min = this.nat(arg, "descriptor minimum", 255);
      for (let n = Math.max(3, min); n < 256; n++) if (!this.s.p.fds.has(n)) {
        const q = this.s.dup(fd, n);
        this.s.p.fds.get(q)!.clo = cmd === 1030;
        if (this.localSockets.has(fd)) this.localSockets.add(q);
        return q;
      }
      return bad("EMFILE", "descriptor table full");
    }
    if (cmd === 1) return f.clo ? 1 : 0;
    if (cmd === 2) { f.clo = !!(this.nat(arg, "descriptor flags", 0x7fffffff) & 1); return 0; }
    if (cmd === 3) return f.rd && f.wr ? O_RDWR : f.wr ? O_WRONLY : 0;
    if (cmd === 4) { f.add = !!(this.nat(arg, "descriptor flags", 0x7fffffff) & O_APPEND); return 0; }
    return -22;
  }

  private ioctl(
    fd: number,
    req: number,
    at: bigint,
  ): bigint {
    const descriptor =
      this.s.p.fds.get(fd) ??
      bad("EBADF", String(fd));

    const tty = terminalFromFd(descriptor);

    if (!tty) {
      return -25n;
    }

    if (req === TCGETS) {
      const raw = tty.termios();

      if (raw.byteLength < LINUX_TERMIOS_SIZE) {
        return -22n;
      }

      this.mem(
        at,
        LINUX_TERMIOS_SIZE,
        true,
      );

      this.m.write(
        at,
        raw.subarray(
          0,
          LINUX_TERMIOS_SIZE,
        ),
      );

      return 0n;
    }

    if (
      req === TCSETS ||
      req === TCSETSW ||
      req === TCSETSF
    ) {
      this.mem(
        at,
        LINUX_TERMIOS_SIZE,
      );

      tty.setTermios(
        this.m.read(
          at,
          LINUX_TERMIOS_SIZE,
        ),
        req === TCSETSF,
      );

      return 0n;
    }

    if (req === TIOCGWINSZ) {
      const size = tty.size();

      this.mem(
        at,
        LINUX_WINSIZE_SIZE,
        true,
      );

      this.m.set16(
        at,
        Math.min(
          0xffff,
          Math.max(0, size.rows),
        ),
      );

      this.m.set16(
        at + 2n,
        Math.min(
          0xffff,
          Math.max(0, size.cols),
        ),
      );

      this.m.set16(at + 4n, 0);
      this.m.set16(at + 6n, 0);

      return 0n;
    }

    if (req === TIOCSWINSZ) {
      this.mem(
        at,
        LINUX_WINSIZE_SIZE,
      );

      tty.resize(
        this.m.u16(at),
        this.m.u16(at + 2n),
      );

      return 0n;
    }

    return -25n;
  }

  private getdents(fd: number, at: bigint, n: number): number {
    const f = this.s.p.fds.get(fd) ?? bad("EBADF", String(fd)), p = f.path ?? bad("EBADF", String(fd));
    const a = this.s.list(p), out = new Uint8Array(n), v = new DataView(out.buffer); let pos = 0;
    while (f.pos < a.length) {
      const [name, q] = a[f.pos]!, b = enc(name + "\0"), z = (19 + b.length + 7) & -8;
      if (pos + z > n) { if (!pos) bad("EINVAL", "directory buffer is too small"); break; }
      v.setBigUint64(pos, BigInt(q.ino), true); v.setBigUint64(pos + 8, BigInt(f.pos + 1), true); v.setUint16(pos + 16, z, true);
      out[pos + 18] = q.kind === "dir" ? 4 : q.kind === "file" ? 8 : q.kind === "link" ? 10 : 2; out.set(b, pos + 19);
      pos += z; f.pos++;
    }
    this.mem(at, pos, true); this.m.write(at, out.subarray(0, pos)); return pos;
  }

  private pread(fd: number, at: bigint, n: number, off: number): number {
    const f = this.s.p.fds.get(fd) ?? bad("EBADF", String(fd)), old = f.pos; f.pos = off;
    try { const b = this.s.fdr(fd, n); this.mem(at, b.length, true); this.m.write(at, b); return b.length; }
    finally { f.pos = old; }
  }

  private pwrite(fd: number, at: bigint, n: number, off: number): number {
    const f = this.s.p.fds.get(fd) ?? bad("EBADF", String(fd)), old = f.pos; f.pos = off;
    try { this.mem(at, n); return this.s.fdw(fd, this.m.read(at, n)); }
    finally { f.pos = old; }
  }

  private ppoll(at: bigint, n: number): number {
    if (!n) return 0;
    this.mem(at, n * 8, true);
    let hit = 0;
    for (let i = 0; i < n; i++) {
      const p = at + BigInt(i * 8), fd = Number(this.m.i32(p));
      let revents = 0;
      if (fd >= 0 && !this.s.p.fds.has(fd)) {
        revents = 0x20; // POLLNVAL
        hit++;
      }
      this.m.set16(p + 6n, revents);
    }
    return hit;
  }

  private stat(p: string, at: bigint, follow = true): bigint { this.putStat(this.s.stat(p, follow), at); return 0n; }

  private fstat(fd: number, at: bigint): bigint {
    const f = this.s.p.fds.get(fd) ?? bad("EBADF", String(fd));
    if (fd < 3) this.putStat({ ino: fd + 1, kind: "char", mode: 0o620, uid: this.s.uid, gid: this.s.gid, nlink: 1, size: 0, at: Date.now(), mt: Date.now(), ct: Date.now() }, at);
    else this.putStat(this.s.stat(f.path ?? bad("EBADF", String(fd))), at);
    return 0n;
  }

  private addrPtr(n: bigint): bigint {
    if (!n) bad("EFAULT", "null pointer");
    return this.addr(n);
  }

  private getres(a: bigint, b: bigint, c: bigint, group: boolean): bigint {
    this.mem(a, 4, true); this.mem(b, 4, true); this.mem(c, 4, true);
    if (group) {
      this.m.set32(a, this.s.rgid); this.m.set32(b, this.s.egid); this.m.set32(c, this.s.sgid);
    } else {
      this.m.set32(a, this.s.ruid); this.m.set32(b, this.s.euid); this.m.set32(c, this.s.suid);
    }
    return 0n;
  }

  private getgroups(n0: bigint, at0: bigint): number {
    const n = this.nat(n0, "group count", 65536), groups = this.s.groups;
    if (n === 0) return groups.length;
    if (n < groups.length) bad("EINVAL", "group buffer too small");
    const at = this.addrPtr(at0);
    this.mem(at, groups.length * 4, true);
    groups.forEach((g, i) => this.m.set32(at + BigInt(i * 4), g));
    return groups.length;
  }

  private setgroups(n0: bigint, at0: bigint): void {
    const n = this.nat(n0, "group count", 65536), at = n ? this.addrPtr(at0) : 0n;
    if (n) this.mem(at, n * 4);
    const groups: number[] = [];
    for (let i = 0; i < n; i++) groups.push(this.m.u32(at + BigInt(i * 4)));
    this.s.setGroups(groups);
  }

  private putStat(q: { ino: number; kind: "file" | "dir" | "link" | "char"; mode: number; uid: number; gid: number; nlink: number; size: number; at: number; mt: number; ct: number }, at: bigint): void {
    this.mem(at, 128, true);
    const typ = q.kind === "file" ? 0o100000 : q.kind === "dir" ? 0o040000 : q.kind === "link" ? 0o120000 : 0o020000;
    this.m.set64(at, 1); this.m.set64(at + 8n, q.ino); this.m.set32(at + 16n, typ | q.mode); this.m.set32(at + 20n, q.nlink);
    this.m.set32(at + 24n, q.uid); this.m.set32(at + 28n, q.gid); this.m.set64(at + 32n, q.kind === "char" ? 1 : 0); this.m.set64(at + 40n, 0);
    this.m.set64(at + 48n, q.size); this.m.set32(at + 56n, 4096); this.m.set32(at + 60n, 0); this.m.set64(at + 64n, Math.ceil(q.size / 512));
    this.putTs(at + 72n, q.at); this.putTs(at + 88n, q.mt); this.putTs(at + 104n, q.ct); this.m.set64(at + 120n, 0);
  }

  private putTs(at: bigint, ms: number): void { this.m.set64(at, Math.floor(ms / 1000)); this.m.set64(at + 8n, Math.floor(ms % 1000) * 1_000_000); }

  private statfs(at: bigint): bigint {
    const bs = 4096, cap = this.s.k.fs.cap, used = this.s.k.fs.used();
    const blocks = Math.floor(cap / bs), hit = Math.ceil(used / bs), files = Math.max(1024, blocks * 4);
    this.mem(at, 120, true); this.m.write(at, new Uint8Array(120));
    this.m.set64(at, 0x54484953); this.m.set64(at + 8n, bs);
    this.m.set64(at + 16n, blocks); this.m.set64(at + 24n, Math.max(0, blocks - hit)); this.m.set64(at + 32n, Math.max(0, blocks - hit));
    this.m.set64(at + 40n, files); this.m.set64(at + 48n, Math.max(0, files - this.s.k.fs.root.ent.size));
    this.m.set32(at + 56n, 0x5448); this.m.set32(at + 60n, 0x4953);
    this.m.set64(at + 64n, 255); this.m.set64(at + 72n, bs); this.m.set64(at + 80n, 0);
    return 0n;
  }

  private utimens(fd0: bigint, p0: bigint, ts0: bigint, fl0: bigint): bigint {
    const fl = this.nat(fl0, "utimensat flags", 0x7fffffff);
    if (fl & ~0x1100) bad("EINVAL", "unsupported utimensat flags");
    let p: string;
    if (!p0) {
      const fd = this.fd(fd0), f = this.s.p.fds.get(fd) ?? bad("EBADF", String(fd));
      p = f.path ?? bad("EBADF", String(fd));
    } else {
      const raw = this.str(p0);
      if (!raw && fl & 0x1000) {
        const fd = this.fd(fd0), f = this.s.p.fds.get(fd) ?? bad("EBADF", String(fd));
        p = f.path ?? bad("EBADF", String(fd));
      } else if (!raw) return bad("ENOENT", "empty utimensat path");
      else p = this.path(fd0, raw);
    }
    const follow = !(fl & 0x100), q = this.s.stat(p, follow), now = Date.now();
    let at = now, mt = now;
    if (ts0) {
      const ts = this.addr(ts0); this.mem(ts, 32);
      at = this.fileTs(ts, q.at, now); mt = this.fileTs(ts + 16n, q.mt, now);
    }
    this.s.utime(p, at, mt, follow); return 0n;
  }

  private fileTs(at: bigint, old: number, now: number): number {
    const ns = this.m.i64(at + 8n);
    if (ns === 0x3ffffffen) return old;
    if (ns === 0x3fffffffn) return now;
    if (ns < 0n || ns >= 1_000_000_000n) bad("EINVAL", "invalid file timestamp");
    return this.num(this.m.i64(at), "timestamp seconds") * 1000 + Number(ns / 1_000_000n);
  }

  private async futex(at0: bigint, op0: bigint, val0: bigint, to0: bigint): Promise<bigint> {
    const at = this.addr(at0), op = this.nat(op0, "futex operation", 0x7fffffff) & 0x7f;
    this.mem(at, 4, op === 1 || op === 10);
    if (op === 1 || op === 10 || op === 3 || op === 4) return 0n;
    if (op !== 0 && op !== 9) return -38n;
    if (op === 9 && !ux(this.x[15]!)) bad("EINVAL", "empty futex bitset");
    if (this.m.u32(at) !== Number(ux(val0) & 0xffffffffn)) return -11n;
    if (!to0) { await this.s.yield(); return 0n; } // A lone task may wake spuriously; POSIX permits that dance.
    const to = this.addr(to0), ms = this.readTs(to);
    const wait = op === 9 ? ms - this.clockMs(op0 & 0x100n ? 0 : 1) : ms;
    if (wait > 0) await this.s.sleep(Math.min(wait, 0x7fffffff));
    return -110n;
  }

  private clockMs(id: number | bigint): number {
    const n = Number(id);
    if (n === 0 || n === 5 || n === 11) return Date.now();
    if (n === 1 || n === 4 || n === 6 || n === 7) return this.s.uptime();
    if (n === 2 || n === 3) return this.s.p.ms();
    return bad("EINVAL", `unsupported clock ${n}`);
  }

  private clock(id: number, at: bigint): bigint { this.mem(at, 16, true); this.putTs(at, this.clockMs(id)); return 0n; }

  private clockRes(id: number, at: bigint): bigint {
    this.clockMs(id);
    if (at) { this.mem(at, 16, true); this.m.set64(at, 0); this.m.set64(at + 8n, 1_000_000); }
    return 0n;
  }

  private readTs(at: bigint): number {
    this.mem(at, 16); const sec = this.num(this.m.i64(at), "timespec seconds"), ns = this.m.i64(at + 8n);
    if (sec < 0 || ns < 0n || ns >= 1_000_000_000n) bad("EINVAL", "invalid timespec");
    const ms = sec * 1000 + Number(ns) / 1e6;
    if (!Number.isSafeInteger(Math.floor(ms))) bad("ERANGE", "timespec is too large");
    return ms;
  }

  private async sleepTs(at: bigint): Promise<void> { const ms = this.readTs(at); if (ms) await this.s.sleep(Math.min(ms, 0x7fffffff)); }

  private async clockSleep(id0: bigint, fl0: bigint, at0: bigint): Promise<bigint> {
    const id = this.num(id0, "clock id"), fl = this.nat(fl0, "clock sleep flags", 1);
    const ms = this.readTs(this.addr(at0)), wait = fl ? ms - this.clockMs(id) : ms;
    if (wait > 0) await this.s.sleep(Math.min(wait, 0x7fffffff));
    return 0n;
  }

  private setAffinity(pid0: bigint, z0: bigint, at0: bigint): bigint {
    const pid = this.num(pid0, "affinity pid"), z = this.nat(z0, "affinity size", MAX_IO), at = this.addr(at0);
    if (pid && pid !== this.s.pid) bad("ESRCH", String(pid));
    if (!z) bad("EINVAL", "empty CPU set");
    this.mem(at, z); if (!(this.m.u8(at) & 1)) bad("EINVAL", "Thistle has one schedulable CPU");
    return 0n;
  }

  private getAffinity(pid0: bigint, z0: bigint, at0: bigint): bigint {
    const pid = this.num(pid0, "affinity pid"), z = this.nat(z0, "affinity size", MAX_IO), at = this.addr(at0);
    if (pid && pid !== this.s.pid) bad("ESRCH", String(pid));
    if (z < 8) bad("EINVAL", "CPU set is shorter than one kernel word");
    this.mem(at, z, true); this.m.write(at, new Uint8Array(z)); this.m.set8(at, 1); return 8n;
  }

  private times(at: bigint): bigint {
    const hz = 100, self = Math.floor(this.s.p.ms() * hz / 1000);
    if (at) {
      this.mem(at, 32, true); this.m.write(at, new Uint8Array(32)); this.m.set64(at, self);
    }
    return BigInt(Math.floor(this.s.uptime() * hz / 1000));
  }

  private usage(who0: bigint, at: bigint): bigint {
    const who = this.num(who0, "rusage target");
    if (who !== -1 && who !== 0 && who !== 1) bad("EINVAL", String(who));
    this.putUsage(at, who === -1 ? 0 : this.s.p.ms()); return 0n;
  }

  private putUsage(at: bigint, ms: number): void {
    this.mem(at, 144, true); this.m.write(at, new Uint8Array(144));
    this.m.set64(at, Math.floor(ms / 1000)); this.m.set64(at + 8n, Math.floor(ms % 1000) * 1000);
    this.m.set64(at + 32n, Math.ceil(this.m.used / 1024)); this.m.set64(at + 64n, this.m.used / 65536);
  }

  private getcpu(cpu0: bigint, node0: bigint): bigint {
    if (cpu0) { const at = this.addr(cpu0); this.mem(at, 4, true); this.m.set32(at, 0); }
    if (node0) { const at = this.addr(node0); this.mem(at, 4, true); this.m.set32(at, 0); }
    return 0n;
  }

  private sysinfo(at: bigint): bigint {
    const mem = this.s.k.lim.mem, free = Math.max(0, mem - this.m.used), run = [...this.s.k.procs.values()].filter(p => p.state === "run").length;
    this.mem(at, 112, true); this.m.write(at, new Uint8Array(112));
    this.m.set64(at, Math.floor(this.s.uptime() / 1000));
    this.m.set64(at + 8n, run * 65536); this.m.set64(at + 16n, run * 32768); this.m.set64(at + 24n, run * 16384);
    this.m.set64(at + 32n, mem); this.m.set64(at + 40n, free);
    this.m.set16(at + 80n, Math.min(0xffff, this.s.k.procs.size)); this.m.set32(at + 104n, 1);
    return 0n;
  }

  private timeval(at: bigint): bigint { if (at) { this.mem(at, 16, true); const n = Date.now(); this.m.set64(at, Math.floor(n / 1000)); this.m.set64(at + 8n, Math.floor(n % 1000) * 1000); } return 0n; }

  private uname(at: bigint): bigint {
    this.mem(at, 390, true); const a = [this.s.k.name, this.s.k.host, this.s.k.release, "Thistle64 RV64GC", "riscv64", "localdomain"];
    a.forEach((x, i) => { const b = enc(x + "\0").slice(0, 65); this.m.write(at + BigInt(i * 65), b); }); return 0n;
  }

  private limit(pid0: bigint, res0: bigint, nu0: bigint, old0: bigint): bigint {
    const pid = this.num(pid0, "limit pid"), res = this.nat(res0, "limit resource", 15);
    if (pid && pid !== this.s.pid) bad("ESRCH", String(pid));
    const old = this.getLimit(res);
    if (old0) { const at = this.addr(old0); this.mem(at, 16, true); this.m.set64(at, old[0]); this.m.set64(at + 8n, old[1]); }
    if (nu0) {
      const at = this.addr(nu0); this.mem(at, 16); const cur = this.m.u64(at), max = this.m.u64(at + 8n);
      if (max !== MASK && cur > max) bad("EINVAL", "soft limit exceeds hard limit");
      if (this.s.uid && old[1] !== MASK && (max === MASK || max > old[1])) bad("EPERM", "hard limit increase");
      this.rlim.set(res, [cur, max]);
    }
    return 0n;
  }

  private getLimit(res: number): [bigint, bigint] {
    const hit = this.rlim.get(res); if (hit) return hit;
    const mem = BigInt(this.s.k.lim.mem), fs = BigInt(this.s.k.fs.cap), stack = BigInt(this.s.k.lim.stack);
    let q: [bigint, bigint];
    if (res === 1) q = [fs, fs];
    else if (res === 2 || res === 5 || res === 8 || res === 9 || res === 12) q = [mem, mem];
    else if (res === 3) q = [stack, mem];
    else if (res === 4 || res === 13 || res === 14) q = [0n, 0n];
    else if (res === 6) q = [1024n, 1024n];
    else if (res === 7) q = [256n, 256n];
    else if (res === 11) q = [256n, 256n];
    else q = [MASK, MASK];
    this.rlim.set(res, q); return q;
  }

  private copy(b: Uint8Array, at: bigint, n: number, cut = false): number {
    const q = cut ? b.slice(0, n) : b;
    if (q.length > n) bad("ERANGE", "RV64 output buffer is too small");
    this.mem(at, q.length, true); this.m.write(at, q); return q.length;
  }

  private trunc(p: string, z: number): void { const b = this.s.readb(p), q = new Uint8Array(z); q.set(b.subarray(0, z)); this.s.writeb(p, q); }

  private str(at0: bigint): string {
    const b: number[] = []; let at = this.addr(at0);
    for (; b.length < 65536; at++) { this.mem(at, 1); const x = this.m.u8(at); if (!x) return new TextDecoder().decode(Uint8Array.from(b)); b.push(x); }
    return bad("ENAMETOOLONG", "RV64 string");
  }

  private async readv(fd: number, at: bigint, n: number): Promise<number> {
    this.mem(at, n * 16); let done = 0;
    for (let i = 0; i < n; i++) {
      const p = this.m.u64(at + BigInt(i * 16)), z = this.nat(this.m.i64(at + BigInt(i * 16 + 8)), "iovec length", MAX_IO - done);
      this.mem(p, z, true); const b = await this.read(fd, z); this.m.write(p, b); done += b.length; if (b.length < z) break;
    }
    return done;
  }

  private async writev(fd: number, at: bigint, n: number): Promise<number> {
    this.mem(at, n * 16); let done = 0;
    for (let i = 0; i < n; i++) {
      const p = this.m.u64(at + BigInt(i * 16)), z = this.nat(this.m.i64(at + BigInt(i * 16 + 8)), "iovec length", MAX_IO - done);
      this.mem(p, z); const q = await this.write(fd, this.m.read(p, z)); done += q;
      if (q < z) break;
    }
    return done;
  }

  private doBrk(n: bigint): bigint {
    if (!n) return this.brk;
    if (n < this.floor || n + 1024n * 1024n >= this.stackAt) return this.brk;
    if (n < this.brk) this.m.drop(n, this.nat(this.brk - n, "released break range", Number.MAX_SAFE_INTEGER));
    this.brk = n; return n;
  }

  private mmap(addr0: bigint, len0: bigint, prot0: bigint, flags0: bigint, fd0: bigint, off0: bigint): bigint {
    const z0 = this.nat(len0, "mapping length", Number.MAX_SAFE_INTEGER), z = al(BigInt(z0));
    if (!z) bad("EINVAL", "zero-length mapping");
    const prot = this.nat(prot0, "mapping protection", 7), flags = this.nat(flags0, "mapping flags", 0x7fffffff);
    let at = flags & 0x10 ? this.addr(addr0) : addr0 ? al(this.addr(addr0)) : this.mapAt;
    if (at < al(this.floor) || at + z + 1024n * 1024n >= this.stackAt || this.maps.some(q => at < q.end && at + z > q.at)) {
      if (flags & 0x10) bad("ENOMEM", "fixed mapping collides with the process image");
      at = this.mapAt;
      while (this.maps.some(q => at < q.end && at + z > q.at)) at = al(at + 16n * 1024n * 1024n);
      if (at + z + 1024n * 1024n >= this.stackAt) bad("ENOMEM", "RV64 mapping space exhausted");
    }
    let path: string | undefined;
    let off = 0;
    if (!(flags & 0x20) && fd0 >= 0n) {
      const fd = this.fd(fd0), f = this.s.p.fds.get(fd) ?? bad("EBADF", String(fd));
      path = f.path ?? bad("EBADF", String(fd));
      off = this.nat(off0, "mapping offset", Number.MAX_SAFE_INTEGER);
      const b = this.s.readb(path).slice(off, off + z0);
      this.m.write(at, b);
    }
    const ent: MapEnt = { at, end: at + z, prot, shared: !!(flags & 1) };
    if (path !== undefined) {
      ent.path = path;
      ent.off = off;
    }
    this.maps.push(ent);
    if (at + z > this.mapAt) this.mapAt = al(at + z);
    return at;
  }

  private remap(old0: bigint, oz0: bigint, nz0: bigint, fl0: bigint, fixed0: bigint): bigint {
    const old = this.addr(old0), on = this.nat(oz0, "old mapping length", Number.MAX_SAFE_INTEGER), nn = this.nat(nz0, "new mapping length", Number.MAX_SAFE_INTEGER);
    const oz = al(BigInt(on)), nz = al(BigInt(nn)), fl = this.nat(fl0, "remap flags", 3);
    if (!on || !nn || old & (PAGE - 1n) || fl & ~3 || fl & 2) bad("EINVAL", "invalid mremap arguments");
    if (fixed0) bad("EINVAL", "fixed mremap is not supported");
    const q = this.maps.find(x => x.at === old && x.end === old + oz) ?? bad("EINVAL", "mremap range is not one mapping");
    if (nz === oz) return old;
    if (nz < oz) { this.flushShared(old + nz, this.nat(oz - nz, "released mapping range", Number.MAX_SAFE_INTEGER)); this.m.drop(old + nz, this.nat(oz - nz, "released mapping range", Number.MAX_SAFE_INTEGER)); q.end = old + nz; return old; }

    const end = old + nz, hit = this.maps.some(x => x !== q && old < x.end && end > x.at);
    if (!hit && end + 1024n * 1024n < this.stackAt) { q.end = end; if (end > this.mapAt) this.mapAt = al(end); return old; }
    if (!(fl & 1)) bad("ENOMEM", "mapping cannot grow in place");

    const to = this.mmap(0n, nz, BigInt(q.prot), 0x22n, -1n, 0n), copy = on < nn ? on : nn;
    try {
      for (let n = 0; n < copy; n += 65536) {
        const z = Math.min(65536, copy - n); this.m.write(to + BigInt(n), this.m.read(old + BigInt(n), z));
      }
    } catch (e) { this.unmap(to, nn); throw e; }
    this.unmap(old, on); return to;
  }

  private unmap(at0: bigint, len: number): void {
    const at = at0 & -PAGE, end = al(at0 + BigInt(len));
    this.flushShared(at, this.nat(end - at, "unmapped range", Number.MAX_SAFE_INTEGER));
    for (let i = this.maps.length - 1; i >= 0; i--) {
      const q = this.maps[i]!;
      const lo = at > q.at ? at : q.at, hi = end < q.end ? end : q.end;
      if (lo < hi) this.m.drop(lo, this.nat(hi - lo, "unmapped range", Number.MAX_SAFE_INTEGER));
      if (at <= q.at && end >= q.end) this.maps.splice(i, 1);
      else if (at > q.at && end < q.end) {
        const old = q.end, next: MapEnt = { at: end, end: old, prot: q.prot, shared: q.shared };
        if (q.path !== undefined) next.path = q.path;
        if (q.off !== undefined) next.off = q.off + this.nat(end - q.at, "mapping offset", Number.MAX_SAFE_INTEGER);
        q.end = at;
        this.maps.push(next);
      }
      else if (at <= q.at && end > q.at) {
        const old = q.at;
        q.at = end;
        if (q.off !== undefined) q.off += this.nat(end - old, "mapping offset", Number.MAX_SAFE_INTEGER);
      }
      else if (at < q.end && end >= q.end) q.end = at;
    }
  }

  private flushShared(at0: bigint, len: number): void {
    if (len <= 0) return;
    const at = at0 & -PAGE, end = al(at0 + BigInt(len));
    for (const q of this.maps) {
      if (!q.shared || !q.path || q.off === undefined) continue;
      const lo = at > q.at ? at : q.at, hi = end < q.end ? end : q.end;
      if (lo >= hi) continue;
      const rel = this.nat(lo - q.at, "mapping relative offset", Number.MAX_SAFE_INTEGER);
      const n = this.nat(hi - lo, "mapping flush length", Number.MAX_SAFE_INTEGER);
      const dst = q.off + rel, cur = this.s.readb(q.path), out = new Uint8Array(Math.max(cur.length, dst + n));
      out.set(cur);
      out.set(this.m.read(lo, n), dst);
      this.s.writeb(q.path, out);
    }
  }

  private flushAllShared(): void {
    for (const q of [...this.maps]) this.flushShared(q.at, this.nat(q.end - q.at, "mapping length", Number.MAX_SAFE_INTEGER));
  }

  private random(at: bigint, n: number): number {
    this.mem(at, n, true);
    for (let i = 0; i < n; i += 65536) { const b = new Uint8Array(Math.min(65536, n - i)); crypto.getRandomValues(b); this.m.write(at + BigInt(i), b); }
    return n;
  }

  private stack(argv: string[]): void {
    const env = [...(this.s.env() as Map<string, string>)].map(([k, v]) => `${k}=${v}`);
    let sp = this.m.top - 16n;
    const z = BigInt(Math.max(1024 * 1024, this.s.k.lim.stack));
    this.stackAt = this.m.top - z;
    const put = (s: string): bigint => { const b = enc(s + "\0"); sp -= BigInt(b.length); if (sp < this.stackAt) bad("EFBIG", "RV64 argument block exceeds the stack"); this.m.write(sp, b); return sp; };
    const ep = env.map(put), ap = argv.map(put), exec = ap[0] ?? put(argv[0] ?? ""), rnd = sp - 16n;
    sp = rnd; this.random(rnd, 16); sp &= -16n;
    const aux: Array<[bigint, bigint]> = [
      [3n, BigInt(this.exe.phdr)], [4n, BigInt(this.exe.phent)], [5n, BigInt(this.exe.phnum)], [6n, PAGE],
      [7n, 0n], [8n, 0n], [9n, BigInt(this.exe.entry)], [11n, BigInt(this.s.uid)], [12n, BigInt(this.s.uid)],
      [13n, BigInt(this.s.gid)], [14n, BigInt(this.s.gid)], [23n, 0n], [25n, rnd], [31n, exec], [0n, 0n],
    ];
    const words: bigint[] = [BigInt(ap.length), ...ap, 0n, ...ep, 0n];
    for (const [k, v] of aux) words.push(k, v);
    sp = (sp - BigInt(words.length * 8)) & -16n;
    if (sp < this.stackAt || sp < this.brk + 1024n * 1024n) bad("ENOMEM", "arguments leave no RV64 stack");
    words.forEach((n, i) => this.m.set64(sp + BigInt(i * 8), n));
    this.x[2] = sx(sp, 64);
  }

  private exec(at: bigint, n: number): void {
    const end = at + BigInt(n);
    if (at >= this.eat && end <= this.eend) return;
    const q = this.seg.find(s => s.flg.includes("x") && at >= s.at && end <= s.end);
    if (q) { this.eat = q.at; this.eend = q.end; return; }
    if (!this.maps.some(m => m.prot & 4 && at >= m.at && end <= m.end)) bad("EACCES", `RV64 execute at 0x${at.toString(16)}`);
  }

  private mem(at: bigint, n: number, wr = false): void {
    const end = at + BigInt(n);
    if (at < 0n || !Number.isSafeInteger(n) || n < 0 || end > this.m.top) bad("ERANGE", `RV64 memory at 0x${at.toString(16)}`);
    if (!n) return;
    const q = at < this.floor ? this.seg.find(s => at >= s.at && end <= s.end) : undefined;
    const mapped = !!q || at >= this.floor && end <= this.brk || at >= this.stackAt || this.maps.some(m => at >= m.at && end <= m.end);
    if (!mapped) bad("ERANGE", `unmapped RV64 memory at 0x${at.toString(16)} from pc 0x${(this.pc - 2n).toString(16)} (a3=0x${ux(this.x[13]!).toString(16)}, a7=0x${ux(this.x[17]!).toString(16)})`);
    if (wr && q && !q.flg.includes("w")) bad("EACCES", `write to ${q.name}`);
    if (wr && !q && this.maps.some(m => at >= m.at && end <= m.end && !(m.prot & 2))) bad("EACCES", "write to read-only RV64 mapping");
  }

  private div(a: bigint, b: bigint, uns: boolean, bits = 64): bigint {
    if (!b) return uns ? (1n << BigInt(bits)) - 1n : -1n;
    const lo = -(1n << BigInt(bits - 1));
    if (!uns && a === lo && b === -1n) return lo;
    return a / b;
  }

  private rem(a: bigint, b: bigint, uns: boolean): bigint {
    if (!b) return a;
    if (!uns && a === MIN && b === -1n) return 0n;
    return a % b;
  }

  private immI(i: number): bigint { return sx(BigInt(i >>> 20), 12); }
  private immS(i: number): bigint { return sx(BigInt((i >>> 25) << 5 | i >>> 7 & 31), 12); }
  private immB(i: number): bigint { return sx(BigInt((i >>> 31) << 12 | (i >>> 7 & 1) << 11 | (i >>> 25 & 63) << 5 | (i >>> 8 & 15) << 1), 13); }
  private immU(i: number): bigint { return sx(BigInt(i & 0xfffff000), 32); }
  private immJ(i: number): bigint { return sx(BigInt((i >>> 31) << 20 | (i >>> 12 & 255) << 12 | (i >>> 20 & 1) << 11 | (i >>> 21 & 1023) << 1), 21); }
  private set(d: number, n: bigint): void { if (d) this.x[d] = sx(n, 64); }
  private addr(n: bigint): bigint { return ux(n); }
  private fd(n: bigint): number { return this.nat(n, "file descriptor", 0x7fffffff); }
  private nat(n: bigint, k: string, max: number): number { const q = ux(n); if (n < 0n || q > BigInt(max)) bad("ERANGE", `${k} is out of range`); return Number(q); }
  private owner(n: bigint, k: string): number { const q = ux(n); if (q === 0xffffffffn) bad("EINVAL", `${k} is reserved`); if (q > 0xffffffffn) bad("ERANGE", `${k} is out of range`); return Number(q); }
  private idOrKeep(n: bigint): number | undefined {
    const value = ux(n);
    return value === 0xffffffffn || value === MASK ? undefined : this.owner(n, "identity");
  }
  private num(n: bigint, k: string): number { if (n < BigInt(Number.MIN_SAFE_INTEGER) || n > BigInt(Number.MAX_SAFE_INTEGER)) bad("ERANGE", `${k} is out of range`); return Number(n); }
  private exit(n: bigint): void { this.flushAllShared(); this.code = Number(ux(n) & 0xffffffffn); this.done = true; }
  private bad(i: number, at = this.pc - 4n): never { return bad("ENOEXEC", `bad RV64 instruction 0x${i.toString(16).padStart(8, "0")} at 0x${at.toString(16)}`); }
  private badR(top: number, f: number): never { return bad("ENOEXEC", `bad RV64 function ${top.toString(16)}:${f} at 0x${(this.pc - 4n).toString(16)}`); }
}
