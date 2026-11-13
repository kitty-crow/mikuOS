import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rv64Branch } from "../../src/core/rv64-branch.ts";
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
console.log("PASS: canonical Thistle RV64 source matches Bake/Baguette WebAssembly on 120,000 immediate decodings and signed/unsigned branches");
