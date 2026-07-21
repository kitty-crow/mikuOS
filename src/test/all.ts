import { boot } from "../main/boot.js";
import { FnApp } from "../apps/base.js";
import type { Ch, Os } from "../main/boot.js";
import { KErr } from "../core/err.js";
import { demoWasm } from "../wasm/demo.js";
import { dec, enc } from "../io/stream.js";
import { Net, NetDev } from "../net/net.js";
import type { DReq, DRes } from "../net/net.js";
import { Asm } from "../asm/asm.js";
import { Link } from "../asm/link.js";
import { Exe, Obj, codec } from "../asm/fmt.js";
import type { Tree, TreeEnt } from "../fs/tree.js";
import { DirTree } from "../main/dir.js";
import { Mem64 } from "../vm/mem64.js";
import { Rv64 } from "../vm/rv64.js";
import { Sys } from "../core/sys.js";
import { Tty } from "../io/tty.js";
import { DEFAULT_CONFIG } from "../core/config.js";
import { IDENTITY } from "../core/identity.js";
import { LineEditor } from "../sh/editor.js";
import { hostConfig, mergeConfig } from "../main/config.js";
import { sourceReleaseName } from "../core/release.js";
import { localSessionPlan, superviseLocalLogin } from "../main/session.js";
import { WebSession } from "../main/websession.js";
import { directMemory } from "../teto/memory.js";
import {
  tetoHartGetX,
  tetoHartGetF,
  tetoHartInit,
  tetoHartImageFloor,
  tetoHartMetric,
  tetoHartPc,
  tetoHartStackBottom,
  tetoHartStackPointer,
  tetoHartBreak,
  tetoHartVirtualTop,
  tetoHartSetX,
  tetoHartSetPc,
  tetoHartStatus,
  tetoGuestPage,
  tetoImageRelease,
  tetoImageReserve,
  tetoImageBegin,
  tetoImageSegment,
  tetoImageFinish,
  tetoKernelInit,
  tetoProcessInit,
  tetoProcessCount,
  tetoProcessMapCount,
  tetoProcessSegmentCount,
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
  tetoRunRv64Batch,
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
  C_ACTIVE_WORKERS,
  H_FAULT,
  H_FALLBACK_SYSCALLS,
  H_HOST_TO_WASM,
  H_IMAGE_BYTES,
  H_IMAGE_LOADS,
  H_STARTUP_LOADS,
  H_HOST_REQUESTS,
  H_INSTRUCTIONS,
  H_INTERNAL_SYSCALLS,
  H_WASM_TO_HOST,
  TETO_BATCH_EXITED,
  TETO_BATCH_BUDGET,
  TETO_BATCH_FAULT,
  TETO_BATCH_SYSCALL,
  TETO_HART_EXITED,
  TETO_HART_BASE,
  TETO_HART_FAULTED,
  TETO_FAULT_MEMORY,
  TETO_THX_CHECKSUM,
  TETO_THX_OK,
  TETO_START_FORMAT,
  TETO_STARTUP_MAGIC,
  TETO_START_OK,
  TETO_VFS_CHECKSUM,
  TETO_VFS_KIND_DIRECTORY,
  TETO_VFS_KIND_FILE,
  TETO_VFS_KIND_LINK,
  TETO_VFS_OK,
  TETO_FD_DIRECTORY,
  TETO_FD_EMPTY,
  TETO_FD_FILE,
  TETO_SEGMENT_EXECUTE,
  TETO_SEGMENT_READ,
  TETO_SEGMENT_WRITE,
  W_BATCHES,
  W_INSTRUCTIONS,
} from "../teto/abi.js";
import { loadTeto } from "../teto/loader.js";
import type { TetoImageProvider } from "../teto/loader.js";
import type { TetoExports } from "../teto/loader.js";
import type { KernelMode } from "../teto/provider.js";

class TestNet extends NetDev {
  seen: DReq[] = [];

  override async req(r: DReq, sig: AbortSignal): Promise<DRes> {
    if (sig.aborted) throw new KErr("EINTR", "test request aborted");
    this.seen.push(r);
    const u = new URL(r.url);
    if (u.pathname === "/go") return { url: r.url, status: 302, text: "Found", hdr: { location: "/file" }, body: new Uint8Array() };
    if (u.pathname === "/gone") return { url: r.url, status: 404, text: "Not Found", hdr: {}, body: enc("missing") };
    const body = r.method === "POST" ? r.body ?? new Uint8Array() : enc("network payload\n");
    if (body.length > r.max) throw new KErr("EFBIG", "test response is too large");
    return { url: r.url, status: 200, text: "OK", hdr: { "content-type": "text/plain", "content-length": String(body.length) }, body };
  }
}

class Rig {
  os: Os;
  out = "";
  err = "";

  constructor(net?: Net, setId = false, teto?: TetoImageProvider, kernelMode?: KernelMode) {
    this.os = boot({
      put: (s, ch: Ch) => { if (ch === "err") this.err += s; else this.out += s; },
      setId,
      ...(teto ? { teto } : {}),
      ...(kernelMode ? { kernelMode } : {}),
    }, net);
  }

  async run(s: string): Promise<{ code: number; out: string; err: string }> {
    this.out = ""; this.err = "";
    const code = await this.os.run(s);
    return { code, out: this.out, err: this.err };
  }
}

class MemTree implements Tree {
  readonly label = "test host directory";
  ent: TreeEnt[] | null = null;
  imageVersion = 0;
  async pull(): Promise<TreeEnt[] | null> { return this.ent?.map(x => ({ ...x, ...(x.data ? { data: x.data.slice() } : {}) })) ?? null; }
  async push(ent: TreeEnt[], imageVersion = this.imageVersion): Promise<void> {
    this.ent = ent.map(x => ({ ...x, ...(x.data ? { data: x.data.slice() } : {}) }));
    this.imageVersion = imageVersion;
  }
}

const tests: Array<[string, () => void | Promise<void>]> = [];
const test = (name: string, fn: () => void | Promise<void>): void => { tests.push([name, fn]); };
const ok: (v: unknown, m?: string) => asserts v = (v, m = "assertion failed") => { if (!v) throw new Error(m); };
const show = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => typeof x === "bigint" ? `${x}n` : x);
const eq = (a: unknown, b: unknown, m = "values differ"): void => { if (!Object.is(a, b)) throw new Error(`${m}: ${show(a)} != ${show(b)}`); };

test("thistle64 byte stores keep low bits above JS integer precision", () => {
  const m = new Mem64(1024n * 1024n, 65536);
  m.set8(0x10000n, 0x00bf762de49b5209n);
  eq(m.u8(0x10000n), 9);
});

test("thistle64 scalar memory handles sparse and page-crossing values", () => {
  const m = new Mem64(1024n * 1024n, 8 * 65536);
  m.set32(0x10020n, 0x89abcdef); eq(m.u32(0x10020n), 0x89abcdef);
  m.set64(0x10028n, 0xfedcba9876543210n); eq(m.u64(0x10028n), 0xfedcba9876543210n);
  m.set16(0x1ffffn, 0xa1b2); eq(m.u16(0x1ffffn), 0xa1b2);
  m.set32(0x2fffen, 0xc3d4e5f6); eq(m.u32(0x2fffen), 0xc3d4e5f6);
  m.set64(0x3fffcn, 0x1020304050607080n); eq(m.u64(0x3fffcn), 0x1020304050607080n);
  m.setF64(0x4fffcn, -12.5); eq(m.f64(0x4fffcn), -12.5);
  m.setF32(0x60000n, -0); ok(Object.is(m.f32(0x60000n), -0), "negative zero lost its sign");
});

test("thistle64 releases full pages and clears partial unmaps", () => {
  const m = new Mem64(1024n * 1024n, 4 * 65536);
  m.set32(0x10000n, 0x11223344); m.set32(0x20010n, 0x55667788);
  eq(m.used, 2 * 65536);
  m.drop(0x10000n, 65536); eq(m.used, 65536); eq(m.u32(0x10000n), 0);
  m.drop(0x20011n, 2); eq(m.used, 65536); eq(m.u32(0x20010n), 0x55000088);
});

