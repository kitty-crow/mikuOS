// This module composes kernel, toolchain or integration-test boundaries and intentionally imports their contracts.
//@cg-expect-warning
import { parseJson } from "../core/json.js";
import type { WorkerReport, SchedulerWorkerData } from "./teto-worker.js";
import assert from "node:assert/strict";
import { hostModule } from "../main/host-module.js";
import { withValue } from "../core/err.js";
import { requireValue } from "../core/err.js";
import { runInNewContext } from "node:vm";
import { boot } from "../main/boot.js";
import { ROOT_IMAGE_VERSION } from "../main/image.js";
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
import { rv64Branch } from "../core/rv64-branch.js";
import { rv64RegisterWordValid, rv64RegisterWordValue, rv64ImmediateWordValid, rv64ImmediateWordValue } from "../core/rv64-word.js";
import { rv64ImmediateOpValid, rv64ImmediateOpValue } from "../core/rv64-immediate-op.js";
import { rv64RegisterValid, rv64RegisterValue } from "../core/rv64-register.js";
import { rv64FloatClass } from "../core/rv64-fclass.js";
import {
  rv64DivideSigned,
  rv64DivideUnsigned,
  rv64MulHighSigned,
  rv64MulHighSignedUnsigned,
  rv64MulHighUnsigned,
  rv64RemainderSigned,
  rv64RemainderUnsigned,
} from "../core/rv64-arithmetic.js";
import {
  rv64CompressedJump,
  rv64ImmediateB,
  rv64ImmediateI,
  rv64ImmediateJ,
  rv64ImmediateS,
  rv64ImmediateU,
} from "../vm/rv64-immediate.js";
import { localSessionPlan, superviseLocalLogin } from "../main/session.js";
import { WebSession } from "../main/websession.js";
import { WebTree } from "../main/webtree.js";
import { directMemory } from "../teto/memory.js";
import {
  thistleHartGetX as tetoHartGetX,
  thistleHartGetF as tetoHartGetF,
  thistleHartInit as tetoHartInit,
  thistleHartImageFloor as tetoHartImageFloor,
  thistleHartMetric as tetoHartMetric,
  thistleHartPc as tetoHartPc,
  thistleHartStackBottom as tetoHartStackBottom,
  thistleHartStackPointer as tetoHartStackPointer,
  thistleHartBreak as tetoHartBreak,
  thistleHartVirtualTop as tetoHartVirtualTop,
  thistleHartSetX as tetoHartSetX,
  thistleHartSetPc as tetoHartSetPc,
  thistleHartStatus as tetoHartStatus,
  thistleGuestPage as tetoGuestPage,
  thistleImageRelease as tetoImageRelease,
  thistleImageReserve as tetoImageReserve,
  thistleImageBegin as tetoImageBegin,
  thistleImageSegment as tetoImageSegment,
  thistleImageFinish as tetoImageFinish,
  thistleKernelInit as tetoKernelInit,
  thistleProcessInit as tetoProcessInit,
  thistleProcessCount as tetoProcessCount,
  thistleProcessMapCount as tetoProcessMapCount,
  thistleProcessSegmentCount as tetoProcessSegmentCount,
  thistleProcessSetGroup as tetoProcessSetGroup,
  thistleResolvePath as tetoResolvePath,
  thistleAccessInode as tetoAccessInode,
  thistleOpenPath as tetoOpenPath,
  thistleReadDescriptor as tetoReadDescriptor,
  thistleSeekDescriptor as tetoSeekDescriptor,
  thistleCloseDescriptor as tetoCloseDescriptor,
  thistleDescriptorKind as tetoDescriptorKind,
  thistleDescriptorInode as tetoDescriptorInode,
  thistleDescriptorOffset as tetoDescriptorOffset,
  thistleRunRv64Batch as tetoRunRv64Batch,
} from "../teto/kernel.js";
import { thistleLoadThx as tetoLoadThx } from "../teto/thx.js";
import { thistleBuildInitialStack as tetoBuildInitialStack } from "../teto/start.js";
import { serializeTetoVfs } from "../teto/vfs-host.js";
import {
  thistleLoadVfs as tetoLoadVfs,
  thistleVfsDentryCount as tetoVfsDentryCount,
  thistleVfsFileSize as tetoVfsFileSize,
  thistleVfsGid as tetoVfsGid,
  thistleVfsInodeCount as tetoVfsInodeCount,
  thistleVfsKind as tetoVfsKind,
  thistleVfsLoaded as tetoVfsLoaded,
  thistleVfsLookup as tetoVfsLookup,
  thistleVfsMode as tetoVfsMode,
  thistleVfsNlink as tetoVfsNlink,
  thistleVfsReadData as tetoVfsReadData,
  thistleVfsRoot as tetoVfsRoot,
  thistleVfsUid as tetoVfsUid,
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
  THISTLE_BATCH_EXITED as TETO_BATCH_EXITED,
  THISTLE_BATCH_BUDGET as TETO_BATCH_BUDGET,
  THISTLE_BATCH_FAULT as TETO_BATCH_FAULT,
  THISTLE_BATCH_SYSCALL as TETO_BATCH_SYSCALL,
  THISTLE_HART_EXITED as TETO_HART_EXITED,
  THISTLE_HART_BASE as TETO_HART_BASE,
  THISTLE_HART_FAULTED as TETO_HART_FAULTED,
  THISTLE_FAULT_MEMORY as TETO_FAULT_MEMORY,
  THISTLE_THX_CHECKSUM as TETO_THX_CHECKSUM,
  THISTLE_THX_OK as TETO_THX_OK,
  THISTLE_START_FORMAT as TETO_START_FORMAT,
  THISTLE_STARTUP_MAGIC as TETO_STARTUP_MAGIC,
  THISTLE_START_OK as TETO_START_OK,
  THISTLE_VFS_CHECKSUM as TETO_VFS_CHECKSUM,
  THISTLE_VFS_KIND_DIRECTORY as TETO_VFS_KIND_DIRECTORY,
  THISTLE_VFS_KIND_FILE as TETO_VFS_KIND_FILE,
  THISTLE_VFS_KIND_LINK as TETO_VFS_KIND_LINK,
  THISTLE_VFS_OK as TETO_VFS_OK,
  THISTLE_FD_DIRECTORY as TETO_FD_DIRECTORY,
  THISTLE_FD_EMPTY as TETO_FD_EMPTY,
  THISTLE_FD_FILE as TETO_FD_FILE,
  THISTLE_SEGMENT_EXECUTE as TETO_SEGMENT_EXECUTE,
  THISTLE_SEGMENT_READ as TETO_SEGMENT_READ,
  THISTLE_SEGMENT_WRITE as TETO_SEGMENT_WRITE,
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

  constructor(net: Net | null = null, setId = false, teto: TetoImageProvider | null = null, kernelMode: KernelMode | null = null) {
    this.os = boot({"halt": null, "tree": null, "requireTree": null, "pkg": null, "config": null, "account": null, "onBootProgress": null, put: (s, ch: Ch) => { if (ch === "err") this.err += s; else this.out += s; },
      setId,
      teto,
      kernelMode,
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
  async pull(): Promise<TreeEnt[] | null> { return withValue(this.ent ?? null, value => value.map(x => ({ ...x, ...(x.data ? {data: x.data.slice() } : {}) }))) ?? null; }
  async push(ent: TreeEnt[], imageVersion: number | null = this.imageVersion): Promise<void> {
    imageVersion ??= this.imageVersion;
    this.ent = ent.map(x => ({ ...x, ...(x.data ? {data: x.data.slice() } : {}) }));
    this.imageVersion = imageVersion;
  }
}

const tests: Array<[string, () => void | Promise<void>]> = [];
const test = (name: string, fn: () => void | Promise<void>): void => { tests.push([name, fn]); };
const show = <T>(value: T): string => JSON.stringify(value, <V>(_key: string, item: V) => typeof item === "bigint" ? `${item}n` : item) ?? String(value);

test("Thistle preserves its working interpreter without substituting Teto source", async () => {
  const original = boot({"halt": null, "tree": null, "requireTree": null, "pkg": null, "config": null, "account": null, "setId": null, "teto": null, "onBootProgress": null, put: () => {}, kernelMode: "thistle" }, null);
  await original.ready;
  assert.equal(original.p.env.has("THISTLE_RV_CORE"), false);
  assert.equal(original.p.env.has("THISTLE_PORTABLE_PROBE"), false);
  assert.equal(original.k.executionCore, "Thistle TypeScript");
});

test("canonical RV64 FCLASS distinguishes every IEEE-754 category", () => {
  const values: Array<[bigint, number, bigint]> = [
    [0xff800000n, 32, 1n], [0xbf800000n, 32, 2n],
    [0x80000001n, 32, 4n], [0x80000000n, 32, 8n],
    [0n, 32, 16n], [1n, 32, 32n],
    [0x3f800000n, 32, 64n], [0x7f800000n, 32, 128n],
    [0x7f800001n, 32, 256n], [0x7fc00000n, 32, 512n],
    [0xfff0000000000000n, 64, 1n], [0xbff0000000000000n, 64, 2n],
    [0x8000000000000001n, 64, 4n], [0x8000000000000000n, 64, 8n],
    [0n, 64, 16n], [1n, 64, 32n],
    [0x3ff0000000000000n, 64, 64n], [0x7ff0000000000000n, 64, 128n],
    [0x7ff0000000000001n, 64, 256n], [0x7ff8000000000000n, 64, 512n],
  ];
  for (const [raw, bits, category] of values) assert.equal(rv64FloatClass(raw, bits), category);
});

test("canonical RV64 word operations preserve 32-bit sign extension and legality", () => {
  const signed32 = (n: bigint): bigint => BigInt.asIntN(32, n);
  const unsigned32 = (n: bigint): bigint => BigInt.asUintN(32, n);
  const values = [-(1n << 63n), -2147483648n, -1n, 0n, 1n, 2147483647n, (1n << 63n) - 1n];
  for (const top of [0, 1, 0x20, 7]) for (let funct3 = 0; funct3 < 8; funct3++) {
    const valid = top === 1 ? [0, 4, 5, 6, 7].includes(funct3) :
      (funct3 === 0 || funct3 === 5) ? top === 0 || top === 0x20 : funct3 === 1 && top === 0;
    assert.equal(rv64RegisterWordValid(funct3, top), valid ? 1 : 0);
    if (!valid) continue;
    for (const left of values) for (const right of values) {
      const actual = rv64RegisterWordValue(funct3, top, left, right);
      assert.equal(actual, signed32(actual), "register word result is not sign-extended");
      const shift = unsigned32(right) & 31n;
      switch (true) {
case !!(top === 1 && funct3 === 0): { assert.equal(actual, signed32(signed32(left) * signed32(right)));
break; }
case !!(top !== 1 && funct3 === 0): { assert.equal(actual, signed32(top === 0 ? left + right : left - right));
break; }
case !!(top !== 1 && funct3 === 1): { assert.equal(actual, signed32(signed32(left) << shift));
break; }
case !!(top !== 1 && funct3 === 5): { assert.equal(actual, signed32(top === 0 ? unsigned32(left) >> shift : signed32(left) >> shift));
break; }
}
    }
  }
  for (const instruction of [0, -1, 0x40005013, 0x00001013, 0x00105013, 0x80000013]) {
    for (let funct3 = 0; funct3 < 8; funct3++) {
      const top = instruction >>> 25;
      const valid = funct3 === 0 || funct3 === 1 && top === 0 || funct3 === 5 && (top === 0 || top === 0x20);
      assert.equal(rv64ImmediateWordValid(funct3, instruction), valid ? 1 : 0);
      if (!valid) continue;
      for (const left of values) assert.equal(rv64ImmediateWordValue(funct3, instruction, left),
        signed32(rv64ImmediateWordValue(funct3, instruction, left)));
    }
  }
});

test("canonical RV64 immediate instructions preserve signed and unsigned values", () => {
  const signed = (n: bigint): bigint => BigInt.asIntN(64, n);
  const unsigned = (n: bigint): bigint => BigInt.asUintN(64, n);
  const values = [-(1n << 63n), -1n, 0n, 1n, (1n << 63n) - 1n];
  for (const instruction of [0, 0xffffffff, 0x40005013, 0x00001013, 0x00105013, 0x80000013, 0x40000013]) {
    for (let funct3 = 0; funct3 < 8; funct3++) {
      const top = instruction >>> 26;
      const valid = funct3 === 1 ? top === 0 : funct3 === 5 ? top === 0 || top === 0x10 : true;
      assert.equal(rv64ImmediateOpValid(funct3, instruction), valid ? 1 : 0);
      if (!valid) continue;
      const immediate = BigInt.asIntN(12, BigInt(instruction >>> 20));
      const shift = BigInt(instruction >>> 20 & 63);
      for (const left of values) {
        const actual = rv64ImmediateOpValue(funct3, instruction, left);
        assert.equal(actual, signed(actual), "immediate result not truncated to 64 bits");
        switch (true) {
case !!(funct3 === 0): { assert.equal(actual, signed(left + immediate));
break; }
case !!(funct3 === 1): { assert.equal(actual, signed(unsigned(left) << shift));
break; }
case !!(funct3 === 2): { assert.equal(actual, left < immediate ? 1n : 0n);
break; }
case !!(funct3 === 3): { assert.equal(actual, unsigned(left) < unsigned(immediate) ? 1n : 0n);
break; }
case !!(funct3 === 4): { assert.equal(actual, left ^ immediate);
break; }
case !!(funct3 === 5): { assert.equal(actual, signed(top === 0 ? unsigned(left) >> shift : left >> shift));
break; }
case !!(funct3 === 6): { assert.equal(actual, left | immediate);
break; }
case !!(funct3 === 7): { assert.equal(actual, left & immediate);
break; }
}
      }
    }
  }
});

test("canonical RV64 register operations preserve validity and 64-bit results", () => {
  const values = [-(1n << 63n), -(1n << 31n), -1n, 0n, 1n, 2n, (1n << 31n), (1n << 63n) - 1n];
  const signed = (n: bigint): bigint => BigInt.asIntN(64, n);
  const unsigned = (n: bigint): bigint => BigInt.asUintN(64, n);
  for (const top of [0, 1, 0x20, 2, 0xff]) for (let funct3 = 0; funct3 < 8; funct3++) {
    const valid = top === 0 || top === 1 || top === 0x20 && (funct3 === 0 || funct3 === 5);
    assert.equal(rv64RegisterValid(funct3, top), valid ? 1 : 0);
    if (!valid) continue;
    for (const left of values) for (const right of values) {
      const actual = rv64RegisterValue(funct3, top, left, right);
      assert.equal(actual, signed(actual), "register operation did not truncate to 64 bits");
      if (top !== 0 && top !== 0x20) continue;
      const shift = unsigned(right) & 63n;
      if (funct3 === 0) assert.equal(actual, signed(top === 0 ? left + right : left - right));
      if (funct3 === 1) assert.equal(actual, signed(unsigned(left) << shift));
      if (funct3 === 2) assert.equal(actual, left < right ? 1n : 0n);
      if (funct3 === 3) assert.equal(actual, unsigned(left) < unsigned(right) ? 1n : 0n);
      if (funct3 === 4) assert.equal(actual, left ^ right);
      if (funct3 === 5) assert.equal(actual, signed(top === 0 ? unsigned(left) >> shift : left >> shift));
      if (funct3 === 6) assert.equal(actual, left | right);
      if (funct3 === 7) assert.equal(actual, left & right);
    }
  }
});

test("canonical Thistle RV64 multiplication and M-extension division preserve edge cases", () => {
  const low = -(1n << 63n);
  const high = (1n << 63n) - 1n;
  const unsigned = (n: bigint): bigint => BigInt.asUintN(64, n);
  const signed = (n: bigint): bigint => BigInt.asIntN(64, n);
  const values = [low, low + 1n, -65537n, -2n, -1n, 0n, 1n, 2n, 65537n, high - 1n, high];
  for (const left of values) for (const right of values) {
    assert.equal(rv64MulHighUnsigned(unsigned(left), unsigned(right)),
      unsigned(unsigned(left) * unsigned(right) >> 64n));
    assert.equal(rv64MulHighSigned(left, right), signed(left * right >> 64n));
    assert.equal(rv64MulHighSignedUnsigned(left, unsigned(right)), signed(left * unsigned(right) >> 64n));
    for (const bits of [32, 64]) {
      const a = BigInt.asIntN(bits, left);
      const b = BigInt.asIntN(bits, right);
      const ua = BigInt.asUintN(bits, left);
      const ub = BigInt.asUintN(bits, right);
      const min = -(1n << BigInt(bits - 1));
      const divide = b === 0n ? -1n : a === min && b === -1n ? min : a / b;
      const remainder = b === 0n ? a : a === min && b === -1n ? 0n : a % b;
      assert.equal(rv64DivideSigned(left, right, bits), BigInt.asIntN(bits, divide));
      assert.equal(rv64RemainderSigned(left, right, bits), BigInt.asIntN(bits, remainder));
      assert.equal(rv64DivideUnsigned(unsigned(left), unsigned(right), bits),
        ub === 0n ? (1n << BigInt(bits)) - 1n : ua / ub);
      assert.equal(rv64RemainderUnsigned(unsigned(left), unsigned(right), bits),
        ub === 0n ? ua : ua % ub);
    }
  }
});

test("canonical RV64 immediate decoders retain Thistle's signed arithmetic", () => {
  const original = (value: number, width: number): number =>
    Number(BigInt.asIntN(width, BigInt(value)));
  let word = 0x12345678;
  const instructions = [0, -1, 0x80000000, 0x7fffffff, 0x000fffff, 0xfff00000, 0x00000800];
  for (let index = 0; index < 10000; index++) {
    word = Math.imul(word, 1664525) + 1013904223 | 0;
    instructions.push(word);
  }
  for (const instruction of instructions) {
    assert.equal(rv64ImmediateI(instruction), original(instruction >>> 20, 12));
    assert.equal(rv64ImmediateS(instruction), original((instruction >>> 25) << 5 | instruction >>> 7 & 31, 12));
    assert.equal(rv64ImmediateB(instruction), original((instruction >>> 31) << 12 | (instruction >>> 7 & 1) << 11 |
      (instruction >>> 25 & 63) << 5 | (instruction >>> 8 & 15) << 1, 13));
    assert.equal(rv64ImmediateU(instruction), original(instruction & 0xfffff000, 32));
    assert.equal(rv64ImmediateJ(instruction), original((instruction >>> 31) << 20 | (instruction >>> 12 & 255) << 12 |
      (instruction >>> 20 & 1) << 11 | (instruction >>> 21 & 1023) << 1, 21));
    assert.equal(rv64CompressedJump(instruction), original((instruction >>> 1 & 0x800) | (instruction << 2 & 0x400) |
      (instruction >>> 1 & 0x300) | (instruction << 1 & 0x80) | (instruction >>> 1 & 0x40) |
      (instruction << 3 & 0x20) | (instruction >>> 7 & 0x10) | (instruction >>> 2 & 0xe), 12));
  }
});

test("Thistle's shared RV64 branches preserve 64-bit signed and unsigned conditions", () => {
  const values = [
    -(1n << 63n), -2n, -1n, 0n, 1n, 2n, (1n << 63n) - 1n,
  ];
  for (const left of values) {
    for (const right of values) {
      const signedLess = left < right;
      const unsignedLess = BigInt.asUintN(64, left) < BigInt.asUintN(64, right);
      assert.equal(rv64Branch(0, left, right), Number(left === right));
      assert.equal(rv64Branch(1, left, right), Number(left !== right));
      assert.equal(rv64Branch(4, left, right), Number(signedLess));
      assert.equal(rv64Branch(5, left, right), Number(!signedLess));
      assert.equal(rv64Branch(6, left, right), Number(unsignedLess));
      assert.equal(rv64Branch(7, left, right), Number(!unsignedLess));
    }
  }
  for (const funct3 of [2, 3]) assert.equal(rv64Branch(funct3, 0n, 0n), -1);
});

test("thistle64 byte stores keep low bits above JS integer precision", () => {
  const m = new Mem64(1024n * 1024n, 65536);
  m.set8(0x10000n, 0x00bf762de49b5209n);
  assert.equal(m.u8(0x10000n), 9);
});

test("thistle64 scalar memory handles sparse and page-crossing values", () => {
  const m = new Mem64(1024n * 1024n, 8 * 65536);
  m.set32(0x10020n, 0x89abcdef); assert.equal(m.u32(0x10020n), 0x89abcdef);
  m.set64(0x10028n, 0xfedcba9876543210n); assert.equal(m.u64(0x10028n), 0xfedcba9876543210n);
  m.set16(0x1ffffn, 0xa1b2); assert.equal(m.u16(0x1ffffn), 0xa1b2);
  m.set32(0x2fffen, 0xc3d4e5f6); assert.equal(m.u32(0x2fffen), 0xc3d4e5f6);
  m.set64(0x3fffcn, 0x1020304050607080n); assert.equal(m.u64(0x3fffcn), 0x1020304050607080n);
  m.setF64(0x4fffcn, -12.5); assert.equal(m.f64(0x4fffcn), -12.5);
  m.setF32(0x60000n, -0); assert.ok(Object.is(m.f32(0x60000n), -0), "negative zero lost its sign");
});

test("thistle64 releases full pages and clears partial unmaps", () => {
  const m = new Mem64(1024n * 1024n, 4 * 65536);
  m.set32(0x10000n, 0x11223344); m.set32(0x20010n, 0x55667788);
  assert.equal(m.used, 2 * 65536);
  m.drop(0x10000n, 65536); assert.equal(m.used, 65536); assert.equal(m.u32(0x10000n), 0);
  m.drop(0x20011n, 2); assert.equal(m.used, 65536); assert.equal(m.u32(0x20010n), 0x55000088);
});

test("RV64 shared mappings flush on msync, munmap and exit", async () => {
  interface HFs { readFile(p: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
  const r = new Rig(), bin = new Uint8Array(await fs.readFile(new URL("../../assets/mmap-shared.thx", import.meta.url)));
  r.os.load("mmap-shared.thx", bin);
  const x = await r.run("/tmp/mmap-shared.thx");
  assert.equal(x.code, 0); assert.equal(x.err, "");
  const b = r.os.s.readb("/tmp/mmap-shared.out"), at = (n: number, s: string): void => assert.equal(dec(b.slice(n, n + s.length)), s);
  at(0, "flushed-at-exit"); at(4096, "flushed-by-msync"); at(8192, "flushed-by-munmap");
});

test(".thx and .39 are byte-identical header-selected THX aliases", async () => {
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
  const [assetThx, asset39, webThx, web39] = await Promise.all([
    fs.readFile(new URL("../../assets/hello.thx", import.meta.url)),
    fs.readFile(new URL("../../assets/hello.39", import.meta.url)),
    fs.readFile(new URL("../../dist/web/assets/hello.thx", import.meta.url)),
    fs.readFile(new URL("../../dist/web/assets/hello.39", import.meta.url)),
  ]);
  const same = (a: Uint8Array, b: Uint8Array): boolean =>
    a.length === b.length && a.every((value, index) => value === (b[index] ?? null));
  assert.ok(same(assetThx, asset39), "generated .thx and .39 assets differ");
  assert.ok(same(assetThx, webThx) && same(asset39, web39), "static packaging changed THX alias bytes");
  assert.equal(dec(asset39.slice(0, 4)), "THX2");

  const r = new Rig(), s = r.os.s;
  const installedThx = s.readb("/usr/bin/hello.thx");
  const installed39 = s.readb("/usr/bin/hello.39");
  assert.ok(same(installedThx, installed39), "installed .thx and .39 aliases resolve to different bytes");
  assert.equal(s.stat("/usr/bin/hello.thx").mode, 0o755);
  assert.equal(s.stat("/usr/bin/hello.39").mode, 0o755);

  const thx = await r.run("/usr/bin/hello.thx");
  const thirtyNine = await r.run("/usr/bin/hello.39");
  assert.equal(`${thx.code}:${thx.out}:${thx.err}`, `${thirtyNine.code}:${thirtyNine.out}:${thirtyNine.err}`);
  assert.equal(thx.code, 0);

  s.writeb("/tmp/renamed.thx", installedThx); s.chmod("/tmp/renamed.thx", 0o755);
  let result = await r.run("mv /tmp/renamed.thx /tmp/renamed.39; /tmp/renamed.39");
  assert.equal(result.code, 0); assert.equal(result.out, thx.out);
  result = await r.run("mv /tmp/renamed.39 /tmp/renamed.thx; /tmp/renamed.thx");
  assert.equal(result.code, 0); assert.equal(result.out, thx.out);

  s.writeb("/tmp/no-extension", installedThx); s.chmod("/tmp/no-extension", 0o755);
  result = await r.run("/tmp/no-extension");
  assert.equal(result.code, 0, "a valid THX header depended on a filename extension");
  s.write("/tmp/not-thx.39", "not a THX executable\n", false, 0o755);
  s.chmod("/tmp/not-thx.39", 0o755);
  result = await r.run("/tmp/not-thx.39");
  assert.equal(result.code, 126, "the .39 suffix bypassed THX header validation");

  result = await r.run("ld -o /tmp/linked.39 /usr/share/thistle/examples/hello.to && /tmp/linked.39");
  assert.equal(result.code, 0); assert.equal(result.out, thx.out);
  const completion = r.os.complete("/usr/bin/hello.3");
  assert.equal(completion.line, "/usr/bin/hello.39 ");
  assert.equal(completion.list.join("\n"), "/usr/bin/hello.39");
});

test("thsh completion includes executable PATH entries and excludes nonexecutables", () => {
  const r = new Rig(), sys = r.os.s;
  sys.mkfile("/tmp/kittyprompt-test", "#!/bin/thsh\n", 0o755);
  sys.mkfile("/tmp/kittyprompt-private", "not executable", 0o644);
  sys.setenv("PATH", "/tmp:/bin");
  const hit = r.os.complete("kittyprompt-te");
  assert.equal(hit.line, "kittyprompt-test ");
  assert.equal(hit.list.join(","), "kittyprompt-test");
  assert.equal(r.os.complete("kittyprompt-private").list.length, 0,
    "non-executable files must not appear in completion");

  sys.setenv("PATH", "/bin");
  assert.equal(r.os.complete("kittyprompt-te").list.length, 0,
    "commands outside PATH must not be suggested");

  sys.setenv("PATH", "/tmp:/tmp:/bin");
  assert.equal(r.os.complete("kittyprompt-te").list.length, 1,
    "repeated PATH directories must not duplicate suggestions");
});

test("generated Teto executes bounded RV64 batches with direct-source parity", async () => {
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
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
    assert.ok(at < 0xfffffffe, "direct Teto image reservation failed");
    memory.bytes.set(bytes, at);
    assert.equal(tetoImageBegin(memory, hart, virtualTop, address, 0n, 0, 0), TETO_THX_OK);
    assert.equal(tetoImageSegment(memory, hart, 0x11110000 + hart, 5, address, BigInt(bytes.length),
      TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, at, bytes.length), TETO_THX_OK);
    if (data !== 0n) assert.equal(tetoImageSegment(memory, hart, 0x22220000 + hart, 5, data, 65536n,
      TETO_SEGMENT_READ | TETO_SEGMENT_WRITE, at, 0), TETO_THX_OK);
    assert.equal(tetoImageFinish(memory, hart, bytes.length), TETO_THX_OK);
    assert.equal(tetoImageRelease(memory, at, bytes.length), TETO_THX_OK);
  };

  const direct = directMemory(64 * 1024 * 1024);
  assert.equal(tetoKernelInit(direct, 2, false), 0);
  assert.equal(tetoHartInit(direct, 0, virtualTop, pc), 0);
  assert.equal(tetoProcessInit(direct, 0, 42, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
  assert.equal(tetoProcessSetGroup(direct, 0, 0, 1000), 0);
  assert.equal(tetoProcessSetGroup(direct, 0, 1, 1000), 0);
  assert.equal(tetoProcessSetGroup(direct, 0, 2, 39), 0);
  assert.equal(tetoProcessCount(direct), 1);
  installDirect(direct, 0, pc, program);
  assert.equal(tetoRunRv64Batch(direct, 0, 4096, 123456n, 0), TETO_BATCH_EXITED);
  assert.equal(tetoHartGetX(direct, 0, 5), 1000n);
  assert.equal(tetoHartGetX(direct, 0, 6), 42n);
  assert.equal(tetoHartGetX(direct, 0, 7), 1000n);
  assert.equal(tetoHartGetX(direct, 0, 10), 1000n);
  assert.equal(tetoHartGetX(direct, 0, 17), 93n);
  assert.equal(tetoHartMetric(direct, 0, H_INSTRUCTIONS), 2011n);
  assert.equal(tetoHartMetric(direct, 0, H_INTERNAL_SYSCALLS), 3n);
  assert.equal(tetoHartMetric(direct, 0, H_HOST_REQUESTS), 0n);
  assert.equal(tetoHartMetric(direct, 0, H_FALLBACK_SYSCALLS), 0n);
  assert.equal(tetoHartMetric(direct, 0, H_HOST_TO_WASM), 1n);
  assert.equal(tetoHartMetric(direct, 0, H_WASM_TO_HOST), 1n);

  const wasmBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const wasm = await loadTeto(wasmBytes);
  const wasmMemory = new Uint8Array(wasm.memory.buffer);
  const installWasm = (runtime: typeof wasm, hart: number, address: bigint, bytes: Uint8Array, data = 0n): void => {
    const at = runtime.exports.tetoImageReserve(0, bytes.length) >>> 0;
    assert.ok(at < 0xfffffffe, "WASM Teto image reservation failed");
    new Uint8Array(runtime.memory.buffer).set(bytes, at);
    assert.equal(runtime.exports.tetoImageBegin(0, hart, virtualTop, address, 0n, 0, 0), TETO_THX_OK);
    assert.equal(runtime.exports.tetoImageSegment(0, hart, 0x11110000 + hart, 5, address, BigInt(bytes.length),
      TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, at, bytes.length), TETO_THX_OK);
    if (data !== 0n) assert.equal(runtime.exports.tetoImageSegment(0, hart, 0x22220000 + hart, 5, data, 65536n,
      TETO_SEGMENT_READ | TETO_SEGMENT_WRITE, at, 0), TETO_THX_OK);
    assert.equal(runtime.exports.tetoImageFinish(0, hart, bytes.length), TETO_THX_OK);
    assert.equal(runtime.exports.tetoImageRelease(0, at, bytes.length), TETO_THX_OK);
  };
  assert.equal(wasm.exports.tetoKernelInit(0, 2, 0), 0);
  assert.equal(wasm.exports.tetoHartInit(0, 0, virtualTop, pc), 0);
  assert.equal(wasm.exports.tetoProcessInit(0, 0, 42, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
  assert.equal(wasm.exports.tetoProcessSetGroup(0, 0, 0, 1000), 0);
  assert.equal(wasm.exports.tetoProcessSetGroup(0, 0, 1, 1000), 0);
  assert.equal(wasm.exports.tetoProcessSetGroup(0, 0, 2, 39), 0);
  assert.equal(wasm.exports.tetoProcessCount(0), 1);
  installWasm(wasm, 0, pc, program);
  assert.equal(wasm.exports.tetoRunRv64Batch(0, 0, 4096, 123456n, 0), TETO_BATCH_EXITED);
  for (let register = 0; register < 32; register++) {
    assert.equal(wasm.exports.tetoHartGetX(0, 0, register), tetoHartGetX(direct, 0, register), `Teto x${register} diverged from direct source`);
  }
  assert.equal(wasm.exports.tetoHartPc(0, 0), pc + 0x34n);
  assert.equal(wasm.exports.tetoHartMetric(0, 0, H_INSTRUCTIONS), 2011n);
  assert.equal(wasm.exports.tetoHartMetric(0, 0, H_INTERNAL_SYSCALLS), 3n);
  assert.equal(wasm.exports.tetoHartMetric(0, 0, H_HOST_REQUESTS), 0n);
  assert.equal(wasm.exports.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
  assert.equal(wasm.exports.tetoHartMetric(0, 0, H_HOST_TO_WASM), 1n);
  assert.equal(wasm.exports.tetoHartMetric(0, 0, H_WASM_TO_HOST), 1n);
  assert.ok(wasm.exports.tetoHartMetric(0, 0, H_INSTRUCTIONS) / wasm.exports.tetoHartMetric(0, 0, H_WASM_TO_HOST) > 1000n,
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
  assert.equal(tetoHartInit(direct, 0, virtualTop, floatingPc), 0);
  assert.equal(tetoProcessInit(direct, 0, 44, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
  installDirect(direct, 0, floatingPc, floatingProgram, dataAddress);
  assert.equal(tetoHartSetX(direct, 0, 1, bits(1.5)), 0);
  assert.equal(tetoHartSetX(direct, 0, 2, bits(2.25)), 0);
  assert.equal(tetoHartSetX(direct, 0, 7, dataAddress), 0);
  assert.equal(tetoRunRv64Batch(direct, 0, 64, 123456n, 0), TETO_BATCH_SYSCALL);
  assert.equal(tetoHartGetF(direct, 0, 3), bits(3.75));
  assert.equal(tetoHartGetX(direct, 0, 6), bits(3.75));
  assert.equal(tetoHartGetX(direct, 0, 8), bits(3.75));

  assert.equal(wasm.exports.tetoHartInit(0, 0, virtualTop, floatingPc), 0);
  assert.equal(wasm.exports.tetoProcessInit(0, 0, 45, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
  installWasm(wasm, 0, floatingPc, floatingProgram, dataAddress);
  assert.equal(wasm.exports.tetoHartSetX(0, 0, 1, bits(1.5)), 0);
  assert.equal(wasm.exports.tetoHartSetX(0, 0, 2, bits(2.25)), 0);
  assert.equal(wasm.exports.tetoHartSetX(0, 0, 7, dataAddress), 0);
  assert.equal(wasm.exports.tetoRunRv64Batch(0, 0, 64, 123456n, 0), TETO_BATCH_SYSCALL);
  assert.equal(wasm.exports.tetoHartGetF(0, 0, 3), tetoHartGetF(direct, 0, 3));
  assert.equal(wasm.exports.tetoHartGetX(0, 0, 6), tetoHartGetX(direct, 0, 6));
  assert.equal(wasm.exports.tetoHartGetX(0, 0, 8), tetoHartGetX(direct, 0, 8));
  const dataPage = wasm.exports.tetoGuestPage(0, 0, dataAddress, 0);
  assert.equal(new DataView(wasm.memory.buffer).getBigUint64(dataPage + Number(dataAddress & 0xffffn), true), bits(3.75));

  const threadedBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto-threads.wasm", import.meta.url)));
  const first = await loadTeto(threadedBytes, {"memory": null, "initialPages": null, "maximumPages": null,  threaded: true });
  const second = await loadTeto(threadedBytes, {"initialPages": null, "maximumPages": null,  threaded: true, memory: first.memory });
  assert.equal(first.exports.tetoKernelInit(0, 2, 1), 0);
  assert.equal(first.exports.tetoHartInit(0, 0, virtualTop, pc), 0);
  assert.equal(first.exports.tetoHartInit(0, 1, virtualTop, pc), 0);
  assert.equal(first.exports.tetoProcessInit(0, 0, 42, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
  assert.ok(second.exports.tetoProcessInit(0, 1, 42, 1, 1001, 1001, 1001, 1001, 1001, 1001) !== 0,
    "shared Teto process table accepted a duplicate PID");
  assert.equal(first.exports.tetoProcessInit(0, 1, 43, 1, 1001, 1001, 1001, 1001, 1001, 1001), 0);
  assert.equal(second.exports.tetoProcessCount(0), 2, "shared Teto instances did not observe one process table");
  installWasm(first, 0, pc, program);
  installWasm(first, 1, pc, program);
  assert.equal(first.exports.tetoRunRv64Batch(0, 0, 4096, 123456n, 0), TETO_BATCH_EXITED);
  assert.equal(second.exports.tetoRunRv64Batch(0, 1, 4096, 123456n, 1), TETO_BATCH_EXITED);
  assert.equal(first.exports.tetoHartGetX(0, 1, 10), 1000n, "shared Teto instances did not observe one coherent hart table");
  assert.equal(new DataView(first.memory.buffer).getInt32(C_ACTIVE_WORKERS, true), 0, "Teto leaked an active worker count");

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
  const parallel = await loadTeto(threadedBytes, {"memory": null, "initialPages": null, "maximumPages": null,  threaded: true });
  assert.equal(parallel.exports.tetoKernelInit(0, 2, 1), 0);
  for (let hart = 0; hart < 2; hart++) {
    assert.equal(parallel.exports.tetoHartInit(0, hart, virtualTop, pc), 0);
    assert.equal(parallel.exports.tetoProcessInit(0, hart, 50 + hart, 1, 1000 + hart, 1000 + hart, 1000 + hart,
      1000 + hart, 1000 + hart, 1000 + hart), 0);
    installWasm(parallel, hart, pc, parallelProgram);
  }

  interface HostWorker {
    once(event: "message", listener: (value: WorkerReport) => void): HostWorker;
    once(event: "error", listener: (value: Error) => void): HostWorker;
  }
  interface HostWorkerCtor {
    new(url: URL, options: { workerData: SchedulerWorkerData }): HostWorker;
  }
  const workerThreads = await hostModule("node:worker_threads") as { Worker: HostWorkerCtor };
  const runWorker = (worker: number): Promise<WorkerReport> => new Promise((resolve, reject) => {
    const thread = new workerThreads.Worker(new URL("./teto-worker.js", import.meta.url), {
      workerData: { bytes: threadedBytes, memory: parallel.memory, worker, budget: 8192 },
    });
    thread.once("message", value => resolve(value as WorkerReport));
    thread.once("error", value => reject(value instanceof Error ? value : new Error(String(value))));
  });
  const reports = await Promise.all([runWorker(0), runWorker(1)]);
  assert.ok(reports.every(report => report.terminal === 0), `Teto scheduler worker failed: ${show(reports)}`);
  assert.ok(reports.every(report => report.claims > 0), `a Teto worker executed no scheduled batch: ${show(reports)}`);
  assert.equal(parallel.exports.tetoHartStatus(0, 0), TETO_HART_EXITED);
  assert.equal(parallel.exports.tetoHartStatus(0, 1), TETO_HART_EXITED);
  assert.ok(parallel.exports.tetoWorkerMetric(0, 0, W_BATCHES) > 0n);
  assert.ok(parallel.exports.tetoWorkerMetric(0, 1, W_BATCHES) > 0n);
  assert.ok(parallel.exports.tetoWorkerMetric(0, 0, W_INSTRUCTIONS) > 0n);
  assert.ok(parallel.exports.tetoWorkerMetric(0, 1, W_INSTRUCTIONS) > 0n);
  assert.equal(parallel.exports.tetoProcessCount(0), 2);
  assert.equal(new DataView(parallel.memory.buffer).getInt32(C_ACTIVE_WORKERS, true), 0, "parallel Teto leaked an active worker count");
});

test("Teto enforces executable, readable and writable guest mappings", async () => {
  type ProtectionCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoImageReserve" |
    "tetoImageRelease" | "tetoImageBegin" | "tetoImageSegment" | "tetoImageFinish" |
    "tetoBuildInitialStack" |
    "tetoHartSetX" | "tetoHartGetX" | "tetoHartSetPc" | "tetoHartStatus" | "tetoGuestPage" |
    "tetoRunRv64Batch">;
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
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
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
    tetoImageBegin: (_memory, hart, top, entry, phdr, phent, phnum) =>
      tetoImageBegin(sourceMemory, hart, top, entry, phdr, phent, phnum),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
    tetoImageSegment: (_memory, hart, nameHash, nameLength, address, size, flags, imageAt, length) =>
      tetoImageSegment(sourceMemory, hart, nameHash, nameLength, address, size, flags, imageAt, length),
    tetoImageFinish: (_memory, hart, size) => tetoImageFinish(sourceMemory, hart, size),
    tetoBuildInitialStack: (_memory, hart, at, size, stackBytes) => tetoBuildInitialStack(sourceMemory, hart, at, size, stackBytes),
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

  // Validation precedes mutation so failures leave the current operation in a defined state.
  // Exercise executable anonymous pages end-to-end: V8's dynamically
  // generated code cannot reside in a THX image segment.
  const allocate = words([
    addi(10, 0, 0),
    (1 << 12 | 11 << 7 | 0x37) >>> 0,
    addi(13, 0, 0x22),
    addi(14, 0, -1),
    addi(15, 0, 0),
    addi(17, 0, 222),
    0x00000073,
    addi(6, 10, 0),
  ]);
  const jitExit = words([addi(10, 0, 42), addi(17, 0, 93), 0x00000073]);
  const startup = new Uint8Array(38);
  const startupView = new DataView(startup.buffer);
  startupView.setUint32(0, TETO_STARTUP_MAGIC, true);
  startupView.setUint32(4, 1, true);
  startupView.setUint32(32, 2, true);
  startup.set(enc("/x"), 36);

  const exerciseMappings = (core: ProtectionCore, memory: Uint8Array): Array<Array<string | number | bigint>> => {
    // Segment permissions must agree between the canonical source core and generated WASM.
    const results: Array<Array<string | number | bigint>> = [];
    for (const item of cases) {
      assert.equal(core.tetoKernelInit(0, 1, 0), 0);
      assert.equal(core.tetoHartInit(0, 0, virtualTop, pc), 0);
      assert.equal(core.tetoProcessInit(0, 0, 70, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
      const imageLength = item.code.length + item.initial.length;
      const imageAt = core.tetoImageReserve(0, imageLength) >>> 0;
      assert.ok(imageAt < 0xfffffffe, `${item.name}: image reservation failed`);
      memory.set(item.code, imageAt);
      memory.set(item.initial, imageAt + item.code.length);
      assert.equal(core.tetoImageBegin(0, 0, virtualTop, pc, 0n, 0, 0), TETO_THX_OK);
      assert.equal(core.tetoImageSegment(0, 0, 0x1111, 4, pc, BigInt(item.code.length), item.codeFlags,
        imageAt, item.code.length), TETO_THX_OK);
      if (item.dataLength !== 0n) {
        assert.equal(core.tetoImageSegment(0, 0, 0x2222, 4, data, item.dataLength, item.dataFlags,
          imageAt + item.code.length, item.initial.length), TETO_THX_OK);
      }
      assert.equal(core.tetoImageFinish(0, 0, imageLength), TETO_THX_OK);
      assert.equal(core.tetoImageRelease(0, imageAt, imageLength), TETO_THX_OK);
      assert.equal(core.tetoHartSetX(0, 0, 1, data), 0);
      assert.equal(core.tetoHartSetX(0, 0, 2, 39n), 0);
      if ((item.runPc ?? null) !== null) assert.equal(core.tetoHartSetPc(0, 0, (requireValue(item.runPc ?? null, "src/test/all.ts:807") ?? null)), 0);
      const result = core.tetoRunRv64Batch(0, 0, 64, 123456n, 0);
      const status = core.tetoHartStatus(0, 0);
      const fault = new DataView(memory.buffer).getInt32(TETO_HART_BASE + H_FAULT, true);
      assert.equal(result, item.result, `${item.name}: unexpected batch result`);
      assert.equal(status, item.status, `${item.name}: unexpected hart status`);
      if (item.result === TETO_BATCH_FAULT) assert.equal(fault, TETO_FAULT_MEMORY, `${item.name}: wrong fault`);
      assert.equal(core.tetoHartGetX(0, 0, 3), item.value, `${item.name}: unexpected loaded value`);
      results.push([item.name, result, status, fault, core.tetoHartGetX(0, 0, 3)]);
    }
    return results;
  };

  const exerciseAnonymous = (core: ProtectionCore, memory: Uint8Array): Array<Array<string | number | bigint>> => {
    // Only executable anonymous mappings may run the injected guest exit programme.
    const results: Array<Array<string | number | bigint>> = [];
    for (const protect of [7, 3]) {
      assert.equal(core.tetoKernelInit(0, 1, 0), 0);
      assert.equal(core.tetoHartInit(0, 0, virtualTop, pc), 0);
      assert.equal(core.tetoProcessInit(0, 0, 70, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
      const imageAt = core.tetoImageReserve(0, allocate.length) >>> 0;
      memory.set(allocate, imageAt);
      assert.equal(core.tetoImageBegin(0, 0, virtualTop, pc, 0n, 0, 0), TETO_THX_OK);
      assert.equal(core.tetoImageSegment(0, 0, 0x1111, 4, pc, BigInt(allocate.length),
        TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, imageAt, allocate.length), TETO_THX_OK);
      assert.equal(core.tetoImageFinish(0, 0, allocate.length), TETO_THX_OK);
      assert.equal(core.tetoImageRelease(0, imageAt, allocate.length), TETO_THX_OK);
      const startupAt = core.tetoImageReserve(0, startup.length) >>> 0;
      memory.set(startup, startupAt);
      assert.equal(core.tetoBuildInitialStack(0, 0, startupAt, startup.length, 1024 * 1024), TETO_START_OK);
      assert.equal(core.tetoImageRelease(0, startupAt, startup.length), TETO_THX_OK);
      assert.equal(core.tetoHartSetX(0, 0, 12, BigInt(protect)), 0);
      assert.equal(core.tetoRunRv64Batch(0, 0, 8, 123456n, 0), TETO_BATCH_BUDGET);
      const executableAt = core.tetoHartGetX(0, 0, 6);
      assert.ok(executableAt > pc && (executableAt & 4095n) === 0n, "invalid mmap code reservation");
      const frame = core.tetoGuestPage(0, 0, executableAt, 1) >>> 0;
      assert.ok(frame < 0xfffffffe && frame + jitExit.length <= memory.length, "unable to back executable page");
      memory.set(jitExit, frame);
      assert.equal(core.tetoHartSetPc(0, 0, executableAt), 0);
      const expected = protect === 7 ? TETO_BATCH_EXITED : TETO_BATCH_FAULT;
      assert.equal(core.tetoRunRv64Batch(0, 0, 32, 123456n, 0), expected);
      assert.equal(core.tetoHartStatus(0, 0), protect === 7 ? TETO_HART_EXITED : TETO_HART_FAULTED);
      if (protect === 7) assert.equal(core.tetoHartGetX(0, 0, 10), 42n);
      else assert.equal(new DataView(memory.buffer).getInt32(TETO_HART_BASE + H_FAULT, true), TETO_FAULT_MEMORY);
      results.push(["anonymous-execute", protect, expected, executableAt]);
    }
    return results;
  };

  const exercise = (core: ProtectionCore, memory: Uint8Array): string =>
    show([...exerciseMappings(core, memory), ...exerciseAnonymous(core, memory)]);

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  assert.equal(generatedResult, sourceResult);
});

test("Teto owns RV64 brk growth, bounds and shrink zeroing", async () => {
  type BreakCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoImageReserve" |
    "tetoImageRelease" | "tetoImageBegin" | "tetoImageSegment" | "tetoImageFinish" |
    "tetoBuildInitialStack" | "tetoHartBreak" | "tetoHartGetX" | "tetoHartMetric" |
    "tetoRunRv64Batch">;
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
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
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
    tetoImageBegin: (_memory, hart, top, entry, phdr, phent, phnum) =>
      tetoImageBegin(sourceMemory, hart, top, entry, phdr, phent, phnum),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
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
    assert.equal(core.tetoKernelInit(0, 1, 0), 0);
    assert.equal(core.tetoHartInit(0, 0, virtualTop, pc), 0);
    assert.equal(core.tetoProcessInit(0, 0, 71, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
    const imageAt = core.tetoImageReserve(0, code.length) >>> 0;
    memory.set(code, imageAt);
    assert.equal(core.tetoImageBegin(0, 0, virtualTop, pc, 0n, 0, 0), TETO_THX_OK);
    assert.equal(core.tetoImageSegment(0, 0, 0x1111, 4, pc, BigInt(code.length),
      TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, imageAt, code.length), TETO_THX_OK);
    assert.equal(core.tetoImageFinish(0, 0, code.length), TETO_THX_OK);
    assert.equal(core.tetoImageRelease(0, imageAt, code.length), TETO_THX_OK);
    assert.equal(core.tetoHartBreak(0, 0), expectedInitial);
    const startupAt = core.tetoImageReserve(0, startup.length) >>> 0;
    memory.set(startup, startupAt);
    assert.equal(core.tetoBuildInitialStack(0, 0, startupAt, startup.length, 1024 * 1024), TETO_START_OK);
    assert.equal(core.tetoImageRelease(0, startupAt, startup.length), TETO_THX_OK);
    assert.equal(core.tetoRunRv64Batch(0, 0, 128, 123456n, 0), TETO_BATCH_EXITED);
    assert.equal(core.tetoHartGetX(0, 0, 5), expectedInitial);
    assert.equal(core.tetoHartGetX(0, 0, 7), 0n, "regrown heap exposed truncated bytes");
    assert.equal(core.tetoHartGetX(0, 0, 8), expectedInitial + 64n, "invalid break changed the heap bound");
    assert.equal(core.tetoHartBreak(0, 0), expectedInitial + 64n);
    assert.equal(core.tetoHartMetric(0, 0, H_INTERNAL_SYSCALLS), 6n);
    assert.equal(core.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
    return show([core.tetoHartGetX(0, 0, 5), core.tetoHartGetX(0, 0, 7),
      core.tetoHartGetX(0, 0, 8), core.tetoHartBreak(0, 0),
      core.tetoHartMetric(0, 0, H_INTERNAL_SYSCALLS)]);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  assert.equal(generatedResult, sourceResult);
});

test("Teto honours MAP_FIXED replacement inside MAP_NORESERVE reservations", async () => {
  type MapCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoImageReserve" |
    "tetoImageRelease" | "tetoImageBegin" | "tetoImageSegment" | "tetoImageFinish" |
    "tetoBuildInitialStack" | "tetoHartSetX" | "tetoHartGetX" | "tetoHartStatus" |
    "tetoHartMetric" | "tetoProcessMapCount" | "tetoRunRv64Batch">;
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
  const addi = (rd: number, rs: number, immediate: number): number =>
    ((immediate & 0xfff) << 20 | rs << 15 | rd << 7 | 0x13) >>> 0;
  const add = (rd: number, left: number, right: number): number =>
    (right << 20 | left << 15 | rd << 7 | 0x33) >>> 0;
  const load = (rd: number, base: number): number => (base << 15 | 3 << 12 | rd << 7 | 0x03) >>> 0;
  const store = (source: number, base: number): number => (source << 20 | base << 15 | 3 << 12 | 0x23) >>> 0;
  const instructions = [
    // Reserve two pages using MAP_NORESERVE, then exercise their backing.
    0x00000073, addi(5, 10, 0), add(21, 5, 20), load(8, 21),
    addi(6, 0, 39), store(6, 5), load(7, 5),
    // MAP_FIXED must replace the first page, zeroing its previous contents
    // while preserving the second page within the original reservation.
    addi(10, 5, 0), addi(11, 20, 0), addi(12, 0, 3),
    addi(13, 0, 0x32), addi(17, 0, 222), 0x00000073,
    addi(9, 10, 0), load(23, 5),
    // Unmap the replaced page, then deliberately fault on its old address.
    addi(10, 5, 0), addi(11, 20, 0), addi(17, 0, 215),
    0x00000073, load(22, 21), load(10, 5),
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
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
    tetoImageBegin: (_memory, hart, top, entry, phdr, phent, phnum) =>
      tetoImageBegin(sourceMemory, hart, top, entry, phdr, phent, phnum),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
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
    assert.equal(core.tetoKernelInit(0, 1, 0), 0);
    assert.equal(core.tetoHartInit(0, 0, virtualTop, pc), 0);
    assert.equal(core.tetoProcessInit(0, 0, 72, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
    const imageAt = core.tetoImageReserve(0, code.length) >>> 0;
    memory.set(code, imageAt);
    assert.equal(core.tetoImageBegin(0, 0, virtualTop, pc, 0n, 0, 0), TETO_THX_OK);
    assert.equal(core.tetoImageSegment(0, 0, 0x1111, 4, pc, BigInt(code.length),
      TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, imageAt, code.length), TETO_THX_OK);
    assert.equal(core.tetoImageFinish(0, 0, code.length), TETO_THX_OK);
    assert.equal(core.tetoImageRelease(0, imageAt, code.length), TETO_THX_OK);
    const startupAt = core.tetoImageReserve(0, startup.length) >>> 0;
    memory.set(startup, startupAt);
    assert.equal(core.tetoBuildInitialStack(0, 0, startupAt, startup.length, 1024 * 1024), TETO_START_OK);
    assert.equal(core.tetoImageRelease(0, startupAt, startup.length), TETO_THX_OK);
    const registers: Array<[number, bigint]> = [
      [10, 0n], [11, 8192n], [12, 3n], [13, 0x4022n], [14, -1n], [15, 0n], [17, 222n], [20, 4096n],
    ];
    for (const [register, value] of registers) assert.equal(core.tetoHartSetX(0, 0, register, value), 0);
    assert.equal(core.tetoRunRv64Batch(0, 0, 128, 123456n, 0), TETO_BATCH_FAULT);
    assert.equal(core.tetoHartStatus(0, 0), TETO_HART_FAULTED);
    const fault = new DataView(memory.buffer).getInt32(TETO_HART_BASE + H_FAULT, true);
    assert.equal(fault, TETO_FAULT_MEMORY);
    const mapped = core.tetoHartGetX(0, 0, 5);
    assert.ok(mapped > pc && (mapped & 4095n) === 0n, "anonymous mmap returned an invalid address");
    assert.equal(core.tetoHartGetX(0, 0, 7), 39n);
    assert.equal(core.tetoHartGetX(0, 0, 8), 0n);
    assert.equal(core.tetoHartGetX(0, 0, 9), mapped, "MAP_FIXED replacement must retain the address");
    assert.equal(core.tetoHartGetX(0, 0, 23), 0n, "MAP_FIXED replacement must clear previously written data");
    assert.equal(core.tetoHartGetX(0, 0, 22), 0n, "unreplaced page must retain its contents");
    assert.equal(core.tetoProcessMapCount(0, 0), 1);
    assert.equal(core.tetoHartMetric(0, 0, H_INTERNAL_SYSCALLS), 3n);
    assert.equal(core.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
    return show([mapped, core.tetoHartGetX(0, 0, 7), core.tetoHartGetX(0, 0, 8),
      core.tetoHartGetX(0, 0, 9), core.tetoProcessMapCount(0, 0), fault]);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  assert.equal(generatedResult, sourceResult);
});

test("Teto protects, synchronises and remaps anonymous RV64 memory", async () => {
  type PolicyCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoImageReserve" |
    "tetoImageRelease" | "tetoImageBegin" | "tetoImageSegment" | "tetoImageFinish" |
    "tetoBuildInitialStack" | "tetoHartSetX" | "tetoHartGetX" | "tetoHartStatus" |
    "tetoHartMetric" | "tetoProcessMapCount" | "tetoRunRv64Batch">;
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
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
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
    tetoImageBegin: (_memory, hart, top, entry, phdr, phent, phnum) =>
      tetoImageBegin(sourceMemory, hart, top, entry, phdr, phent, phnum),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
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
    assert.equal(core.tetoKernelInit(0, 1, 0), 0);
    assert.equal(core.tetoHartInit(0, 0, virtualTop, pc), 0);
    assert.equal(core.tetoProcessInit(0, 0, 73, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
    const imageAt = core.tetoImageReserve(0, code.length) >>> 0;
    memory.set(code, imageAt);
    assert.equal(core.tetoImageBegin(0, 0, virtualTop, pc, 0n, 0, 0), TETO_THX_OK);
    assert.equal(core.tetoImageSegment(0, 0, 0x1111, 4, pc, BigInt(code.length),
      TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE, imageAt, code.length), TETO_THX_OK);
    assert.equal(core.tetoImageFinish(0, 0, code.length), TETO_THX_OK);
    assert.equal(core.tetoImageRelease(0, imageAt, code.length), TETO_THX_OK);
    const startupAt = core.tetoImageReserve(0, startup.length) >>> 0;
    memory.set(startup, startupAt);
    assert.equal(core.tetoBuildInitialStack(0, 0, startupAt, startup.length, 1024 * 1024), TETO_START_OK);
    assert.equal(core.tetoImageRelease(0, startupAt, startup.length), TETO_THX_OK);
  };
  const mmapRegisters = (core: PolicyCore, length: bigint): void => {
    const registers: Array<[number, bigint]> = [
      [10, 0n], [11, length], [12, 3n], [13, 0x22n], [14, -1n], [15, 0n],
      [17, 222n], [20, 4096n], [22, 8192n],
    ];
    for (const [register, value] of registers) assert.equal(core.tetoHartSetX(0, 0, register, value), 0);
  };
  const exercise = (core: PolicyCore, memory: Uint8Array): string => {
    const results: Array<Array<string | number | bigint>> = [];

    setup(core, memory, protection);
    mmapRegisters(core, 8192n);
    assert.equal(core.tetoRunRv64Batch(0, 0, 128, 123456n, 0), TETO_BATCH_FAULT);
    assert.equal(core.tetoHartGetX(0, 0, 7), 39n);
    assert.equal(core.tetoProcessMapCount(0, 0), 2);
    assert.equal(core.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
    results.push(["protect", core.tetoHartGetX(0, 0, 7), core.tetoProcessMapCount(0, 0),
      new DataView(memory.buffer).getInt32(TETO_HART_BASE + H_FAULT, true)]);

    setup(core, memory, grow);
    mmapRegisters(core, 4096n);
    assert.equal(core.tetoRunRv64Batch(0, 0, 256, 123456n, 0), TETO_BATCH_EXITED);
    assert.equal(core.tetoHartGetX(0, 0, 6), core.tetoHartGetX(0, 0, 5));
    assert.equal(core.tetoHartGetX(0, 0, 7), 39n);
    assert.equal(core.tetoHartGetX(0, 0, 8), 0n);
    assert.equal(core.tetoProcessMapCount(0, 0), 1);
    assert.equal(core.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
    results.push(["grow", core.tetoHartGetX(0, 0, 5), core.tetoHartGetX(0, 0, 7),
      core.tetoHartGetX(0, 0, 8), core.tetoProcessMapCount(0, 0)]);

    setup(core, memory, move);
    mmapRegisters(core, 4096n);
    assert.equal(core.tetoRunRv64Batch(0, 0, 256, 123456n, 0), TETO_BATCH_EXITED);
    assert.ok(core.tetoHartGetX(0, 0, 9) !== core.tetoHartGetX(0, 0, 5), "MREMAP_MAYMOVE did not relocate a blocked mapping");
    assert.equal(core.tetoHartGetX(0, 0, 7), 39n);
    assert.equal(core.tetoProcessMapCount(0, 0), 2);
    assert.equal(core.tetoHartMetric(0, 0, H_FALLBACK_SYSCALLS), 0n);
    results.push(["move", core.tetoHartGetX(0, 0, 5), core.tetoHartGetX(0, 0, 9),
      core.tetoHartGetX(0, 0, 7), core.tetoProcessMapCount(0, 0)]);
    return show(results);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  assert.equal(generatedResult, sourceResult);
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
    {"sum": null, "size": null, "source": null, "to": null, p: "/hard-release", k: "f", id: 3, mode: 0o640, uid: 1000, gid: 2000, at: stamp, mt: stamp + 1, ct: stamp + 2, data: contents },
    {"data": null, "sum": null, "size": null, "source": null, "to": null, p: "/", k: "d", id: 1, mode: 0o755, uid: 0, gid: 0, at: stamp, mt: stamp, ct: stamp },
    {"sum": null, "size": null, "source": null, "to": null, p: "/etc/os-release", k: "f", id: 3, mode: 0o640, uid: 1000, gid: 2000, at: stamp, mt: stamp + 1, ct: stamp + 2, data: contents },
    {"data": null, "sum": null, "size": null, "source": null, p: "/release-link", k: "l", id: 4, mode: 0o777, uid: 1000, gid: 2000, at: stamp, mt: stamp, ct: stamp, to: "etc/os-release" },
    {"data": null, "sum": null, "size": null, "source": null, "to": null, p: "/etc", k: "d", id: 2, mode: 0o750, uid: 0, gid: 1000, at: stamp, mt: stamp, ct: stamp },
    {"data": null, "sum": null, "size": null, "source": null, "to": null, p: "/private", k: "d", id: 5, mode: 0o700, uid: 2000, gid: 2000, at: stamp, mt: stamp, ct: stamp },
    {"sum": null, "size": null, "source": null, "to": null, p: "/private/secret", k: "f", id: 6, mode: 0o600, uid: 2000, gid: 2000, at: stamp, mt: stamp, ct: stamp, data: enc("secret") },
    {"data": null, "sum": null, "size": null, "source": null, "to": null, p: "/group", k: "d", id: 7, mode: 0o710, uid: 0, gid: 3000, at: stamp, mt: stamp, ct: stamp },
    {"sum": null, "size": null, "source": null, "to": null, p: "/group/item", k: "f", id: 8, mode: 0o640, uid: 2000, gid: 3000, at: stamp, mt: stamp, ct: stamp, data: enc("group") },
    {"data": null, "sum": null, "size": null, "source": null, p: "/loop-a", k: "l", id: 9, mode: 0o777, uid: 0, gid: 0, at: stamp, mt: stamp, ct: stamp, to: "loop-b" },
    {"data": null, "sum": null, "size": null, "source": null, p: "/loop-b", k: "l", id: 10, mode: 0o777, uid: 0, gid: 0, at: stamp, mt: stamp, ct: stamp, to: "loop-a" },
    {"data": null, "sum": null, "size": null, "source": null, p: "/absolute-link", k: "l", id: 11, mode: 0o777, uid: 0, gid: 0, at: stamp, mt: stamp, ct: stamp, to: "/etc/os-release" },
  ];
  const image = serializeTetoVfs(fixture);
  assert.equal(show(serializeTetoVfs([...fixture].reverse())), show(image), "Teto VFS serialisation is not deterministic");
  let rejectedDirectoryLink = false;
  try {
    serializeTetoVfs([...fixture, { ...requireValue(fixture.find(entry => entry.p === "/etc") ?? null, "src/test/all.ts:1240"), p: "/etc-hard" }]);
  } catch { rejectedDirectoryLink = true; }
  assert.ok(rejectedDirectoryLink, "Teto accepted a hard-linked directory with ambiguous parent traversal");

  const sourceMemory = directMemory(64 * 1024 * 1024);
  const source: VfsCore = {
    tetoKernelInit: (_memory, harts, threaded) => tetoKernelInit(sourceMemory, harts, threaded !== 0),
    tetoHartInit: (_memory, hart, virtualTop, pc) => tetoHartInit(sourceMemory, hart, virtualTop, pc),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
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

  const fs = await hostModule("node:fs/promises") as HostFs;
  const generated = await loadTeto(Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url))), {"threaded": null, "memory": null,
    initialPages: 8192,
    maximumPages: 32768,
  });

  // Validation precedes mutation so failures leave the current operation in a defined state.
  const exercise = (core: VfsCore, bytes: Uint8Array): string => {
    assert.equal(core.tetoKernelInit(0, 1, 0), 0);
    assert.equal(core.tetoHartInit(0, 0, 0x0000ffffffffffffn, 0n), 0);
    assert.equal(core.tetoProcessInit(0, 0, 80, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
    assert.equal(core.tetoProcessSetGroup(0, 0, 0, 3000), 0);
    const imageAt = core.tetoImageReserve(0, image.length) >>> 0;
    assert.ok(imageAt !== 0xffffffff);
    bytes.set(image, imageAt);
    assert.equal(core.tetoLoadVfs(0, imageAt, image.length), TETO_VFS_OK);
    assert.equal(core.tetoImageRelease(0, imageAt, image.length), 0);

    const corrupt = image.slice();
    corrupt[corrupt.length - 1] = requireValue(corrupt[corrupt.length - 1] ?? null, "src/test/all.ts:1296") ^ 1;
    const corruptAt = core.tetoImageReserve(0, corrupt.length) >>> 0;
    bytes.set(corrupt, corruptAt);
    assert.equal(core.tetoLoadVfs(0, corruptAt, corrupt.length), TETO_VFS_CHECKSUM);
    assert.equal(core.tetoImageRelease(0, corruptAt, corrupt.length), 0);

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
    assert.equal(core.tetoImageRelease(0, scratch, 512), 0);
    return summary;
  };
  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  assert.equal(generatedResult, sourceResult);
  assert.equal(sourceResult, show([1, 1, 11, 11, TETO_VFS_KIND_DIRECTORY, TETO_VFS_KIND_FILE, TETO_VFS_KIND_LINK,
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

  const fs = await hostModule("node:fs/promises") as HFs;
  const image = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.thx", import.meta.url)));
  const sourceMemory = directMemory(64 * 1024 * 1024);
  const source: ImageCore = {
    tetoKernelInit: (_memory, maxHarts, threaded) => tetoKernelInit(sourceMemory, maxHarts, threaded !== 0),
    tetoHartInit: (_memory, hart, virtualTop, pc) => tetoHartInit(sourceMemory, hart, virtualTop, pc),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
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
    assert.equal(core.tetoKernelInit(0, 1, 0), 0);
    assert.equal(core.tetoHartInit(0, 0, 0x0000ffffffffffffn, 0n), 0);
    assert.equal(core.tetoProcessInit(0, 0, 80, 1, 1000, 1000, 1000, 1000, 1000, 1000), 0);
    const imageAt = core.tetoImageReserve(0, image.length) >>> 0;
    assert.ok(imageAt < 0xfffffffe && imageAt + image.length <= bytes.length);
    bytes.set(image, imageAt);
    assert.equal(core.tetoLoadThx(0, 0, imageAt, image.length), TETO_THX_OK);
    assert.equal(core.tetoImageRelease(0, imageAt, image.length), TETO_THX_OK);
    assert.equal(core.tetoProcessSegmentCount(0, 0), 2);
    assert.equal(core.tetoHartVirtualTop(0, 0), 1024n * 1024n * 1024n);
    assert.equal(core.tetoHartPc(0, 0), 0x10000n);
    const floor = core.tetoHartImageFloor(0, 0);
    assert.ok(floor > 0x20000n);
    const codeFrame = core.tetoGuestPage(0, 0, 0x10000n, 0) >>> 0;
    const dataFrame = core.tetoGuestPage(0, 0, 0x20000n, 0) >>> 0;
    assert.ok(codeFrame < 0xfffffffe && dataFrame < 0xfffffffe);
    const instruction = new DataView(bytes.buffer).getUint32(codeFrame, true);
    const message = dec(bytes.slice(dataFrame, dataFrame + "hello from Teto RV64GC\n".length));
    assert.equal(message, "hello from Teto RV64GC\n");
    assert.equal(core.tetoHartMetric(0, 0, H_IMAGE_LOADS), 1n);
    assert.equal(core.tetoHartMetric(0, 0, H_IMAGE_BYTES), BigInt(image.length));

    const corrupt = image.slice();
    corrupt[corrupt.length - 1] = requireValue(corrupt[corrupt.length - 1] ?? null, "src/test/all.ts:1426") ^ 1;
    const badAt = core.tetoImageReserve(0, corrupt.length) >>> 0;
    assert.ok(badAt < 0xfffffffe && badAt + corrupt.length <= bytes.length);
    bytes.set(corrupt, badAt);
    assert.equal(core.tetoLoadThx(0, 0, badAt, corrupt.length), TETO_THX_CHECKSUM);
    assert.equal(core.tetoImageRelease(0, badAt, corrupt.length), TETO_THX_OK);
    assert.equal(core.tetoHartMetric(0, 0, H_IMAGE_LOADS), 1n);
    return show([core.tetoProcessSegmentCount(0, 0), core.tetoHartVirtualTop(0, 0),
      core.tetoHartPc(0, 0), floor, instruction, message,
      core.tetoHartMetric(0, 0, H_IMAGE_BYTES)]);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  assert.equal(generatedResult, sourceResult);
});

test("Teto builds the initial RV64 process stack inside source and generated kernels", async () => {
  type StartupCore = Pick<TetoExports,
    "tetoKernelInit" | "tetoHartInit" | "tetoProcessInit" | "tetoImageReserve" |
    "tetoImageRelease" | "tetoLoadThx" | "tetoBuildInitialStack" |
    "tetoHartStackBottom" | "tetoHartStackPointer" | "tetoHartGetX" |
    "tetoHartMetric" | "tetoGuestPage">;
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
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
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
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

  // Validation precedes mutation so failures leave the current operation in a defined state.
  const exercise = (core: StartupCore, bytes: Uint8Array): string => {
    // Read virtual stack data through mapped pages; a rejected startup block must not increment the successful-load metric.
    assert.equal(core.tetoKernelInit(0, 1, 0), 0);
    assert.equal(core.tetoHartInit(0, 0, 0x0000ffffffffffffn, 0n), 0);
    assert.equal(core.tetoProcessInit(0, 0, 81, 1, 1000, 0, 0, 1000, 0, 0), 0);
    const imageAt = core.tetoImageReserve(0, image.length) >>> 0;
    bytes.set(image, imageAt);
    assert.equal(core.tetoLoadThx(0, 0, imageAt, image.length), TETO_THX_OK);
    assert.equal(core.tetoImageRelease(0, imageAt, image.length), TETO_THX_OK);
    const blockAt = core.tetoImageReserve(0, startup.length) >>> 0;
    bytes.set(startup, blockAt);
    assert.equal(core.tetoBuildInitialStack(0, 0, blockAt, startup.length, 2 * 1024 * 1024), TETO_START_OK);
    assert.equal(core.tetoImageRelease(0, blockAt, startup.length), TETO_THX_OK);

    const sp = core.tetoHartStackPointer(0, 0);
    assert.equal(core.tetoHartStackBottom(0, 0), 1024n * 1024n * 1024n - 2n * 1024n * 1024n);
    assert.equal(core.tetoHartGetX(0, 0, 2), sp);
    const guestByte = (address: bigint): number => {
      const frame = core.tetoGuestPage(0, 0, address, 0) >>> 0;
      assert.ok(frame < 0xfffffffe, `unmapped startup byte at 0x${address.toString(16)}`);
      return requireValue(bytes[frame + Number(address & 0xffffn)] ?? null, "src/test/all.ts:1507");
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
    assert.equal(guestWord(sp), 2n);
    const argv0 = guestWord(sp + 8n), argv1 = guestWord(sp + 16n);
    assert.equal(guestString(argv0), "/tmp/hello-rv64.39");
    assert.equal(guestString(argv1), "alpha");
    assert.equal(guestWord(sp + 24n), 0n);
    const env0 = guestWord(sp + 32n), env1 = guestWord(sp + 40n);
    assert.equal(guestString(env0), "HOME=/home/guest");
    assert.equal(guestString(env1), "USER=guest");
    assert.equal(guestWord(sp + 48n), 0n);
    const aux = sp + 56n;
    let random = 0n;
    let summary = "";
    for (let index = 0; index < 15; index++) {
      const key = guestWord(aux + BigInt(index * 16));
      const value = guestWord(aux + BigInt(index * 16 + 8));
      if (key === 9n) assert.equal(value, 0x10000n);
      if (key === 11n) assert.equal(value, 1000n);
      if (key === 12n) assert.equal(value, 0n);
      if (key === 13n) assert.equal(value, 1000n);
      if (key === 14n) assert.equal(value, 0n);
      if (key === 23n) assert.equal(value, 1n);
      if (key === 25n) random = value;
      if (key === 31n) assert.equal(value, argv0);
      summary += `${key}:${value};`;
    }
    assert.ok(random !== 0n);
    for (let index = 0; index < 16; index++) assert.equal(guestByte(random + BigInt(index)), index);
    assert.equal(core.tetoHartMetric(0, 0, H_STARTUP_LOADS), 1n);

    const malformed = startup.slice();
    malformed[0] = 0;
    const malformedAt = core.tetoImageReserve(0, malformed.length) >>> 0;
    bytes.set(malformed, malformedAt);
    assert.equal(core.tetoBuildInitialStack(0, 0, malformedAt, malformed.length, 2 * 1024 * 1024), TETO_START_FORMAT);
    assert.equal(core.tetoImageRelease(0, malformedAt, malformed.length), TETO_THX_OK);
    assert.equal(core.tetoHartMetric(0, 0, H_STARTUP_LOADS), 1n);
    return show([sp, argv0, argv1, env0, env1, summary]);
  };

  const sourceResult = exercise(source, sourceMemory.bytes);
  const generatedResult = exercise(generated.exports, new Uint8Array(generated.memory.buffer));
  assert.equal(generatedResult, sourceResult);
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
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
    tetoProcessInit: (_memory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid) =>
      tetoProcessInit(sourceMemory, hart, pid, ppid, ruid, euid, suid, rgid, egid, sgid),
    tetoImageReserve: (_memory, size) => tetoImageReserve(sourceMemory, size),
    tetoImageRelease: (_memory, at, size) => tetoImageRelease(sourceMemory, at, size),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
    tetoImageBegin: (_memory, hart, virtualTop, entry, phdr, phent, phnum) =>
      tetoImageBegin(sourceMemory, hart, virtualTop, entry, phdr, phent, phnum),
    // The fixed guest/WASM ABI requires these positional scalar parameters.
    //@cg-expect-warning
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

  const fs = await hostModule("node:fs/promises") as HFs;
  const wasmBytes = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const generated = await loadTeto(wasmBytes);

  // Validation precedes mutation so failures leave the current operation in a defined state.
  const exercise = (core: CredentialCore, bytes: Uint8Array): string => {
    const virtualTop = 1n << 40n, pc = 0x10000n, data = 0x20000n;
    assert.equal(core.tetoKernelInit(0, 1, 0), 0);
    assert.equal(core.tetoHartInit(0, 0, virtualTop, pc), 0);
    assert.equal(core.tetoProcessInit(0, 0, 70, 1, 1000, 0, 0, 1000, 0, 0), 0);
    const ecall = new Uint8Array([0x73, 0, 0, 0]);
    const imageAt = core.tetoImageReserve(0, ecall.length) >>> 0;
    bytes.set(ecall, imageAt);
    assert.equal(core.tetoImageBegin(0, 0, virtualTop, pc, 0n, 0, 0), TETO_THX_OK);
    assert.equal(core.tetoImageSegment(0, 0, 0x1111, 4, pc, 4n, TETO_SEGMENT_READ | TETO_SEGMENT_EXECUTE,
      imageAt, ecall.length), TETO_THX_OK);
    assert.equal(core.tetoImageSegment(0, 0, 0x2222, 4, data, 65536n, TETO_SEGMENT_READ | TETO_SEGMENT_WRITE,
      imageAt, 0), TETO_THX_OK);
    assert.equal(core.tetoImageFinish(0, 0, ecall.length), TETO_THX_OK);
    assert.equal(core.tetoImageRelease(0, imageAt, ecall.length), TETO_THX_OK);
    const codeFrame = core.tetoGuestPage(0, 0, pc, 0) >>> 0;
    const dataFrame = core.tetoGuestPage(0, 0, data, 1);
    assert.ok(codeFrame < 0xfffffffe && dataFrame < 0xfffffffe);
    const view = new DataView(bytes.buffer);
    const at = (address: bigint): number => dataFrame + Number(address - data);
    const call = (number: number, args: readonly bigint[] = []): bigint => {
      assert.equal(core.tetoHartSetPc(0, 0, pc), 0);
      assert.equal(core.tetoHartSetX(0, 0, 17, BigInt(number)), 0);
      for (let register = 10; register <= 15; register++) {
        assert.equal(core.tetoHartSetX(0, 0, register, args[register - 10] ?? 0n), 0);
      }
      assert.equal(core.tetoRunRv64Batch(0, 0, 1, 123456n, 0), TETO_BATCH_BUDGET);
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
  assert.equal(generatedResult, sourceResult);
});

test("byte-identical RV64GC THX and .39 execute through direct and source cores", async () => {
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
  const thxBytes = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.thx", import.meta.url)));
  const aliasBytes = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.39", import.meta.url)));
  assert.equal(show(aliasBytes), show(thxBytes));
  const exe = codec.unpack(thxBytes);
  assert.ok(exe instanceof Exe && exe.machine === "thistle64" && exe.isa === "rv64gc");

  const direct = new Rig();
  const directPath = direct.os.load("hello-rv64.thx", thxBytes);
  const expected = await direct.run(directPath);
  assert.equal(`${expected.code}:${expected.out}:${expected.err}`, "0:hello from Teto RV64GC\n:");

  const source = new Rig();
  source.os.s.setenv("THISTLE_RV_CORE", "teto-source");
  source.os.s.setenv("THISTLE_TETO_STRICT", "1");
  const sourceThx = source.os.load("hello-rv64.thx", thxBytes);
  const sourceAlias = source.os.load("hello-rv64.39", aliasBytes);
  const thx = await source.run(sourceThx);
  const alias = await source.run(sourceAlias);
  assert.equal(`${thx.code}:${thx.out}:${thx.err}`, `${expected.code}:${expected.out}:${expected.err}`);
  assert.equal(`${alias.code}:${alias.out}:${alias.err}`, `${expected.code}:${expected.out}:${expected.err}`);
});

test("byte-identical RV64GC THX and .39 execute inside generated WebAssembly", async () => {
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
  const wasm = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const thxBytes = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.thx", import.meta.url)));
  const aliasBytes = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.39", import.meta.url)));
  const provider: TetoImageProvider = {
    load: async variant => {
      assert.equal(variant, "baseline");
      return wasm;
    },
  };
  const generated = new Rig(null, false, provider, null);
  generated.os.s.setenv("THISTLE_RV_CORE", "teto-wasm-core");
  generated.os.s.setenv("THISTLE_TETO_STRICT", "1");
  const thxPath = generated.os.load("hello-rv64.thx", thxBytes);
  const aliasPath = generated.os.load("hello-rv64.39", aliasBytes);
  const thx = await generated.run(thxPath);
  const alias = await generated.run(aliasPath);
  assert.equal(`${thx.code}:${thx.out}:${thx.err}`, "0:hello from Teto RV64GC\n:");
  assert.equal(`${alias.code}:${alias.out}:${alias.err}`, `${thx.code}:${thx.out}:${thx.err}`);
});

test("strict generated Teto keeps RV64 execution in WASM across host-serviced syscalls", async () => {
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
  const wasm = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const provider: TetoImageProvider = { load: async () => wasm };

  // getcwd (RV64 syscall 17) is provided by the host's filesystem service,
  // not by Teto's native syscall table. It must return to Teto after service.
  const addi = (rd: number, rs: number, value: number): number =>
    ((value & 0xfff) << 20 | rs << 15 | rd << 7 | 0x13) >>> 0;
  const instructions = [
    (0x20 << 12 | 10 << 7 | 0x37) >>> 0, // lui a0, 0x20: writable guest buffer
    addi(11, 0, 128),                  // a1: buffer capacity
    addi(17, 0, 17),                   // a7: getcwd
    0x00000073,                        // ecall: explicit host-service boundary
    addi(17, 0, 93),                   // a7: exit
    0x00000073,                        // ecall: native Teto exit
  ];
  const text = new Uint8Array(instructions.length * 4);
  const view = new DataView(text.buffer);
  instructions.forEach((word, index) => view.setUint32(index * 4, word, true));
  const exe = new Exe("thistle64");
  exe.isa = "rv64gc";
  exe.entry = 0x10000;
  exe.sec.push({ name: ".text", flg: "rx", align: 4096, addr: 0x10000, size: text.length, data: text });
  exe.sec.push({ name: ".data", flg: "rw", align: 4096, addr: 0x20000, size: 4096, data: new Uint8Array(4096) });
  const binary = codec.pack(exe);

  const direct = new Rig();
  const directPath = direct.os.load("host-syscall.39", binary);
  const expected = await direct.run(directPath);
  assert.ok(expected.code > 0 && expected.code < 128, "the direct Thistle getcwd service did not return a valid path length");

  const generated = new Rig(null, false, provider, "teto");
  await generated.os.ready;
  assert.equal(generated.os.activeKernelMode, "teto");
  assert.equal(generated.os.s.env("THISTLE_TETO_STRICT"), "1");
  assert.equal(generated.os.s.env("THISTLE_RV_CORE"), "teto-wasm-core");
  const path = generated.os.load("host-syscall.39", binary);
  const result = await generated.run(path);
  assert.equal(result.code, expected.code, "Teto did not resume the host-serviced syscall; stderr=" + JSON.stringify(result.err));
  assert.equal(result.out, expected.out);
  assert.equal(result.err, expected.err);
  assert.equal(generated.os.k.executionCore, "Teto WebAssembly");
  assert.equal(generated.os.s.env("THISTLE_RV_CORE"), "teto-wasm-core");
});

test("mikuOS boot mode selects generated Teto without manual guest environment overrides", async () => {
  interface HFs { readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as HFs;
  const wasm = Uint8Array.from(await fs.readFile(new URL("../../dist/teto/teto.wasm", import.meta.url)));
  const image = Uint8Array.from(await fs.readFile(new URL("../../assets/hello-rv64.39", import.meta.url)));
  const provider: TetoImageProvider = { load: async () => wasm };
  const rig = new Rig(null, false, provider, "teto");
  await rig.os.ready;
  assert.equal(rig.os.activeKernelMode, "teto");
  assert.equal(rig.os.s.env("MIKUOS_KERNEL_MODE"), "teto");
  assert.equal(rig.os.s.env("THISTLE_RV_CORE"), "teto-wasm-core");
  assert.equal(rig.os.s.env("THISTLE_TETO_STRICT"), "1");
  assert.equal(rig.os.k.name, "Teto");
  await rig.os.hello();
  assert.ok(
    rig.out.includes(
      "Kernel source: Teto. Run 'help' for userland.",
    ),
    "Teto startup banner did not report Teto",
  );
  assert.ok(
    !rig.out.includes(
      "Kernel source: Thistle. Run 'help' for userland.",
    ),
    "Teto startup banner incorrectly reported Thistle",
  );
  const uname = await rig.run("uname -s");
  assert.equal(uname.out, "Teto\n");
  assert.ok(rig.os.s.read("/proc/version").startsWith("Teto version "));
  const path = rig.os.load("hello-rv64.39", image);
  const result = await rig.run(path);
  assert.equal(`${result.code}:${result.out}:${result.err}`, "0:hello from Teto RV64GC\n:");
});

test("mikuOS auto mode falls back cleanly when Teto validation fails", async () => {
  const provider: TetoImageProvider = { load: async () => new Uint8Array([0, 1, 2, 3]) };
  const rig = new Rig(null, false, provider, "auto");
  await rig.os.ready;
  assert.equal(rig.os.activeKernelMode, "thistle");
  assert.equal(rig.os.s.env("MIKUOS_KERNEL_MODE"), "thistle");
  assert.equal(rig.os.s.env("THISTLE_RV_CORE"), null);
  await rig.os.hello();
  assert.ok(
    rig.out.includes(
      "Kernel source: Thistle. Run 'help' for userland.",
    ),
    "Thistle fallback banner did not report Thistle",
  );
  assert.ok(
    !rig.out.includes(
      "Kernel source: Teto. Run 'help' for userland.",
    ),
    "Thistle fallback banner incorrectly reported Teto",
  );
});

test("explicit Thistle mode reports Thistle in the startup banner", async () => {
  const rig = new Rig(
    null,
    false,
    null,
    "thistle",
  );

  await rig.os.hello();

  assert.equal(rig.os.activeKernelMode, "thistle");
  assert.equal(rig.os.k.name, "Thistle");
  assert.ok(
    rig.out.includes(
      "Kernel source: Thistle. Run 'help' for userland.",
    ),
    "explicit Thistle banner did not report Thistle",
  );
  assert.ok(
    !rig.out.includes(
      "Kernel source: Teto. Run 'help' for userland.",
    ),
    "explicit Thistle banner incorrectly reported Teto",
  );
});

test("configuration separates kernel and OS identity with legacy compatibility", () => {
  assert.equal(IDENTITY.os.name, "mikuOS");
  assert.equal(IDENTITY.os.prettyName, "初音ミクOS v｡三");
  assert.equal(IDENTITY.os.expansion, "MIKU Is Not the Kernel; it's Userspace.");
  assert.equal(IDENTITY.thistle.expansion, "Thistle Hosted Interactive Shell-based TypeScript Live Environment.");
  assert.equal(IDENTITY.teto.expansion, "Teto Executes Thistle Optimally.");
  assert.equal(IDENTITY.guest.architecture, "Thistle64 RV64GC");
  assert.equal(IDENTITY.guest.executable, "THX");
  assert.equal(DEFAULT_CONFIG.kernel.name, "Thistle");
  assert.equal(DEFAULT_CONFIG.kernel.version, "2.1.0");
  assert.equal(DEFAULT_CONFIG.os.name, "mikuOS");
  assert.equal(DEFAULT_CONFIG.os.version, "0.3");

  const modern = mergeConfig({
    kernel: { version: "2.1-test" },
    os: { name: "mikuOS test", version: "0.3-test" },
  });
  assert.equal(modern.kernel.name, "Thistle");
  assert.equal(modern.kernel.version, "2.1-test");
  assert.equal(modern.os.name, "mikuOS test");
  assert.equal(modern.os.version, "0.3-test");

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
  assert.equal(legacy.kernel.name, "Legacy Kernel");
  assert.equal(legacy.kernel.version, "1.9.4");
  assert.equal(legacy.kernel.machine, "Legacy64");
  assert.equal(legacy.os.name, "Legacy OS");
  assert.equal(legacy.os.version, "0.3");
  assert.equal(legacy.os.homeUrl, "https://legacy.example");
  assert.ok(!("distro" in legacy), "legacy distro identity leaked into the normalised model");
});

test("local session policy selects direct, prompted and named login safely", () => {
  const direct = localSessionPlan(DEFAULT_CONFIG);
  assert.equal(direct.kind, "direct");
  assert.equal(direct.account.name, "root");
  assert.equal(direct.command, null);

  const promptConfig = mergeConfig({ sessions: { local: { mode: "login" } } });
  const prompt = localSessionPlan(promptConfig);
  assert.equal(prompt.kind, "login");
  assert.equal(prompt.account.cred.uid, 0);
  assert.equal(prompt.command, "/bin/login");

  const selected = localSessionPlan(mergeConfig({
    sessions: { local: { mode: "login", account: "alice" } },
  }));
  assert.equal(selected.command, "/bin/login alice");

  const unsafe = localSessionPlan(mergeConfig({
    sessions: { local: { mode: "login", account: "root; reboot" } },
  }));
  assert.equal(unsafe.command, "/bin/login", "unsafe selected account reached the shell command");

  let rejected = false;
  try {
    localSessionPlan(mergeConfig({
      accounts: { cli: { cred: { uid: 1000 } } },
      sessions: { local: { mode: "login" } },
    }));
  } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
    rejected = error instanceof Error && error.message.includes("UID 0");
  }
  assert.ok(rejected, "login mode accepted a non-root supervisor account");
});

test("supervised session commands do not enter root shell history", async () => {
  const r = new Rig();
  const before = r.os.sh.hist.join("\n");
  const result = await r.os.run("echo supervised", [], false);
  assert.equal(result, 0);
  assert.equal(r.os.sh.hist.join("\n"), before);
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
      return requireValue(results.shift() ?? null, "src/test/all.ts:1954");
    },
    unavailable: () => { unavailable++; },
  });

  assert.equal(commands.join("\n"), "/bin/login alice\n/bin/login alice\n/bin/login alice");
  assert.equal(unavailable, 1);
});

test("canonical mikuOS release metadata stays aligned", async () => {
  interface HFs { readFile(path: URL, encoding: "utf8"): Promise<string>; }

  const fs = await hostModule("node:fs/promises") as HFs;
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
  const pkg = parseJson(packageText) as { name: string | null; version: string | null; scripts: Record<string, string> | null };
  const fileConfig = parseJson(configText) as { os: { version: string | null } | null; kernel: { version: string | null } | null };
  const loaded = await hostConfig(new URL("mikuos.config.json", root));

  assert.equal(pkg.name, "mikuos");
  assert.equal(pkg.version, "0.3.0");
  assert.equal((withValue(pkg.scripts ?? null, value => (value["test:toolchain"] ?? null)) ?? null), "bun run thistlecc/test/test.ts");
  assert.ok((withValue(withValue(pkg.scripts ?? null, value => (value["test:guest-toolchain"] ?? null)) ?? null, value => value.includes("build/test/toolchain.js")) ?? null));
  assert.equal(withValue(fileConfig.os ?? null, value => value.version), "0.3");
  assert.equal(withValue(fileConfig.kernel ?? null, value => value.version), "2.1.0");
  assert.equal(loaded.os.prettyName, "初音ミクOS v｡三");
  assert.equal(loaded.kernel.machine, "Thistle64 RV64GC");
  assert.equal(sourceReleaseName(), "mikuos-0.3.0-thistle-2.1.0-source.tar.gz");
  assert.ok(manifest.includes("name: mikuOS"));
  assert.ok(manifest.includes("release: 0.3.0"));
  assert.ok(manifest.includes("release: 2.1.0"));
  assert.ok(manifest.includes("build_policy: host-only-thistlecc"));
  assert.ok(page.includes("<title>初音ミクOS v｡三</title>"));
  assert.ok(!ignore.split(/\r?\n/).includes("ports/"), "native source tree is broadly ignored");
  assert.ok(ignore.includes("ports/**/*.o"), "reproducible native objects are not ignored");
  assert.ok(mikuosEntry.includes('import "./src/main/cli.ts"'));
  assert.ok(thistleEntry.includes('import "./src/main/cli.ts"'));
});

test("Unicode Art Studio logo source is trimmed without losing its visible edges", async () => {
  const fs = (globalThis as typeof globalThis & {
    process: { getBuiltinModule(name: string): { promises: {
      readFile(path: URL, encoding: "utf8"): Promise<string>
    } } }
  }).process.getBuiltinModule("fs").promises;
  const original = await fs.readFile(new URL("../../src/boot/logo.txt", import.meta.url), "utf8");
  const rows = original.trimEnd().split(/\r?\n/).map(line =>
    line.replace(/<@?#(?:[A-Fa-f0-9]{6}|default)>/g, ""));
  assert.equal(rows.length, 12, "The Unicode export must not contain blank top/bottom rows");
  const ink = (glyph: string): boolean => glyph !== "⠀" && glyph !== " ";
  for (const row of rows) assert.equal([...row].length, 71,
    "The Unicode export must not retain empty left/right columns");
  assert.ok([...requireValue(rows[0] ?? null, "src/test/all.ts:2014")].some(ink));
  assert.ok([...requireValue(rows.at(-1) ?? null, "src/test/all.ts:2015")].some(ink));
  assert.ok(rows.some(row => ink(requireValue([...row][0] ?? null, "src/test/all.ts:2016"))));
  assert.ok(rows.some(row => ink(requireValue([...row].at(-1) ?? null, "src/test/all.ts:2017"))));
});

test("independent C/WASM boot display reports real milestones and cleans up xterm", async () => {
  const fs = (globalThis as typeof globalThis & {
    process: { getBuiltinModule(name: string): { promises: {
      readFile(path: URL): Promise<Uint8Array>
    } } }
  }).process.getBuiltinModule("fs").promises;
  const wasm = await fs.readFile(new URL("../../dist/web/boot.wasm", import.meta.url));
  assert.ok(WebAssembly.validate(Uint8Array.from(wasm)), "early C boot screen is not valid WASM");
  let instance: WebAssembly.Instance | null = null;
  const chunks: string[] = [];
  const module = await WebAssembly.instantiate(Uint8Array.from(wasm), {
    env: { emit(pointer: number, size: number): void {
      const memory = (requireValue(instance ?? null, "src/test/all.ts:2032").exports.memory ?? null) as WebAssembly.Memory;
      chunks.push(new TextDecoder().decode(new Uint8Array(memory.buffer, pointer, size)));
    } },
  });
  instance = module.instance;
  const boot = instance.exports as {
    boot_start(cols: number, rows: number): void;
    boot_update(step: number, done: number, total: number): void;
    boot_tick(): void;
    boot_finish(): void;
  };
  boot.boot_start(50, 24);
  boot.boot_update(3, 0, 0);
  boot.boot_tick();
  boot.boot_update(8, 0, 0);
  boot.boot_finish();
  const emitted = chunks.join("");
  console.log("[boot UI checks]", {
    heading: emitted.includes("Loading mikuOS"),
    oldHeading: emitted.includes("Welcome to mikuOS"),
    black: emitted.includes("\x1b[48;2;0;0;0m"),
    grey: emitted.includes("\x1b[48;2;22;24;29m"),
    percent: emitted.includes("100%"),
    filled: emitted.includes("█"),
    empty: emitted.includes("░"),
    glyph: emitted.includes("⣿"),
    stage: emitted.includes("Unpacking guest filesystem"),
  });
  assert.ok(emitted.includes("Loading mikuOS"), "The unfinished boot must say Loading mikuOS");
  assert.ok(!emitted.includes("Welcome to mikuOS"), "Do not welcome users before boot finishes");
  assert.ok(emitted.includes("\x1b[48;2;0;0;0m"), "The entire logo surround must be pure black");
  assert.ok(!emitted.includes("\x1b[48;2;22;24;29m"), "No dark-grey boot panel behind the logo");
  assert.ok(!emitted.includes("100%"), "The progress bar does not need a numeric percentage");
  assert.ok(emitted.includes("█") && emitted.includes("░"),
    "Keep the existing visual progress bar");
  assert.ok(emitted.includes("⣿"), "The original Unicode Braille artwork must survive WASM compilation");
  assert.ok(emitted.includes("\x1b[38;2;0;211;230m"),
    "The supplied Studio artwork must retain its original 24-bit cyan colours");
  assert.ok(emitted.includes("Unpacking guest filesystem"),
    "Boot progress should report the actual guest filesystem phase");
  assert.ok(emitted.includes("\x1b[?1049h") && emitted.includes("\x1b[?1049l"),
    "Boot screen must restore the original terminal buffer");
});

test("early boot centres xterm grid and restores its layout on completion", async () => {
  const fs = (globalThis as typeof globalThis & {
    process: { getBuiltinModule(name: string): { promises: {
      readFile(path: URL, encoding: "utf8"): Promise<string>;
      readFile(path: URL): Promise<Uint8Array>;
    } } }
  }).process.getBuiltinModule("fs").promises;
  const root = new URL("../../", import.meta.url);
  const source = await fs.readFile(new URL("dist/web/bootloader.js", root), "utf8");
  const wasm = await fs.readFile(new URL("dist/web/boot.wasm", root));
  const pixels = { width: 800 };
  const screen = {
    style: { transform: "" },
    getBoundingClientRect() { return { left: 100, width: 760 }; },
  };
  const host = {
    querySelector(name: string) { return name === ".xterm-screen" ? screen : null; },
    getBoundingClientRect() { return { left: 100, width: pixels.width }; },
  };
  const resizeState: { handler: ((size: { cols: number; rows: number }) => void) | null } = { handler: null };
  const term = {
    cols: 80,
    rows: 24,
    element: host,
    write(_data: string): void {},
    onResize(handler: (size: { cols: number; rows: number }) => void) {
      resizeState.handler = handler;
      return { dispose(): void {} };
    },
  };
  interface SplashApi { create(terminal: object, base: URL): Promise<{ finish(): void }> }
  const sandbox = { MikuBoot: null as SplashApi | null, TextDecoder,
    URL,
    WebAssembly,
    fetch: async () => ({ ok: true, arrayBuffer: async () => Uint8Array.from(wasm).buffer }),
    setInterval: () => 1,
    clearInterval: () => {},
  };
  // The built browser script populates its API inside this isolated VM.
  //@cg-expect-warning
  runInNewContext(source, sandbox);
  const boot = await requireValue(sandbox.MikuBoot ?? null, "src/test/all.ts:2118").create(term, new URL("https://example.test/mikuos/"));
  assert.equal(screen.style.transform, "translateX(20px)",
    "The grid's unused right-side pixels must be split equally to centre the splash");
  pixels.width = 840;
  withValue(resizeState.handler, callable => callable({ cols: 80, rows: 24 }));
  assert.equal(screen.style.transform, "translateX(40px)",
    "The loading screen must remain centred after a terminal resize");
  boot.finish();
  assert.equal(screen.style.transform, "",
    "The interactive terminal must regain its original screen placement");
});

test("classic thistle.js boots the static Teto guest without a runtime server", async () => {
  interface HFs {
    readFile(path: URL, encoding: "utf8"): Promise<string>;
    readFile(path: URL): Promise<Uint8Array>;
  }
  interface HProc { getBuiltinModule(name: string): { promises: HFs }; }
  interface FakeAddon { activate: ((terminal: FakeTerminal) => void) | null; }
  interface StaticHandle {
    persistent: boolean;
    session: WebSession;
    dispose(): void;
  }
  interface StaticApi {
    launchThistle(options: {
      terminal: object | null;
      config: typeof DEFAULT_CONFIG | null;
      persistence: boolean | null;
      kernel: KernelMode | null;
      tetoBase: string | URL | null;
      rootBase: string | URL | null;
    } | null): Promise<StaticHandle & { kernel: "thistle" | "teto" }>;
  }

  class FakeTerminal {
    rows = 24;
    cols = 80;
    loadAddon(addon: FakeAddon): void { withValue(addon.activate ?? null, callable => callable.call(addon, this)); }
    open(): void {}
    focus(): void {}
    write(text: string): void { output += text; }
    onData(_listener: (value: string) => void): { dispose(): void } { return { dispose: () => {} }; }
    onResize(_listener: (size: { rows: number; cols: number }) => void): { dispose(): void } { return { dispose: () => {} }; }
    dispose(): void {}
  }

  class FakeFit { activate(_terminal: FakeTerminal): void {} fit(): void {} dispose(): void {} }
  class FakeObserver { observe(): void {} disconnect(): void {} }

  const fs = (globalThis as typeof globalThis & { process: HProc }).process.getBuiltinModule("fs").promises;
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

  assert.ok(page.includes('<script defer src="./vendor/xterm.js"></script>'));
  assert.ok(page.includes('<script defer src="./vendor/xterm-fit.js"></script>'));
  assert.ok(page.includes('<script defer src="./bootloader.js"></script>'));
  assert.ok(page.includes('<script defer src="./boot-standalone.js"></script>'));
  assert.ok(!page.includes('<script defer src="./thistle.js"></script>'),
    "The full runtime must not load before the small boot WASM");
  assert.ok(!page.includes('type="module"'), "static page retained a module graph");
  assert.ok(xterm.includes("Terminal"), "static xterm.js asset is invalid");
  assert.ok(fit.includes("FitAddon"), "static fit-addon asset is invalid");
  assert.ok(css.includes(".xterm"), "static xterm stylesheet is invalid");
  assert.ok(source.includes("var Thistle ="));
  assert.ok(source.includes("launchThistle"));
  for (const [pattern, label] of forbidden) assert.ok(!pattern.test(source), `thistle.js contains forbidden ${label}`);

  let output = "";
  const node = {};
  const originalFetch = globalThis.fetch;
  const restoreGlobals: Array<() => void> = [];
  const setGlobal = <T>(name: string, value: T): void => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name) ?? null;
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    restoreGlobals.push(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  };
  setGlobal("document", {
    title: "",
    documentElement: { lang: "", dataset: {} },
    baseURI: "https://static.example/mikuos/",
    readyState: "loading",
    querySelector: () => node,
  });
  setGlobal("window", { addEventListener: () => {}, removeEventListener: () => {} });
  setGlobal("Terminal", FakeTerminal);
  setGlobal("FitAddon", { FitAddon: FakeFit });
  setGlobal("ResizeObserver", FakeObserver);
  setGlobal("fetch", async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/root/manifest.json")) return new Response(Uint8Array.from(manifest).buffer, { status: 200 });
    if (url.endsWith("/root/core.gz")) return new Response(Uint8Array.from(core).buffer, { status: 200 });
    if (url.endsWith("/teto/teto.wasm")) return new Response(Uint8Array.from(tetoBytes).buffer, { status: 200 });
    if (url.endsWith("/assets/hello-rv64.39")) return new Response(Uint8Array.from(rv64Bytes).buffer, { status: 200 });
    return new Response("not found", { status: 404 });
  });

  try {
    // Evaluate the emitted bundle before testing the public browser API.
    //@cg-expect-warning
    const api = Function(`${source}\nreturn Thistle;`)() as StaticApi;
    const handle = await api.launchThistle({"config": null, "kernel": null, "tetoBase": null, "rootBase": null,  terminal: node, persistence: false });
    assert.ok(!handle.persistent);
    assert.equal(handle.kernel, "teto");
    assert.equal(handle.session.os.activeKernelMode, "teto");
    assert.equal(handle.session.os.s.uid, 1000);
    assert.equal(handle.session.os.k.setId, true);
    assert.ok(requireValue(handle.session.os.k.mounts()[0] ?? null, "src/test/all.ts:2245").opt.includes("suid"));
    assert.equal(handle.session.os.s.stat("/usr/bin/sudo").mode, 0o4755);
    assert.ok(handle.session.os.k.fs.used() < 96 * 1024 * 1024, "static browser root eagerly expanded its packed userland");

    output = "";
    handle.session.key("whoami\r");
    await handle.session.idle();
    assert.ok(output.includes("guest\n"));

    output = "";
    const rv64Path = handle.session.os.load(
      "hello-rv64.39",
      Uint8Array.from(rv64Bytes),
    );
    assert.equal(await handle.session.os.run(rv64Path), 0);
    assert.ok(output.includes("hello from Teto RV64GC\n"), "static browser did not execute the generated Teto module");
    handle.dispose();
  } finally {
    for (const restore of restoreGlobals.reverse()) restore();
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

      assert.equal(kept, 3);
      assert.equal(closed, 4);

      requireValue(s.p.fds.get(closed) ?? null, "src/test/all.ts:2308").clo = true;
      s.cd("/tmp");
      s.setGroups([1000, 1000, 1003]);
      s.setResgid(1000, 1000, 1000);
      s.setResuid(1000, 1000, 1000);

      const env = new Map(s.env(null) as Map<string, string>);
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

  assert.equal(await r.os.s.wait(pid), 0);
  assert.equal(
    r.out,
    `${pid}:1000:1000:1000:1000:/tmp:present:one,two:true:false\n`,
  );
  assert.equal(child.pid, pid);
  assert.equal(child.cmd, "/bin/exec-target");
  assert.equal(child.argv.join(","), "exec-target,one,two");
});

test("process credentials preserve real, effective and saved identities", async () => {
  const r = new Rig();
  r.os.s.write("/tmp/effective-root", "secret\n", false, 0o600);
  r.os.s.p.cred = {"uid": null, "gid": null, ruid: 1000,
    euid: 0,
    suid: 0,
    rgid: 1000,
    egid: 0,
    sgid: 0,
    groups: [1000, 20],
  };
  r.os.s.p.fsuid = 0;
  r.os.s.p.fsgid = 0;
  assert.equal(r.os.s.ruid, 1000);
  assert.equal(r.os.s.euid, 0);
  assert.equal(r.os.s.suid, 0);
  assert.equal(r.os.s.rgid, 1000);
  assert.equal(r.os.s.egid, 0);
  assert.equal(r.os.s.sgid, 0);
  assert.equal(r.os.s.read("/tmp/effective-root"), "secret\n", "filesystem ignored effective root identity");

  const child = r.os.s.start("true", []);
  assert.equal(child.cred.ruid, 1000);
  assert.equal(child.cred.euid, 0);
  assert.equal(child.cred.suid, 0);
  assert.equal(child.cred.rgid, 1000);
  assert.equal(child.cred.egid, 0);
  assert.equal(child.cred.sgid, 0);
  r.os.s.p.cred.groups.push(99);
  assert.ok(!child.cred.groups.includes(99), "child shared its parent's supplementary group array");
  assert.equal(await r.os.s.wait(child.pid), 0);

  r.os.s.p.cred.euid = 1000;
  r.os.s.p.cred.egid = 1000;
  r.os.s.p.fsuid = 1000;
  r.os.s.p.fsgid = 1000;
  let denied = false;
  try { r.os.s.read("/tmp/effective-root"); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  denied = e instanceof KErr && e.code === "EACCES"; }
  assert.ok(denied, "filesystem used the real or saved root identity instead of the effective identity");
});

test("identity transitions enforce saved-ID and group rules atomically", async () => {
  const r = new Rig(), s = r.os.s;
  s.write("/tmp/root-only", "root\n", false, 0o600);
  s.setResgid(1000, 0, 0);
  s.setResuid(1000, 0, 0);
  assert.equal(s.ruid, 1000); assert.equal(s.euid, 0); assert.equal(s.suid, 0);
  assert.equal(s.rgid, 1000); assert.equal(s.egid, 0); assert.equal(s.sgid, 0);

  s.setGroups([0, 20, 1000]);
  assert.equal(s.groups.join(","), "0,20,1000");
  const exposed = s.groups; exposed.push(99);
  assert.ok(!s.groups.includes(99), "supplementary groups escaped by reference");

  s.setResuid(null, 1000, null);
  assert.equal(s.euid, 1000); assert.equal(s.suid, 0);
  let denied = false;
  try { s.setGroups([1000]); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  denied = e instanceof KErr && e.code === "EPERM"; }
  assert.ok(denied, "non-root process replaced supplementary groups");
  const before = JSON.stringify(s.p.cred);
  denied = false;
  try { s.setResuid(null, 2000, null); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  denied = e instanceof KErr && e.code === "EPERM"; }
  assert.ok(denied, "non-root process selected an unrelated effective uid");
  assert.equal(JSON.stringify(s.p.cred), before, "forbidden transition changed credentials");
  s.setResuid(null, 0, null);
  assert.equal(s.euid, 0, "saved uid could not restore effective root");

  assert.equal(s.setFsuid(1000), 0);
  denied = false;
  try { s.read("/tmp/root-only"); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  denied = e instanceof KErr && e.code === "EACCES"; }
  assert.ok(denied, "fsuid did not constrain filesystem access");
  assert.equal(s.setFsuid(0), 1000);
  assert.equal(s.read("/tmp/root-only"), "root\n");

  const temporary = new Rig().os.s;
  temporary.setResuid(1000, 0, 0);
  temporary.setReuid(null, 1000);
  assert.equal(temporary.suid, 0, "temporary effective drop destroyed the saved uid");
  temporary.setReuid(null, 0);
  assert.equal(temporary.euid, 0, "setreuid could not restore the saved uid");
  temporary.setReuid(1000, 1000);
  assert.equal(temporary.suid, 1000, "real-id change did not commit the saved uid");
  denied = false;
  try { temporary.setReuid(null, 0); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  denied = e instanceof KErr && e.code === "EPERM"; }
  assert.ok(denied, "permanently dropped uid was restored");

  const permanent = new Rig().os.s;
  permanent.setGid(1000);
  permanent.setUid(1000);
  assert.equal(`${permanent.ruid}:${permanent.euid}:${permanent.suid}`, "1000:1000:1000");
  assert.equal(`${permanent.rgid}:${permanent.egid}:${permanent.sgid}`, "1000:1000:1000");
  denied = false;
  try { permanent.setUid(0); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  denied = e instanceof KErr && e.code === "EPERM"; }
  assert.ok(denied, "permanent setuid drop was reversible");
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
  const vm = new Rv64(s) as object as RvHarness;
  vm.m = new Mem64(1024n * 1024n, 4 * 65536);
  vm.floor = 0x10000n; vm.brk = 0x20000n; vm.stackAt = 0xf0000n;

  vm.x[10] = 1000n; vm.x[11] = 0n; vm.x[12] = 0n;
  assert.equal(await vm.call(147), 0n);
  assert.equal(await vm.call(174), 1000n);
  assert.equal(await vm.call(175), 0n);

  vm.x[10] = 0x10000n; vm.x[11] = 0x10004n; vm.x[12] = 0x10008n;
  assert.equal(await vm.call(148), 0n);
  assert.equal(vm.m.u32(0x10000n), 1000); assert.equal(vm.m.u32(0x10004n), 0); assert.equal(vm.m.u32(0x10008n), 0);

  vm.m.set32(0x10000n, 0x12345678);
  vm.x[10] = 0x10000n; vm.x[11] = 0n; vm.x[12] = 0x10008n;
  let fault = false;
  try { await vm.call(148); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  fault = e instanceof KErr && e.code === "EFAULT"; }
  assert.ok(fault, "getresuid accepted a null result pointer");
  assert.equal(vm.m.u32(0x10000n), 0x12345678, "getresuid partially wrote before pointer validation");

  s.setGroups([7, 8]);
  vm.x[10] = 0n; vm.x[11] = 0n;
  assert.equal(await vm.call(158), 2n);
  vm.x[10] = 2n; vm.x[11] = 0x10100n;
  assert.equal(await vm.call(158), 2n);
  assert.equal(vm.m.u32(0x10100n), 7); assert.equal(vm.m.u32(0x10104n), 8);
  vm.m.set32(0x10110n, 20); vm.m.set32(0x10114n, 30);
  vm.x[10] = 2n; vm.x[11] = 0x10110n;
  assert.equal(await vm.call(159), 0n);
  assert.equal(s.groups.join(","), "20,30");

  s.write("/tmp/high-owner", "ownership\n");
  vm.m.write(0x10120n, enc("/tmp/high-owner\0"));
  vm.x[10] = -100n; vm.x[11] = 0x10120n;
  vm.x[12] = 0xfffffffen; vm.x[13] = 0xfffffffdn; vm.x[14] = 0n;
  assert.equal(await vm.call(54), 0n);
  assert.equal(s.stat("/tmp/high-owner").uid, 0xfffffffe);
  assert.equal(s.stat("/tmp/high-owner").gid, 0xfffffffd);

  const highOwner = s.open("/tmp/high-owner", "r+");
  vm.x[10] = BigInt(highOwner); vm.x[11] = 0xfffffffdn; vm.x[12] = 0xfffffffen;
  assert.equal(await vm.call(55), 0n);
  s.close(highOwner);
  assert.equal(s.stat("/tmp/high-owner").uid, 0xfffffffd);
  assert.equal(s.stat("/tmp/high-owner").gid, 0xfffffffe);

  vm.x[10] = -100n; vm.x[11] = 0x10120n;
  vm.x[12] = 0xffffffffn; vm.x[13] = 1n; vm.x[14] = 0n;
  let invalidOwner = false;
  try { await vm.call(54); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  invalidOwner = e instanceof KErr && e.code === "EINVAL"; }
  assert.ok(invalidOwner, "fchownat accepted the reserved all-ones uid");
  assert.equal(s.stat("/tmp/high-owner").uid, 0xfffffffd, "rejected fchownat changed ownership");

  vm.m.set32(0x10200n, 0); vm.m.set16(0x10204n, 0); vm.m.set16(0x10206n, 0xffff);
  vm.x[10] = 0x10200n; vm.x[11] = 1n; vm.x[12] = 0x10300n; vm.x[13] = 0n; vm.x[14] = 0n;
  assert.equal(await vm.call(73), 0n); assert.equal(vm.m.u16(0x10206n), 0, "ppoll rejected a valid standard descriptor");
  vm.m.set32(0x10200n, 99);
  assert.equal(await vm.call(73), 1n); assert.equal(vm.m.u16(0x10206n), 0x20, "ppoll did not mark an invalid descriptor");

  vm.x[10] = BigInt(s.pid); vm.x[11] = 0n;
  assert.equal(await vm.call(129), 1n, "RV64 kill(pid, 0) did not probe a live process");
  assert.ok(!s.p.ac.signal.aborted, "RV64 signal-zero probe delivered a signal");
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
  const vm = new Rv64(s) as object as RvRenameHarness;

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

  assert.equal(await vm.call(276), 0n);
  assert.equal(s.read("/tmp/renameat2-target"), "renamed\n");

  let oldMissing = false;

  try {
    s.stat("/tmp/renameat2-source");
  } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
    oldMissing =
      error instanceof KErr &&
      error.code === "ENOENT";
  }

  assert.ok(
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
  } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
    noReplace =
      error instanceof KErr &&
      error.code === "EEXIST";
  }

  assert.ok(
    noReplace,
    "RENAME_NOREPLACE replaced an existing target",
  );

  assert.equal(s.read("/tmp/renameat2-source"), "source\n");
  assert.equal(s.read("/tmp/renameat2-existing"), "existing\n");

  vm.x[14] = 2n;

  let unsupported = false;

  try {
    await vm.call(276);
  } catch (caughtValue) { const error = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
    unsupported =
      error instanceof KErr &&
      error.code === "EINVAL";
  }

  assert.ok(
    unsupported,
    "renameat2 accepted unsupported exchange semantics",
  );
});

test("identity commands distinguish real and effective users", async () => {
  const r = new Rig();
  r.os.s.setResgid(1000, 0, 0);
  r.os.s.setResuid(1000, 0, 0);
  const x = await r.run("id; whoami");
  assert.equal(x.code, 0); assert.equal(x.err, "");
  assert.ok(x.out.includes("uid=1000(guest) euid=0(root)"));
  assert.ok(x.out.includes("gid=1000(users) egid=0(root)"));
  assert.ok(x.out.endsWith("root\n"), "whoami did not report the effective user");
});

test("set-ID execution applies saved IDs only on suid mounts", async () => {
  const r = new Rig(null, true, null, null), s = r.os.s, native = s.readb("/usr/bin/hello.txe");
  const install = (path: string, uid: number, gid: number, mode: number): void => {
    s.writeb(path, native); s.chown(path, uid, gid); s.chmod(path, mode);
  };

  install("/tmp/setid.txe", 0, 20, 0o6755);
  install("/tmp/plain.txe", 0, 0, 0o0755);
  s.write("/tmp/setid-script", "#!/bin/thsh\nexit 0\n");
  s.chown("/tmp/setid-script", 0, 0); s.chmod("/tmp/setid-script", 0o4755);
  install("/tmp/guest-write.txe", 0, 0, 0o4777);

  const x = await r.run("ls -l /tmp/setid.txe");
  assert.ok(x.out.includes("-rwsr-sr-x"), "ls did not display set-user-ID and set-group-ID bits");

  install("/tmp/write-clear.txe", 0, 0, 0o6755);
  s.writeb("/tmp/write-clear.txe", native);
  assert.equal(s.stat("/tmp/write-clear.txe").mode, 0o0755, "content write retained set-ID bits");
  s.chmod("/tmp/write-clear.txe", 0o6755);
  const fd = s.open("/tmp/write-clear.txe", "r+"); s.fdw(fd, native.subarray(0, 8)); s.close(fd);
  assert.equal(s.stat("/tmp/write-clear.txe").mode, 0o0755, "descriptor write retained set-ID bits");
  s.chmod("/tmp/write-clear.txe", 0o6755); s.chown("/tmp/write-clear.txe", 0, 0);
  assert.equal(s.stat("/tmp/write-clear.txe").mode, 0o0755, "ownership change retained set-ID bits");

  s.setGroups([1000]);
  s.setResgid(1000, 1000, 1000);
  s.setResuid(1000, 1000, 1000);
  assert.ok((requireValue(withValue((r.os.k.mounts()[0] ?? null) ?? null, value => value.opt) ?? null, "src/test/all.ts:2654").includes("suid") ?? null));

  const plain = s.start("/tmp/plain.txe", []);
  assert.equal(`${plain.cred.ruid}:${plain.cred.euid}:${plain.cred.suid}`, "1000:1000:1000");
  assert.equal(await s.wait(plain.pid), 0);

  const elevated = s.start("/tmp/setid.txe", []);
  assert.equal(`${elevated.cred.ruid}:${elevated.cred.euid}:${elevated.cred.suid}`, "1000:0:0");
  assert.equal(`${elevated.cred.rgid}:${elevated.cred.egid}:${elevated.cred.sgid}`, "1000:20:20");
  const elevatedSys = new Sys(r.os.k, elevated);
  elevatedSys.setResuid(null, 1000, null);
  assert.equal(elevatedSys.euid, 1000); assert.equal(elevatedSys.suid, 0);
  elevatedSys.setResuid(null, 0, null);
  assert.equal(elevatedSys.euid, 0, "set-ID child could not restore its saved uid");
  assert.equal(await s.wait(elevated.pid), 0);
  assert.equal(`${s.ruid}:${s.euid}:${s.suid}`, "1000:1000:1000", "set-ID execution changed the parent");

  let denied = false;
  try { s.start("/tmp/setid-script", []); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  denied = e instanceof KErr && e.code === "EACCES"; }
  assert.ok(denied, "set-ID script was accepted on a suid mount");

  s.writeb("/tmp/user-owned.txe", native); s.chmod("/tmp/user-owned.txe", 0o4755);
  denied = false;
  try { s.chown("/tmp/user-owned.txe", 0, 0); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  denied = e instanceof KErr && e.code === "EPERM"; }
  assert.ok(denied, "non-root process created a root-owned executable");
  const harmless = s.start("/tmp/user-owned.txe", []);
  assert.equal(harmless.cred.euid, 1000, "user-owned set-ID file gained another identity");
  assert.equal(await s.wait(harmless.pid), 0);

  s.writeb("/tmp/guest-write.txe", native);
  assert.equal(s.stat("/tmp/guest-write.txe").mode, 0o0777, "unprivileged write retained root set-ID bit");
});

test("nosuid execution ignores file privilege bits", async () => {
  const r = new Rig(), s = r.os.s, native = s.readb("/usr/bin/hello.txe");
  s.writeb("/tmp/nosuid.txe", native); s.chown("/tmp/nosuid.txe", 0, 20); s.chmod("/tmp/nosuid.txe", 0o6755);
  s.setGroups([1000]); s.setResgid(1000, 1000, 1000); s.setResuid(1000, 1000, 1000);
  assert.ok((requireValue(withValue((r.os.k.mounts()[0] ?? null) ?? null, value => value.opt) ?? null, "src/test/all.ts:2691").includes("nosuid") ?? null));
  const child = s.start("/tmp/nosuid.txe", []);
  assert.equal(`${child.cred.ruid}:${child.cred.euid}:${child.cred.suid}`, "1000:1000:1000");
  assert.equal(`${child.cred.rgid}:${child.cred.egid}:${child.cred.sgid}`, "1000:1000:1000");
  assert.equal(await s.wait(child.pid), 0);
});

test("boot image and init", async () => {
  const r = new Rig();
  assert.equal(withValue((r.os.k.ps()[0] ?? null) ?? null, value => value.pid), 1);
  assert.equal(r.os.s.read("/etc/hostname"), "mikuos\n");
  const release = r.os.s.read("/etc/os-release");
  assert.ok(release.includes('NAME="mikuOS"'));
  assert.ok(release.includes('PRETTY_NAME="初音ミクOS v｡三"'));
  assert.ok(release.includes('VERSION="v0.3"'));
  assert.ok(release.includes('VERSION_ID="0.3"'));
  assert.ok(release.includes('KERNEL_NAME=Thistle'));
  assert.ok(release.includes('KERNEL_VERSION=2.1.0'));
  assert.ok(release.includes('KERNEL_SOURCE=Thistle'));
  assert.ok(r.os.s.read("/etc/motd").includes("mikuOS v0.3"));
  assert.ok(r.os.s.apps().length >= 50, "core userland is incomplete");
  assert.equal(r.os.s.stat("/bin/thsh").mode, 0o755);
  assert.equal(r.os.s.stat("/usr/libexec/mikuos/builtin/thsh").mode, 0o755);
  const builtins = parseJson(r.os.s.read("/usr/share/mikuos/builtin-commands.json")) as {
    schema: number;
    commands: Array<{ name: string; activePath: string; rescuePath: string }>;
  };
  assert.equal(builtins.schema, 1);
  assert.equal(builtins.commands.length, r.os.s.apps().length);
  assert.ok(builtins.commands.some(command =>
    command.name === "true" &&
    command.activePath === "/bin/true" &&
    command.rescuePath === "/usr/libexec/mikuos/builtin/true"
  ));
  const compiler = parseJson(r.os.s.read("/usr/share/mikuos/compiler-infrastructure.json")) as {
    schema: number;
    integration: Array<{ path: string }>;
  };
  assert.equal(compiler.schema, 1);
  assert.ok(compiler.integration.some(component => component.path === "/usr/libexec/thistle/thx-cc"));
  const uname = await r.run("uname -s; uname -r");
  assert.equal(uname.code, 0);
  assert.equal(uname.out, "Thistle\n2.1.0\n");
  assert.ok(r.os.s.read("/proc/version").startsWith("Thistle version 2.1.0 "));
  const bootManifest = r.os.s.read("/boot/mikuos.yaml");
  assert.equal(bootManifest, r.os.s.read("/boot/thistle.yaml"));
  assert.ok(bootManifest.includes("os_name: mikuOS"));
  assert.ok(bootManifest.includes("os_release: v0.3"));
  assert.ok(bootManifest.includes("kernel_source: Thistle"));
  assert.ok(bootManifest.includes("host_compiler: thistlecc"));
});

test("every built-in rescue command has a runnable help path", async () => {
  const r = new Rig();
  for (const a of r.os.s.apps()) {
    const path = `/usr/libexec/mikuos/builtin/${a.name}`;
    const x = await r.run(`${path} --help`);
    assert.equal(x.code, 0, `${path} --help failed`);
    assert.equal(x.err, "", `${path} --help wrote an error`);
    assert.ok(x.out.startsWith("usage:"), `${path} has no usage text`);
  }
});

test("inode data, links and permissions", () => {
  const r = new Rig();
  r.os.s.mkdir("/tmp/fs");
  r.os.s.write("/tmp/fs/a", "one");
  r.os.s.link("/tmp/fs/a", "/tmp/fs/b");
  r.os.s.write("/tmp/fs/b", "two");
  assert.equal(r.os.s.read("/tmp/fs/a"), "two");
  r.os.s.symlink("a", "/tmp/fs/c");
  assert.equal(r.os.s.read("/tmp/fs/c"), "two");
  assert.equal(r.os.s.stat("/tmp/fs/a").nlink, 2);
  r.os.s.chmod("/tmp/fs/a", 0o600);
  let e: Error | null = null;
  try { r.os.k.fs.read("/tmp/fs/a", "/", {"ruid": null, "euid": null, "suid": null, "rgid": null, "egid": null, "sgid": null, uid: 1000, gid: 1000, groups: [1000] }); } catch (caughtValue) { const x = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  e = x; }
  assert.ok(e instanceof KErr && e.code === "EACCES", "guest bypassed mode bits");
  const g = { uid: 1000, gid: 1000, ruid: 1000, euid: 1000, suid: 1000, rgid: 1000, egid: 1000, sgid: 1000, groups: [1000] };
  r.os.k.fs.write("/home/guest/own", "mine", "/", g);
  assert.equal(r.os.k.fs.stat("/home/guest/own", "/", g).uid, 1000);
});

test("descriptor offsets and append", () => {
  const r = new Rig();
  r.os.s.write("/tmp/fd", "abcdef");
  const fd = r.os.s.open("/tmp/fd", "r+");
  assert.equal(dec(r.os.s.fdr(fd, 2)), "ab");
  r.os.s.seek(fd, 3);
  r.os.s.fdw(fd, enc("XY"));
  r.os.s.close(fd);
  assert.equal(r.os.s.read("/tmp/fd"), "abcXYf");
  const ap = r.os.s.open("/tmp/fd", "a");
  r.os.s.fdw(ap, enc("!"));
  r.os.s.close(ap);
  assert.equal(r.os.s.read("/tmp/fd"), "abcXYf!");
});

test("the complete root survives a fresh boot", async () => {
  const tree = new MemTree(), quiet = { put: () => {}, tree };
  const a = boot(quiet, null);
  await a.ready;
  a.s.mkdir("/var/persistence-test"); a.s.write("/var/persistence-test/main.c", "int main(void) { return 7; }\n");
  a.s.link("/var/persistence-test/main.c", "/var/persistence-test/copy.c"); a.s.chmod("/var/persistence-test/main.c", 0o640);
  a.s.write("/made-at-root", "persistent\n");
  a.s.write("/etc/motd", "locally replaced\n"); a.s.chmod("/etc/motd", 0o640); a.s.chown("/etc/motd", 1000, 1000);
  a.s.rm("/etc/issue");
  await a.flush();
  assert.ok(tree.ent && tree.ent.some(x => x.p === "/var/persistence-test/main.c" && x.data), "host tree did not receive /var/persistence-test/main.c");
  assert.ok(withValue(tree.ent ?? null, value => value.some(x => x.p === "/made-at-root")), "host tree did not receive a file created under /");
  assert.ok(!withValue(tree.ent ?? null, value => value.some(x => x.p === "/etc/issue")), "deleting a system file was not persisted");
  assert.ok(!withValue(tree.ent ?? null, value => value.some(x => x.p === "/dev" || x.p.startsWith("/dev/") || x.p === "/proc" || x.p.startsWith("/proc/"))), "live mounts leaked into persistent storage");

  const b = boot(quiet, null);
  await b.ready;
  assert.equal(b.s.read("/var/persistence-test/copy.c"), "int main(void) { return 7; }\n");
  assert.equal(b.s.read("/made-at-root"), "persistent\n");
  assert.equal(b.s.read("/etc/motd"), "locally replaced\n"); assert.equal(b.s.stat("/etc/motd").mode, 0o640); assert.equal(b.s.stat("/etc/motd").uid, 1000);
  assert.equal(b.s.stat("/var/persistence-test/main.c").nlink, 2); assert.equal(b.s.stat("/var/persistence-test/main.c").mode, 0o640);
  let gone = false; try { b.s.stat("/etc/issue"); } catch { gone = true; }
  assert.ok(gone, "the base image resurrected a deleted system file");
  assert.equal(b.s.stat("/dev/null").kind, "char", "restoring / removed devfs");
  assert.ok(b.s.read("/proc/mounts").includes("hostfs / thistlefs rw"), "persistent / is absent from /proc/mounts");
});

test("versioned image migration changes stock identity but preserves local identity", async () => {
  const tree = new MemTree(), quiet = { put: () => {}, tree }, a = boot(quiet, null);
  await a.ready;
  const issue = (withValue(tree.ent ?? null, value => (value.find(x => x.p === "/etc/issue") ?? null)) ?? null);
  const release = (withValue(tree.ent ?? null, value => (value.find(x => x.p === "/etc/os-release") ?? null)) ?? null);
  const motd = (withValue(tree.ent ?? null, value => (value.find(x => x.p === "/etc/motd") ?? null)) ?? null);
  assert.ok(withValue(issue ?? null, value => value.data) && withValue(release ?? null, value => value.data) && withValue(motd ?? null, value => value.data), "identity files were not persisted");
  requireValue(issue ?? null, "src/test/all.ts:2822").data = enc("Thistle OS 2.0.0 \\n \\l\n");
  requireValue(release ?? null, "src/test/all.ts:2823").data = enc("locally branded\n");
  requireValue(motd ?? null, "src/test/all.ts:2824").data = enc("Welcome to Thistle 2.0.0, the 64-bit TypeScript Unix-like system.\nRun 'hello.txe' for Thistle64, 'hello32.txe' for compatibility, or 'help'.\n");
  tree.imageVersion = 0;

  const b = boot(quiet, null);
  await b.ready;
  assert.equal(b.s.read("/etc/issue"), DEFAULT_CONFIG.messages.issue);
  assert.equal(b.s.read("/etc/os-release"), "locally branded\n");
  assert.equal(b.s.read("/etc/motd"), DEFAULT_CONFIG.messages.motd);
  assert.equal(tree.imageVersion, ROOT_IMAGE_VERSION);
});

test("an invalid optional root package does not prevent base-system boot", async () => {
  let error = "";
  const os = boot({"halt": null, "tree": null, "requireTree": null, "config": null, "account": null, "setId": null, "teto": null, "kernelMode": null, "onBootProgress": null, put: (text, channel) => { if (channel === "err") error += text; },
    pkg: { install: async () => { throw new Error("truncated test package"); } },
  }, null);
  await os.ready;
  assert.equal(os.s.read("/etc/hostname"), "mikuos\n");
  assert.ok(error.includes("Optional root package was not installed: truncated test package"));
  assert.ok(os.k.logs.some(line => line.includes("pkg: install failed: truncated test package")));
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
  const hfs = (globalThis as typeof globalThis & { process: HProc }).process.getBuiltinModule("fs").promises;
  let refused = false; try { new DirTree("/"); } catch { refused = true; }
  assert.ok(refused, "the adapter accepted the host filesystem root as guest storage");
  const dir = await hfs.mkdtemp("/tmp/mikuos-host-test-");
  try {
    const a = boot({"halt": null, "requireTree": null, "pkg": null, "config": null, "account": null, "setId": null, "teto": null, "kernelMode": null, "onBootProgress": null, put: () => {}, tree: new DirTree(dir) }, null);
    await a.ready;
    assert.equal(dec(await hfs.readFile(`${dir}/etc/hostname`)), "mikuos\n", "first boot did not seed the complete host root");
    assert.equal((await hfs.lstat(`${dir}/root`)).mode & 0o777, 0o700, "guest directory mode was not applied to the host root");
    a.s.mkdir("/var/persistence-test");
    a.s.write("/var/persistence-test/a.txt", "one\n"); a.s.link("/var/persistence-test/a.txt", "/var/persistence-test/b.txt"); a.s.chmod("/var/persistence-test/a.txt", 0o640);
    a.s.symlink("/etc/hostname", "/var/persistence-test/host-name");
    a.s.rm("/etc/issue");
    await a.flush();
    assert.equal(dec(await hfs.readFile(`${dir}/var/persistence-test/a.txt`)), "one\n");
    assert.equal(await hfs.readlink(`${dir}/var/persistence-test/host-name`), "../../etc/hostname", "an absolute guest link escaped the host root");
    let sa = await hfs.lstat(`${dir}/var/persistence-test/a.txt`), sb = await hfs.lstat(`${dir}/var/persistence-test/b.txt`);
    assert.equal(sa.ino, sb.ino, "guest hard link was copied instead of linked"); assert.equal(sa.mode & 0o777, 0o640);

    a.s.write("/var/persistence-test/b.txt", "two\n"); await a.flush();
    assert.equal(dec(await hfs.readFile(`${dir}/var/persistence-test/a.txt`)), "two\n", "hard-link update did not reach the first host name");
    sa = await hfs.lstat(`${dir}/var/persistence-test/a.txt`); sb = await hfs.lstat(`${dir}/var/persistence-test/b.txt`);
    assert.equal(sa.ino, sb.ino, "flushing a hard-link update split the host inode");

    await hfs.writeFile(`${dir}/host.c`, enc("int host(void) { return 2; }\n"));
    const b = boot({"halt": null, "requireTree": null, "pkg": null, "config": null, "account": null, "setId": null, "teto": null, "kernelMode": null, "onBootProgress": null, put: () => {}, tree: new DirTree(dir) }, null);
    await b.ready; assert.equal(b.s.read("/host.c"), "int host(void) { return 2; }\n");
    assert.equal(b.s.readlink("/var/persistence-test/host-name"), "/etc/hostname", "absolute guest link changed after a boot");
    let issueGone = false; try { b.s.stat("/etc/issue"); } catch { issueGone = true; }
    assert.ok(issueGone, "host-directory boot resurrected a deleted system file");
    b.s.rm("/host.c"); await b.flush();
    let missing = false; try { await hfs.lstat(`${dir}/host.c`); } catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  missing = (e as Error & { code: string | null }).code === "ENOENT"; }
    assert.ok(missing, "deleting an imported host file did not delete the real file");
  } finally { await hfs.rm(dir, { recursive: true, force: true }); }
});

test("quoting, variables and command gates", async () => {
  const r = new Rig();
  let x = await r.run("export COLOUR=green; echo '$COLOUR' \"$COLOUR\"");
  assert.equal(x.out, "$COLOUR green\n");
  x = await r.run("false && echo bad; false || echo good; true && echo yes");
  assert.equal(x.out, "good\nyes\n");
  assert.equal(x.code, 0);
  x = await r.run("A=one; A=two env | grep '^A=two$'; echo ok # ; echo nope");
  assert.equal(x.out, "A=two\nok\n");
});

test("command and colon are handled inside /bin/thsh", async () => {
  const r = new Rig();

  let x = await r.run("/bin/thsh -c ':'");
  assert.equal(x.code, 0);
  assert.equal(x.out, "");

  x = await r.run("/bin/thsh -c 'false; :; echo $?'");
  assert.equal(x.code, 0);
  assert.equal(x.out, "0\n", "colon must reset exit status to success");

  x = await r.run("/bin/thsh -c 'command -v :; command -v command; command -v true'");
  assert.equal(x.code, 0);
  assert.equal(x.out, ":\ncommand\n/bin/true\n");

  x = await r.run("/bin/thsh -c 'command -p -v true'");
  assert.equal(x.code, 0);
  assert.equal(x.out, "/bin/true\n");

  x = await r.run("/bin/thsh -c 'command -V command'");
  assert.equal(x.code, 0);
  assert.equal(x.out, "command is a shell built-in\n");

  x = await r.run("/bin/thsh -c 'alias echo=false; command echo bypasses-alias'");
  assert.equal(x.code, 0);
  assert.equal(x.out, "bypasses-alias\n", "command must not expand aliases of its operand");

  x = await r.run("/bin/thsh -c 'command -v no-such-program'");
  assert.equal(x.code, 1);
  assert.equal(x.out, "");

  x = await r.run("/bin/thsh -c 'command no-such-program'");
  assert.equal(x.code, 127);

  x = await r.run("/bin/thsh -c 'command false'");
  assert.equal(x.code, 1);

  x = await r.run("/bin/thsh -c 'command cd /tmp; pwd'");
  assert.equal(x.code, 0);
  assert.equal(x.out, "/tmp\n", "command cd must act in the same shell");

  x = await r.run("/bin/thsh -c ': > /tmp/colon-created; cat /tmp/colon-created'");
  assert.equal(x.code, 0);
  assert.equal(x.out, "");
  assert.equal(r.os.s.read("/tmp/colon-created"), "");

  for (const name of ["/bin/command", "/bin/:"]) {
    let installed = true;
    try { r.os.s.stat(name); } catch { installed = false; }
    assert.ok(!installed, name + " must remain a shell built-in, not a separate executable");
  }
});

test("GNU head dd od and Bash are actual pre-built THX2 guest executables", async () => {
  const file = await import("node:fs/promises");
  const r = new Rig();
  for (const command of ["head", "dd", "od", "bash"]) {
    const path = "/bin/" + command;
    const bin = new Uint8Array(await file.readFile(new URL("../../.thistle.base" + path, import.meta.url), null));
    assert.equal(dec(bin.slice(0, 4)), "THX2",
      path + " must be native GNU RV64GC THX2, not a TypeScript launcher");
    assert.ok(bin.length > 256, path + " is not a complete executable");
    r.os.s.mkfile(path, bin, 0o755);
  }

  let x = await r.run("printf 'first\nsecond\n' | /bin/head -n 1");
  assert.equal(x.code, 0);
  assert.equal(x.out, "first\n");
  x = await r.run("printf 'ABC' > /tmp/gnu-data; /bin/dd if=/tmp/gnu-data of=/tmp/gnu-copy bs=1 count=3");
  assert.equal(x.code, 0, x.err);
  assert.equal(r.os.s.read("/tmp/gnu-copy"), "ABC");
  x = await r.run("/bin/od -An -tx1 /tmp/gnu-copy");
  assert.equal(x.code, 0);
  assert.ok(/\b41\s+42\s+43\b/.test(x.out), "GNU od output does not match the copied bytes");
  x = await r.run("/bin/bash -c 'printf bash-ready'");
  assert.equal(x.code, 0, x.err);
  assert.equal(x.out, "bash-ready");
});

test("thsh folds physical line continuations without changing quoted here-documents", async () => {
  const r = new Rig();
  const slash = String.fromCharCode(92);
  const lines = (...value: string[]): string => value.join("\n");

  let x = await r.run(lines(`echo alpha ${slash}`, "beta"));
  assert.equal(x.code, 0);
  assert.equal(x.out, "alpha beta\n");

  x = await r.run(lines(`printf '%s' "double${slash}`, "quoted\""));
  assert.equal(x.code, 0);
  assert.equal(x.out, "doublequoted");

  x = await r.run(lines(`printf '%s' 'single${slash}`, "quoted'"));
  assert.equal(x.code, 0);
  assert.equal(x.out, `single${slash}\nquoted`);

  x = await r.run(lines(`printf '%s\\n' literal${slash}${slash}`, "echo next"));
  assert.equal(x.code, 0);
  assert.equal(x.out, `literal${slash}\nnext\n`, "an escaped literal backslash became a continuation");

  x = await r.run(`echo comment-ok # 'not a quote ${slash}`);
  assert.equal(x.code, 0);
  assert.equal(x.out, "comment-ok\n", "comment text incorrectly made the command incomplete");

  x = await r.run(`echo unfinished ${slash}`);
  assert.equal(x.code, 2);
  assert.ok(x.err.includes("trailing escape"), "a trailing escape did not report a syntax error");

  r.os.s.write(
    "/tmp/continued.thsh",
    lines("#!/bin/thsh", `echo script ${slash}`, "continued", ""),
    false,
    0o755,
  );
  r.os.s.chmod("/tmp/continued.thsh", 0o755);
  x = await r.run("/tmp/continued.thsh");
  assert.equal(x.code, 0);
  assert.equal(x.out, "script continued\n");

  x = await r.run(lines("cat <<'EOF'", `left${slash}`, "right", "EOF", ""));
  assert.equal(x.code, 0);
  assert.equal(x.out, `left${slash}\nright\n`, "a quoted here-document body was folded");

  x = await r.run(lines("cat <<EOF", `left${slash}`, "right", "EOF", ""));
  assert.equal(x.code, 0);
  assert.equal(x.out, "leftright\n", "an unquoted here-document lost its established expansion rules");
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

  assert.equal(executed, 'echo "test"');
  assert.ok(
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
  assert.equal(executed.length, 1, "a pasted continuation executed more than once");
  assert.equal(requireValue(executed[0] ?? null, "src/test/all.ts:3079").source, `echo pasted ${slash}\nworks`);
  assert.ok(output.includes("> "), "the continuation prompt was not rendered");
  let x = await r.run(requireValue(executed.shift() ?? null, "src/test/all.ts:3081").source);
  assert.equal(x.code, 0);
  assert.equal(x.out, "pasted works\n");

  editor.key(`echo literal ${slash}${slash}\r`);
  assert.equal(executed.length, 1, "an escaped literal backslash incorrectly requested another line");
  executed.shift();

  output = "";
  editor.key(`echo cancelled ${slash}\r`);
  assert.equal(executed.length, 0);
  editor.key("\x03");
  editor.key("echo kept\r");
  assert.equal(executed.length, 1);
  assert.equal(requireValue(executed.shift() ?? null, "src/test/all.ts:3095").source, "echo kept");
  assert.ok(output.includes("^C"), "Ctrl+C did not visibly cancel continuation input");

  editor.key(`echo eof ${slash}\r`);
  editor.key("\x04");
  assert.equal(halted, 0, "EOF halted the shell while a command was incomplete");
  assert.equal(executed.length, 1);
  x = await r.run(requireValue(executed.shift() ?? null, "src/test/all.ts:3102").source);
  assert.equal(x.code, 2);
  assert.ok(x.err.includes("trailing escape"), "EOF did not surface the incomplete command error");

  editor.key("\x04");
  assert.equal(halted, 1, "EOF on an empty complete prompt did not halt the shell");
});

test("redirects and filesystem commands", async () => {
  const r = new Rig();
  const x = await r.run("mkdir -p /tmp/a/b && echo first > /tmp/a/b/x && echo second >> /tmp/a/b/x && cp /tmp/a/b/x /tmp/a/y && cat /tmp/a/y");
  assert.equal(x.code, 0);
  assert.equal(x.out, "first\nsecond\n");
  assert.equal(r.os.s.read("/tmp/a/b/x"), "first\nsecond\n");
  await r.run("rm -r /tmp/a");
  let miss = false; try { r.os.s.stat("/tmp/a"); } catch { miss = true; }
  assert.ok(miss, "recursive rm left the tree behind");
  await r.run("umask 077; touch /tmp/private");
  assert.equal(r.os.s.stat("/tmp/private").mode, 0o600, "umask was not inherited by a child");
});

test("streaming pipeline closes upstream", async () => {
  const r = new Rig();
  const file = await import("node:fs/promises");
  const head = new Uint8Array(await file.readFile(new URL("../../.thistle.base/bin/head", import.meta.url), null));
  r.os.s.mkfile("/bin/head", head, 0o755);
  const x = await r.run("yes thistle | head -n 3");
  assert.equal(x.out, "thistle\nthistle\nthistle\n");
  assert.equal(x.err, "", "SIGPIPE leaked as a diagnostic");
  assert.equal(x.code, 0);
  assert.ok(r.os.k.ps().length === 2, "pipeline children were not reaped");
  const y = await r.run("printf 'kept\\n' | thsh -c 'echo first; cat'");
  assert.equal(y.out, "first\nkept\n", "a nested process closed its shell stdin");
});

test("text tool pipeline", async () => {
  const r = new Rig();
  const x = await r.run("printf 'pear\\napple\\npear\\nplum\\n' | sort | uniq -c | grep -E '2 pear'");
  assert.equal(x.code, 0);
  assert.ok(x.out.includes("2 pear"));
});

test("background jobs and signals", async () => {
  const r = new Rig();
  let x = await r.run("sleep 30 &");
  assert.ok(/^\[1\] \d+\n$/.test(x.out));
  x = await r.run("jobs");
  assert.ok(x.out.includes("Running"));
  await r.run("kill %1");
  x = await r.run("wait %1");
  assert.equal(x.code, 143);
  assert.equal(r.os.sh.jobs.size, 0);
});

test("scripts retain shell state", async () => {
  const r = new Rig();
  r.os.s.write("/tmp/t.thsh", "#!/bin/thsh\nexport X=inside\necho $X\ncd /tmp\npwd\n", false, 0o755);
  r.os.s.chmod("/tmp/t.thsh", 0o755);
  const x = await r.run("/tmp/t.thsh");
  assert.equal(x.out, "inside\n/tmp\n");
  assert.equal(r.os.s.cwd, "/root", "child script changed the parent cwd");
});

test("interactive TTY supports canonical and raw input", async () => {
  let out = "", sig = 0;
  const tty = new Tty((s) => { out += s; }, () => { sig++; });
  const line = tty.input.rd();
  tty.feed("hello\r");
  assert.equal(dec(await line), "hello\n");
  assert.equal(out, "hello\r\n");
  const raw = tty.termios(), v = new DataView(raw.buffer);
  v.setUint32(12, v.getUint32(12, true) & ~0x0a, true);
  tty.setTermios(raw, false);
  const key = tty.input.rd();
  tty.feed("\x1b[A");
  assert.equal(dec(await key), "\x1b[A");
  tty.resize(42, 132);
  assert.equal(tty.size().rows, 42); assert.equal(tty.size().cols, 132); assert.equal(sig, 0);
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
  assert.equal((await waiting).length, 0, "interrupted terminal read did not wake");
  const restored = new DataView(tty.termios().buffer);
  assert.ok(!!(restored.getUint32(12, true) & 0x08), "echo was not restored");
  assert.equal(signals, 1);
  assert.ok(out.includes("^C"), "interrupt was not displayed");
  assert.ok(!out.includes("uncommitted-secret"), "hidden input was echoed");
  const next = tty.input.rd();
  tty.feed("clean\r");
  assert.equal(dec(await next), "clean\n", "partial secret survived the interrupt");
});

test("process signal masks defer delivery across critical sections", () => {
  const r = new Rig(), p = r.os.p, interrupt = 1n << 1n;
  assert.equal(p.setSignalMask(0, interrupt), 0n);
  assert.equal(p.signalMask, interrupt);
  assert.equal(p.signal(2), false, "masked signal was delivered immediately");
  assert.equal(p.sig, null);
  assert.ok(!p.ac.signal.aborted, "masked signal aborted the process");
  assert.equal(p.setSignalMask(1, interrupt), interrupt);
  assert.equal(p.sig, 2);
  assert.ok(p.ac.signal.aborted, "pending signal was not delivered after unmasking");

  const k = new Rig().os.p;
  k.setSignalMask(0, 1n << 8n);
  assert.equal(k.signalMask, 0n, "SIGKILL was maskable");
  assert.equal(k.signal(9), true);
  assert.equal(k.sig, 9);
});

test("signal zero probes process ownership without delivery", () => {
  const r = new Rig();
  assert.equal(r.os.s.kill(r.os.p.pid, 0), 1);
  assert.ok(!r.os.p.ac.signal.aborted, "signal zero interrupted its target");

  let error = "";
  try {
    r.os.s.kill(0x7fffffff, 0);
  } catch (caughtValue) { const caught = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));
    error = caught instanceof KErr ? caught.code : "unexpected";
  }

  assert.equal(error, "ESRCH", "a missing process passed a signal-zero probe");
});

test("/dev/tty opens the controlling terminal", () => {
  const r = new Rig();
  const fd = r.os.s.open("/dev/tty", "r+");
  const f = (r.os.s.p.fds.get(fd) ?? null);
  assert.ok(withValue(withValue(f ?? null, value => value.input) ?? null, value => value.tty), "/dev/tty has no terminal input");
  assert.ok(withValue(withValue(f ?? null, value => value.output) ?? null, value => value.tty), "/dev/tty has no terminal output");
  assert.equal(requireValue(requireValue(f ?? null, "src/test/all.ts:3242").input ?? null, "src/test/all.ts:3238").tty, requireValue(requireValue(f ?? null, "src/test/all.ts:3242").output ?? null, "src/test/all.ts:3238").tty, "/dev/tty streams use different terminals");
  r.os.s.close(fd);
});

test("web account boots as the configured unprivileged user", async () => {
  const config = mergeConfig({ sessions: { local: { mode: "login", account: "root" } } });
  const r = boot({"halt": null, "tree": null, "requireTree": null, "pkg": null, "setId": null, "teto": null, "kernelMode": null, "onBootProgress": null, put: () => {}, config, account: config.accounts.web }, null);
  await r.ready;
  assert.equal(r.s.uid, 1000); assert.equal(r.s.gid, 1000); assert.equal(r.s.env("USER"), "guest"); assert.equal(r.s.cwd, "/home/guest");
});

test("shell restores commands when saved history has become a directory", async () => {
  const tree = new MemTree();
  const output: string[] = [];
  const session = (): Os => boot({"halt": null, "requireTree": null, "pkg": null, "teto": null, "kernelMode": null, "onBootProgress": null, put: value => { output.push(value); },
    tree,
    config: DEFAULT_CONFIG,
    account: DEFAULT_CONFIG.accounts.web,
    setId: true,
  }, null);
  const history = "/home/guest/.thsh_history";
  const first = session();
  await first.ready;
  assert.equal(await first.run("pwd"), 0);
  assert.ok(first.s.read(history).includes("pwd"));

  // Recreate a damaged legacy snapshot: a root-owned, non-empty directory
  // occupies the history filename before the next browser visit.
  const original = (requireValue(tree.ent ?? null, "src/test/all.ts:3272").find(entry => entry.p === history) ?? null);
  assert.ok(original);
  const identifier = Math.max(...requireValue(tree.ent ?? null, "src/test/all.ts:3274").map(entry => entry.id)) + 1;
  tree.ent = [
    ...requireValue(tree.ent ?? null, "src/test/all.ts:3276").map(entry => entry.p === history
      ? { data: null, source: null, size: null, sum: null, to: null, p: entry.p, k: "d" as const, id: entry.id, uid: 0, gid: 0, mode: 0o755,
        at: entry.at, mt: entry.mt, ct: entry.ct }
      : entry),
    { ...original, p: `${history}/important.txt`, k: "f", id: identifier,
      data: enc("preserve this directory"), uid: 0, gid: 0, mode: 0o644 },
  ];

  const reopened = session();
  await reopened.ready;
  assert.equal(reopened.s.stat(history).kind, "dir");
  output.length = 0;
  assert.equal(await reopened.run("pwd"), 0);
  assert.ok(output.join("").includes("/home/guest"), "the command did not execute");
  assert.equal(reopened.s.stat(history).kind, "file");
  const backups = reopened.s.list("/home/guest")
    .map(([name]) => name)
    .filter(name => name.startsWith(".thsh_history.recovered-"));
  assert.equal(backups.length, 1);
  assert.equal(reopened.s.read(`/home/guest/${(backups[0] ?? null)}/important.txt`), "preserve this directory");
  assert.ok(reopened.s.read(history).includes("pwd"));

  const third = session();
  await third.ready;
  assert.equal(third.s.stat(history).kind, "file");
  assert.ok(third.s.read(history).includes("pwd"));
  assert.equal(await third.run("help"), 0);
});

test("failed shell history writes warn once and never prevent commands", async () => {
  const errors: string[] = [];
  const os = boot({"halt": null, "tree": null, "requireTree": null, "pkg": null, "teto": null, "kernelMode": null, "onBootProgress": null, put: (value, channel) => { if (channel === "err") errors.push(value); },
    config: DEFAULT_CONFIG,
    account: DEFAULT_CONFIG.accounts.web,
    setId: true,
  }, null);
  await os.ready;
  const originalWrite = os.s.write.bind(os.s);
  const failingWrite = (path: string, content: string, append = false, mode = 0o666): void => {
    if (path.endsWith("/.thsh_history")) throw new KErr("EIO", path);
    originalWrite(path, content, append, mode);
  };
  os.s.write = failingWrite;

  assert.equal(await os.run("pwd"), 0);
  assert.equal(await os.run("help"), 0);
  assert.equal(errors.filter(value => value.includes("history not saved")).length, 1);
  assert.ok(os.sh.hist.includes("pwd"), "failed history write lost in-memory history");
  assert.ok(os.sh.hist.includes("help"), "subsequent command was not recorded");
});

test("browser OPFS overlay recovers from stale entry types across reloads", async () => {
  class MemoryFile {
    readonly kind = "file" as const;
    bytes: Uint8Array = new Uint8Array();
    constructor(readonly name: string) {}
    async getFile(): Promise<File> {
      const bytes = Uint8Array.from(this.bytes);
      return {
        arrayBuffer: async () => bytes.buffer,
        text: async () => dec(bytes),
      } as File;
    }
    async createWritable(): Promise<{ write(value: Uint8Array | string): Promise<void>; close(): Promise<void> }> {
      return {
        write: async value => { this.bytes = typeof value === "string" ? enc(value) : Uint8Array.from(value); },
        close: async () => {},
      };
    }
  }

  class MemoryDirectory {
    readonly kind = "directory" as const;
    readonly children = new Map<string, MemoryDirectory | MemoryFile>();
    constructor(readonly name: string) {}
    async *entries(): AsyncGenerator<[string, MemoryDirectory | MemoryFile], void, void> {
      yield* this.children;
    }
    async getDirectoryHandle(name: string, options: { create: boolean | null } = {"create": null}): Promise<MemoryDirectory> {
      const entry = (this.children.get(name) ?? null);
      if (entry instanceof MemoryDirectory) return entry;
      if (entry) throw new DOMException("Existing entry is a file", "TypeMismatchError");
      if (!options.create) throw new DOMException("Missing directory", "NotFoundError");
      const directory = new MemoryDirectory(name);
      this.children.set(name, directory);
      return directory;
    }
    async getFileHandle(name: string, options: { create: boolean | null } = {"create": null}): Promise<MemoryFile> {
      const entry = (this.children.get(name) ?? null);
      if (entry instanceof MemoryFile) return entry;
      if (entry) throw new DOMException("Existing entry is a directory", "TypeMismatchError");
      if (!options.create) throw new DOMException("Missing file", "NotFoundError");
      const file = new MemoryFile(name);
      this.children.set(name, file);
      return file;
    }
    async removeEntry(name: string, options: { recursive: boolean | null } = {"recursive": null}): Promise<void> {
      const entry = (this.children.get(name) ?? null);
      if (!entry) throw new DOMException("Missing entry", "NotFoundError");
      if (entry instanceof MemoryDirectory && entry.children.size && !options.recursive) {
        throw new DOMException("Directory is not empty", "InvalidModificationError");
      }
      this.children.delete(name);
    }
  }

  const storage = new MemoryDirectory("");
  const originalNavigator = (Object.getOwnPropertyDescriptor(globalThis, "navigator") ?? null);
  const originalFetch = globalThis.fetch;
  const attributes = { mode: 0o755, uid: 0, gid: 0, at: 0, mt: 0, ct: 0 };
  const root: TreeEnt[] = [
    {"data": null, "sum": null, "size": null, "source": null, "to": null, ...attributes, p: "/", k: "d", id: 1 },
    {"data": null, "sum": null, "size": null, "source": null, "to": null, ...attributes, p: "/home", k: "d", id: 2 },
    {"data": null, "sum": null, "size": null, "source": null, "to": null, ...attributes, p: "/home/guest", k: "d", id: 3 },
  ];
  const file = (path: string, value: string, id: number): TreeEnt => ({"sum": null, "size": null, "source": null, "to": null, ...attributes, p: path, k: "f", id, uid: 1000, gid: 1000, data: enc(value),
  });
  const folder = (path: string, id: number): TreeEnt => ({"data": null, "sum": null, "size": null, "source": null, "to": null, ...attributes, p: path, k: "d", id, uid: 1000, gid: 1000,
  });
  const manifest = {
    format: 1,
    image: ROOT_IMAGE_VERSION,
    generated: "2026-01-01T00:00:00.000Z",
    core: { path: "core.gz", encoding: "gzip", packedSize: 20, unpackedSize: 0 },
    entries: root,
  };
  const emptyGzip = Uint8Array.from([
    31, 139, 8, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { storage: { getDirectory: async () => storage } },
  });
  const mockFetch = async (input: RequestInfo | URL): Promise<Response> => {
    const path = String(input);
    if (path.endsWith("/root/manifest.json")) return new Response(JSON.stringify(manifest));
    if (path.endsWith("/root/core.gz")) return new Response(emptyGzip.buffer);
    throw new Error(`Unexpected static root request: ${path}`);
  };
  globalThis.fetch = Object.assign(mockFetch, { preconnect: () => {} });

  try {
    const path = "/home/guest/.thsh_history";
    const original = new WebTree(new URL("https://example.test/root/"));
    await original.pull();
    await original.push([...root, file(path, "ls\n", 4)], null);

    const reopened = new WebTree(new URL("https://example.test/root/"));
    const before = await reopened.pull();
    assert.equal(dec(withValue((before.find(entry => entry.p === path) ?? null) ?? null, value => value.data) ?? new Uint8Array()), "ls\n");

    // Emulate a stale OPFS directory left at a path now occupied by a guest file.
    const overlay = await storage.getDirectoryHandle(".mikuos");
    const data = await overlay.getDirectoryHandle("data");
    const home = await data.getDirectoryHandle("home");
    const guest = await home.getDirectoryHandle("guest");
    await guest.removeEntry(".thsh_history");
    const stale = await guest.getDirectoryHandle(".thsh_history", { create: true });
    await stale.getFileHandle("old", { create: true });
    await reopened.push([...root, file(path, "ls\npwd\n", 4)], null);

    const recovered = new WebTree(new URL("https://example.test/root/"));
    const after = await recovered.pull();
    assert.equal(dec(withValue((after.find(entry => entry.p === path) ?? null) ?? null, value => value.data) ?? new Uint8Array()), "ls\npwd\n");

    // File -> directory and directory -> file must both work across saves.
    const scratch = "/home/guest/scratch";
    await recovered.push([...root, file(path, "ls\npwd\n", 4), file(scratch, "first\n", 5)], null);
    await recovered.push([
      ...root, file(path, "ls\npwd\n", 4),
      folder(scratch, 6), file(`${scratch}/nested`, "nested\n", 7),
    ], null);
    const asDirectory = new WebTree(new URL("https://example.test/root/"));
    assert.equal(dec(withValue(((await asDirectory.pull()).find(entry => entry.p === `${scratch}/nested`) ?? null) ?? null, value => value.data) ?? new Uint8Array()), "nested\n");
    await asDirectory.push([...root, file(path, "ls\npwd\n", 4), file(scratch, "second\n", 8)], null);
    const asFile = new WebTree(new URL("https://example.test/root/"));
    const final = await asFile.pull();
    assert.equal(dec(withValue((final.find(entry => entry.p === scratch) ?? null) ?? null, value => value.data) ?? new Uint8Array()), "second\n");
    assert.ok(!final.some(entry => entry.p === `${scratch}/nested`), "deleted directory child survived");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("browser session restores history before Up and autocomplete", async () => {
  let output = "";
  const web = new WebSession(
    {"halt": null, write: text => { output += text; } },
    {"tree": null, "net": null, "kernelMode": null, "teto": null, "onBootProgress": null, config: DEFAULT_CONFIG },
  );
  await web.ready;
  web.restoreHistory(["echo previously-entered", "ls"]);
  assert.equal(web.os.sh.hist.join("|"), "echo previously-entered|ls");
  assert.ok(web.os.sh.historyMatches("echo prev").includes("echo previously-entered"));

  output = "";
  web.key("\x1b[A");
  assert.ok(output.includes("ls"), "Up should return the restored last command");
  web.key("\x03");
  assert.ok(web.os.sh.historyMatches("echo prev").includes("echo previously-entered"),
    "Restored history must remain available to autocomplete");
});

test("browser session runs the full guest locally without a runtime server", async () => {
  let output = "";
  const device = new TestNet();
  const web = new WebSession(
    {"halt": null, write: text => { output += text; } },
    {"tree": null, "kernelMode": null, "teto": null, "onBootProgress": null, config: DEFAULT_CONFIG, net: new Net(device) },
  );

  await web.ready;
  assert.equal(web.os.s.uid, 1000);
  assert.equal(web.os.s.env("USER"), "guest");
  assert.equal(web.os.k.setId, true);
  assert.ok(requireValue(web.os.k.mounts()[0] ?? null, "src/test/all.ts:3496").opt.includes("suid"));
  assert.equal(device.seen.length, 0, "browser boot contacted a runtime service");

  output = "";
  web.key("whoami\r");
  await web.idle();
  assert.ok(output.includes("guest\n"), "local browser shell did not execute whoami");

  output = "";
  web.key("hello.txe\r");
  await web.idle();
  assert.ok(
    output.includes("Hello from native Thistle assembly!\n"),
    "local browser kernel did not execute the bundled Thistle64 program",
  );
  assert.equal(device.seen.length, 0, "local browser commands contacted a runtime service");
});

test("native WebAssembly loader and WASI", async () => {
  const r = new Rig();
  assert.ok(WebAssembly.validate(Uint8Array.from(demoWasm()) as BufferSource), "bundled module is invalid");
  const x = await r.run("hello.wasm");
  assert.equal(x.code, 0);
  assert.equal(x.out, "Hello from a real WASI binary inside Thistle!\n");
  const f = await r.run("file /usr/bin/hello.wasm");
  assert.ok(f.out.includes("WebAssembly binary module"));
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
  const a = new Asm(null, {"defs": {}, "arch": "thistle64",  debug: true }).run(src, "unit.tas");
  assert.ok(a.obj.sym.some(x => x.name === "_start" && x.bind === "global"));
  assert.equal(a.obj.machine, "thistle64");
  assert.ok(a.obj.rel.some(x => x.type === "abs64" && x.sym === "msg"));
  assert.ok(a.obj.rel.some(x => x.type === "rel64"));
  const ob = codec.pack(a.obj), oq = codec.unpack(ob);
  assert.ok(oq instanceof Obj, "object codec changed its kind");
  const z = new Link().run([a.obj]);
  assert.equal(z.exe.entry, 0x10000);
  assert.ok(z.map.includes("_start"));
  const bad = ob.slice(); bad[bad.length - 1] = requireValue(bad[bad.length - 1] ?? null, "src/test/all.ts:3553") ^ 1;
  let hit = false; try { codec.unpack(bad); } catch { hit = true; }
  assert.ok(hit, "object checksum accepted changed bytes");
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
  const x = await r.run("/tmp/ops.txe"); assert.equal(x.code, 0); assert.equal(x.err, "");
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
  assert.equal(z.machine, "thistle64"); assert.equal(z.mem, 1024 * 1024 * 1024 * 1024);
  r.os.s.writeb("/tmp/wide.txe", codec.pack(z)); r.os.s.chmod("/tmp/wide.txe", 0o755);
  const x = await r.run("/tmp/wide.txe"); assert.equal(x.code, 0); assert.equal(x.err, "");

  const hi = new Link().run([new Asm().run(".text\n.global _start\n_start: li x0, 0\n halt\n", "high.tas").obj], {"entry": null, "mem": null, "names": null,  base: 0x100000000 }).exe;
  assert.equal(hi.entry, 0x100000000, "the host linker truncated a 64-bit image base");
  r.os.s.writeb("/tmp/high.txe", codec.pack(hi)); r.os.s.chmod("/tmp/high.txe", 0o755);
  const y = await r.run("/tmp/high.txe"); assert.equal(y.code, 0); assert.equal(y.err, "");
});

test("native tools assemble, link, inspect and execute", async () => {
  const r = new Rig();
  let x = await r.run("hello.txe");
  assert.equal(x.code, 0); assert.equal(x.out, "Hello from native Thistle assembly!\n");
  x = await r.run("hello32.txe");
  assert.equal(x.code, 0); assert.equal(x.out, "Hello from Thistle 1 compatibility assembly!\n");
  x = await r.run("fib.txe");
  assert.equal(x.code, 0); assert.equal(x.out, "5\n", "native calls or stack frames are broken");

  x = await r.run("as -g --listing /tmp/hello.lst -o /tmp/hello.to /usr/share/thistle/examples/hello.tas");
  assert.equal(x.code, 0); assert.equal(x.err, ""); assert.ok(r.os.s.read("/tmp/hello.lst").includes("sys SYS_write"));
  x = await r.run("ld --Map /tmp/hello.map -o /tmp/hello.txe /tmp/hello.to && /tmp/hello.txe");
  assert.equal(x.code, 0); assert.equal(x.out, "Hello from native Thistle assembly!\n"); assert.ok(r.os.s.read("/tmp/hello.map").includes("entry _start"));
  x = await r.run("file /tmp/hello.to /tmp/hello.txe; nm -g /tmp/hello.to; size /tmp/hello.txe; dis -hr /tmp/hello.to");
  assert.ok(x.out.includes("thistle64 relocatable object")); assert.ok(x.out.includes("native executable")); assert.ok(x.out.includes(" T _start")); assert.ok(x.out.includes("abs64"));

  x = await r.run("as --32 -o /tmp/hello32.to /usr/share/thistle/examples/hello32.tas && ld -o /tmp/hello32.txe /tmp/hello32.to && /tmp/hello32.txe");
  assert.equal(x.code, 0); assert.equal(x.out, "Hello from Thistle 1 compatibility assembly!\n");
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
  assert.equal(x.code, 9, "crt0 or cross-object call returned the wrong status"); assert.equal(x.err, "");

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
  assert.equal(x.code, 0); assert.equal(x.out, "written by thistle64\n"); assert.equal(r.os.s.stat("/tmp/from-native").mode, 0o640);

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
  assert.equal(x.code, 0, "native spawn/wait did not use the kernel process table");
});

test("HTTP stack and wget userland", async () => {
  const dev = new TestNet();
  const r = new Rig(new Net(dev));
  let x = await r.run("wget -S http://unit.test/go -O /tmp/payload");
  assert.equal(x.code, 0);
  assert.equal(r.os.s.read("/tmp/payload"), "network payload\n");
  assert.ok(x.err.includes("HTTP 200 OK"));
  assert.equal(dev.seen.length, 2, "redirect was not followed");
  assert.equal(r.os.k.net.calls, 2);
  assert.ok(r.os.s.read("/proc/net/dev").includes("requests 2 failed 0"));

  x = await r.run("wget -qO- http://unit.test/file");
  assert.equal(x.code, 0);
  assert.equal(x.out, "network payload\n");
  assert.equal(x.err, "");

  x = await r.run("wget --post-data=hello -O - http://unit.test/post");
  assert.equal(x.code, 0);
  assert.equal(x.out, "hello");
  assert.equal(withValue((dev.seen.at(-1) ?? null) ?? null, value => value.method), "POST");

  x = await r.run("wget --spider http://unit.test/gone");
  assert.equal(x.code, 8, "HTTP failure did not use wget's server-error code");

  x = await r.run("wget --max-size=2 -O /tmp/small http://unit.test/file");
  assert.equal(x.code, 4, "oversized response did not use wget's network-error code");
  let made = true; try { r.os.s.stat("/tmp/small"); } catch { made = false; }
  assert.equal(made, false, "wget left a partial oversized file");

  x = await r.run("wget --max-redirect=0 -O /tmp/loop http://unit.test/go");
  assert.equal(x.code, 4, "redirect limit was ignored");
});

test("devices and procfs are live", async () => {
  const r = new Rig();
  assert.equal(r.os.s.readb("/dev/zero").slice(0, 32).every(x => x === 0), true);
  assert.ok(r.os.s.read("/proc/version").includes("Thistle version"));
  assert.ok(r.os.s.read("/proc/version").includes("Thistle TypeScript"));
  const cat = await r.run("cat /proc/version");
  assert.equal(cat.out.split("\n").filter(Boolean).length, 1, "proc file did not reach EOF");
  await new Promise<void>(resolve => setTimeout(resolve, 5));
  assert.ok(Number.parseFloat(r.os.s.read("/proc/uptime")) > 0);
  let e: Error | null = null; try { r.os.s.write("/dev/full", "x"); } catch (caughtValue) { const x = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  e = x; }
  assert.ok(e instanceof KErr && e.code === "ENOSPC");
});

test("globs, find and metadata", async () => {
  const r = new Rig();
  await r.run("mkdir /tmp/g; touch /tmp/g/a.txt /tmp/g/b.txt /tmp/g/nope; chmod 640 /tmp/g/a.txt");
  let x = await r.run("echo /tmp/g/*.txt");
  assert.equal(x.out, "/tmp/g/a.txt /tmp/g/b.txt\n");
  x = await r.run("find /tmp/g -name '*.txt' -type f | sort");
  assert.equal(x.out, "/tmp/g/a.txt\n/tmp/g/b.txt\n");
  assert.equal(r.os.s.stat("/tmp/g/a.txt").mode, 0o640);
});

test("mikuOS consumes the exact Thistle -> Bake -> Baguette Teto build", async () => {
  interface TextFs { readFile(path: URL, encoding: "utf8"): Promise<string>; readFile(path: URL): Promise<Uint8Array>; }

  const fs = await hostModule("node:fs/promises") as TextFs;
  const config = parseJson(await fs.readFile(
    new URL("../../deps/teto/baguette.config.json", import.meta.url), "utf8",
  )) as { entries: string[] | null; canonicalSource: string | null; completeKernel: boolean | null; memory: { initialPages: number | null } | null };
  assert.equal(config.canonicalSource, "Thistle");
  assert.equal(config.completeKernel, true);
  assert.equal(withValue(config.memory ?? null, value => value.initialPages), 8192);
  assert.ok((withValue(config.entries ?? null, value => value.some(path => path.endsWith("/src/native/kernel.ts"))) ?? null),
    "mikuOS must declare the canonical native Thistle kernel entry");
  assert.ok(!(withValue(config.entries ?? null, value => value.some(path => path.includes("src/teto/"))) ?? null),
    "mikuOS must never build Teto from a local second kernel");
  const manifest = parseJson(await fs.readFile(
    new URL("../../dist/teto/teto.manifest.json", import.meta.url), "utf8",
  )) as {
    canonicalSource: string | null;
    canonicalRevision: string | null;
    canonicalOriginalEntries: string[] | null;
    canonicalOriginalModules: string[] | null;
    generatedFrom: Array<{ path: string; sha256: string }> | null;
  };
  assert.equal(manifest.canonicalSource, "Thistle");
  const selectedSha = (parseJson(await fs.readFile(
    new URL("../../deps/teto/teto.manifest.json", import.meta.url), "utf8",
  )) as { canonicalRevision: string }).canonicalRevision;
  assert.equal(manifest.canonicalRevision, selectedSha);
  assert.ok((withValue(manifest.canonicalOriginalEntries ?? null, value => value.some(path => path.endsWith("/src/native/kernel.ts"))) ?? null),
    "Teto manifest must identify the original Thistle kernel source");
  assert.ok((withValue(manifest.canonicalOriginalModules ?? null, value => value.some(path => path.endsWith("/src/native/kernel.ts"))) ?? null),
    "Teto manifest must record the original native Thistle source graph");
  assert.ok(!(withValue(manifest.canonicalOriginalModules ?? null, value => value.some(path => path.endsWith("/src/teto/kernel.ts"))) ?? null),
    "A separate Teto kernel must not enter the transitive compilation graph");
  assert.ok((withValue(manifest.generatedFrom ?? null, value => value.some(entry => entry.path.endsWith("/src/native/kernel.ts"))) ?? null),
    "Generated WebAssembly must contain the Bake-lowered Thistle kernel");
  for (const name of ["abi.ts", "kernel.ts", "memory.ts", "start.ts", "thx.ts", "types.ts", "vfs.ts", "word.ts"]) {
    const thistle = await fs.readFile(new URL(`../../deps/teto/thistle/src/native/${name}`, import.meta.url), "utf8");
    const legacy = await fs.readFile(new URL(`../../src/teto/${name}`, import.meta.url), "utf8");
    assert.equal(legacy, thistle, `Local compatibility copy of ${name} diverged from canonical Thistle`);
  }
  for (const name of ["teto.wasm", "teto-threads.wasm"]) {
    const upstream = await fs.readFile(new URL(`../../deps/teto/dist/teto/${name}`, import.meta.url));
    const release = await fs.readFile(new URL(`../../dist/teto/${name}`, import.meta.url));
    const web = await fs.readFile(new URL(`../../dist/web/teto/${name}`, import.meta.url));
    assert.equal(release.byteLength, upstream.byteLength, `${name}: package size differs from the upstream compiler output`);
    assert.ok(release.every((byte, index) => byte === (upstream[index] ?? null)), `${name}: packaged bytes differ from Teto`);
    assert.equal(web.byteLength, upstream.byteLength, `${name}: browser package size differs from upstream`);
    assert.ok(web.every((byte, index) => byte === (upstream[index] ?? null)), `${name}: browser kernel is not the exact Thistle-origin WASM`);
  }
});

let pass = 0;
for (const [name, fn] of tests) {
  try { await fn(); console.log(`ok ${++pass} - ${name}`); }
  catch (caughtValue) { const e = caughtValue instanceof Error ? caughtValue : new Error(typeof caughtValue === "undefined" ? "undefined" : String(caughtValue));  console.error(`not ok ${pass + 1} - ${name}`); throw e; }
}
console.log(`1..${tests.length}`);
