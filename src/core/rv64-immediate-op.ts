/**
 * Canonical Thistle RV64 register-immediate execution.
 * Both the direct TypeScript interpreter and compiled Teto use these checks
 * and operations, including sign-extended immediates and shift encoding.
 */
import type { I32, I64, U32 } from "./native-types.js";
import { sx, ux, word } from "./rv64-numbers.js";
import { rv64ImmediateI } from "../vm/rv64-immediate.js";

export const rv64ImmediateOpValid = (funct3: U32, instruction: U32): I32 => {
  if (funct3 > 7) return 0;
  const top = instruction >>> 26;
  if (funct3 === 1) return top === 0 ? 1 : 0;
  if (funct3 === 5) return top === 0 || top === 0x10 ? 1 : 0;
  return 1;
};

/** Only call with an encoding accepted by rv64ImmediateOpValid. */
export const rv64ImmediateOpValue = (funct3: U32, instruction: U32, left: I64): I64 => {
  const immediate = word(rv64ImmediateI(instruction));
  const shift = word(instruction >>> 20 & 63);
  if (funct3 === 0) return sx(left + immediate, 64);
  if (funct3 === 1) return sx(ux(left) << shift, 64);
  if (funct3 === 2) return left < immediate ? 1n : 0n;
  if (funct3 === 3) return ux(left) < ux(immediate) ? 1n : 0n;
  if (funct3 === 4) return left ^ immediate;
  if (funct3 === 5) return sx(instruction >>> 26 === 0 ? ux(left) >> shift : left >> shift, 64);
  if (funct3 === 6) return left | immediate;
  if (funct3 === 7) return left & immediate;
  return 0n;
};
