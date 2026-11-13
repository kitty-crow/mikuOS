import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rv64Branch } from "../../src/core/rv64-branch.ts";
import { rv64ImmediateOpValid, rv64ImmediateOpValue } from "../../src/core/rv64-immediate-op.ts";
import { rv64RegisterValid, rv64RegisterValue } from "../../src/core/rv64-register.ts";
import { rv64FloatClass } from "../../src/core/rv64-fclass.ts";
import {
  rv64DivideSigned,
  rv64DivideUnsigned,
  rv64MulHighSigned,
  rv64MulHighSignedUnsigned,
  rv64MulHighUnsigned,
  rv64RemainderSigned,
  rv64RemainderUnsigned,
} from "../../src/core/rv64-arithmetic.ts";
import {
  rv64CompressedJump,
  rv64ImmediateB,
  rv64ImmediateI,
  rv64ImmediateJ,
  rv64ImmediateS,
  rv64ImmediateU,
} from "../../src/vm/rv64-immediate.ts";

interface NativeCore {
  rv64Branch(funct3: number, left: bigint, right: bigint): number;
  rv64ImmediateOpValid(funct3: number, instruction: number): number;
  rv64ImmediateOpValue(funct3: number, instruction: number, left: bigint): bigint;
  rv64RegisterValid(funct3: number, top: number): number;
  rv64RegisterValue(funct3: number, top: number, left: bigint, right: bigint): bigint;
  rv64FloatClass(raw: bigint, bits: number): bigint;
  rv64DivideSigned(left: bigint, right: bigint, bits: number): bigint;
  rv64DivideUnsigned(left: bigint, right: bigint, bits: number): bigint;
  rv64RemainderSigned(left: bigint, right: bigint, bits: number): bigint;
  rv64RemainderUnsigned(left: bigint, right: bigint, bits: number): bigint;
  rv64MulHighSigned(left: bigint, right: bigint): bigint;
  rv64MulHighSignedUnsigned(left: bigint, right: bigint): bigint;
  rv64MulHighUnsigned(left: bigint, right: bigint): bigint;
  rv64ImmediateI(instruction: number): number;
  rv64ImmediateS(instruction: number): number;
  rv64ImmediateB(instruction: number): number;
  rv64ImmediateU(instruction: number): number;
  rv64ImmediateJ(instruction: number): number;
  rv64CompressedJump(instruction: number): number;
}

const bytes = await readFile(new URL("../../dist/thistle-core-probe/thistle-core-probe.wasm", import.meta.url));
const module = await WebAssembly.instantiate(bytes, {
  env: { memory: new WebAssembly.Memory({ initial: 256, maximum: 32768 }) },
});
const native = module.instance.exports as unknown as NativeCore;
const compare = [
  ["rv64ImmediateI", rv64ImmediateI],
  ["rv64ImmediateS", rv64ImmediateS],
  ["rv64ImmediateB", rv64ImmediateB],
  ["rv64ImmediateU", rv64ImmediateU],
  ["rv64ImmediateJ", rv64ImmediateJ],
  ["rv64CompressedJump", rv64CompressedJump],
] as const;

let instruction = 0x12345678;
for (let index = 0; index < 20000; index++) {
  instruction = Math.imul(instruction, 1664525) + 1013904223 | 0;
  for (const [name, direct] of compare) {
    const expected = direct(instruction);
    const actual = native[name](instruction);
    assert.equal(actual, expected, `${name} disagrees for 0x${(instruction >>> 0).toString(16)}`);
  }
}
const samples = [
  -(1n << 63n), -(1n << 48n), -2n, -1n, 0n, 1n, 2n,
  1n << 48n, (1n << 63n) - 1n,
];
for (const left of samples) for (const right of samples) {
  for (const funct3 of [0, 1, 2, 3, 4, 5, 6, 7]) {
    assert.equal(native.rv64Branch(funct3, left, right), rv64Branch(funct3, left, right),
      `rv64Branch disagrees: funct3=${funct3} left=${left} right=${right}`);
  }
}
const signed64 = (n: bigint): bigint => BigInt.asIntN(64, n);
let random = 0x715a9e23;
const nextWord = (): number => {
  random = Math.imul(random, 1664525) + 1013904223 | 0;
  return random >>> 0;
};
const registers: bigint[] = [
  -(1n << 63n), -(1n << 63n) + 1n, -1n, 0n, 1n, 2n, (1n << 63n) - 1n,
];
for (let index = 0; index < 250; index++) {
  registers.push(signed64((BigInt(nextWord()) << 32n) | BigInt(nextWord())));
}
for (const top of [0, 1, 0x20, 2]) for (let funct3 = 0; funct3 < 8; funct3++) {
  const valid = rv64RegisterValid(funct3, top);
  assert.equal(native.rv64RegisterValid(funct3, top), valid, "register validity mismatch");
  if (valid === 0) continue;
  for (let index = 0; index < registers.length; index++) {
    const left = registers[index]!;
    const right = registers[(index * 37 + 11) % registers.length]!;
    const direct = rv64RegisterValue(funct3, top, left, right);
    assert.equal(native.rv64RegisterValue(funct3, top, left, right), direct,
      `register mismatch funct3=${funct3} top=${top} left=${left} right=${right}`);
  }
}

