/**
 * Canonical Thistle RV64 immediate decoding, shared with the generated Teto core.
 * The signed 32-bit results have exact bigint/i64 representations on both targets.
 */
import type { I32, U32 } from "../core/native-types.js";

export const rv64ImmediateI = (instruction: U32): I32 => instruction >> 20;
export const rv64ImmediateS = (instruction: U32): I32 =>
  ((instruction >>> 25) << 5 | (instruction >>> 7 & 31)) << 20 >> 20;
export const rv64ImmediateB = (instruction: U32): I32 =>
  ((instruction >>> 31) << 12 | (instruction >>> 7 & 1) << 11 |
   (instruction >>> 25 & 63) << 5 | (instruction >>> 8 & 15) << 1) << 19 >> 19;
export const rv64ImmediateU = (instruction: U32): I32 => instruction & 0xfffff000;
export const rv64ImmediateJ = (instruction: U32): I32 =>
  ((instruction >>> 31) << 20 | (instruction >>> 12 & 255) << 12 |
   (instruction >>> 20 & 1) << 11 | (instruction >>> 21 & 1023) << 1) << 11 >> 11;
export const rv64CompressedJump = (instruction: U32): I32 =>
  ((instruction >>> 1 & 0x800) | (instruction << 2 & 0x400) |
   (instruction >>> 1 & 0x300) | (instruction << 1 & 0x80) |
   (instruction >>> 1 & 0x40) | (instruction << 3 & 0x20) |
   (instruction >>> 7 & 0x10) | (instruction >>> 2 & 0xe)) << 20 >> 20;