test("RV64 shared mappings flush on msync, munmap and exit", async () => {
  interface HFs { readFile(p: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const r = new Rig(), bin = new Uint8Array(await fs.readFile(new URL("../../assets/mmap-shared.thx", import.meta.url)));
  r.os.load("mmap-shared.thx", bin);
  const x = await r.run("/tmp/mmap-shared.thx");
  eq(x.code, 0); eq(x.err, "");
  const b = r.os.s.readb("/tmp/mmap-shared.out"), at = (n: number, s: string): void => eq(dec(b.slice(n, n + s.length)), s);
  at(0, "flushed-at-exit"); at(4096, "flushed-by-msync"); at(8192, "flushed-by-munmap");
});

test(".thx and .39 are byte-identical header-selected THX aliases", async () => {
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const [assetThx, asset39, webThx, web39] = await Promise.all([
    fs.readFile(new URL("../../assets/hello.thx", import.meta.url)),
    fs.readFile(new URL("../../assets/hello.39", import.meta.url)),
    fs.readFile(new URL("../../dist/web/assets/hello.thx", import.meta.url)),
    fs.readFile(new URL("../../dist/web/assets/hello.39", import.meta.url)),
  ]);
  const same = (a: Uint8Array, b: Uint8Array): boolean =>
    a.length === b.length && a.every((value, index) => value === b[index]);
  ok(same(assetThx, asset39), "generated .thx and .39 assets differ");
  ok(same(assetThx, webThx) && same(asset39, web39), "static packaging changed THX alias bytes");
  eq(dec(asset39.slice(0, 4)), "THX2");

  const r = new Rig(), s = r.os.s;
  const installedThx = s.readb("/usr/bin/hello.thx");
  const installed39 = s.readb("/usr/bin/hello.39");
  ok(same(installedThx, installed39), "installed .thx and .39 aliases resolve to different bytes");
  eq(s.stat("/usr/bin/hello.thx").mode, 0o755);
  eq(s.stat("/usr/bin/hello.39").mode, 0o755);

  const thx = await r.run("/usr/bin/hello.thx");
  const thirtyNine = await r.run("/usr/bin/hello.39");
  eq(`${thx.code}:${thx.out}:${thx.err}`, `${thirtyNine.code}:${thirtyNine.out}:${thirtyNine.err}`);
  eq(thx.code, 0);

  s.writeb("/tmp/renamed.thx", installedThx); s.chmod("/tmp/renamed.thx", 0o755);
  let result = await r.run("mv /tmp/renamed.thx /tmp/renamed.39; /tmp/renamed.39");
  eq(result.code, 0); eq(result.out, thx.out);
  result = await r.run("mv /tmp/renamed.39 /tmp/renamed.thx; /tmp/renamed.thx");
  eq(result.code, 0); eq(result.out, thx.out);

  s.writeb("/tmp/no-extension", installedThx); s.chmod("/tmp/no-extension", 0o755);
  result = await r.run("/tmp/no-extension");
  eq(result.code, 0, "a valid THX header depended on a filename extension");
  s.write("/tmp/not-thx.39", "not a THX executable\n", false, 0o755);
  s.chmod("/tmp/not-thx.39", 0o755);
  result = await r.run("/tmp/not-thx.39");
  eq(result.code, 126, "the .39 suffix bypassed THX header validation");

  result = await r.run("ld -o /tmp/linked.39 /usr/share/thistle/examples/hello.to && /tmp/linked.39");
  eq(result.code, 0); eq(result.out, thx.out);
  const completion = r.os.complete("/usr/bin/hello.3");
  eq(completion.line, "/usr/bin/hello.39 ");
  eq(completion.list.join("\n"), "/usr/bin/hello.39");
});

test("generated Teto executes bounded RV64 batches with direct-source parity", async () => {
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const addi = (rd: number, rs: number, immediate: number): number =>
    ((immediate & 0xfff) << 20 | rs << 15 | rd << 7 | 0x13) >>> 0;
  const branch = (funct3: number, left: number, right: number, immediate: number): number => {
    const value = immediate & 0x1fff;
    return ((value >>> 12 & 1) << 31 | (value >>> 5 & 0x3f) << 25 |
      right << 20 | left << 15 | funct3 << 12 | (value >>> 1 & 0xf) << 8 |
      (value >>> 11 & 1) << 7 | 0x63) >>> 0;
  };
  const words = [
    addi(4, 0, 1000),
    addi(5, 0, 0),
    addi(5, 5, 1),
    branch(4, 5, 4, -4),
    addi(17, 0, 172),
    0x00000073,
    addi(6, 10, 0),
    addi(17, 0, 174),
    0x00000073,
    addi(7, 10, 0),
    addi(10, 5, 0),
    addi(17, 0, 93),
    0x00000073,
  ];
  const program = new Uint8Array(words.length * 4);
  const programView = new DataView(program.buffer);
  words.forEach((instruction, index) => programView.setUint32(index * 4, instruction, true));
  const virtualTop = 1n << 40n, pc = 0x10000n;
  const installDirect = (memory: ReturnType<typeof directMemory>, hart: number, address: bigint, bytes: Uint8Array, data = 0n): void => {
    const at = tetoImageReserve(memory, bytes.length);
    ok(at < 0xfffffffe, "direct Teto image reservation failed");
    memory.bytes.set(bytes, at);
    eq(tetoImageBegin(memory, hart, virtualTop, address, 0n, 0, 0), TETO_THX_OK);
    eq(tetoImageSegment(memory, hart, 0x11110000 + hart, 5, address, BigInt(bytes.length),
      TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, at, bytes.length), TETO_THX_OK);
    if (data !== 0n) eq(tetoImageSegment(memory, hart, 0x22220000 + hart, 5, data, 65536n,
      TETO_SEGMENT_READ | TETO_SEGMENT_WRITE, at, 0), TETO_THX_OK);
    eq(tetoImageFinish(memory, hart, bytes.length), TETO_THX_OK);
    eq(tetoImageRelease(memory, at, bytes.length), TETO_THX_OK);
  };

  const direct = directMemory(64 * 1024 * 1024);
  eq(tetoKernelInit(direct, 2, false), 0);
  eq(tetoHartInit(direct, 0, virtualTop, pc), 0);
  eq(tetoProcessInit(direct, 0, 42, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
  eq(tetoProcessSetGroup(direct, 0, 0, 1000), 0);
  eq(tetoProcessSetGroup(direct, 0, 1, 1000), 0);
  eq(tetoProcessSetGroup(direct, 0, 2, 39), 0);
  eq(tetoProcessCount(direct), 1);
  installDirect(direct, 0, pc, program);
  eq(tetoRunRv64Batch(direct, 0, 4096, 123456n, 0), TETO_BATCH_EXITED);
  eq(tetoHartGetX(direct, 0, 5), 1000n);
  eq(tetoHartGetX(direct, 0, 6), 42n);
  eq(tetoHartGetX(direct, 0, 7), 1000n);
  eq(tetoHartGetX(direct, 0, 10), 1000n);
  eq(tetoHartGetX(direct, 0, 17), 93n);
  eq(tetoHartMetric(direct, 0, H_INSTRUCTIONS), 2011n);
  eq(tetoHartMetric(direct, 0, H_INTERNAL_SYSCALLS), 3n);
  eq(tetoHartMetric(direct, 0, H_HOST_REQUESTS), 0n);
  eq(tetoHartMetric(direct, 0, H_FALLBACK_SYSCALLS), 0n);
  eq(tetoHartMetric(direct, 0, H_HOST_TO_WASM), 1n);
  eq(tetoHartMetric(direct, 0, H_WASM_TO_HOST), 1n);

  const wasmBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const wasm = await loadTeto(wasmBytes);
  const wasmMemory = new Uint8Array(wasm.memory.buffer);
  const installWasm = (runtime: typeof wasm, hart: number, address: bigint, bytes: Uint8Array, data = 0n): void => {
    const at = runtime.exports.tetoImageReserve(0, bytes.length) >>> 0;
    ok(at < 0xfffffffe, "WASM Teto image reservation failed");
    new Uint8Array(runtime.memory.buffer).set(bytes, at);
    eq(runtime.exports.tetoImageBegin(0, hart, virtualTop, address, 0n, 0, 0), TETO_THX_OK);
    eq(runtime.exports.tetoImageSegment(0, hart, 0x11110000 + hart, 5, address, BigInt(bytes.length),
      TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, at, bytes.length), TETO_THX_OK);
    if (data !== 0n) eq(runtime.exports.tetoImageSegment(0, hart, 0x22220000 + hart, 5, data, 65536n,
      TETO_SEGMENT_READ | TETO_SEGMENT_WRITE, at, 0), TETO_THX_OK);
    eq(runtime.exports.tetoImageFinish(0, hart, bytes.length), TETO_THX_OK);
    eq(runtime.exports.tetoImageRelease(0, at, bytes.length), TETO_THX_OK);
  };
  eq(wasm.exports.tetoKernelInit(0, 2, 0), 0);
  eq(wasm.exports.tetoHartInit(0, 0, virtualTop, pc), 0);
  eq(wasm.exports.tetoProcessInit(0, 0, 42, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
  eq(wasm.exports.tetoProcessSetGroup(0, 0, 0, 1000), 0);
  eq(wasm.exports.tetoProcessSetGroup(0, 0, 1, 1000), 0);
  eq(wasm.exports.tetoProcessSetGroup(0, 0, 2, 39), 0);
  eq(wasm.exports.tetoProcessCount(0), 1);
  installWasm(wasm, 0, pc, program);
  eq(wasm.exports.tetoRunRv64Batch(0, 0, 4096, 123456n, 0), TETO_BATCH_EXITED);
  for (let register = 0; register < 32; register++) {
    eq(wasm.exports.tetoHartGetX(0, 0, register), tetoHartGetX(direct, 0, register), `Teto x${register} diverged from direct source`);
  }
  eq(wasm.exports.tetoHartPc(0, 0), pc + 0x34n);
  eq(wasm.exports.tetoHartMetric(0, 0, H_INSTRUCTIONS), 2011n);
  eq(wasm.exports.tetoHartMetric(0, 0, H_INTERNAL_SYSCALLS), 3n);
  eq(wasm.exports.tetoHartMetric(0, 0, H_HOST_REQUESTS), 0n);
  eq(wasm.exports.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
  eq(wasm.exports.tetoHartMetric(0, 0, H_HOST_TO_WASM), 1n);
  eq(wasm.exports.tetoHartMetric(0, 0, H_WASM_TO_HOST), 1n);
  ok(wasm.exports.tetoHartMetric(0, 0, H_INSTRUCTIONS) / wasm.exports.tetoHartMetric(0, 0, H_WASM_TO_HOST) > 1000n,
    "Teto returned to the host too frequently");

  const floating = (top: number, destination: number, sourceA: number, sourceB = 0, mode = 0): number =>
    (top << 25 | sourceB << 20 | sourceA << 15 | mode << 12 | destination << 7 | 0x53) >>> 0;
  const floatingStore = (source: number, base: number, offset = 0): number =>
    ((offset >>> 5 & 0x7f) << 25 | source << 20 | base << 15 | 3 << 12 | (offset & 0x1f) << 7 | 0x27) >>> 0;
  const floatingLoad = (destination: number, base: number, offset = 0): number =>
    ((offset & 0xfff) << 20 | base << 15 | 3 << 12 | destination << 7 | 0x07) >>> 0;
  const floatingWords = [
    floating(0x79, 1, 1),
    floating(0x79, 2, 2),
    floating(0x01, 3, 1, 2),
    floating(0x71, 6, 3),
    floatingStore(3, 7),
    floatingLoad(5, 7),
    floating(0x71, 8, 5),
    0x00000073,
  ];
  const floatingProgram = new Uint8Array(floatingWords.length * 4);
  const floatingProgramView = new DataView(floatingProgram.buffer);
  floatingWords.forEach((instruction, index) => floatingProgramView.setUint32(index * 4, instruction, true));
  const bits = (value: number): bigint => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, value, true);
    return view.getBigUint64(0, true);
  };
  const floatingPc = 0x20000n, dataAddress = virtualTop - 0x10000n;
  eq(tetoHartInit(direct, 0, virtualTop, floatingPc), 0);
  eq(tetoProcessInit(direct, 0, 44, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
  installDirect(direct, 0, floatingPc, floatingProgram, dataAddress);
  eq(tetoHartSetX(direct, 0, 1, bits(1.5)), 0);
  eq(tetoHartSetX(direct, 0, 2, bits(2.25)), 0);
  eq(tetoHartSetX(direct, 0, 7, dataAddress), 0);
  eq(tetoRunRv64Batch(direct, 0, 64, 123456n, 0), TETO_BATCH_SYSCALL);
  eq(tetoHartGetF(direct, 0, 3), bits(3.75));
  eq(tetoHartGetX(direct, 0, 6), bits(3.75));
  eq(tetoHartGetX(direct, 0, 8), bits(3.75));

  eq(wasm.exports.tetoHartInit(0, 0, virtualTop, floatingPc), 0);
  eq(wasm.exports.tetoProcessInit(0, 0, 45, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
  installWasm(wasm, 0, floatingPc, floatingProgram, dataAddress);
  eq(wasm.exports.tetoHartSetX(0, 0, 1, bits(1.5)), 0);
  eq(wasm.exports.tetoHartSetX(0, 0, 2, bits(2.25)), 0);
  eq(wasm.exports.tetoHartSetX(0, 0, 7, dataAddress), 0);
  eq(wasm.exports.tetoRunRv64Batch(0, 0, 64, 123456n, 0), TETO_BATCH_SYSCALL);
  eq(wasm.exports.tetoHartGetF(0, 0, 3), tetoHartGetF(direct, 0, 3));
  eq(wasm.exports.tetoHartGetX(0, 0, 6), tetoHartGetX(direct, 0, 6));
  eq(wasm.exports.tetoHartGetX(0, 0, 8), tetoHartGetX(direct, 0, 8));
  const dataPage = wasm.exports.tetoGuestPage(0, 0, dataAddress, 0);
  eq(new DataView(wasm.memory.buffer).getBigUint64(dataPage + Number(dataAddress & 0xffffn), true), bits(3.75));

  const threadedBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto-threads.wasm", import.meta.url)));
  const first = await loadTeto(threadedBytes, { threaded: true });
  const second = await loadTeto(threadedBytes, { threaded: true, memory: first.memory });
  eq(first.exports.tetoKernelInit(0, 2, 1), 0);
  eq(first.exports.tetoHartInit(0, 0, virtualTop, pc), 0);
  eq(first.exports.tetoHartInit(0, 1, virtualTop, pc), 0);
  eq(first.exports.tetoProcessInit(0, 0, 42, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
  ok(second.exports.tetoProcessInit(0, 1, 42, 1, 1001, 1001, 1001, 1001, 1001, 1001) !== 0,
    "shared Teto process table accepted a duplicate PID");
  eq(first.exports.tetoProcessInit(0, 1, 43, 1, 1001, 1001, 1001, 1001, 1001, 1001), 0);
  eq(second.exports.tetoProcessCount(0), 2, "shared Teto instances did not observe one process table");
  installWasm(first, 0, pc, program);
  installWasm(first, 1, pc, program);
  eq(first.exports.tetoRunRv64Batch(0, 0, 4096, 123456n, 0), TETO_BATCH_EXITED);
  eq(second.exports.tetoRunRv64Batch(0, 1, 4096, 123456n, 1), TETO_BATCH_EXITED);
  eq(first.exports.tetoHartGetX(0, 1, 10), 1000n, "shared Teto instances did not observe one coherent hart table");
  eq(new DataView(first.memory.buffer).getInt32(C_ACTIVE_WORKERS, true), 0, "Teto leaked an active worker count");

  const parallelWords = [
    addi(4, 0, 500),
    addi(5, 0, 0),
    addi(6, 0, 2000),
    addi(5, 5, 1),
    addi(6, 6, -1),
    branch(1, 6, 0, -8),
    addi(4, 4, -1),
    branch(1, 4, 0, -20),
    addi(17, 0, 93),
    addi(10, 0, 0),
    0x00000073,
  ];
  const parallelProgram = new Uint8Array(parallelWords.length * 4);
  const parallelView = new DataView(parallelProgram.buffer);
  parallelWords.forEach((instruction, index) => parallelView.setUint32(index * 4, instruction, true));
  const parallel = await loadTeto(threadedBytes, { threaded: true });
  eq(parallel.exports.tetoKernelInit(0, 2, 1), 0);
  for (let hart = 0; hart < 2; hart++) {
    eq(parallel.exports.tetoHartInit(0, hart, virtualTop, pc), 0);
    eq(parallel.exports.tetoProcessInit(0, hart, 50 + hart, 1, 1000 + hart, 1000 + hart, 1000 + hart,
      1000 + hart, 1000 + hart, 1000 + hart), 0);
    installWasm(parallel, hart, pc, parallelProgram);
  }

  interface WorkerReport { calls: number; claims: number; idle: number; contention: number; terminal: number; }
  interface HostWorker {
    once(event: "message", listener: (value: unknown) => void): HostWorker;
    once(event: "error", listener: (value: unknown) => void): HostWorker;
  }
  interface HostWorkerConstructor {
    new(url: URL, options: { workerData: unknown }): HostWorker;
  }
  const workerThreads = await mod("node:worker_threads") as { Worker: HostWorkerConstructor };
  const runWorker = (worker: number): Promise<WorkerReport> => new Promise((resolve, reject) => {
    const thread = new workerThreads.Worker(new URL("./teto-worker.js", import.meta.url), {
      workerData: { bytes: threadedBytes, memory: parallel.memory, worker, budget: 8192 },
    });
    thread.once("message", value => resolve(value as WorkerReport));
    thread.once("error", value => reject(value instanceof Error ? value : new Error(String(value))));
  });
  const reports = await Promise.all([runWorker(0), runWorker(1)]);
  ok(reports.every(report => report.terminal === 0), `Teto scheduler worker failed: ${show(reports)}`);
  ok(reports.every(report => report.claims > 0), `a Teto worker executed no scheduled batch: ${show(reports)}`);
  eq(parallel.exports.tetoHartStatus(0, 0), TETO_HART_EXITED);
  eq(parallel.exports.tetoHartStatus(0, 1), TETO_HART_EXITED);
  ok(parallel.exports.tetoWorkerMetric(0, 0, W_BATCHES) > 0n);
  ok(parallel.exports.tetoWorkerMetric(0, 1, W_BATCHES) > 0n);
  ok(parallel.exports.tetoWorkerMetric(0, 0, W_INSTRUCTIONS) > 0n);
  ok(parallel.exports.tetoWorkerMetric(0, 1, W_INSTRUCTIONS) > 0n);
  eq(parallel.exports.tetoProcessCount(0), 2);
  eq(new DataView(parallel.memory.buffer).getInt32(C_ACTIVE_WORKERS, true), 0, "parallel Teto leaked an active worker count");
});

test("Teto enforces executable, readable and writable guest mappings", async () => {
  type ProtectionCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoImageReserve" |
    "tetoImageRelease" | "tetoImageBegin" | "tetoImageSegment" | "tetoImageFinish" |
    "tetoHartSetX" | "tetoHartGetX" | "tetoHartSetPc" | "tetoHartStatus" | "tetoGuestPage" |
    "tetoRunRv64Batch">;
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const addi = (rd: number, rs: number, immediate: number): number =>
    ((immediate & 0xfff) << 20 | rs << 15 | rd << 7 | 0x13) >>> 0;
  const load = (rd: number, base: number): number => (base << 15 | 3 << 12 | rd << 7 | 0x03) >>> 0;
  const store = (source: number, base: number): number => (source << 20 | base << 15 | 3 << 12 | 0x23) >>> 0;
  const words = (values: number[]): Uint8Array => {
    const bytes = new Uint8Array(values.length * 4);
    const view = new DataView(bytes.buffer);
    values.forEach((value, index) => view.setUint32(index * 4, value, true));
    return bytes;
  };
  const exit = [addi(10, 0, 0), addi(17, 0, 93), 0x00000073];
  const pc = 0x10000n, data = 0x20000n, virtualTop = 1n << 40n;
  const cases = [
    { name: "valid-rw", code: words([store(2, 1), load(3, 1), ...exit]),
      codeFlags: TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE,
      dataFlags: TETO_SEGMENT_READ | TETO_SEGMENT_WRITE, dataLength: 65536n,
      initial: new Uint8Array(8), result: TETO_BATCH_EXITED, status: TETO_HART_EXITED, value: 39n },
    { name: "execute-without-x", code: words(exit),
      codeFlags: TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE,
      dataFlags: TETO_SEGMENT_READ, dataLength: 65536n, initial: words(exit), runPc: data,
      result: TETO_BATCH_FAULT, status: TETO_HART_FAULTED, value: 0n },
    { name: "store-to-read-only", code: words([store(2, 1)]),
      codeFlags: TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, dataFlags: TETO_SEGMENT_READ,
      dataLength: 65536n, initial: new Uint8Array(8),
      result: TETO_BATCH_FAULT, status: TETO_HART_FAULTED, value: 0n },
    { name: "load-from-write-only", code: words([load(3, 1)]),
      codeFlags: TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, dataFlags: TETO_SEGMENT_WRITE,
      dataLength: 65536n, initial: new Uint8Array(8),
      result: TETO_BATCH_FAULT, status: TETO_HART_FAULTED, value: 0n },
    { name: "load-from-unmapped", code: words([load(3, 1)]),
      codeFlags: TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE,
      dataFlags: 0, dataLength: 0n, initial: new Uint8Array(),
      result: TETO_BATCH_FAULT, status: TETO_HART_FAULTED, value: 0n },
  ];

  const sourceMemory = directMemory(64 * 1024 * 1024);
  const source: ProtectionCore = {
    tetoKernelInit: (_memory, maxHarts, threaded) => tetoKernelInit(sourceMemory, maxHarts, threaded !== 0),
    tetoHartInit: (_memory, hart, top, entry) => tetoHartInit(sourceMemory, hart, top, entry),
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    tetoImageBegin: (_memory, hart, top, entry, phdr, phent, phnum) =>
      tetoImageBegin(sourceMemory, hart, top, entry, phdr, phent, phnum),
    tetoImageSegment: (_memory, hart, nameHash, nameLength, address, size, flags, imageAt, length) =>
      tetoImageSegment(sourceMemory, hart, nameHash, nameLength, address, size, flags, imageAt, length),
    tetoImageFinish: (_memory, hart, size) => tetoImageFinish(sourceMemory, hart, size),
    tetoHartSetX: (_memory, hart, register, value) => tetoHartSetX(sourceMemory, hart, register, value),
    tetoHartGetX: (_memory, hart, register) => tetoHartGetX(sourceMemory, hart, register),
    tetoHartSetPc: (_memory, hart, value) => tetoHartSetPc(sourceMemory, hart, value),
    tetoHartStatus: (_memory, hart) => tetoHartStatus(sourceMemory, hart),
    tetoGuestPage: (_memory, hart, address, create) => tetoGuestPage(sourceMemory, hart, address, create !== 0),
    tetoRunRv64Batch: (_memory, hart, budget, nowMicros, worker) =>
      tetoRunRv64Batch(sourceMemory, hart, budget, nowMicros, worker),
  };
  const generatedBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const generated = await loadTeto(generatedBytes);

  const exercise = (core: ProtectionCore, memory: Uint8Array): string => {
    const results: unknown[] = [];
    for (const item of cases) {
      eq(core.tetoKernelInit(0, 1, 0), 0);
      eq(core.tetoHartInit(0, 0, virtualTop, pc), 0);
      eq(core.tetoProcessInit(0, 0, 70, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
      const imageLength = item.code.length + item.initial.length;
      const imageAt = core.tetoImageReserve(0, imageLength) >>> 0;
      ok(imageAt < 0xfffffffe, `${item.name}: image reservation failed`);
      memory.set(item.code, imageAt);
      memory.set(item.initial, imageAt + item.code.length);
      eq(core.tetoImageBegin(0, 0, virtualTop, pc, 0n, 0, 0), TETO_THX_OK);
      eq(core.tetoImageSegment(0, 0, 0x1111, 4, pc, BigInt(item.code.length), item.codeFlags,
        imageAt, item.code.length), TETO_THX_OK);
      if (item.dataLength !== 0n) {
        eq(core.tetoImageSegment(0, 0, 0x2222, 4, data, item.dataLength, item.dataFlags,
          imageAt + item.code.length, item.initial.length), TETO_THX_OK);
      }
      eq(core.tetoImageFinish(0, 0, imageLength), TETO_THX_OK);
      eq(core.tetoImageRelease(0, imageAt, imageLength), TETO_THX_OK);
      eq(core.tetoHartSetX(0, 0, 1, data), 0);
      eq(core.tetoHartSetX(0, 0, 2, 39n), 0);
      if (item.runPc !== undefined) eq(core.tetoHartSetPc(0, 0, item.runPc), 0);
      const result = core.tetoRunRv64Batch(0, 0, 64, 123456n, 0);
      const status = core.tetoHartStatus(0, 0);
      const fault = new DataView(memory.buffer).getInt32(TETO_HART_BASE + H_FAULT, true);
      eq(result, item.result, `${item.name}: unexpected batch result`);
      eq(status, item.status, `${item.name}: unexpected hart status`);
      if (item.result === TETO_BATCH_FAULT) eq(fault, TETO_FAULT_MEMORY, `${item.name}: wrong fault`);
      eq(core.tetoHartGetX(0, 0, 3), item.value, `${item.name}: unexpected loaded value`);
      results.push([item.name, result, status, fault, core.tetoHartGetX(0, 0, 3)]);
    }
    return show(results);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  eq(generatedResult, sourceResult);
});

test("Teto owns RV64 brk growth, bounds and shrink zeroing", async () => {
  type BreakCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoImageReserve" |
    "tetoImageRelease" | "tetoImageBegin" | "tetoImageSegment" | "tetoImageFinish" |
    "tetoBuildInitialStack" | "tetoHartBreak" | "tetoHartGetX" | "tetoHartMetric" |
    "tetoRunRv64Batch">;
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const addi = (rd: number, rs: number, immediate: number): number =>
    ((immediate & 0xfff) << 20 | rs << 15 | rd << 7 | 0x13) >>> 0;
  const load = (rd: number, base: number): number => (base << 15 | 3 << 12 | rd << 7 | 0x03) >>> 0;
  const store = (source: number, base: number): number => (source << 20 | base << 15 | 3 << 12 | 0x23) >>> 0;
  const instructions = [
    addi(10, 0, 0), addi(17, 0, 214), 0x00000073,
    addi(5, 10, 0), addi(10, 5, 64), 0x00000073,
    addi(6, 0, 39), store(6, 5),
    addi(10, 5, 0), 0x00000073,
    addi(10, 5, 64), 0x00000073,
    load(7, 5), addi(10, 2, 0), 0x00000073, addi(8, 10, 0),
    addi(10, 7, 0), addi(17, 0, 93), 0x00000073,
  ];
  const code = new Uint8Array(instructions.length * 4);
  const codeView = new DataView(code.buffer);
  instructions.forEach((instruction, index) => codeView.setUint32(index * 4, instruction, true));
  const startup = new Uint8Array(38);
  const startupView = new DataView(startup.buffer);
  startupView.setUint32(0, TETO_STARTUP_MAGIC, true);
  startupView.setUint32(4, 1, true);
  startupView.setUint32(32, 2, true);
  startup.set(enc("/x"), 36);
  const pc = 0x10000n, virtualTop = 1024n * 1024n * 1024n;
  const expectedInitial = pc + BigInt(code.length) + 4095n & -4096n;

  const sourceMemory = directMemory(64 * 1024 * 1024);
  const source: BreakCore = {
    tetoKernelInit: (_memory, maxHarts, threaded) => tetoKernelInit(sourceMemory, maxHarts, threaded !== 0),
    tetoHartInit: (_memory, hart, top, entry) => tetoHartInit(sourceMemory, hart, top, entry),
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    tetoImageBegin: (_memory, hart, top, entry, phdr, phent, phnum) =>
      tetoImageBegin(sourceMemory, hart, top, entry, phdr, phent, phnum),
    tetoImageSegment: (_memory, hart, nameHash, nameLength, address, size, flags, imageAt, length) =>
      tetoImageSegment(sourceMemory, hart, nameHash, nameLength, address, size, flags, imageAt, length),
    tetoImageFinish: (_memory, hart, size) => tetoImageFinish(sourceMemory, hart, size),
    tetoBuildInitialStack: (_memory, hart, at, size, stackBytes) =>
      tetoBuildInitialStack(sourceMemory, hart, at, size, stackBytes),
    tetoHartBreak: (_memory, hart) => tetoHartBreak(sourceMemory, hart),
    tetoHartGetX: (_memory, hart, register) => tetoHartGetX(sourceMemory, hart, register),
    tetoHartMetric: (_memory, hart, offset) => tetoHartMetric(sourceMemory, hart, offset),
    tetoRunRv64Batch: (_memory, hart, budget, nowMicros, worker) =>
      tetoRunRv64Batch(sourceMemory, hart, budget, nowMicros, worker),
  };
  const wasmBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const generated = await loadTeto(wasmBytes);

  const exercise = (core: BreakCore, memory: Uint8Array): string => {
    eq(core.tetoKernelInit(0, 1, 0), 0);
    eq(core.tetoHartInit(0, 0, virtualTop, pc), 0);
    eq(core.tetoProcessInit(0, 0, 71, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
    const imageAt = core.tetoImageReserve(0, code.length) >>> 0;
    memory.set(code, imageAt);
    eq(core.tetoImageBegin(0, 0, virtualTop, pc, 0n, 0, 0), TETO_THX_OK);
    eq(core.tetoImageSegment(0, 0, 0x1111, 4, pc, BigInt(code.length),
      TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, imageAt, code.length), TETO_THX_OK);
    eq(core.tetoImageFinish(0, 0, code.length), TETO_THX_OK);
    eq(core.tetoImageRelease(0, imageAt, code.length), TETO_THX_OK);
    eq(core.tetoHartBreak(0, 0), expectedInitial);
    const startupAt = core.tetoImageReserve(0, startup.length) >>> 0;
    memory.set(startup, startupAt);
    eq(core.tetoBuildInitialStack(0, 0, startupAt, startup.length, 1024 * 1024), TETO_START_OK);
    eq(core.tetoImageRelease(0, startupAt, startup.length), TETO_THX_OK);
    eq(core.tetoRunRv64Batch(0, 0, 128, 123456n, 0), TETO_BATCH_EXITED);
    eq(core.tetoHartGetX(0, 0, 5), expectedInitial);
    eq(core.tetoHartGetX(0, 0, 7), 0n, "regrown heap exposed truncated bytes");
    eq(core.tetoHartGetX(0, 0, 8), expectedInitial + 64n, "invalid break changed the heap bound");
    eq(core.tetoHartBreak(0, 0), expectedInitial + 64n);
    eq(core.tetoHartMetric(0, 0, H_INTERNAL_SYSCALLS), 6n);
    eq(core.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
    return show([core.tetoHartGetX(0, 0, 5), core.tetoHartGetX(0, 0, 7),
      core.tetoHartGetX(0, 0, 8), core.tetoHartBreak(0, 0),
      core.tetoHartMetric(0, 0, H_INTERNAL_SYSCALLS)]);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  eq(generatedResult, sourceResult);
});

test("Teto owns anonymous RV64 mappings and partial unmap", async () => {
  type MapCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoImageReserve" |
    "tetoImageRelease" | "tetoImageBegin" | "tetoImageSegment" | "tetoImageFinish" |
    "tetoBuildInitialStack" | "tetoHartSetX" | "tetoHartGetX" | "tetoHartStatus" |
    "tetoHartMetric" | "tetoProcessMapCount" | "tetoRunRv64Batch">;
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const addi = (rd: number, rs: number, immediate: number): number =>
    ((immediate & 0xfff) << 20 | rs << 15 | rd << 7 | 0x13) >>> 0;
  const add = (rd: number, left: number, right: number): number =>
    (right << 20 | left << 15 | rd << 7 | 0x33) >>> 0;
  const load = (rd: number, base: number): number => (base << 15 | 3 << 12 | rd << 7 | 0x03) >>> 0;
  const store = (source: number, base: number): number => (source << 20 | base << 15 | 3 << 12 | 0x23) >>> 0;
  const instructions = [
    0x00000073, addi(5, 10, 0), add(21, 5, 20), load(8, 21),
    addi(6, 0, 39), store(6, 5), load(7, 5),
    addi(10, 5, 0), addi(11, 20, 0), addi(17, 0, 215), 0x00000073,
    load(9, 21), load(10, 5),
  ];
  const code = new Uint8Array(instructions.length * 4);
  const codeView = new DataView(code.buffer);
  instructions.forEach((instruction, index) => codeView.setUint32(index * 4, instruction, true));
  const startup = new Uint8Array(38);
  const startupView = new DataView(startup.buffer);
  startupView.setUint32(0, TETO_STARTUP_MAGIC, true);
  startupView.setUint32(4, 1, true);
  startupView.setUint32(32, 2, true);
  startup.set(enc("/x"), 36);
  const pc = 0x10000n, virtualTop = 1024n * 1024n * 1024n;

  const sourceMemory = directMemory(64 * 1024 * 1024);
  const source: MapCore = {
    tetoKernelInit: (_memory, maxHarts, threaded) => tetoKernelInit(sourceMemory, maxHarts, threaded !== 0),
    tetoHartInit: (_memory, hart, top, entry) => tetoHartInit(sourceMemory, hart, top, entry),
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    tetoImageBegin: (_memory, hart, top, entry, phdr, phent, phnum) =>
      tetoImageBegin(sourceMemory, hart, top, entry, phdr, phent, phnum),
    tetoImageSegment: (_memory, hart, nameHash, nameLength, address, size, flags, imageAt, length) =>
      tetoImageSegment(sourceMemory, hart, nameHash, nameLength, address, size, flags, imageAt, length),
    tetoImageFinish: (_memory, hart, size) => tetoImageFinish(sourceMemory, hart, size),
    tetoBuildInitialStack: (_memory, hart, at, size, stackBytes) =>
      tetoBuildInitialStack(sourceMemory, hart, at, size, stackBytes),
    tetoHartSetX: (_memory, hart, register, value) => tetoHartSetX(sourceMemory, hart, register, value),
    tetoHartGetX: (_memory, hart, register) => tetoHartGetX(sourceMemory, hart, register),
    tetoHartStatus: (_memory, hart) => tetoHartStatus(sourceMemory, hart),
    tetoHartMetric: (_memory, hart, offset) => tetoHartMetric(sourceMemory, hart, offset),
    tetoProcessMapCount: (_memory, hart) => tetoProcessMapCount(sourceMemory, hart),
    tetoRunRv64Batch: (_memory, hart, budget, nowMicros, worker) =>
      tetoRunRv64Batch(sourceMemory, hart, budget, nowMicros, worker),
  };
  const wasmBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const generated = await loadTeto(wasmBytes);

  const exercise = (core: MapCore, memory: Uint8Array): string => {
    eq(core.tetoKernelInit(0, 1, 0), 0);
    eq(core.tetoHartInit(0, 0, virtualTop, pc), 0);
    eq(core.tetoProcessInit(0, 0, 72, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
    const imageAt = core.tetoImageReserve(0, code.length) >>> 0;
    memory.set(code, imageAt);
    eq(core.tetoImageBegin(0, 0, virtualTop, pc, 0n, 0, 0), TETO_THX_OK);
    eq(core.tetoImageSegment(0, 0, 0x1111, 4, pc, BigInt(code.length),
      TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, imageAt, code.length), TETO_THX_OK);
    eq(core.tetoImageFinish(0, 0, code.length), TETO_THX_OK);
    eq(core.tetoImageRelease(0, imageAt, code.length), TETO_THX_OK);
    const startupAt = core.tetoImageReserve(0, startup.length) >>> 0;
    memory.set(startup, startupAt);
    eq(core.tetoBuildInitialStack(0, 0, startupAt, startup.length, 1024 * 1024), TETO_START_OK);
    eq(core.tetoImageRelease(0, startupAt, startup.length), TETO_THX_OK);
    const registers: Array<[number, bigint]> = [
      [10, 0n], [11, 8192n], [12, 3n], [13, 0x22n], [14, -1n], [15, 0n], [17, 222n], [20, 4096n],
    ];
    for (const [register, value] of registers) eq(core.tetoHartSetX(0, 0, register, value), 0);
    eq(core.tetoRunRv64Batch(0, 0, 128, 123456n, 0), TETO_BATCH_FAULT);
    eq(core.tetoHartStatus(0, 0), TETO_HART_FAULTED);
    const fault = new DataView(memory.buffer).getInt32(TETO_HART_BASE + H_FAULT, true);
    eq(fault, TETO_FAULT_MEMORY);
    const mapped = core.tetoHartGetX(0, 0, 5);
    ok(mapped > pc && (mapped & 4095n) === 0n, "anonymous mmap returned an invalid address");
    eq(core.tetoHartGetX(0, 0, 7), 39n);
    eq(core.tetoHartGetX(0, 0, 8), 0n);
    eq(core.tetoHartGetX(0, 0, 9), 0n);
    eq(core.tetoProcessMapCount(0, 0), 1);
    eq(core.tetoHartMetric(0, 0, H_INTERNAL_SYSCALLS), 2n);
    eq(core.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
    return show([mapped, core.tetoHartGetX(0, 0, 7), core.tetoHartGetX(0, 0, 8),
      core.tetoHartGetX(0, 0, 9), core.tetoProcessMapCount(0, 0), fault]);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  eq(generatedResult, sourceResult);
});

test("Teto protects, synchronises and remaps anonymous RV64 memory", async () => {
  type PolicyCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoImageReserve" |
    "tetoImageRelease" | "tetoImageBegin" | "tetoImageSegment" | "tetoImageFinish" |
    "tetoBuildInitialStack" | "tetoHartSetX" | "tetoHartGetX" | "tetoHartStatus" |
    "tetoHartMetric" | "tetoProcessMapCount" | "tetoRunRv64Batch">;
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const addi = (rd: number, rs: number, immediate: number): number =>
    ((immediate & 0xfff) << 20 | rs << 15 | rd << 7 | 0x13) >>> 0;
  const add = (rd: number, left: number, right: number): number =>
    (right << 20 | left << 15 | rd << 7 | 0x33) >>> 0;
  const load = (rd: number, base: number): number => (base << 15 | 3 << 12 | rd << 7 | 0x03) >>> 0;
  const store = (source: number, base: number): number => (source << 20 | base << 15 | 3 << 12 | 0x23) >>> 0;
  const bytes = (instructions: number[]): Uint8Array => {
    const code = new Uint8Array(instructions.length * 4);
    const view = new DataView(code.buffer);
    instructions.forEach((instruction, index) => view.setUint32(index * 4, instruction, true));
    return code;
  };
  const protection = bytes([
    0x00000073, addi(5, 10, 0), addi(6, 0, 39), store(6, 5),
    addi(10, 5, 0), addi(11, 20, 0), addi(12, 0, 1), addi(17, 0, 226), 0x00000073,
    load(7, 5), store(6, 5),
  ]);
  const grow = bytes([
    0x00000073, addi(5, 10, 0), addi(6, 0, 39), store(6, 5),
    addi(10, 5, 0), addi(11, 20, 0), addi(12, 22, 0), addi(13, 0, 0), addi(14, 0, 0),
    addi(17, 0, 216), 0x00000073, addi(6, 10, 0), add(21, 5, 20), load(7, 5), load(8, 21),
    addi(10, 5, 0), addi(11, 22, 0), addi(12, 0, 4), addi(17, 0, 227), 0x00000073,
    addi(10, 0, 0), addi(17, 0, 93), 0x00000073,
  ]);
  const move = bytes([
    0x00000073, addi(5, 10, 0), addi(6, 0, 39), store(6, 5), add(21, 5, 20),
    addi(10, 21, 0), addi(11, 20, 0), addi(12, 0, 3), addi(13, 0, 0x32),
    addi(14, 0, -1), addi(17, 0, 222), 0x00000073,
    addi(10, 5, 0), addi(11, 20, 0), addi(12, 22, 0), addi(13, 0, 1), addi(14, 0, 0),
    addi(17, 0, 216), 0x00000073, addi(9, 10, 0), load(7, 9),
    addi(10, 0, 0), addi(17, 0, 93), 0x00000073,
  ]);
  const startup = new Uint8Array(38);
  const startupView = new DataView(startup.buffer);
  startupView.setUint32(0, TETO_STARTUP_MAGIC, true);
  startupView.setUint32(4, 1, true);
  startupView.setUint32(32, 2, true);
  startup.set(enc("/x"), 36);
  const pc = 0x10000n, virtualTop = 1024n * 1024n * 1024n;

  const sourceMemory = directMemory(64 * 1024 * 1024);
  const source: PolicyCore = {
    tetoKernelInit: (_memory, maxHarts, threaded) => tetoKernelInit(sourceMemory, maxHarts, threaded !== 0),
    tetoHartInit: (_memory, hart, top, entry) => tetoHartInit(sourceMemory, hart, top, entry),
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    tetoImageBegin: (_memory, hart, top, entry, phdr, phent, phnum) =>
      tetoImageBegin(sourceMemory, hart, top, entry, phdr, phent, phnum),
    tetoImageSegment: (_memory, hart, nameHash, nameLength, address, size, flags, imageAt, length) =>
      tetoImageSegment(sourceMemory, hart, nameHash, nameLength, address, size, flags, imageAt, length),
    tetoImageFinish: (_memory, hart, size) => tetoImageFinish(sourceMemory, hart, size),
    tetoBuildInitialStack: (_memory, hart, at, size, stackBytes) =>
      tetoBuildInitialStack(sourceMemory, hart, at, size, stackBytes),
    tetoHartSetX: (_memory, hart, register, value) => tetoHartSetX(sourceMemory, hart, register, value),
    tetoHartGetX: (_memory, hart, register) => tetoHartGetX(sourceMemory, hart, register),
    tetoHartStatus: (_memory, hart) => tetoHartStatus(sourceMemory, hart),
    tetoHartMetric: (_memory, hart, offset) => tetoHartMetric(sourceMemory, hart, offset),
    tetoProcessMapCount: (_memory, hart) => tetoProcessMapCount(sourceMemory, hart),
    tetoRunRv64Batch: (_memory, hart, budget, nowMicros, worker) =>
      tetoRunRv64Batch(sourceMemory, hart, budget, nowMicros, worker),
  };
  const wasmBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const generated = await loadTeto(wasmBytes);

  const setup = (core: PolicyCore, memory: Uint8Array, code: Uint8Array): void => {
    eq(core.tetoKernelInit(0, 1, 0), 0);
    eq(core.tetoHartInit(0, 0, virtualTop, pc), 0);
    eq(core.tetoProcessInit(0, 0, 73, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
    const imageAt = core.tetoImageReserve(0, code.length) >>> 0;
    memory.set(code, imageAt);
    eq(core.tetoImageBegin(0, 0, virtualTop, pc, 0n, 0, 0), TETO_THX_OK);
    eq(core.tetoImageSegment(0, 0, 0x1111, 4, pc, BigInt(code.length),
      TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, imageAt, code.length), TETO_THX_OK);
    eq(core.tetoImageFinish(0, 0, code.length), TETO_THX_OK);
    eq(core.tetoImageRelease(0, imageAt, code.length), TETO_THX_OK);
    const startupAt = core.tetoImageReserve(0, startup.length) >>> 0;
    memory.set(startup, startupAt);
    eq(core.tetoBuildInitialStack(0, 0, startupAt, startup.length, 1024 * 1024), TETO_START_OK);
    eq(core.tetoImageRelease(0, startupAt, startup.length), TETO_THX_OK);
  };
  const mmapRegisters = (core: PolicyCore, length: bigint): void => {
    const registers: Array<[number, bigint]> = [
      [10, 0n], [11, length], [12, 3n], [13, 0x22n], [14, -1n], [15, 0n],
      [17, 222n], [20, 4096n], [22, 8192n],
    ];
    for (const [register, value] of registers) eq(core.tetoHartSetX(0, 0, register, value), 0);
  };
  const exercise = (core: PolicyCore, memory: Uint8Array): string => {
    const results: unknown[] = [];

    setup(core, memory, protection);
    mmapRegisters(core, 8192n);
    eq(core.tetoRunRv64Batch(0, 0, 128, 123456n, 0), TETO_BATCH_FAULT);
    eq(core.tetoHartGetX(0, 0, 7), 39n);
    eq(core.tetoProcessMapCount(0, 0), 2);
    eq(core.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
    results.push(["protect", core.tetoHartGetX(0, 0, 7), core.tetoProcessMapCount(0, 0),
      new DataView(memory.buffer).getInt32(TETO_HART_BASE + H_FAULT, true)]);

    setup(core, memory, grow);
    mmapRegisters(core, 4096n);
    eq(core.tetoRunRv64Batch(0, 0, 256, 123456n, 0), TETO_BATCH_EXITED);
    eq(core.tetoHartGetX(0, 0, 6), core.tetoHartGetX(0, 0, 5));
    eq(core.tetoHartGetX(0, 0, 7), 39n);
    eq(core.tetoHartGetX(0, 0, 8), 0n);
    eq(core.tetoProcessMapCount(0, 0), 1);
    eq(core.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
    results.push(["grow", core.tetoHartGetX(0, 0, 5), core.tetoHartGetX(0, 0, 7),
      core.tetoHartGetX(0, 0, 8), core.tetoProcessMapCount(0, 0)]);

    setup(core, memory, move);
    mmapRegisters(core, 4096n);
    eq(core.tetoRunRv64Batch(0, 0, 256, 123456n, 0), TETO_BATCH_EXITED);
    ok(core.tetoHartGetX(0, 0, 9) !== core.tetoHartGetX(0, 0, 5), "MREMAP_MAYMOVE did not relocate a blocked mapping");
    eq(core.tetoHartGetX(0, 0, 7), 39n);
    eq(core.tetoProcessMapCount(0, 0), 2);
    eq(core.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
    results.push(["move", core.tetoHartGetX(0, 0, 5), core.tetoHartGetX(0, 0, 9),
      core.tetoHartGetX(0, 0, 7), core.tetoProcessMapCount(0, 0)]);
    return show(results);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  eq(generatedResult, sourceResult);
});

test("Teto imports and reads a deterministic hard-link-preserving root image", async () => {
  type VfsCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoProcessSetGroup" |
    "tetoImageReserve" | "tetoImageRelease" | "tetoLoadVfs" | "tetoResolvePath" | "tetoAccessInode" |
    "tetoOpenPath" | "tetoReadDescriptor" | "tetoSeekDescriptor" | "tetoCloseDescriptor" |
    "tetoDescriptorKind" | "tetoDescriptorInode" | "tetoDescriptorOffset" |
    "tetoVfsLoaded" | "tetoVfsRoot" | "tetoVfsInodeCount" | "tetoVfsDentryCount" |
    "tetoVfsKind" | "tetoVfsFileSize" | "tetoVfsMode" | "tetoVfsUid" | "tetoVfsGid" |
    "tetoVfsNlink" | "tetoVfsLookup" | "tetoVfsReadData">;
  const stamp = 1_725_000_000_123;
  const contents = enc("NAME=mikuOS\nVERSION_ID=0.3\n");
  const fixture: TreeEnt[] = [
    { p: "/hard-release", k: "f", id: 3, mode: 0o640, uid: 1000, gid: 2000, at: stamp, mt: stamp + 1, ct: stamp + 2, data: contents },
    { p: "/", k: "d", id: 1, mode: 0o755, uid: 0, gid: 0, at: stamp, mt: stamp, ct: stamp },
    { p: "/etc/os-release", k: "f", id: 3, mode: 0o640, uid: 1000, gid: 2000, at: stamp, mt: stamp + 1, ct: stamp + 2, data: contents },
    { p: "/release-link", k: "l", id: 4, mode: 0o777, uid: 1000, gid: 2000, at: stamp, mt: stamp, ct: stamp, to: "etc/os-release" },
    { p: "/etc", k: "d", id: 2, mode: 0o750, uid: 0, gid: 1000, at: stamp, mt: stamp, ct: stamp },
    { p: "/private", k: "d", id: 5, mode: 0o700, uid: 2000, gid: 2000, at: stamp, mt: stamp, ct: stamp },
    { p: "/private/secret", k: "f", id: 6, mode: 0o600, uid: 2000, gid: 2000, at: stamp, mt: stamp, ct: stamp, data: enc("secret") },
    { p: "/group", k: "d", id: 7, mode: 0o710, uid: 0, gid: 3000, at: stamp, mt: stamp, ct: stamp },
    { p: "/group/item", k: "f", id: 8, mode: 0o640, uid: 2000, gid: 3000, at: stamp, mt: stamp, ct: stamp, data: enc("group") },
    { p: "/loop-a", k: "l", id: 9, mode: 0o777, uid: 0, gid: 0, at: stamp, mt: stamp, ct: stamp, to: "loop-b" },
    { p: "/loop-b", k: "l", id: 10, mode: 0o777, uid: 0, gid: 0, at: stamp, mt: stamp, ct: stamp, to: "loop-a" },
    { p: "/absolute-link", k: "l", id: 11, mode: 0o777, uid: 0, gid: 0, at: stamp, mt: stamp, ct: stamp, to: "/etc/os-release" },
  ];
  const image = serializeTetoVfs(fixture);
  eq(show(serializeTetoVfs([...fixture].reverse())), show(image), "Teto VFS serialisation is not deterministic");
  let rejectedDirectoryLink = false;
  try {
    serializeTetoVfs([...fixture, { ...fixture.find(entry => entry.p === "/etc")!, p: "/etc-hard" }]);
  } catch { rejectedDirectoryLink = true; }
  ok(rejectedDirectoryLink, "Teto accepted a hard-linked directory with ambiguous parent traversal");

  const sourceMemory = directMemory(64 * 1024 * 1024);
  const source: VfsCore = {
    tetoKernelInit: (_memory, harts, threaded) => tetoKernelInit(sourceMemory, harts, threaded !== 0),
    tetoHartInit: (_memory, hart, virtualTop, pc) => tetoHartInit(sourceMemory, hart, virtualTop, pc),
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoProcessSetGroup: (_memory, hart, index, gid) => tetoProcessSetGroup(sourceMemory, hart, index, gid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    tetoLoadVfs: (_memory, at, size) => tetoLoadVfs(sourceMemory, at, size),
    tetoResolvePath: (_memory, hart, start, path, length, follow) => tetoResolvePath(sourceMemory, hart, start, path, length, follow !== 0),
    tetoAccessInode: (_memory, hart, inode, bits) => tetoAccessInode(sourceMemory, hart, inode, bits),
    tetoOpenPath: (_memory, hart, start, path, length, flags) => tetoOpenPath(sourceMemory, hart, start, path, length, flags),
    tetoReadDescriptor: (_memory, hart, descriptor, output, length) => tetoReadDescriptor(sourceMemory, hart, descriptor, output, length),
    tetoSeekDescriptor: (_memory, hart, descriptor, offset, whence) => tetoSeekDescriptor(sourceMemory, hart, descriptor, offset, whence),
    tetoCloseDescriptor: (_memory, hart, descriptor) => tetoCloseDescriptor(sourceMemory, hart, descriptor),
    tetoDescriptorKind: (_memory, hart, descriptor) => tetoDescriptorKind(sourceMemory, hart, descriptor),
    tetoDescriptorInode: (_memory, hart, descriptor) => tetoDescriptorInode(sourceMemory, hart, descriptor),
    tetoDescriptorOffset: (_memory, hart, descriptor) => tetoDescriptorOffset(sourceMemory, hart, descriptor),
    tetoVfsLoaded: () => tetoVfsLoaded(sourceMemory) ? 1 : 0,
    tetoVfsRoot: () => tetoVfsRoot(sourceMemory),
    tetoVfsInodeCount: () => tetoVfsInodeCount(sourceMemory),
    tetoVfsDentryCount: () => tetoVfsDentryCount(sourceMemory),
    tetoVfsKind: (_memory, inode) => tetoVfsKind(sourceMemory, inode),
    tetoVfsFileSize: (_memory, inode) => tetoVfsFileSize(sourceMemory, inode),
    tetoVfsMode: (_memory, inode) => tetoVfsMode(sourceMemory, inode),
    tetoVfsUid: (_memory, inode) => tetoVfsUid(sourceMemory, inode),
    tetoVfsGid: (_memory, inode) => tetoVfsGid(sourceMemory, inode),
    tetoVfsNlink: (_memory, inode) => tetoVfsNlink(sourceMemory, inode),
    tetoVfsLookup: (_memory, parent, name, length) => tetoVfsLookup(sourceMemory, parent, name, length),
    tetoVfsReadData: (_memory, inode, offset, output, length) => tetoVfsReadData(sourceMemory, inode, offset, output, length),
  };
  interface HostFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HostFs;
  const generated = await loadTeto(Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url))), {
    initialPages: 1024,
    maximumPages: 32768,
  });

  const exercise = (core: VfsCore, bytes: Uint8Array): string => {
    eq(core.tetoKernelInit(0, 1, 0), 0);
    eq(core.tetoHartInit(0, 0, 0x0000ffffffffffffn, 0n), 0);
    eq(core.tetoProcessInit(0, 0, 80, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
    eq(core.tetoProcessSetGroup(0, 0, 0, 3000), 0);
    const imageAt = core.tetoImageReserve(0, image.length) >>> 0;
    ok(imageAt !== 0xffffffff);
    bytes.set(image, imageAt);
    eq(core.tetoLoadVfs(0, imageAt, image.length), TETO_VFS_OK);
    eq(core.tetoImageRelease(0, imageAt, image.length), 0);

    const corrupt = image.slice();
    corrupt[corrupt.length - 1] = corrupt[corrupt.length - 1]! ^ 1;
    const corruptAt = core.tetoImageReserve(0, corrupt.length) >>> 0;
    bytes.set(corrupt, corruptAt);
    eq(core.tetoLoadVfs(0, corruptAt, corrupt.length), TETO_VFS_CHECKSUM);
    eq(core.tetoImageRelease(0, corruptAt, corrupt.length), 0);

    const scratch = core.tetoImageReserve(0, 512) >>> 0;
    const lookup = (parent: number, name: string): number => {
      const encoded = enc(name);
      bytes.set(encoded, scratch);
      return core.tetoVfsLookup(0, parent, scratch, encoded.length);
    };
    const resolve = (path: string, follow = true, start = core.tetoVfsRoot(0)): number => {
      const encoded = enc(path);
      bytes.set(encoded, scratch);
      return core.tetoResolvePath(0, 0, start, scratch, encoded.length, follow ? 1 : 0);
    };
    const root = core.tetoVfsRoot(0);
    const etc = lookup(root, "etc");
    const release = lookup(etc, "os-release");
    const hard = lookup(root, "hard-release");
    const link = lookup(root, "release-link");
    const read = core.tetoVfsReadData(0, release, 5n, scratch, 8);
    const slice = dec(bytes.slice(scratch, scratch + read));
    const linkRead = core.tetoVfsReadData(0, link, 0n, scratch, 64);
    const target = dec(bytes.slice(scratch, scratch + linkRead));
    const groupItem = resolve("/group/item");
    const open = (path: string, flags = 0, start = 0): number => {
      const encoded = enc(path);
      bytes.set(encoded, scratch);
      return core.tetoOpenPath(0, 0, start, scratch, encoded.length, flags);
    };
    const fileDescriptor = open("/etc/os-release");
    const firstRead = core.tetoReadDescriptor(0, 0, fileDescriptor, scratch, 4);
    const firstBytes = dec(bytes.slice(scratch, scratch + firstRead));
    const setOffset = core.tetoSeekDescriptor(0, 0, fileDescriptor, 5n, 0);
    const middleRead = core.tetoReadDescriptor(0, 0, fileDescriptor, scratch, 8);
    const middleBytes = dec(bytes.slice(scratch, scratch + middleRead));
    const endOffset = core.tetoSeekDescriptor(0, 0, fileDescriptor, -4n, 2);
    const endRead = core.tetoReadDescriptor(0, 0, fileDescriptor, scratch, 16);
    const endBytes = dec(bytes.slice(scratch, scratch + endRead));
    const directoryDescriptor = open("/etc", 0x10000);
    const summary = show([
      core.tetoVfsLoaded(0), root, core.tetoVfsInodeCount(0), core.tetoVfsDentryCount(0),
      core.tetoVfsKind(0, root), core.tetoVfsKind(0, release), core.tetoVfsKind(0, link),
      release, hard, core.tetoVfsFileSize(0, release), core.tetoVfsMode(0, release),
      core.tetoVfsUid(0, release), core.tetoVfsGid(0, release), core.tetoVfsNlink(0, release),
      read, slice, linkRead, target,
      resolve("/etc/os-release"), resolve("/release-link"), resolve("/release-link", false),
      resolve("./os-release", true, etc), resolve("../hard-release", true, etc),
      resolve("/private/secret"), resolve("/etc/os-release/"), resolve("/missing"), groupItem,
      resolve("/absolute-link"), resolve("/loop-a"), resolve(`/${"a".repeat(256)}`), resolve(""),
      core.tetoAccessInode(0, 0, release, 4), core.tetoAccessInode(0, 0, release, 2),
      core.tetoAccessInode(0, 0, release, 1), core.tetoAccessInode(0, 0, groupItem, 4),
      core.tetoAccessInode(0, 0, groupItem, 2), core.tetoAccessInode(0, 0, 5, 1),
      fileDescriptor, core.tetoDescriptorKind(0, 0, fileDescriptor), core.tetoDescriptorInode(0, 0, fileDescriptor),
      firstRead, firstBytes, setOffset, middleRead, middleBytes, endOffset, endRead, endBytes,
      core.tetoDescriptorOffset(0, 0, fileDescriptor), directoryDescriptor,
      core.tetoDescriptorKind(0, 0, directoryDescriptor), core.tetoDescriptorInode(0, 0, directoryDescriptor),
      core.tetoReadDescriptor(0, 0, directoryDescriptor, scratch, 4), open("/private/secret"),
      open("/etc/os-release", 1), open("/etc/os-release", 0x10000),
      core.tetoCloseDescriptor(0, 0, fileDescriptor), core.tetoDescriptorKind(0, 0, fileDescriptor),
      core.tetoCloseDescriptor(0, 0, fileDescriptor), open("/release-link"),
    ]);
    eq(core.tetoImageRelease(0, scratch, 512), 0);
    return summary;
  };
  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  eq(generatedResult, sourceResult);
  eq(sourceResult, show([1, 1, 11, 11, TETO_VFS_KIND_DIRECTORY, TETO_VFS_KIND_FILE, TETO_VFS_KIND_LINK,
    3, 3, BigInt(contents.length), 0o640, 1000, 2000, 2, 8, "mikuOS\nV", 14, "etc/os-release",
    3, 3, 4, 3, 3, -13, -20, -2, 8, 3, -40, -36, -2, 1, 1, 0, 1, 0, 0,
    3, TETO_FD_FILE, 3, 4, "NAME", 5n, 8, "mikuOS\nV", BigInt(contents.length - 4), 4, "0.3\n",
    BigInt(contents.length), 4, TETO_FD_DIRECTORY, 2, -21, -13, -30, -20, 0, TETO_FD_EMPTY, -9, 3]));
});

test("Teto parses and maps raw THX inside source and generated kernels", async () => {
  type ImageCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoImageReserve" |
    "tetoImageRelease" | "tetoLoadThx" | "tetoProcessSegmentCount" |
    "tetoHartVirtualTop" | "tetoHartPc" | "tetoHartImageFloor" |
    "tetoHartMetric" | "tetoGuestPage">;
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const image = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.thx", import.meta.url)));
  const sourceMemory = directMemory(64 * 1024 * 1024);
  const source: ImageCore = {
    tetoKernelInit: (_memory, maxHarts, threaded) => tetoKernelInit(sourceMemory, maxHarts, threaded !== 0),
    tetoHartInit: (_memory, hart, virtualTop, pc) => tetoHartInit(sourceMemory, hart, virtualTop, pc),
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    tetoLoadThx: (_memory, hart, at, size) => tetoLoadThx(sourceMemory, hart, at, size),
    tetoProcessSegmentCount: (_memory, hart) => tetoProcessSegmentCount(sourceMemory, hart),
    tetoHartVirtualTop: (_memory, hart) => tetoHartVirtualTop(sourceMemory, hart),
    tetoHartPc: (_memory, hart) => tetoHartPc(sourceMemory, hart),
    tetoHartImageFloor: (_memory, hart) => tetoHartImageFloor(sourceMemory, hart),
    tetoHartMetric: (_memory, hart, offset) => tetoHartMetric(sourceMemory, hart, offset),
    tetoGuestPage: (_memory, hart, address, create) => tetoGuestPage(sourceMemory, hart, address, create !== 0),
  };
  const wasmBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const generated = await loadTeto(wasmBytes);

  const exercise = (core: ImageCore, bytes: Uint8Array): string => {
    eq(core.tetoKernelInit(0, 1, 0), 0);
    eq(core.tetoHartInit(0, 0, 0x0000ffffffffffffn, 0n), 0);
    eq(core.tetoProcessInit(0, 0, 80, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
    const imageAt = core.tetoImageReserve(0, image.length) >>> 0;
    ok(imageAt < 0xfffffffe && imageAt + image.length <= bytes.length);
    bytes.set(image, imageAt);
    eq(core.tetoLoadThx(0, 0, imageAt, image.length), TETO_THX_OK);
    eq(core.tetoImageRelease(0, imageAt, image.length), TETO_THX_OK);
    eq(core.tetoProcessSegmentCount(0, 0), 2);
    eq(core.tetoHartVirtualTop(0, 0), 1024n * 1024n * 1024n);
    eq(core.tetoHartPc(0, 0), 0x10000n);
    const floor = core.tetoHartImageFloor(0, 0);
    ok(floor > 0x20000n);
    const codeFrame = core.tetoGuestPage(0, 0, 0x10000n, 0) >>> 0;
    const dataFrame = core.tetoGuestPage(0, 0, 0x20000n, 0) >>> 0;
    ok(codeFrame < 0xfffffffe && dataFrame < 0xfffffffe);
    const instruction = new DataView(bytes.buffer).getUint32(codeFrame, true);
    const message = dec(bytes.slice(dataFrame, dataFrame + "hello from Teto RV64GC\n".length));
    eq(message, "hello from Teto RV64GC\n");
    eq(core.tetoHartMetric(0, 0, H_IMAGE_LOADS), 1n);
    eq(core.tetoHartMetric(0, 0, H_IMAGE_BYTES), BigInt(image.length));

    const corrupt = image.slice();
    corrupt[corrupt.length - 1] = corrupt[corrupt.length - 1]! ^ 1;
    const badAt = core.tetoImageReserve(0, corrupt.length) >>> 0;
    ok(badAt < 0xfffffffe && badAt + corrupt.length <= bytes.length);
    bytes.set(corrupt, badAt);
    eq(core.tetoLoadThx(0, 0, badAt, corrupt.length), TETO_THX_CHECKSUM);
    eq(core.tetoImageRelease(0, badAt, corrupt.length), TETO_THX_OK);
    eq(core.tetoHartMetric(0, 0, H_IMAGE_LOADS), 1n);
    return show([core.tetoProcessSegmentCount(0, 0), core.tetoHartVirtualTop(0, 0),
      core.tetoHartPc(0, 0), floor, instruction, message,
      core.tetoHartMetric(0, 0, H_IMAGE_BYTES)]);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  eq(generatedResult, sourceResult);
});

test("Teto builds the initial RV64 process stack inside source and generated kernels", async () => {
  type StartupCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoImageReserve" |
    "tetoImageRelease" | "tetoLoadThx" | "tetoBuildInitialStack" |
    "tetoHartStackBottom" | "tetoHartStackPointer" | "tetoHartGetX" |
    "tetoHartMetric" | "tetoGuestPage">;
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const image = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.thx", import.meta.url)));
  const values = ["HOME=/home/guest", "USER=guest", "/tmp/hello-rv64.39", "alpha"].map(enc);
  const startupLength = 32 + values.reduce((total, value) => total + 4 + value.length, 0);
  const startup = new Uint8Array(startupLength);
  const startupView = new DataView(startup.buffer);
  startupView.setUint32(0, 0x31545354, true);
  startupView.setUint32(4, 2, true);
  startupView.setUint32(8, 2, true);
  for (let index = 0; index < 16; index++) startup[16 + index] = index;
  let startupAt = 32;
  for (const value of values) {
    startupView.setUint32(startupAt, value.length, true);
    startupAt += 4;
    startup.set(value, startupAt);
    startupAt += value.length;
  }

  const sourceMemory = directMemory(64 * 1024 * 1024);
  const source: StartupCore = {
    tetoKernelInit: (_memory, maxHarts, threaded) => tetoKernelInit(sourceMemory, maxHarts, threaded !== 0),
    tetoHartInit: (_memory, hart, virtualTop, pc) => tetoHartInit(sourceMemory, hart, virtualTop, pc),
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    tetoLoadThx: (_memory, hart, at, size) => tetoLoadThx(sourceMemory, hart, at, size),
    tetoBuildInitialStack: (_memory, hart, at, size, stackBytes) => tetoBuildInitialStack(sourceMemory, hart, at, size, stackBytes),
    tetoHartStackBottom: (_memory, hart) => tetoHartStackBottom(sourceMemory, hart),
    tetoHartStackPointer: (_memory, hart) => tetoHartStackPointer(sourceMemory, hart),
    tetoHartGetX: (_memory, hart, register) => tetoHartGetX(sourceMemory, hart, register),
    tetoHartMetric: (_memory, hart, offset) => tetoHartMetric(sourceMemory, hart, offset),
    tetoGuestPage: (_memory, hart, address, create) => tetoGuestPage(sourceMemory, hart, address, create !== 0),
  };
  const wasmBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const generated = await loadTeto(wasmBytes);

  const exercise = (core: StartupCore, bytes: Uint8Array): string => {
    eq(core.tetoKernelInit(0, 1, 0), 0);
    eq(core.tetoHartInit(0, 0, 0x0000ffffffffffffn, 0n), 0);
    eq(core.tetoProcessInit(0, 0, 81, 1, 1000, 0, 0, 1000, 0, 0), 0);
    const imageAt = core.tetoImageReserve(0, image.length) >>> 0;
    bytes.set(image, imageAt);
    eq(core.tetoLoadThx(0, 0, imageAt, image.length), TETO_THX_OK);
    eq(core.tetoImageRelease(0, imageAt, image.length), TETO_THX_OK);
    const blockAt = core.tetoImageReserve(0, startup.length) >>> 0;
    bytes.set(startup, blockAt);
    eq(core.tetoBuildInitialStack(0, 0, blockAt, startup.length, 2 * 1024 * 1024), TETO_START_OK);
    eq(core.tetoImageRelease(0, blockAt, startup.length), TETO_THX_OK);

    const sp = core.tetoHartStackPointer(0, 0);
    eq(core.tetoHartStackBottom(0, 0), 1024n * 1024n * 1024n - 2n * 1024n * 1024n);
    eq(core.tetoHartGetX(0, 0, 2), sp);
    const guestByte = (address: bigint): number => {
      const frame = core.tetoGuestPage(0, 0, address, 0) >>> 0;
      ok(frame < 0xfffffffe, `unmapped startup byte at 0x${address.toString(16)}`);
      return bytes[frame + Number(address & 0xffffn)]!;
    };
    const guestWord = (address: bigint): bigint => {
      let value = 0n;
      for (let index = 7; index >= 0; index--) value = value << 8n | BigInt(guestByte(address + BigInt(index)));
      return value;
    };
    const guestString = (address: bigint): string => {
      const output: number[] = [];
      for (let index = 0; index < 4096; index++) {
        const value = guestByte(address + BigInt(index));
        if (value === 0) return dec(Uint8Array.from(output));
        output.push(value);
      }
      throw new Error("unterminated Teto startup string");
    };
    eq(guestWord(sp), 2n);
    const argv0 = guestWord(sp + 8n), argv1 = guestWord(sp + 16n);
    eq(guestString(argv0), "/tmp/hello-rv64.39");
    eq(guestString(argv1), "alpha");
    eq(guestWord(sp + 24n), 0n);
    const env0 = guestWord(sp + 32n), env1 = guestWord(sp + 40n);
    eq(guestString(env0), "HOME=/home/guest");
    eq(guestString(env1), "USER=guest");
    eq(guestWord(sp + 48n), 0n);
    const aux = sp + 56n;
    let random = 0n;
    let summary = "";
    for (let index = 0; index < 15; index++) {
      const key = guestWord(aux + BigInt(index * 16));
      const value = guestWord(aux + BigInt(index * 16 + 8));
      if (key === 9n) eq(value, 0x10000n);
      if (key === 11n) eq(value, 1000n);
      if (key === 12n) eq(value, 0n);
      if (key === 13n) eq(value, 1000n);
      if (key === 14n) eq(value, 0n);
      if (key === 23n) eq(value, 1n);
      if (key === 25n) random = value;
      if (key === 31n) eq(value, argv0);
      summary += `${key}:${value};`;
    }
    ok(random !== 0n);
    for (let index = 0; index < 16; index++) eq(guestByte(random + BigInt(index)), index);
    eq(core.tetoHartMetric(0, 0, H_STARTUP_LOADS), 1n);

    const malformed = startup.slice();
    malformed[0] = 0;
    const malformedAt = core.tetoImageReserve(0, malformed.length) >>> 0;
    bytes.set(malformed, malformedAt);
    eq(core.tetoBuildInitialStack(0, 0, malformedAt, malformed.length, 2 * 1024 * 1024), TETO_START_FORMAT);
    eq(core.tetoImageRelease(0, malformedAt, malformed.length), TETO_THX_OK);
    eq(core.tetoHartMetric(0, 0, H_STARTUP_LOADS), 1n);
    return show([sp, argv0, argv1, env0, env1, summary]);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  eq(generatedResult, sourceResult);
});

test("Teto credential syscalls preserve source and WebAssembly transaction parity", async () => {
  type CredentialCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoGuestPage" |
    "tetoHartSetX" | "tetoHartGetX" | "tetoHartSetPc" | "tetoRunRv64Batch" |
    "tetoImageReserve" | "tetoImageRelease" | "tetoImageBegin" |
    "tetoImageSegment" | "tetoImageFinish">;
  const sourceMemory = directMemory(64 * 1024 * 1024);
  const source: CredentialCore = {
    tetoKernelInit: (_memory, maxHarts, threaded) => tetoKernelInit(sourceMemory, maxHarts, threaded !== 0),
    tetoHartInit: (_memory, hart, virtualTop, pc) => tetoHartInit(sourceMemory, hart, virtualTop, pc),
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    tetoImageBegin: (_memory, hart, virtualTop, entry, phdr, phent, phnum) =>
      tetoImageBegin(sourceMemory, hart, virtualTop, entry, phdr, phent, phnum),
    tetoImageSegment: (_memory, hart, nameHash, nameLength, address, size, flags, at, length) =>
      tetoImageSegment(sourceMemory, hart, nameHash, nameLength, address, size, flags, at, length),
    tetoImageFinish: (_memory, hart, size) => tetoImageFinish(sourceMemory, hart, size),
    tetoGuestPage: (_memory, hart, address, create) => tetoGuestPage(sourceMemory, hart, address, create !== 0),
    tetoHartSetX: (_memory, hart, register, value) => tetoHartSetX(sourceMemory, hart, register, value),
    tetoHartGetX: (_memory, hart, register) => tetoHartGetX(sourceMemory, hart, register),
    tetoHartSetPc: (_memory, hart, pc) => tetoHartSetPc(sourceMemory, hart, pc),
    tetoRunRv64Batch: (_memory, hart, budget, nowMicros, worker) =>
      tetoRunRv64Batch(sourceMemory, hart, budget, nowMicros, worker),
  };

  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const wasmBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const generated = await loadTeto(wasmBytes);

  const exercise = (core: CredentialCore, bytes: Uint8Array): string => {
    const virtualTop = 1n << 40n, pc = 0x10000n, data = 0x20000n;
    eq(core.tetoKernelInit(0, 1, 0), 0);
    eq(core.tetoHartInit(0, 0, virtualTop, pc), 0);
    eq(core.tetoProcessInit(0, 0, 70, 1, 1000, 0, 0, 1000, 0, 0), 0);
    const ecall = new Uint8Array([0x73, 0, 0, 0]);
    const imageAt = core.tetoImageReserve(0, ecall.length) >>> 0;
    bytes.set(ecall, imageAt);
    eq(core.tetoImageBegin(0, 0, virtualTop, pc, 0n, 0, 0), TETO_THX_OK);
    eq(core.tetoImageSegment(0, 0, 0x1111, 4, pc, 4n, TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE,
      imageAt, ecall.length), TETO_THX_OK);
    eq(core.tetoImageSegment(0, 0, 0x2222, 4, data, 65536n, TETO_SEGMENT_READ | TETO_SEGMENT_WRITE,
      imageAt, 0), TETO_THX_OK);
    eq(core.tetoImageFinish(0, 0, ecall.length), TETO_THX_OK);
    eq(core.tetoImageRelease(0, imageAt, ecall.length), TETO_THX_OK);
    const codeFrame = core.tetoGuestPage(0, 0, pc, 0) >>> 0;
    const dataFrame = core.tetoGuestPage(0, 0, data, 1);
    ok(codeFrame < 0xfffffffe && dataFrame < 0xfffffffe);
    const view = new DataView(bytes.buffer);
    const at = (address: bigint): number => dataFrame + Number(address - data);
    const call = (number: number, args: readonly bigint[] = []): bigint => {
      eq(core.tetoHartSetPc(0, 0, pc), 0);
      eq(core.tetoHartSetX(0, 0, 17, BigInt(number)), 0);
      for (let register = 10; register <= 15; register++) {
        eq(core.tetoHartSetX(0, 0, register, args[register - 10] ?? 0n), 0);
      }
      eq(core.tetoRunRv64Batch(0, 0, 1, 123456n, 0), TETO_BATCH_BUDGET);
      return core.tetoHartGetX(0, 0, 10);
    };
    const result: Array<bigint | number> = [];
    result.push(call(174), call(175));
    result.push(call(147, [0xffffffffn, 1000n, 0xffffffffn]), call(175));
    result.push(call(147, [0xffffffffn, 2000n, 0xffffffffn]), call(175));
    result.push(call(147, [-1n, 0n, -1n]), call(175));

    view.setUint32(at(data), 0x12345678, true);
    result.push(call(148, [data, 0n, data + 8n]), view.getUint32(at(data), true));
    result.push(call(148, [data, data + 4n, data + 8n]));
    result.push(view.getUint32(at(data), true), view.getUint32(at(data + 4n), true), view.getUint32(at(data + 8n), true));

    view.setUint32(at(data + 0x20n), 7, true);
    view.setUint32(at(data + 0x24n), 8, true);
    result.push(call(159, [2n, data + 0x20n]), call(158, [0n, 0n]));
    result.push(call(158, [2n, data + 0x40n]));
    result.push(view.getUint32(at(data + 0x40n), true), view.getUint32(at(data + 0x44n), true));

    /*
     * musl initgroups() may include the primary group twice when the
     * account is also explicitly listed in that group's member field.
     * Linux setgroups() accepts the list as supplied.
     */
    view.setUint32(at(data + 0x60n), 1000, true);
    view.setUint32(at(data + 0x64n), 1000, true);
    view.setUint32(at(data + 0x68n), 1003, true);
    result.push(call(159, [3n, data + 0x60n]), call(158, [0n, 0n]));
    result.push(call(158, [3n, data + 0x80n]));
    result.push(
      view.getUint32(at(data + 0x80n), true),
      view.getUint32(at(data + 0x84n), true),
      view.getUint32(at(data + 0x88n), true),
    );

    result.push(call(147, [-1n, 1000n, -1n]));
    result.push(call(159, [0n, 0n]), call(158, [0n, 0n]));
    return show(result);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  eq(generatedResult, sourceResult);
});

test("byte-identical RV64GC THX and .39 execute through direct and source cores", async () => {
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const thxBytes = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.thx", import.meta.url)));
  const aliasBytes = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.39", import.meta.url)));
  eq(show(aliasBytes), show(thxBytes));
  const exe = codec.unpack(thxBytes);
  ok(exe instanceof Exe && exe.machine === "thistle64" && exe.isa === "rv64gc");

  const direct = new Rig();
  const directPath = direct.os.load("hello-rv64.thx", thxBytes);
  const expected = await direct.run(directPath);
  eq(`${expected.code}:${expected.out}:${expected.err}`, "0:hello from Teto RV64GC\n:");

  const source = new Rig();
  source.os.s.setenv("THISTLE_RV_CORE", "teto-source");
  source.os.s.setenv("THISTLE_TETO_STRICT", "1");
  const sourceThx = source.os.load("hello-rv64.thx", thxBytes);
  const sourceAlias = source.os.load("hello-rv64.39", aliasBytes);
  const thx = await source.run(sourceThx);
  const alias = await source.run(sourceAlias);
  eq(`${thx.code}:${thx.out}:${thx.err}`, `${expected.code}:${expected.out}:${expected.err}`);
  eq(`${alias.code}:${alias.out}:${alias.err}`, `${expected.code}:${expected.out}:${expected.err}`);
});

test("byte-identical RV64GC THX and .39 execute inside generated WebAssembly", async () => {
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const wasm = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const thxBytes = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.thx", import.meta.url)));
  const aliasBytes = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.39", import.meta.url)));
  const provider: TetoImageProvider = {
    load: async variant => {
      eq(variant, "baseline");
      return wasm;
    },
  };
  const generated = new Rig(undefined, false, provider);
  generated.os.s.setenv("THISTLE_RV_CORE", "teto-wasm-core");
  generated.os.s.setenv("THISTLE_TETO_STRICT", "1");
  const thxPath = generated.os.load("hello-rv64.thx", thxBytes);
  const aliasPath = generated.os.load("hello-rv64.39", aliasBytes);
  const thx = await generated.run(thxPath);
  const alias = await generated.run(aliasPath);
  eq(`${thx.code}:${thx.out}:${thx.err}`, "0:hello from Teto RV64GC\n:");
  eq(`${alias.code}:${alias.out}:${alias.err}`, `${thx.code}:${thx.out}:${thx.err}`);
});

test("mikuOS boot mode selects generated Teto without manual guest environment overrides", async () => {
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const wasm = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const image = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.39", import.meta.url)));
  const provider: TetoImageProvider = { load: async () => wasm };
  const rig = new Rig(undefined, false, provider, "teto");
  await rig.os.ready;
  eq(rig.os.activeKernelMode, "teto");
  eq(rig.os.s.env("MIKUOS_KERNEL_MODE"), "teto");
  eq(rig.os.s.env("THISTLE_RV_CORE"), "teto-wasm-core");
  eq(rig.os.k.name, "Teto");
  const uname = await rig.run("uname -s");
  eq(uname.out, "Teto\n");
  ok(rig.os.s.read("/proc/version").startsWith("Teto version "));
  const path = rig.os.load("hello-rv64.39", image);
  const result = await rig.run(path);
  eq(`${result.code}:${result.out}:${result.err}`, "0:hello from Teto RV64GC\n:");
});

test("mikuOS auto mode falls back cleanly when Teto validation fails", async () => {
  const provider: TetoImageProvider = { load: async () => new Uint8Array([0, 1, 2, 3]) };
  const rig = new Rig(undefined, false, provider, "auto");
  await rig.os.ready;
  eq(rig.os.activeKernelMode, "thistle");
  eq(rig.os.s.env("MIKUOS_KERNEL_MODE"), "thistle");
  eq(rig.os.s.env("THISTLE_RV_CORE"), undefined);
});

test("configuration separates kernel and OS identity with legacy compatibility", () => {
  eq(IDENTITY.os.name, "mikuOS");
  eq(IDENTITY.os.prettyName, "初音ミクOS v｡三");
  eq(IDENTITY.os.expansion, "MIKU Is Not the Kernel; it's Userspace.");
  eq(IDENTITY.thistle.expansion, "Thistle Hosted Interactive Shell-based TypeScript Live Environment.");
  eq(IDENTITY.teto.expansion, "Teto Executes Thistle Optimally.");
  eq(IDENTITY.guest.architecture, "Thistle64 RV64GC");
  eq(IDENTITY.guest.executable, "THX");
  eq(DEFAULT_CONFIG.kernel.name, "Thistle");
  eq(DEFAULT_CONFIG.kernel.version, "2.1.0");
  eq(DEFAULT_CONFIG.os.name, "mikuOS");
  eq(DEFAULT_CONFIG.os.version, "0.3");

  const modern = mergeConfig({
    kernel: { version: "2.1-test" },
    os: { name: "mikuOS test", version: "0.3-test" },
  });
  eq(modern.kernel.name, "Thistle");
  eq(modern.kernel.version, "2.1-test");
  eq(modern.os.name, "mikuOS test");
  eq(modern.os.version, "0.3-test");

  const legacy = mergeConfig({
    os: {
      name: "Legacy Kernel",
      prettyName: "Legacy kernel display",
      id: "legacy-kernel",
      version: "1.9.4",
      release: "1.9.4-legacy",
      machine: "Legacy64",
      homeUrl: "https://legacy.example",
    },
    distro: {
      name: "Legacy OS",
      prettyName: "Legacy OS display",
      id: "legacy-os",
    },
  });
  eq(legacy.kernel.name, "Legacy Kernel");
  eq(legacy.kernel.version, "1.9.4");
  eq(legacy.kernel.machine, "Legacy64");
  eq(legacy.os.name, "Legacy OS");
  eq(legacy.os.version, "0.3");
  eq(legacy.os.homeUrl, "https://legacy.example");
  ok(!("distro" in legacy), "legacy distro identity leaked into the normalised model");
});

test("local session policy selects direct, prompted and named login safely", () => {
  const direct = localSessionPlan(DEFAULT_CONFIG);
  eq(direct.kind, "direct");
  eq(direct.account.name, "root");
  eq(direct.command, undefined);

  const promptConfig = mergeConfig({ sessions: { local: { mode: "login" } } });
  const prompt = localSessionPlan(promptConfig);
  eq(prompt.kind, "login");
  eq(prompt.account.cred.uid, 0);
  eq(prompt.command, "/bin/login");

  const selected = localSessionPlan(mergeConfig({
    sessions: { local: { mode: "login", account: "alice" } },
  }));
  eq(selected.command, "/bin/login alice");

  const unsafe = localSessionPlan(mergeConfig({
    sessions: { local: { mode: "login", account: "root; reboot" } },
  }));
  eq(unsafe.command, "/bin/login", "unsafe selected account reached the shell command");

  let rejected = false;
  try {
    localSessionPlan(mergeConfig({
      accounts: { cli: { cred: { uid: 1000 } } },
      sessions: { local: { mode: "login" } },
    }));
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("UID 0");
  }
  ok(rejected, "login mode accepted a non-root supervisor account");
});

test("supervised session commands do not enter root shell history", async () => {
  const r = new Rig();
  const before = r.os.sh.hist.join("\n");
  const result = await r.os.run("echo supervised", [], false);
  eq(result, 0);
  eq(r.os.sh.hist.join("\n"), before);
});

test("local login supervision restarts sessions and stops on a missing binary", async () => {
  const plan = localSessionPlan(mergeConfig({
    sessions: { local: { mode: "login", account: "alice" } },
  }));
  const results = [1, 0, 127];
  const commands: string[] = [];
  let unavailable = 0;

  await superviseLocalLogin(plan, {
    live: () => results.length > 0,
    run: async command => {
      commands.push(command);
      return results.shift()!;
    },
    unavailable: () => { unavailable++; },
  });

  eq(commands.join("\n"), "/bin/login alice\n/bin/login alice\n/bin/login alice");
  eq(unavailable, 1);
});

test("canonical mikuOS release metadata stays aligned", async () => {
  interface HFs { readFile(path: URL, encoding: "utf8"): Promise<string>; }
  const mod = (name: string): Promise<unknown> => import(name);
  const fs = await mod("node:fs/promises") as HFs;
  const root = new URL("../../", import.meta.url);
  const [packageText, configText, manifest, page, ignore, mikuosEntry, thistleEntry] = await Promise.all([
    fs.readFile(new URL("package.json", root), "utf8"),
    fs.readFile(new URL("mikuos.config.json", root), "utf8"),
    fs.readFile(new URL("mikuos.yaml", root), "utf8"),
    fs.readFile(new URL("index.html", root), "utf8"),
    fs.readFile(new URL(".gitignore", root), "utf8"),
    fs.readFile(new URL("mikuos.ts", root), "utf8"),
    fs.readFile(new URL("thistle.ts", root), "utf8"),
  ]);
  const pkg = JSON.parse(packageText) as { name?: string; version?: string; scripts?: Record<string, string> };
  const fileConfig = JSON.parse(configText) as { os?: { version?: string }; kernel?: { version?: string } };
  const loaded = await hostConfig(new URL("mikuos.config.json", root));

  eq(pkg.name, "mikuos");
  eq(pkg.version, "0.3.0");
  eq(pkg.scripts?.["test:toolchain"], "bun run thistlecc/test/test.ts");
  ok(pkg.scripts?.["test:guest-toolchain"]?.includes("build/test/toolchain.js"));
  eq(fileConfig.os?.version, "0.3");
  eq(fileConfig.kernel?.version, "2.1.0");
  eq(loaded.os.prettyName, "初音ミクOS v｡三");
  eq(loaded.kernel.machine, "Thistle64 RV64GC");
  eq(sourceReleaseName(), "mikuos-0.3.0-thistle-2.1.0-source.tar.gz");
  ok(manifest.includes("name: mikuOS"));
  ok(manifest.includes("release: 0.3.0"));
  ok(manifest.includes("release: 2.1.0"));
  ok(manifest.includes("build_policy: host-only-thistlecc"));
  ok(page.includes("<title>初音ミクOS v｡三</title>"));
  ok(!ignore.split(/\r?\n/).includes("ports/"), "native source tree is broadly ignored");
  ok(ignore.includes("ports/**/*.o"), "reproducible native objects are not ignored");
  ok(mikuosEntry.includes('import "./src/main/cli.ts"'));
  ok(thistleEntry.includes('import "./src/main/cli.ts"'));
});

test("classic thistle.js boots the complete static Teto guest without a runtime server", async () => {
  interface HFs {
    readFile(path: URL, encoding: "utf8"): Promise<string>;
    readFile(path: URL): Promise<Uint8Array>;
  }
  interface HProc { getBuiltinModule(name: string): { promises: HFs }; }
  interface FakeAddon { activate?(terminal: FakeTerminal): void; }
  interface StaticHandle {
    persistent: boolean;
    session: WebSession;
    dispose(): void;
  }
  interface StaticApi {
    launchThistle(options?: {
      terminal?: object;
      config?: typeof DEFAULT_CONFIG;
      persistence?: boolean;
      kernel?: KernelMode;
      tetoBase?: string | URL;
      rootBase?: string | URL;
    }): Promise<StaticHandle & { kernel: "thistle" | "teto" }>;
  }

  class FakeTerminal {
    rows = 24;
    cols = 80;
    loadAddon(addon: FakeAddon): void { addon.activate?.(this); }
    open(): void {}
    focus(): void {}
    write(text: string): void { output += text; }
    onData(_listener: (value: string) => void): { dispose(): void } { return { dispose: () => {} }; }
    onResize(_listener: (size: { rows: number; cols: number }) => void): { dispose(): void } { return { dispose: () => {} }; }
    dispose(): void {}
  }

  class FakeFit { activate(_terminal: FakeTerminal): void {} fit(): void {} dispose(): void {} }
  class FakeObserver { observe(): void {} disconnect(): void {} }

  const fs = (globalThis as unknown as { process: HProc }).process.getBuiltinModule("fs").promises;
  const root = new URL("../../", import.meta.url);
  const [source, page, xterm, fit, css, manifest, core, tetoBytes, rv64Bytes] = await Promise.all([
    fs.readFile(new URL("dist/web/thistle.js", root), "utf8"),
    fs.readFile(new URL("dist/web/index.html", root), "utf8"),
    fs.readFile(new URL("dist/web/vendor/xterm.js", root), "utf8"),
    fs.readFile(new URL("dist/web/vendor/xterm-fit.js", root), "utf8"),
    fs.readFile(new URL("dist/web/vendor/xterm.css", root), "utf8"),
    fs.readFile(new URL("dist/web/root/manifest.json", root)),
    fs.readFile(new URL("dist/web/root/core.gz", root)),
    fs.readFile(new URL("dist/web/teto/teto.wasm", root)),
    fs.readFile(new URL("dist/web/assets/hello-rv64.39", root)),
  ]);
  const forbidden: Array<[RegExp, string]> = [
    [/\bWebSocket\b/, "WebSocket"],
    [/__thistle\//, "runtime-service route"],
    [/["']node:/, "Node module"],
    [/\bBun\b/, "Bun global"],
    [/\bglobalThis\.process\b/, "Node process global"],
    [/\brequire\s*\(/, "CommonJS require"],
    [/^\s*import\s/m, "static import"],
    [/\bimport\s*\(/, "dynamic import"],
  ];

  ok(page.includes('<script defer src="./vendor/xterm.js"></script>'));
  ok(page.includes('<script defer src="./vendor/xterm-fit.js"></script>'));
  ok(page.includes('<script defer src="./thistle.js"></script>'));
  ok(!page.includes('type="module"'), "static page retained a module graph");
  ok(xterm.includes("Terminal"), "static xterm.js asset is invalid");
  ok(fit.includes("FitAddon"), "static fit-addon asset is invalid");
  ok(css.includes(".xterm"), "static xterm stylesheet is invalid");
  ok(source.includes("var Thistle ="));
  ok(source.includes("launchThistle"));
  for (const [pattern, label] of forbidden) ok(!pattern.test(source), `thistle.js contains forbidden ${label}`);

  let output = "";
  const node = {};
  const originalFetch = globalThis.fetch;
  const globals = globalThis as unknown as {
    document?: unknown;
    window?: unknown;
    Terminal?: unknown;
    FitAddon?: unknown;
    ResizeObserver?: unknown;
    fetch?: unknown;
  };
  globals.document = {
    title: "",
    documentElement: { lang: "", dataset: {} },
    baseURI: "https://static.example/mikuos/",
    readyState: "loading",
    querySelector: () => node,
  };
  globals.window = { addEventListener: () => {}, removeEventListener: () => {} };
  globals.Terminal = FakeTerminal;
  globals.FitAddon = { FitAddon: FakeFit };
  globals.ResizeObserver = FakeObserver;
  globals.fetch = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/root/manifest.json")) return new Response(Uint8Array.from(manifest).buffer, { status: 200 });
    if (url.endsWith("/root/core.gz")) return new Response(Uint8Array.from(core).buffer, { status: 200 });
    if (url.endsWith("/teto/teto.wasm")) return new Response(Uint8Array.from(tetoBytes).buffer, { status: 200 });
    if (url.endsWith("/assets/hello-rv64.39")) return new Response(Uint8Array.from(rv64Bytes).buffer, { status: 200 });
    return new Response("not found", { status: 404 });
  };

  try {
    const api = Function(`${source}\nreturn Thistle;`)() as StaticApi;
    const handle = await api.launchThistle({ terminal: node, persistence: false });
    ok(!handle.persistent);
    eq(handle.kernel, "teto");
    eq(handle.session.os.activeKernelMode, "teto");
    eq(handle.session.os.s.uid, 1000);
    eq(handle.session.os.k.setId, true);
    ok(handle.session.os.k.mounts()[0]!.opt.includes("suid"));
    eq(handle.session.os.s.stat("/usr/bin/sudo").mode, 0o4755);
    ok(handle.session.os.s.stat("/usr/bin/gcc").size > 0, "static browser root omitted the GCC launcher");
    ok(handle.session.os.s.stat("/usr/libexec/thistle/gcc").size > 1024 * 1024, "static browser root omitted the real compiler");
    ok(handle.session.os.k.fs.used() < 96 * 1024 * 1024, "static browser root eagerly expanded the compiler toolchain");

    output = "";
    handle.session.key("whoami\r");
    await handle.session.idle();
    ok(output.includes("guest\n"));

    output = "";
    const rv64Path = handle.session.os.load(
      "hello-rv64.39",
      Uint8Array.from(rv64Bytes),
    );
    eq(await handle.session.os.run(rv64Path), 0);
    ok(output.includes("hello from Teto RV64GC\n"), "static browser did not execute the generated Teto module");
    handle.dispose();
  } finally {
    delete globals.document;
    delete globals.window;
    delete globals.Terminal;
    delete globals.FitAddon;
    delete globals.ResizeObserver;
    globals.fetch = originalFetch;
  }
});

test("exec replaces the current image without replacing the process", async () => {
  const r = new Rig();

  r.os.k.install(new FnApp(
    "exec-target",
    "exec replacement target",
    "exec-target",
    async (s, a) => {
      await s.out([
        s.pid,
        s.ruid,
        s.euid,
        s.rgid,
        s.egid,
        s.cwd,
        s.env("EXEC_MARK"),
        a.join(","),
        s.p.fds.has(3),
        s.p.fds.has(4),
      ].join(":") + "\n");

      return 0;
    },
  ));

  r.os.k.install(new FnApp(
    "exec-source",
    "exec replacement source",
    "exec-source",
    async s => {
      const kept = s.open("/tmp/exec-kept", "w");
      const closed = s.open("/tmp/exec-closed", "w");

      eq(kept, 3);
      eq(closed, 4);

      s.p.fds.get(closed)!.clo = true;
      s.cd("/tmp");
      s.setGroups([1000, 1000, 1003]);
      s.setResgid(1000, 1000, 1000);
      s.setResuid(1000, 1000, 1000);

      const env = new Map(s.env() as Map<string, string>);
      env.set("EXEC_MARK", "present");

      await s.exec(
        "/bin/exec-target",
        ["exec-target", "one", "two"],
        env,
      );

      return 0;
    },
  ));

  const child = r.os.s.start("exec-source", []);
  const pid = child.pid;

  eq(await r.os.s.wait(pid), 0);
  eq(
    r.out,
    `${pid}:1000:1000:1000:1000:/tmp:present:one,two:true:false\n`,
  );
  eq(child.pid, pid);
  eq(child.cmd, "/bin/exec-target");
  eq(child.argv.join(","), "exec-target,one,two");
});

test("process credentials preserve real, effective and saved identities", async () => {
  const r = new Rig();
  r.os.s.write("/tmp/effective-root", "secret\n", false, 0o600);
  r.os.s.p.cred = {
    ruid: 1000,
    euid: 0,
    suid: 0,
    rgid: 1000,
    egid: 0,
    sgid: 0,
    groups: [1000, 20],
  };
  r.os.s.p.fsuid = 0;
  r.os.s.p.fsgid = 0;
  eq(r.os.s.ruid, 1000);
  eq(r.os.s.euid, 0);
  eq(r.os.s.suid, 0);
  eq(r.os.s.rgid, 1000);
  eq(r.os.s.egid, 0);
  eq(r.os.s.sgid, 0);
  eq(r.os.s.read("/tmp/effective-root"), "secret\n", "filesystem ignored effective root identity");

  const child = r.os.s.start("true", []);
  eq(child.cred.ruid, 1000);
  eq(child.cred.euid, 0);
  eq(child.cred.suid, 0);
  eq(child.cred.rgid, 1000);
  eq(child.cred.egid, 0);
  eq(child.cred.sgid, 0);
  r.os.s.p.cred.groups.push(99);
  ok(!child.cred.groups.includes(99), "child shared its parent's supplementary group array");
  eq(await r.os.s.wait(child.pid), 0);

  r.os.s.p.cred.euid = 1000;
  r.os.s.p.cred.egid = 1000;
  r.os.s.p.fsuid = 1000;
  r.os.s.p.fsgid = 1000;
  let denied = false;
  try { r.os.s.read("/tmp/effective-root"); } catch (e) { denied = e instanceof KErr && e.code === "EACCES"; }
  ok(denied, "filesystem used the real or saved root identity instead of the effective identity");
});

test("identity transitions enforce saved-ID and group rules atomically", async () => {
  const r = new Rig(), s = r.os.s;
  s.write("/tmp/root-only", "root\n", false, 0o600);
  s.setResgid(1000, 0, 0);
  s.setResuid(1000, 0, 0);
  eq(s.ruid, 1000); eq(s.euid, 0); eq(s.suid, 0);
  eq(s.rgid, 1000); eq(s.egid, 0); eq(s.sgid, 0);

  s.setGroups([0, 20, 1000]);
  eq(s.groups.join(","), "0,20,1000");
  const exposed = s.groups; exposed.push(99);
  ok(!s.groups.includes(99), "supplementary groups escaped by reference");

  s.setResuid(undefined, 1000, undefined);
  eq(s.euid, 1000); eq(s.suid, 0);
  let denied = false;
  try { s.setGroups([1000]); } catch (e) { denied = e instanceof KErr && e.code === "EPERM"; }
  ok(denied, "non-root process replaced supplementary groups");
  const before = JSON.stringify(s.p.cred);
  denied = false;
  try { s.setResuid(undefined, 2000, undefined); } catch (e) { denied = e instanceof KErr && e.code === "EPERM"; }
  ok(denied, "non-root process selected an unrelated effective uid");
  eq(JSON.stringify(s.p.cred), before, "forbidden transition changed credentials");
  s.setResuid(undefined, 0, undefined);
  eq(s.euid, 0, "saved uid could not restore effective root");

  eq(s.setFsuid(1000), 0);
  denied = false;
  try { s.read("/tmp/root-only"); } catch (e) { denied = e instanceof KErr && e.code === "EACCES"; }
  ok(denied, "fsuid did not constrain filesystem access");
  eq(s.setFsuid(0), 1000);
  eq(s.read("/tmp/root-only"), "root\n");

  const temporary = new Rig().os.s;
  temporary.setResuid(1000, 0, 0);
  temporary.setReuid(undefined, 1000);
  eq(temporary.suid, 0, "temporary effective drop destroyed the saved uid");
  temporary.setReuid(undefined, 0);
  eq(temporary.euid, 0, "setreuid could not restore the saved uid");
  temporary.setReuid(1000, 1000);
  eq(temporary.suid, 1000, "real-id change did not commit the saved uid");
  denied = false;
  try { temporary.setReuid(undefined, 0); } catch (e) { denied = e instanceof KErr && e.code === "EPERM"; }
  ok(denied, "permanently dropped uid was restored");

  const permanent = new Rig().os.s;
  permanent.setGid(1000);
  permanent.setUid(1000);
  eq(`${permanent.ruid}:${permanent.euid}:${permanent.suid}`, "1000:1000:1000");
  eq(`${permanent.rgid}:${permanent.egid}:${permanent.sgid}`, "1000:1000:1000");
  denied = false;
  try { permanent.setUid(0); } catch (e) { denied = e instanceof KErr && e.code === "EPERM"; }
  ok(denied, "permanent setuid drop was reversible");
});

test("RV64 identity syscall numbers and pointer checks match the Linux ABI", async () => {
  interface RvHarness {
    readonly x: BigInt64Array;
    m: Mem64;
    floor: bigint;
    brk: bigint;
    stackAt: bigint;
    call(number: number): Promise<bigint>;
  }
  const r = new Rig(), s = r.os.s;
  const vm = new Rv64(s) as unknown as RvHarness;
  vm.m = new Mem64(1024n * 1024n, 4 * 65536);
  vm.floor = 0x10000n; vm.brk = 0x20000n; vm.stackAt = 0xf0000n;

  vm.x[10] = 1000n; vm.x[11] = 0n; vm.x[12] = 0n;
  eq(await vm.call(147), 0n);
  eq(await vm.call(174), 1000n);
  eq(await vm.call(175), 0n);

  vm.x[10] = 0x10000n; vm.x[11] = 0x10004n; vm.x[12] = 0x10008n;
  eq(await vm.call(148), 0n);
  eq(vm.m.u32(0x10000n), 1000); eq(vm.m.u32(0x10004n), 0); eq(vm.m.u32(0x10008n), 0);

  vm.m.set32(0x10000n, 0x12345678);
  vm.x[10] = 0x10000n; vm.x[11] = 0n; vm.x[12] = 0x10008n;
  let fault = false;
  try { await vm.call(148); } catch (e) { fault = e instanceof KErr && e.code === "EFAULT"; }
  ok(fault, "getresuid accepted a null result pointer");
  eq(vm.m.u32(0x10000n), 0x12345678, "getresuid partially wrote before pointer validation");

  s.setGroups([7, 8]);
  vm.x[10] = 0n; vm.x[11] = 0n;
  eq(await vm.call(158), 2n);
  vm.x[10] = 2n; vm.x[11] = 0x10100n;
  eq(await vm.call(158), 2n);
  eq(vm.m.u32(0x10100n), 7); eq(vm.m.u32(0x10104n), 8);
  vm.m.set32(0x10110n, 20); vm.m.set32(0x10114n, 30);
  vm.x[10] = 2n; vm.x[11] = 0x10110n;
  eq(await vm.call(159), 0n);
  eq(s.groups.join(","), "20,30");

  s.write("/tmp/high-owner", "ownership\n");
  vm.m.write(0x10120n, enc("/tmp/high-owner\0"));
  vm.x[10] = -100n; vm.x[11] = 0x10120n;
  vm.x[12] = 0xfffffffen; vm.x[13] = 0xfffffffdn; vm.x[14] = 0n;
  eq(await vm.call(54), 0n);
  eq(s.stat("/tmp/high-owner").uid, 0xfffffffe);
  eq(s.stat("/tmp/high-owner").gid, 0xfffffffd);

  const highOwner = s.open("/tmp/high-owner", "r+");
  vm.x[10] = BigInt(highOwner); vm.x[11] = 0xfffffffdn; vm.x[12] = 0xfffffffen;
  eq(await vm.call(55), 0n);
  s.close(highOwner);
  eq(s.stat("/tmp/high-owner").uid, 0xfffffffd);
  eq(s.stat("/tmp/high-owner").gid, 0xfffffffe);

  vm.x[10] = -100n; vm.x[11] = 0x10120n;
  vm.x[12] = 0xffffffffn; vm.x[13] = 1n; vm.x[14] = 0n;
  let invalidOwner = false;
  try { await vm.call(54); } catch (e) { invalidOwner = e instanceof KErr && e.code === "EINVAL"; }
  ok(invalidOwner, "fchownat accepted the reserved all-ones uid");
  eq(s.stat("/tmp/high-owner").uid, 0xfffffffd, "rejected fchownat changed ownership");

  vm.m.set32(0x10200n, 0); vm.m.set16(0x10204n, 0); vm.m.set16(0x10206n, 0xffff);
  vm.x[10] = 0x10200n; vm.x[11] = 1n; vm.x[12] = 0x10300n; vm.x[13] = 0n; vm.x[14] = 0n;
  eq(await vm.call(73), 0n); eq(vm.m.u16(0x10206n), 0, "ppoll rejected a valid standard descriptor");
  vm.m.set32(0x10200n, 99);
  eq(await vm.call(73), 1n); eq(vm.m.u16(0x10206n), 0x20, "ppoll did not mark an invalid descriptor");

  vm.x[10] = BigInt(s.pid); vm.x[11] = 0n;
  eq(await vm.call(129), 1n, "RV64 kill(pid, 0) did not probe a live process");
  ok(!s.p.ac.signal.aborted, "RV64 signal-zero probe delivered a signal");
});

test("RV64 renameat2 supports transactional replacement semantics", async () => {
  interface RvRenameHarness {
    readonly x: BigInt64Array;
    m: Mem64;
    floor: bigint;
    brk: bigint;
    stackAt: bigint;
    call(number: number): Promise<bigint>;
  }

  const r = new Rig();
  const s = r.os.s;
  const vm = new Rv64(s) as unknown as RvRenameHarness;

  vm.m = new Mem64(1024n * 1024n, 4 * 65536);
  vm.floor = 0x10000n;
  vm.brk = 0x20000n;
  vm.stackAt = 0xf0000n;

  s.write("/tmp/renameat2-source", "renamed\n");

  vm.m.write(
    0x10000n,
    enc("/tmp/renameat2-source\0"),
  );

  vm.m.write(
    0x10100n,
    enc("/tmp/renameat2-target\0"),
  );

  vm.x[10] = -100n;
  vm.x[11] = 0x10000n;
  vm.x[12] = -100n;
  vm.x[13] = 0x10100n;
  vm.x[14] = 0n;

  eq(await vm.call(276), 0n);
  eq(s.read("/tmp/renameat2-target"), "renamed\n");

  let oldMissing = false;

  try {
    s.stat("/tmp/renameat2-source");
  } catch (error) {
    oldMissing =
      error instanceof KErr &&
      error.code === "ENOENT";
  }

  ok(
    oldMissing,
    "renameat2 left its old path behind",
  );

  s.write("/tmp/renameat2-source", "source\n");
  s.write("/tmp/renameat2-existing", "existing\n");

  vm.m.write(
    0x10200n,
    enc("/tmp/renameat2-existing\0"),
  );

  vm.x[10] = -100n;
  vm.x[11] = 0x10000n;
  vm.x[12] = -100n;
  vm.x[13] = 0x10200n;
  vm.x[14] = 1n;

  let noReplace = false;

  try {
    await vm.call(276);
  } catch (error) {
    noReplace =
      error instanceof KErr &&
      error.code === "EEXIST";
  }

  ok(
    noReplace,
    "RENAME_NOREPLACE replaced an existing target",
  );

  eq(s.read("/tmp/renameat2-source"), "source\n");
  eq(s.read("/tmp/renameat2-existing"), "existing\n");

  vm.x[14] = 2n;

  let unsupported = false;

  try {
    await vm.call(276);
  } catch (error) {
    unsupported =
      error instanceof KErr &&
      error.code === "EINVAL";
  }

  ok(
    unsupported,
    "renameat2 accepted unsupported exchange semantics",
  );
});

test("identity commands distinguish real and effective users", async () => {
  const r = new Rig();
  r.os.s.setResgid(1000, 0, 0);
  r.os.s.setResuid(1000, 0, 0);
  const x = await r.run("id; whoami");
  eq(x.code, 0); eq(x.err, "");
  ok(x.out.includes("uid=1000(guest) euid=0(root)"));
  ok(x.out.includes("gid=1000(users) egid=0(root)"));
  ok(x.out.endsWith("root\n"), "whoami did not report the effective user");
});

test("set-ID execution applies saved IDs only on suid mounts", async () => {
  const r = new Rig(undefined, true), s = r.os.s, native = s.readb("/usr/bin/hello.txe");
  const install = (path: string, uid: number, gid: number, mode: number): void => {
    s.writeb(path, native); s.chown(path, uid, gid); s.chmod(path, mode);
  };

  install("/tmp/setid.txe", 0, 20, 0o6755);
  install("/tmp/plain.txe", 0, 0, 0o0755);
  s.write("/tmp/setid-script", "#!/bin/thsh\nexit 0\n");
  s.chown("/tmp/setid-script", 0, 0); s.chmod("/tmp/setid-script", 0o4755);
  install("/tmp/guest-write.txe", 0, 0, 0o4777);

  let x = await r.run("ls -l /tmp/setid.txe");
  ok(x.out.includes("-rwsr-sr-x"), "ls did not display set-user-ID and set-group-ID bits");

  install("/tmp/write-clear.txe", 0, 0, 0o6755);
  s.writeb("/tmp/write-clear.txe", native);
  eq(s.stat("/tmp/write-clear.txe").mode, 0o0755, "content write retained set-ID bits");
  s.chmod("/tmp/write-clear.txe", 0o6755);
  const fd = s.open("/tmp/write-clear.txe", "r+"); s.fdw(fd, native.subarray(0, 8)); s.close(fd);
  eq(s.stat("/tmp/write-clear.txe").mode, 0o0755, "descriptor write retained set-ID bits");
  s.chmod("/tmp/write-clear.txe", 0o6755); s.chown("/tmp/write-clear.txe", 0, 0);
  eq(s.stat("/tmp/write-clear.txe").mode, 0o0755, "ownership change retained set-ID bits");

  s.setGroups([1000]);
  s.setResgid(1000, 1000, 1000);
  s.setResuid(1000, 1000, 1000);
  ok(r.os.k.mounts()[0]?.opt.includes("suid"));

  const plain = s.start("/tmp/plain.txe", []);
  eq(`${plain.cred.ruid}:${plain.cred.euid}:${plain.cred.suid}`, "1000:1000:1000");
  eq(await s.wait(plain.pid), 0);

  const elevated = s.start("/tmp/setid.txe", []);
  eq(`${elevated.cred.ruid}:${elevated.cred.euid}:${elevated.cred.suid}`, "1000:0:0");
  eq(`${elevated.cred.rgid}:${elevated.cred.egid}:${elevated.cred.sgid}`, "1000:20:20");
  const elevatedSys = new Sys(r.os.k, elevated);
  elevatedSys.setResuid(undefined, 1000, undefined);
  eq(elevatedSys.euid, 1000); eq(elevatedSys.suid, 0);
  elevatedSys.setResuid(undefined, 0, undefined);
  eq(elevatedSys.euid, 0, "set-ID child could not restore its saved uid");
  eq(await s.wait(elevated.pid), 0);
  eq(`${s.ruid}:${s.euid}:${s.suid}`, "1000:1000:1000", "set-ID execution changed the parent");

  let denied = false;
  try { s.start("/tmp/setid-script", []); } catch (e) { denied = e instanceof KErr && e.code === "EACCES"; }
  ok(denied, "set-ID script was accepted on a suid mount");

  s.writeb("/tmp/user-owned.txe", native); s.chmod("/tmp/user-owned.txe", 0o4755);
  denied = false;
  try { s.chown("/tmp/user-owned.txe", 0, 0); } catch (e) { denied = e instanceof KErr && e.code === "EPERM"; }
  ok(denied, "non-root process created a root-owned executable");
  const harmless = s.start("/tmp/user-owned.txe", []);
  eq(harmless.cred.euid, 1000, "user-owned set-ID file gained another identity");
  eq(await s.wait(harmless.pid), 0);

  s.writeb("/tmp/guest-write.txe", native);
  eq(s.stat("/tmp/guest-write.txe").mode, 0o0777, "unprivileged write retained root set-ID bit");
});

test("nosuid execution ignores file privilege bits", async () => {
  const r = new Rig(), s = r.os.s, native = s.readb("/usr/bin/hello.txe");
  s.writeb("/tmp/nosuid.txe", native); s.chown("/tmp/nosuid.txe", 0, 20); s.chmod("/tmp/nosuid.txe", 0o6755);
  s.setGroups([1000]); s.setResgid(1000, 1000, 1000); s.setResuid(1000, 1000, 1000);
  ok(r.os.k.mounts()[0]?.opt.includes("nosuid"));
  const child = s.start("/tmp/nosuid.txe", []);
  eq(`${child.cred.ruid}:${child.cred.euid}:${child.cred.suid}`, "1000:1000:1000");
  eq(`${child.cred.rgid}:${child.cred.egid}:${child.cred.sgid}`, "1000:1000:1000");
  eq(await s.wait(child.pid), 0);
});

test("boot image and init", async () => {
  const r = new Rig();
  eq(r.os.k.ps()[0]?.pid, 1);
  eq(r.os.s.read("/etc/hostname"), "thistle\n");
  const release = r.os.s.read("/etc/os-release");
  ok(release.includes('NAME="mikuOS"'));
  ok(release.includes('PRETTY_NAME="初音ミクOS v｡三"'));
  ok(release.includes('VERSION="v0.3"'));
  ok(release.includes('VERSION_ID="0.3"'));
  ok(release.includes('KERNEL_NAME=Thistle'));
  ok(release.includes('KERNEL_VERSION=2.1.0'));
  ok(release.includes('KERNEL_SOURCE=Thistle'));
  ok(r.os.s.read("/etc/motd").includes("mikuOS v0.3"));
  ok(r.os.s.apps().length >= 50, "core userland is incomplete");
  eq(r.os.s.stat("/bin/thsh").mode, 0o755);
  eq(r.os.s.stat("/usr/libexec/mikuos/builtin/thsh").mode, 0o755);
  const builtins = JSON.parse(r.os.s.read("/usr/share/mikuos/builtin-commands.json")) as {
    schema: number;
    commands: Array<{ name: string; activePath: string; rescuePath: string }>;
  };
  eq(builtins.schema, 1);
  eq(builtins.commands.length, r.os.s.apps().length);
  ok(builtins.commands.some(command =>
    command.name === "true" &&
    command.activePath === "/bin/true" &&
    command.rescuePath === "/usr/libexec/mikuos/builtin/true"
  ));
  const compiler = JSON.parse(r.os.s.read("/usr/share/mikuos/compiler-infrastructure.json")) as {
    schema: number;
    integration: Array<{ path: string }>;
  };
  eq(compiler.schema, 1);
  ok(compiler.integration.some(component => component.path === "/usr/libexec/thistle/thx-cc"));
  const uname = await r.run("uname -s; uname -r");
  eq(uname.code, 0);
  eq(uname.out, "Thistle\n2.1.0\n");
  ok(r.os.s.read("/proc/version").startsWith("Thistle version 2.1.0 "));
  const bootManifest = r.os.s.read("/boot/mikuos.yaml");
  eq(bootManifest, r.os.s.read("/boot/thistle.yaml"));
  ok(bootManifest.includes("os_name: mikuOS"));
  ok(bootManifest.includes("os_release: v0.3"));
  ok(bootManifest.includes("kernel_source: Thistle"));
  ok(bootManifest.includes("host_compiler: thistlecc"));
});

test("every built-in rescue command has a runnable help path", async () => {
  const r = new Rig();
  for (const a of r.os.s.apps()) {
    const path = `/usr/libexec/mikuos/builtin/${a.name}`;
    const x = await r.run(`${path} --help`);
    eq(x.code, 0, `${path} --help failed`);
    eq(x.err, "", `${path} --help wrote an error`);
    ok(x.out.startsWith("usage:"), `${path} has no usage text`);
  }
});

test("inode data, links and permissions", () => {
  const r = new Rig();
  r.os.s.mkdir("/tmp/fs");
  r.os.s.write("/tmp/fs/a", "one");
  r.os.s.link("/tmp/fs/a", "/tmp/fs/b");
  r.os.s.write("/tmp/fs/b", "two");
  eq(r.os.s.read("/tmp/fs/a"), "two");
  r.os.s.symlink("a", "/tmp/fs/c");
  eq(r.os.s.read("/tmp/fs/c"), "two");
  eq(r.os.s.stat("/tmp/fs/a").nlink, 2);
  r.os.s.chmod("/tmp/fs/a", 0o600);
  let e: unknown;
  try { r.os.k.fs.read("/tmp/fs/a", "/", { uid: 1000, gid: 1000, groups: [1000] }); } catch (x) { e = x; }
  ok(e instanceof KErr && e.code === "EACCES", "guest bypassed mode bits");
  const g = { uid: 1000, gid: 1000, groups: [1000] };
  r.os.k.fs.write("/home/guest/own", "mine", "/", g);
  eq(r.os.k.fs.stat("/home/guest/own", "/", g).uid, 1000);
});

test("descriptor offsets and append", () => {
  const r = new Rig();
  r.os.s.write("/tmp/fd", "abcdef");
  const fd = r.os.s.open("/tmp/fd", "r+");
  eq(dec(r.os.s.fdr(fd, 2)), "ab");
  r.os.s.seek(fd, 3);
  r.os.s.fdw(fd, enc("XY"));
  r.os.s.close(fd);
  eq(r.os.s.read("/tmp/fd"), "abcXYf");
  const ap = r.os.s.open("/tmp/fd", "a");
  r.os.s.fdw(ap, enc("!"));
  r.os.s.close(ap);
  eq(r.os.s.read("/tmp/fd"), "abcXYf!");
});

test("the complete root survives a fresh boot", async () => {
  const tree = new MemTree(), quiet = { put: () => {}, tree };
  const a = boot(quiet);
  await a.ready;
  a.s.mkdir("/var/persistence-test"); a.s.write("/var/persistence-test/main.c", "int main(void) { return 7; }\n");
  a.s.link("/var/persistence-test/main.c", "/var/persistence-test/copy.c"); a.s.chmod("/var/persistence-test/main.c", 0o640);
  a.s.write("/made-at-root", "persistent\n");
  a.s.write("/etc/motd", "locally replaced\n"); a.s.chmod("/etc/motd", 0o640); a.s.chown("/etc/motd", 1000, 1000);
  a.s.rm("/etc/issue");
  await a.flush();
  ok(tree.ent && tree.ent.some(x => x.p === "/var/persistence-test/main.c" && x.data), "host tree did not receive /var/persistence-test/main.c");
  ok(tree.ent?.some(x => x.p === "/made-at-root"), "host tree did not receive a file created under /");
  ok(!tree.ent?.some(x => x.p === "/etc/issue"), "deleting a system file was not persisted");
  ok(!tree.ent?.some(x => x.p === "/dev" || x.p.startsWith("/dev/") || x.p === "/proc" || x.p.startsWith("/proc/")), "live mounts leaked into persistent storage");

  const b = boot(quiet);
  await b.ready;
  eq(b.s.read("/var/persistence-test/copy.c"), "int main(void) { return 7; }\n");
  eq(b.s.read("/made-at-root"), "persistent\n");
  eq(b.s.read("/etc/motd"), "locally replaced\n"); eq(b.s.stat("/etc/motd").mode, 0o640); eq(b.s.stat("/etc/motd").uid, 1000);
  eq(b.s.stat("/var/persistence-test/main.c").nlink, 2); eq(b.s.stat("/var/persistence-test/main.c").mode, 0o640);
  let gone = false; try { b.s.stat("/etc/issue"); } catch { gone = true; }
  ok(gone, "the base image resurrected a deleted system file");
  eq(b.s.stat("/dev/null").kind, "char", "restoring / removed devfs");
  ok(b.s.read("/proc/mounts").includes("hostfs / thistlefs rw"), "persistent / is absent from /proc/mounts");
});

test("versioned image migration changes stock identity but preserves local identity", async () => {
  const tree = new MemTree(), quiet = { put: () => {}, tree }, a = boot(quiet);
  await a.ready;
  const issue = tree.ent?.find(x => x.p === "/etc/issue");
  const release = tree.ent?.find(x => x.p === "/etc/os-release");
  const motd = tree.ent?.find(x => x.p === "/etc/motd");
  ok(issue?.data && release?.data && motd?.data, "identity files were not persisted");
  issue.data = enc("Thistle OS 2.0.0 \\n \\l\n");
  release.data = enc("locally branded\n");
  motd.data = enc("Welcome to Thistle 2.0.0, the 64-bit TypeScript Unix-like system.\nRun 'hello.txe' for Thistle64, 'hello32.txe' for compatibility, or 'help'.\n");
  tree.imageVersion = 0;

  const b = boot(quiet);
  await b.ready;
  eq(b.s.read("/etc/issue"), DEFAULT_CONFIG.messages.issue);
  eq(b.s.read("/etc/os-release"), "locally branded\n");
  eq(b.s.read("/etc/motd"), DEFAULT_CONFIG.messages.motd);
  eq(tree.imageVersion, 4);
});

test("an invalid optional root package does not prevent base-system boot", async () => {
  let error = "";
  const os = boot({
    put: (text, channel) => { if (channel === "err") error += text; },
    pkg: { install: async () => { throw new Error("truncated test package"); } },
  });
  await os.ready;
  eq(os.s.read("/etc/hostname"), "thistle\n");
  ok(error.includes("Optional root package was not installed: truncated test package"));
  ok(os.k.logs.some(line => line.includes("pkg: install failed: truncated test package")));
});

test("host directory uses ordinary files and real hard links", async () => {
  interface HStat { ino: number | bigint; mode: number; }
  interface HFs {
    mkdtemp(p: string): Promise<string>;
    readFile(p: string): Promise<Uint8Array>;
    writeFile(p: string, b: Uint8Array): Promise<void>;
    lstat(p: string): Promise<HStat>;
    readlink(p: string): Promise<string>;
    rm(p: string, o: { recursive: boolean; force: boolean }): Promise<void>;
  }
  interface HProc { getBuiltinModule(n: string): { promises: HFs }; }
  const hfs = (globalThis as unknown as { process: HProc }).process.getBuiltinModule("fs").promises;
  let refused = false; try { new DirTree("/"); } catch { refused = true; }
  ok(refused, "the adapter accepted the host filesystem root as guest storage");
  const dir = await hfs.mkdtemp("/tmp/mikuos-host-test-");
  try {
    const a = boot({ put: () => {}, tree: new DirTree(dir) });
    await a.ready;
    eq(dec(await hfs.readFile(`${dir}/etc/hostname`)), "thistle\n", "first boot did not seed the complete host root");
    eq((await hfs.lstat(`${dir}/root`)).mode & 0o777, 0o700, "guest directory mode was not applied to the host root");
    a.s.mkdir("/var/persistence-test");
    a.s.write("/var/persistence-test/a.txt", "one\n"); a.s.link("/var/persistence-test/a.txt", "/var/persistence-test/b.txt"); a.s.chmod("/var/persistence-test/a.txt", 0o640);
    a.s.symlink("/etc/hostname", "/var/persistence-test/host-name");
    a.s.rm("/etc/issue");
    await a.flush();
    eq(dec(await hfs.readFile(`${dir}/var/persistence-test/a.txt`)), "one\n");
    eq(await hfs.readlink(`${dir}/var/persistence-test/host-name`), "../../etc/hostname", "an absolute guest link escaped the host root");
    let sa = await hfs.lstat(`${dir}/var/persistence-test/a.txt`), sb = await hfs.lstat(`${dir}/var/persistence-test/b.txt`);
    eq(sa.ino, sb.ino, "guest hard link was copied instead of linked"); eq(sa.mode & 0o777, 0o640);

    a.s.write("/var/persistence-test/b.txt", "two\n"); await a.flush();
    eq(dec(await hfs.readFile(`${dir}/var/persistence-test/a.txt`)), "two\n", "hard-link update did not reach the first host name");
    sa = await hfs.lstat(`${dir}/var/persistence-test/a.txt`); sb = await hfs.lstat(`${dir}/var/persistence-test/b.txt`);
    eq(sa.ino, sb.ino, "flushing a hard-link update split the host inode");

    await hfs.writeFile(`${dir}/host.c`, enc("int host(void) { return 2; }\n"));
    const b = boot({ put: () => {}, tree: new DirTree(dir) });
    await b.ready; eq(b.s.read("/host.c"), "int host(void) { return 2; }\n");
    eq(b.s.readlink("/var/persistence-test/host-name"), "/etc/hostname", "absolute guest link changed after a boot");
    let issueGone = false; try { b.s.stat("/etc/issue"); } catch { issueGone = true; }
    ok(issueGone, "host-directory boot resurrected a deleted system file");
    b.s.rm("/host.c"); await b.flush();
    let missing = false; try { await hfs.lstat(`${dir}/host.c`); } catch (e) { missing = (e as { code?: string }).code === "ENOENT"; }
    ok(missing, "deleting an imported host file did not delete the real file");
  } finally { await hfs.rm(dir, { recursive: true, force: true }); }
});

test("quoting, variables and command gates", async () => {
  const r = new Rig();
  let x = await r.run("export COLOUR=green; echo '$COLOUR' \"$COLOUR\"");
  eq(x.out, "$COLOUR green\n");
  x = await r.run("false && echo bad; false || echo good; true && echo yes");
  eq(x.out, "good\nyes\n");
  eq(x.code, 0);
  x = await r.run("A=one; A=two env | grep '^A=two$'; echo ok # ; echo nope");
  eq(x.out, "A=two\nok\n");
});

test("thsh folds physical line continuations without changing quoted here-documents", async () => {
  const r = new Rig();
  const slash = String.fromCharCode(92);
  const lines = (...value: string[]): string => value.join("\n");

  let x = await r.run(lines(`echo alpha ${slash}`, "beta"));
  eq(x.code, 0);
  eq(x.out, "alpha beta\n");

  x = await r.run(lines(`printf '%s' "double${slash}`, "quoted\""));
  eq(x.code, 0);
  eq(x.out, "doublequoted");

  x = await r.run(lines(`printf '%s' 'single${slash}`, "quoted'"));
  eq(x.code, 0);
  eq(x.out, `single${slash}\nquoted`);

  x = await r.run(lines(`printf '%s\\n' literal${slash}${slash}`, "echo next"));
  eq(x.code, 0);
  eq(x.out, `literal${slash}\nnext\n`, "an escaped literal backslash became a continuation");

  x = await r.run(`echo comment-ok # 'not a quote ${slash}`);
  eq(x.code, 0);
  eq(x.out, "comment-ok\n", "comment text incorrectly made the command incomplete");

  x = await r.run(`echo unfinished ${slash}`);
  eq(x.code, 2);
  ok(x.err.includes("trailing escape"), "a trailing escape did not report a syntax error");

  r.os.s.write(
    "/tmp/continued.thsh",
    lines("#!/bin/thsh", `echo script ${slash}`, "continued", ""),
    false,
    0o755,
  );
  r.os.s.chmod("/tmp/continued.thsh", 0o755);
  x = await r.run("/tmp/continued.thsh");
  eq(x.code, 0);
  eq(x.out, "script continued\n");

  x = await r.run(lines("cat <<'EOF'", `left${slash}`, "right", "EOF", ""));
  eq(x.code, 0);
  eq(x.out, `left${slash}\nright\n`, "a quoted here-document body was folded");

  x = await r.run(lines("cat <<EOF", `left${slash}`, "right", "EOF", ""));
  eq(x.code, 0);
  eq(x.out, "leftright\n", "an unquoted here-document lost its established expansion rules");
});

test("line editor clears unaccepted history suggestions before submitting", () => {
  const r = new Rig();
  r.os.sh.hist.push('echo "test" && echo "test2"');
  let output = "";
  let executed = "";

  const editor = new LineEditor({
    shell: r.os.sh,
    prompt: () => "$ ",
    busy: () => false,
    write: value => { output += value; },
    execute: source => { executed = source; },
    passthrough: () => {},
    halt: () => {},
    complete: line => ({ line, list: [] }),
  });

  editor.key('echo "test"');
  editor.key("\r");

  eq(executed, 'echo "test"');
  ok(
    output.endsWith('\r\x1b[2K$ echo "test"\r\n'),
    "submit left the grey suggestion visible",
  );
});

test("line editor continues typed and pasted commands and cancels safely", async () => {
  const r = new Rig();
  const slash = String.fromCharCode(92);
  const executed: Array<{ source: string; bodies: string[] }> = [];
  let output = "";
  let halted = 0;
  const editor = new LineEditor({
    shell: r.os.sh,
    prompt: () => "$ ",
    busy: () => false,
    write: value => { output += value; },
    execute: (source, bodies) => { executed.push({ source, bodies: [...bodies] }); },
    passthrough: () => {},
    halt: () => { halted++; },
    complete: line => ({ line, list: [] }),
  });

  editor.key(`echo pasted ${slash}\nworks\n`);
  eq(executed.length, 1, "a pasted continuation executed more than once");
  eq(executed[0]!.source, `echo pasted ${slash}\nworks`);
  ok(output.includes("> "), "the continuation prompt was not rendered");
  let x = await r.run(executed.shift()!.source);
  eq(x.code, 0);
  eq(x.out, "pasted works\n");

  editor.key(`echo literal ${slash}${slash}\r`);
  eq(executed.length, 1, "an escaped literal backslash incorrectly requested another line");
  executed.shift();

  output = "";
  editor.key(`echo cancelled ${slash}\r`);
  eq(executed.length, 0);
  editor.key("\x03");
  editor.key("echo kept\r");
  eq(executed.length, 1);
  eq(executed.shift()!.source, "echo kept");
  ok(output.includes("^C"), "Ctrl+C did not visibly cancel continuation input");

  editor.key(`echo eof ${slash}\r`);
  editor.key("\x04");
  eq(halted, 0, "EOF halted the shell while a command was incomplete");
  eq(executed.length, 1);
  x = await r.run(executed.shift()!.source);
  eq(x.code, 2);
  ok(x.err.includes("trailing escape"), "EOF did not surface the incomplete command error");

  editor.key("\x04");
  eq(halted, 1, "EOF on an empty complete prompt did not halt the shell");
});

test("redirects and filesystem commands", async () => {
  const r = new Rig();
  const x = await r.run("mkdir -p /tmp/a/b && echo first > /tmp/a/b/x && echo second >> /tmp/a/b/x && cp /tmp/a/b/x /tmp/a/y && cat /tmp/a/y");
  eq(x.code, 0);
  eq(x.out, "first\nsecond\n");
  eq(r.os.s.read("/tmp/a/b/x"), "first\nsecond\n");
  await r.run("rm -r /tmp/a");
  let miss = false; try { r.os.s.stat("/tmp/a"); } catch { miss = true; }
  ok(miss, "recursive rm left the tree behind");
  await r.run("umask 077; touch /tmp/private");
  eq(r.os.s.stat("/tmp/private").mode, 0o600, "umask was not inherited by a child");
});

test("streaming pipeline closes upstream", async () => {
  const r = new Rig();
  const x = await r.run("yes thistle | head -n 3");
  eq(x.out, "thistle\nthistle\nthistle\n");
  eq(x.err, "", "SIGPIPE leaked as a diagnostic");
  eq(x.code, 0);
  ok(r.os.k.ps().length === 2, "pipeline children were not reaped");
  const y = await r.run("printf 'kept\\n' | thsh -c 'echo first; cat'");
  eq(y.out, "first\nkept\n", "a nested process closed its shell stdin");
});

test("text tool pipeline", async () => {
  const r = new Rig();
  const x = await r.run("printf 'pear\\napple\\npear\\nplum\\n' | sort | uniq -c | grep -E '2 pear'");
  eq(x.code, 0);
  ok(x.out.includes("2 pear"));
});

test("background jobs and signals", async () => {
  const r = new Rig();
  let x = await r.run("sleep 30 &");
  ok(/^\[1\] \d+\n$/.test(x.out));
  x = await r.run("jobs");
  ok(x.out.includes("Running"));
  await r.run("kill %1");
  x = await r.run("wait %1");
  eq(x.code, 143);
  eq(r.os.sh.jobs.size, 0);
});

test("scripts retain shell state", async () => {
  const r = new Rig();
  r.os.s.write("/tmp/t.thsh", "#!/bin/thsh\nexport X=inside\necho $X\ncd /tmp\npwd\n", false, 0o755);
  r.os.s.chmod("/tmp/t.thsh", 0o755);
  const x = await r.run("/tmp/t.thsh");
  eq(x.out, "inside\n/tmp\n");
  eq(r.os.s.cwd, "/root", "child script changed the parent cwd");
});

test("interactive TTY supports canonical and raw input", async () => {
  let out = "", sig = 0;
  const tty = new Tty((s) => { out += s; }, () => { sig++; });
  const line = tty.input.rd();
  tty.feed("hello\r");
  eq(dec(await line), "hello\n");
  eq(out, "hello\r\n");
  const raw = tty.termios(), v = new DataView(raw.buffer);
  v.setUint32(12, v.getUint32(12, true) & ~0x0a, true);
  tty.setTermios(raw, false);
  const key = tty.input.rd();
  tty.feed("\x1b[A");
  eq(dec(await key), "\x1b[A");
  tty.resize(42, 132);
  eq(tty.size().rows, 42); eq(tty.size().cols, 132); eq(sig, 0);
});

test("foreground TTY interruption restores echo and wakes native input", async () => {
  let out = "", signals = 0;
  const tty = new Tty(
    s => { out += s; },
    () => { signals++; return true; },
  );
  const hidden = tty.termios(), view = new DataView(hidden.buffer);
  view.setUint32(12, view.getUint32(12, true) & ~0x48, true);
  tty.setTermios(hidden, true);
  const waiting = tty.input.rd();
  tty.feed("uncommitted-secret\x03");
  eq((await waiting).length, 0, "interrupted terminal read did not wake");
  const restored = new DataView(tty.termios().buffer);
  ok(!!(restored.getUint32(12, true) & 0x08), "echo was not restored");
  eq(signals, 1);
  ok(out.includes("^C"), "interrupt was not displayed");
  ok(!out.includes("uncommitted-secret"), "hidden input was echoed");
  const next = tty.input.rd();
  tty.feed("clean\r");
  eq(dec(await next), "clean\n", "partial secret survived the interrupt");
});

test("process signal masks defer delivery across critical sections", () => {
  const r = new Rig(), p = r.os.p, interrupt = 1n << 1n;
  eq(p.setSignalMask(0, interrupt), 0n);
  eq(p.signalMask, interrupt);
  eq(p.signal(2), false, "masked signal was delivered immediately");
  eq(p.sig, null);
  ok(!p.ac.signal.aborted, "masked signal aborted the process");
  eq(p.setSignalMask(1, interrupt), interrupt);
  eq(p.sig, 2);
  ok(p.ac.signal.aborted, "pending signal was not delivered after unmasking");

  const k = new Rig().os.p;
  k.setSignalMask(0, 1n << 8n);
  eq(k.signalMask, 0n, "SIGKILL was maskable");
  eq(k.signal(9), true);
  eq(k.sig, 9);
});

test("signal zero probes process ownership without delivery", () => {
  const r = new Rig();
  eq(r.os.s.kill(r.os.p.pid, 0), 1);
  ok(!r.os.p.ac.signal.aborted, "signal zero interrupted its target");

  let error = "";
  try {
    r.os.s.kill(0x7fffffff, 0);
  } catch (caught) {
    error = caught instanceof KErr ? caught.code : "unexpected";
  }

  eq(error, "ESRCH", "a missing process passed a signal-zero probe");
});

test("/dev/tty opens the controlling terminal", () => {
  const r = new Rig();
  const fd = r.os.s.open("/dev/tty", "r+");
  const f = r.os.s.p.fds.get(fd);
  ok(f?.input?.tty, "/dev/tty has no terminal input");
  ok(f?.output?.tty, "/dev/tty has no terminal output");
  eq(f.input.tty, f.output.tty, "/dev/tty streams use different terminals");
  r.os.s.close(fd);
});

test("web account boots as the configured unprivileged user", async () => {
  const config = mergeConfig({ sessions: { local: { mode: "login", account: "root" } } });
  const r = boot({ put: () => {}, config, account: config.accounts.web });
  await r.ready;
  eq(r.s.uid, 1000); eq(r.s.gid, 1000); eq(r.s.env("USER"), "guest"); eq(r.s.cwd, "/home/guest");
});

test("browser session runs the full guest locally without a runtime server", async () => {
  let output = "";
  const device = new TestNet();
  const web = new WebSession(
    { write: text => { output += text; } },
    { config: DEFAULT_CONFIG, net: new Net(device) },
  );

  await web.ready;
  eq(web.os.s.uid, 1000);
  eq(web.os.s.env("USER"), "guest");
  eq(web.os.k.setId, true);
  ok(web.os.k.mounts()[0]!.opt.includes("suid"));
  eq(device.seen.length, 0, "browser boot contacted a runtime service");

  output = "";
  web.key("whoami\r");
  await web.idle();
  ok(output.includes("guest\n"), "local browser shell did not execute whoami");

  output = "";
  web.key("hello.txe\r");
  await web.idle();
  ok(
    output.includes("Hello from native Thistle assembly!\n"),
    "local browser kernel did not execute the bundled Thistle64 program",
  );
  eq(device.seen.length, 0, "local browser commands contacted a runtime service");
});

test("native WebAssembly loader and WASI", async () => {
  const r = new Rig();
  ok(WebAssembly.validate(Uint8Array.from(demoWasm()) as BufferSource), "bundled module is invalid");
  const x = await r.run("hello.wasm");
  eq(x.code, 0);
  eq(x.out, "Hello from a real WASI binary inside Thistle!\n");
  const f = await r.run("file /usr/bin/hello.wasm");
  ok(f.out.includes("WebAssembly binary module"));
});

test("native assembler, object format and linker", () => {
  const src = `.macro bump r, n=1
  addi \\r, \\r, \\n
.endm
.section .rodata
msg: .asciz "native"
.equ msg_len, . - msg
.text
.global _start
_start:
  li r0, 0
  bump r0, 2
  jmp 1f
  li r0, 99
1:
  la r1, msg
  li r2, msg_len
  halt
`;
  const a = new Asm(undefined, { debug: true }).run(src, "unit.tas");
  ok(a.obj.sym.some(x => x.name === "_start" && x.bind === "global"));
  eq(a.obj.machine, "thistle64");
  ok(a.obj.rel.some(x => x.type === "abs64" && x.sym === "msg"));
  ok(a.obj.rel.some(x => x.type === "rel64"));
  const ob = codec.pack(a.obj), oq = codec.unpack(ob);
  ok(oq instanceof Obj, "object codec changed its kind");
  const z = new Link().run([a.obj]);
  eq(z.exe.entry, 0x10000);
  ok(z.map.includes("_start"));
  const bad = ob.slice(); bad[bad.length - 1] = bad[bad.length - 1]! ^ 1;
  let hit = false; try { codec.unpack(bad); } catch { hit = true; }
  ok(hit, "object checksum accepted changed bytes");
});

test("thistle64 integer, branch and memory instructions", async () => {
  const r = new Rig();
  const src = `.macro expect r, v
  cmpi \\r, \\v
  jne fail
.endm
.data
.align 4
buf: .space 8
.text
.global _start
_start:
  li r0, 7
  li r1, 3
  add r2, r0, r1
  expect r2, 10
  sub r2, r0, r1
  expect r2, 4
  mul r2, r0, r1
  expect r2, 21
  div r2, r0, r1
  expect r2, 2
  mod r2, r0, r1
  expect r2, 1
  li r3, 0xffffffff
  li r4, 2
  divu r5, r3, r4
  expect r5, 0x7fffffff
  modu r5, r3, r4
  expect r5, 1
  andi r2, r0, 3
  expect r2, 3
  ori r2, r1, 8
  expect r2, 11
  xori r2, r1, 1
  expect r2, 2
  shli r2, r1, 3
  expect r2, 24
  li r6, -8
  sari r2, r6, 1
  expect r2, -4
  shri r2, r3, 31
  expect r2, 1
  not r2, r1
  expect r2, -4
  neg r2, r1
  expect r2, -3
  li r4, 12
  li r5, 34
  xchg r4, r5
  expect r4, 34
  expect r5, 12
  li r6, 255
  sex8 r7, r6
  expect r7, -1
  li r6, 65535
  sex16 r7, r6
  expect r7, -1
  la r8, buf
  li r9, 0x12345678
  st32 [r8], r9
  ld32 r10, [r8]
  expect r10, 0x12345678
  li r9, 0x80
  st8 [r8 + 4], r9
  ld8s r10, [r8 + 4]
  expect r10, -128
  ld8u r10, [r8 + 4]
  expect r10, 128
  li r9, 0x8000
  st16 [r8 + 4], r9
  ld16s r10, [r8 + 4]
  expect r10, -32768
  ld16u r10, [r8 + 4]
  expect r10, 32768
  push r0
  pop r11
  expect r11, 7
  cmp r0, r1
  setg r12
  expect r12, 1
  test r12, r12
  setne r12
  expect r12, 1
  la r4, answer
  callr r4
  expect r0, 42
  li r0, 0
  halt
answer:
  li r0, 42
  ret
fail:
  li r0, 77
  halt
`;
  const z = new Link().run([new Asm().run(src, "ops.tas").obj]).exe;
  r.os.s.writeb("/tmp/ops.txe", codec.pack(z)); r.os.s.chmod("/tmp/ops.txe", 0o755);
  const x = await r.run("/tmp/ops.txe"); eq(x.code, 0); eq(x.err, "");
});

test("thistle64 wide addresses, integers and floating point", async () => {
  const r = new Rig();
  const src = `.equ SYS_brk, 10
.text
.global _start
_start:
  li x4, 0x100000020
  mov x0, x4
  sys SYS_brk
  cmp x0, x4
  jne fail
  li x5, 0x100000000
  li x6, 0x123456789abcdef0
  st64 [x5], x6
  ld64 x7, [x5]
  cmp x6, x7
  jne fail
  fli f0, 1.5
  fli f1, 2.25
  fadd f2, f0, f1
  fli f3, 3.75
  fsete x8, f2, f3
  cmpi x8, 1
  jne fail
  fli f4, 0
  fdiv f5, f4, f4
  fsetne x8, f5, f5
  cmpi x8, 1
  jne fail
  fsetl x8, f5, f3
  cmpi x8, 0
  jne fail
  li x0, 0
  halt
fail:
  li x0, 86
  halt
`;
  const z = new Link().run([new Asm().run(src, "wide.tas").obj]).exe;
  eq(z.machine, "thistle64"); eq(z.mem, 1024 * 1024 * 1024 * 1024);
  r.os.s.writeb("/tmp/wide.txe", codec.pack(z)); r.os.s.chmod("/tmp/wide.txe", 0o755);
  const x = await r.run("/tmp/wide.txe"); eq(x.code, 0); eq(x.err, "");

  const hi = new Link().run([new Asm().run(".text\n.global _start\n_start: li x0, 0\n halt\n", "high.tas").obj], { base: 0x100000000 }).exe;
  eq(hi.entry, 0x100000000, "the host linker truncated a 64-bit image base");
  r.os.s.writeb("/tmp/high.txe", codec.pack(hi)); r.os.s.chmod("/tmp/high.txe", 0o755);
  const y = await r.run("/tmp/high.txe"); eq(y.code, 0); eq(y.err, "");
});

test("native tools assemble, link, inspect and execute", async () => {
  const r = new Rig();
  let x = await r.run("hello.txe");
  eq(x.code, 0); eq(x.out, "Hello from native Thistle assembly!\n");
  x = await r.run("hello32.txe");
  eq(x.code, 0); eq(x.out, "Hello from Thistle 1 compatibility assembly!\n");
  x = await r.run("fib.txe");
  eq(x.code, 0); eq(x.out, "5\n", "native calls or stack frames are broken");

  x = await r.run("as -g --listing /tmp/hello.lst -o /tmp/hello.to /usr/share/thistle/examples/hello.tas");
  eq(x.code, 0); eq(x.err, ""); ok(r.os.s.read("/tmp/hello.lst").includes("sys SYS_write"));
  x = await r.run("ld --Map /tmp/hello.map -o /tmp/hello.txe /tmp/hello.to && /tmp/hello.txe");
  eq(x.code, 0); eq(x.out, "Hello from native Thistle assembly!\n"); ok(r.os.s.read("/tmp/hello.map").includes("entry _start"));
  x = await r.run("file /tmp/hello.to /tmp/hello.txe; nm -g /tmp/hello.to; size /tmp/hello.txe; dis -hr /tmp/hello.to");
  ok(x.out.includes("thistle64 relocatable object")); ok(x.out.includes("native executable")); ok(x.out.includes(" T _start")); ok(x.out.includes("abs64"));

  x = await r.run("as --32 -o /tmp/hello32.to /usr/share/thistle/examples/hello32.tas && ld -o /tmp/hello32.txe /tmp/hello32.to && /tmp/hello32.txe");
  eq(x.code, 0); eq(x.out, "Hello from Thistle 1 compatibility assembly!\n");
});

test("native ABI links objects and performs filesystem syscalls", async () => {
  const r = new Rig();
  r.os.s.write("/tmp/main.tas", `.text
.global main
.extern helper
main:
  call helper
  ret
`);
  r.os.s.write("/tmp/helper.tas", `.text
.global helper
helper:
  li r0, 9
  ret
`);
  let x = await r.run("as -o /tmp/main.to /tmp/main.tas && as -o /tmp/helper.to /tmp/helper.tas && ld -o /tmp/multi.txe /usr/lib/thistle/crt0.to /tmp/main.to /tmp/helper.to && /tmp/multi.txe");
  eq(x.code, 9, "crt0 or cross-object call returned the wrong status"); eq(x.err, "");

  r.os.s.write("/tmp/io.tas", `.include "/usr/include/thistle/sys.tas"
.section .rodata
path: .asciz "/tmp/from-native"
msg: .ascii "written by thistle64\\n"
.equ msg_len, . - msg
.text
.global _start
_start:
  la r0, path
  li r1, O_WRONLY | O_CREAT | O_TRUNC
  li r2, 0o640
  sys SYS_open
  mov r4, r0
  mov r0, r4
  la r1, msg
  li r2, msg_len
  sys SYS_write
  mov r0, r4
  sys SYS_close
  exit 0
`);
  x = await r.run("as -o /tmp/io.to /tmp/io.tas && ld -o /tmp/io.txe /tmp/io.to && /tmp/io.txe && cat /tmp/from-native");
  eq(x.code, 0); eq(x.out, "written by thistle64\n"); eq(r.os.s.stat("/tmp/from-native").mode, 0o640);

  r.os.s.write("/tmp/spawn.tas", `.include "/usr/include/thistle/sys.tas"
.section .rodata
child: .asciz "/bin/true"
.text
.global _start
_start:
  la r0, child
  li r1, 0
  li r2, 0
  sys SYS_spawn
  sys SYS_wait
  sys SYS_exit
`);
  x = await r.run("as -o /tmp/spawn.to /tmp/spawn.tas && ld -o /tmp/spawn.txe /tmp/spawn.to && /tmp/spawn.txe");
  eq(x.code, 0, "native spawn/wait did not use the kernel process table");
});

test("HTTP stack and wget userland", async () => {
  const dev = new TestNet();
  const r = new Rig(new Net(dev));
  let x = await r.run("wget -S http://unit.test/go -O /tmp/payload");
  eq(x.code, 0);
  eq(r.os.s.read("/tmp/payload"), "network payload\n");
  ok(x.err.includes("HTTP 200 OK"));
  eq(dev.seen.length, 2, "redirect was not followed");
  eq(r.os.k.net.calls, 2);
  ok(r.os.s.read("/proc/net/dev").includes("requests 2 failed 0"));

  x = await r.run("wget -qO- http://unit.test/file");
  eq(x.code, 0);
  eq(x.out, "network payload\n");
  eq(x.err, "");

  x = await r.run("wget --post-data=hello -O - http://unit.test/post");
  eq(x.code, 0);
  eq(x.out, "hello");
  eq(dev.seen.at(-1)?.method, "POST");

  x = await r.run("wget --spider http://unit.test/gone");
  eq(x.code, 8, "HTTP failure did not use wget's server-error code");

  x = await r.run("wget --max-size=2 -O /tmp/small http://unit.test/file");
  eq(x.code, 4, "oversized response did not use wget's network-error code");
  let made = true; try { r.os.s.stat("/tmp/small"); } catch { made = false; }
  eq(made, false, "wget left a partial oversized file");

  x = await r.run("wget --max-redirect=0 -O /tmp/loop http://unit.test/go");
  eq(x.code, 4, "redirect limit was ignored");
});

test("devices and procfs are live", async () => {
  const r = new Rig();
  eq(r.os.s.readb("/dev/zero").slice(0, 32).every(x => x === 0), true);
  ok(r.os.s.read("/proc/version").includes("Thistle version"));
  ok(r.os.s.read("/proc/version").includes("Thistle TypeScript"));
  const cat = await r.run("cat /proc/version");
  eq(cat.out.split("\n").filter(Boolean).length, 1, "proc file did not reach EOF");
  await new Promise(ok => setTimeout(ok, 5));
  ok(Number.parseFloat(r.os.s.read("/proc/uptime")) > 0);
  let e: unknown; try { r.os.s.write("/dev/full", "x"); } catch (x) { e = x; }
  ok(e instanceof KErr && e.code === "ENOSPC");
});

test("globs, find and metadata", async () => {
  const r = new Rig();
  await r.run("mkdir /tmp/g; touch /tmp/g/a.txt /tmp/g/b.txt /tmp/g/nope; chmod 640 /tmp/g/a.txt");
  let x = await r.run("echo /tmp/g/*.txt");
  eq(x.out, "/tmp/g/a.txt /tmp/g/b.txt\n");
  x = await r.run("find /tmp/g -name '*.txt' -type f | sort");
  eq(x.out, "/tmp/g/a.txt\n/tmp/g/b.txt\n");
  eq(r.os.s.stat("/tmp/g/a.txt").mode, 0o640);
});

let pass = 0;
for (const [name, fn] of tests) {
  try { await fn(); console.log(`ok ${++pass} - ${name}`); }
  catch (e) { console.error(`not ok ${pass + 1} - ${name}`); throw e; }
}
console.log(`1..${tests.length}`);