let immState = 0xc0ffee12;
for (let index = 0; index < 1500; index++) {
  immState = Math.imul(immState, 1664525) + 1013904223 | 0;
  const instruction = immState >>> 0;
  for (let funct3 = 0; funct3 < 8; funct3++) {
    const valid = rv64ImmediateOpValid(funct3, instruction);
    assert.equal(native.rv64ImmediateOpValid(funct3, instruction), valid, "immediate validity mismatch");
    if (valid === 0) continue;
    const left = registers[(index + funct3 * 23) % registers.length]!;
    assert.equal(native.rv64ImmediateOpValue(funct3, instruction, left),
      rv64ImmediateOpValue(funct3, instruction, left),
      `immediate operation mismatch instruction=${instruction} funct3=${funct3} left=${left}`);
  }
}

const floatCategories: Array<[bigint, number, bigint]> = [
  [0xff800000n, 32, 1n], [0xbf800000n, 32, 2n], [0x80000001n, 32, 4n],
  [0x80000000n, 32, 8n], [0n, 32, 16n], [1n, 32, 32n],
  [0x3f800000n, 32, 64n], [0x7f800000n, 32, 128n],
  [0x7f800001n, 32, 256n], [0x7fc00000n, 32, 512n],
  [0xfff0000000000000n, 64, 1n], [0xbff0000000000000n, 64, 2n],
  [0x8000000000000001n, 64, 4n], [0x8000000000000000n, 64, 8n],
  [0n, 64, 16n], [1n, 64, 32n],
  [0x3ff0000000000000n, 64, 64n], [0x7ff0000000000000n, 64, 128n],
  [0x7ff0000000000001n, 64, 256n], [0x7ff8000000000000n, 64, 512n],
];
for (const [raw, bits, category] of floatCategories) {
  assert.equal(rv64FloatClass(raw, bits), category, "canonical TypeScript FCLASS oracle");
  assert.equal(native.rv64FloatClass(raw, bits), category, "Baguette native FCLASS category");
}

const unsigned = (n: bigint): bigint => BigInt.asUintN(64, n);
const signed = (n: bigint): bigint => BigInt.asIntN(64, n);
const boundaries = [
  -(1n << 63n), -(1n << 63n) + 1n, -(1n << 31n), -65537n,
  -2n, -1n, 0n, 1n, 2n, 65537n, (1n << 31n) - 1n, (1n << 63n) - 1n,
];
for (const left of boundaries) for (const right of boundaries) {
  const bothUnsigned = [unsigned(left), unsigned(right)] as const;
  assert.equal(native.rv64MulHighSigned(left, right), rv64MulHighSigned(left, right), "signed high multiply");
  assert.equal(native.rv64MulHighSigned(left, right), signed(left * right >> 64n), "signed high multiply oracle");
  assert.equal(native.rv64MulHighSignedUnsigned(left, bothUnsigned[1]), rv64MulHighSignedUnsigned(left, bothUnsigned[1]), "signed/unsigned high multiply");
  assert.equal(native.rv64MulHighSignedUnsigned(left, bothUnsigned[1]), signed(left * bothUnsigned[1] >> 64n), "signed/unsigned high multiply oracle");
  assert.equal(unsigned(native.rv64MulHighUnsigned(...bothUnsigned)), rv64MulHighUnsigned(...bothUnsigned), "unsigned high multiply");
  assert.equal(unsigned(native.rv64MulHighUnsigned(...bothUnsigned)), unsigned(bothUnsigned[0] * bothUnsigned[1] >> 64n), "unsigned high multiply oracle");
  for (const bits of [32, 64]) {
    const a = BigInt.asIntN(bits, left), b = BigInt.asIntN(bits, right);
    const ua = BigInt.asUintN(bits, left), ub = BigInt.asUintN(bits, right);
    const min = -(1n << BigInt(bits - 1));
    const signedQuotient = b === 0n ? -1n : a === min && b === -1n ? min : a / b;
    const signedRemainder = b === 0n ? a : a === min && b === -1n ? 0n : a % b;
    assert.equal(native.rv64DivideSigned(left, right, bits), rv64DivideSigned(left, right, bits), "signed divide parity");
    assert.equal(native.rv64DivideSigned(left, right, bits), BigInt.asIntN(bits, signedQuotient), "signed divide oracle");
    assert.equal(native.rv64RemainderSigned(left, right, bits), rv64RemainderSigned(left, right, bits), "signed remainder parity");
    assert.equal(native.rv64RemainderSigned(left, right, bits), BigInt.asIntN(bits, signedRemainder), "signed remainder oracle");
    assert.equal(unsigned(native.rv64DivideUnsigned(...bothUnsigned, bits)), rv64DivideUnsigned(...bothUnsigned, bits), "unsigned divide parity");
    assert.equal(unsigned(native.rv64DivideUnsigned(...bothUnsigned, bits)), ub === 0n ? (1n << BigInt(bits)) - 1n : ua / ub, "unsigned divide oracle");
    assert.equal(unsigned(native.rv64RemainderUnsigned(...bothUnsigned, bits)), rv64RemainderUnsigned(...bothUnsigned, bits), "unsigned remainder parity");
    assert.equal(unsigned(native.rv64RemainderUnsigned(...bothUnsigned, bits)), ub === 0n ? ua : ua % ub, "unsigned remainder oracle");
  }
}

console.log("PASS: canonical Thistle RV64 source matches compiled WebAssembly on 120,000 immediate decodings, M-extension edge cases, register and immediate operations and IEEE-754 FCLASS categories");
