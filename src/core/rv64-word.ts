/**
 * Canonical Thistle RV64GC 32-bit word arithmetic for OP-32 and OP-IMM-32.
 * Register state, memory and fault handling remain host-specific; both
 * execution targets compile the same checked word operation semantics.
 */
import type { I32, I64, U32 } from "./native-types.js";
import { sx, ux, u32word, word } from "./rv64-numbers.js";
import { rv64ImmediateI } from "../vm/rv64-immediate.js";
import {
  rv64DivideSigned,
  rv64DivideUnsigned,
  rv64RemainderSigned,
  rv64RemainderUnsigned,
} from "./rv64-arithmetic.js";

export const rv64RegisterWordValid = (funct3: U32, top: U32): I32 => {
  if (top === 1) return funct3 === 0 || funct3 === 4 || funct3 === 5 || funct3 === 6 || funct3 === 7 ? 1 : 0;
  if (funct3 === 0) return top === 0 || top === 0x20 ? 1 : 0;
  if (funct3 === 1) return top === 0 ? 1 : 0;
  if (funct3 === 5) return top === 0 || top === 0x20 ? 1 : 0;
  return 0;
};

/** Only call with an encoding accepted by rv64RegisterWordValid. */
export const rv64RegisterWordValue = (funct3: U32, top: U32, left: I64, right: I64): I64 => {
  const shift = ux(right) & 31n;
  if (top === 1) {
    if (funct3 === 0) return sx(sx(left, 32) * sx(right, 32), 32);
    if (funct3 === 4) return sx(rv64DivideSigned(left, right, 32), 32);
    if (funct3 === 5) return sx(rv64DivideUnsigned(u32word(left), u32word(right), 32), 32);
    if (funct3 === 6) return sx(rv64RemainderSigned(left, right, 32), 32);
    if (funct3 === 7) return sx(rv64RemainderUnsigned(u32word(left), u32word(right), 32), 32);
    return 0n;
  }
  if (funct3 === 0) return sx(top === 0 ? left + right : left - right, 32);
  if (funct3 === 1) return sx(sx(left, 32) << shift, 32);
  if (funct3 === 5) return sx(top === 0 ? u32word(left) >> shift : sx(left, 32) >> shift, 32);
  return 0n;
};

export const rv64ImmediateWordValid = (funct3: U32, instruction: U32): I32 => {
  const top = instruction >>> 25;
  if (funct3 === 0) return 1;
  if (funct3 === 1) return top === 0 ? 1 : 0;
  if (funct3 === 5) return top === 0 || top === 0x20 ? 1 : 0;
  return 0;
};

/** Only call with an encoding accepted by rv64ImmediateWordValid. */
export const rv64ImmediateWordValue = (funct3: U32, instruction: U32, left: I64): I64 => {
  const shift = word(instruction >>> 20 & 31);
  if (funct3 === 0) return sx(left + word(rv64ImmediateI(instruction)), 32);
  if (funct3 === 1) return sx(sx(left, 32) << shift, 32);
  if (funct3 === 5) return sx(instruction >>> 25 === 0 ?
    u32word(left) >> shift : sx(left, 32) >> shift, 32);
  return 0n;
};
