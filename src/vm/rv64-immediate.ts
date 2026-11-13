/**
 * Canonical Thistle RV64 immediate decoding, shared with the generated Teto core.
 * The signed 32-bit results have exact bigint/i64 representations on both targets.
 */
import type { I32, U32 } from "../core/native-types.js";

/**
 * Explicit sign extension keeps JavaScript's signed bitfield semantics when
 * Baguette represents the input instruction as native u32.
 */
const signExtend = (raw: U32, bits: I32): I32 => {
  const sign: U32 = 1 << (bits - 1);
  const range: U32 = 1 << bits;
  return (raw & sign) !== 0 ? raw - range : raw;
};

export const rv64ImmediateI = (instruction: U32): I32 =>
  signExtend(instruction >>> 20, 12);
export const rv64ImmediateS = (instruction: U32): I32 =>
  signExtend((instruction >>> 25) << 5 | (instruction >>> 7 & 31), 12);
export const rv64ImmediateB = (instruction: U32): I32 =>
  signExtend((instruction >>> 31) << 12 | (instruction >>> 7 & 1) << 11 |
    (instruction >>> 25 & 63) << 5 | (instruction >>> 8 & 15) << 1, 13);
export const rv64ImmediateU = (instruction: U32): I32 => instruction & 0xfffff000;
export const rv64ImmediateJ = (instruction: U32): I32 =>
  signExtend((instruction >>> 31) << 20 | (instruction >>> 12 & 255) << 12 |
    (instruction >>> 20 & 1) << 11 | (instruction >>> 21 & 1023) << 1, 21);
export const rv64CompressedJump = (instruction: U32): I32 =>
  signExtend((instruction >>> 1 & 0x800) | (instruction << 2 & 0x400) |
    (instruction >>> 1 & 0x300) | (instruction << 1 & 0x80) |
    (instruction >>> 1 & 0x40) | (instruction << 3 & 0x20) |
    (instruction >>> 7 & 0x10) | (instruction >>> 2 & 0xe), 12);
