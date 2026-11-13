/**
 * Canonical Thistle RV64GC M-extension arithmetic.
 *
 * Baguette compiles these exact functions to native WASM. The TypeScript
 * interpreter uses the same functions, so high-word products, signed
 * division and division-by-zero rules have one maintained implementation.
 */
import type { I32, I64, U64 } from "./native-types.js";
import { sx, ux, u32word } from "./rv64-numbers.js";

const MASK32: U64 = 0xffffffffn;

/** High 64 bits of a 64 x 64 unsigned multiplication without 128-bit runtime support. */
export const rv64MulHighUnsigned = (left: U64, right: U64): U64 => {
  const a0 = left & MASK32;
  const a1 = left >> 32n;
  const b0 = right & MASK32;
  const b1 = right >> 32n;
  let product = a0 * b0;
  const carry = product >> 32n;
  product = a1 * b0 + carry;
  const middle = product & MASK32;
  const high = product >> 32n;
  product = a0 * b1 + middle;
  return ux(a1 * b1 + high + (product >> 32n));
};

export const rv64MulHighSigned = (left: I64, right: I64): I64 => {
  let high = rv64MulHighUnsigned(ux(left), ux(right));
  if (left < 0n) high = ux(high - ux(right));
  if (right < 0n) high = ux(high - ux(left));
  return sx(high, 64);
};

export const rv64MulHighSignedUnsigned = (left: I64, right: U64): I64 => {
  let high = rv64MulHighUnsigned(ux(left), right);
  if (left < 0n) high = ux(high - right);
  return sx(high, 64);
};

/** Division and remainder obey RISC-V division-by-zero and signed overflow semantics. */
export const rv64DivideSigned = (left: I64, right: I64, bits: I32): I64 => {
  const a = sx(left, bits);
  const b = sx(right, bits);
  if (b === 0n) return -1n;
  const minimum = bits === 32 ? -2147483648n : -0x8000000000000000n;
  if (a === minimum && b === -1n) return a;
  return sx(a / b, bits);
};

export const rv64DivideUnsigned = (left: U64, right: U64, bits: I32): U64 => {
  const a = bits === 32 ? u32word(left) : ux(left);
  const b = bits === 32 ? u32word(right) : ux(right);
  if (b === 0n) return bits === 32 ? MASK32 : 0xffffffffffffffffn;
  return bits === 32 ? u32word(a / b) : ux(a / b);
};

export const rv64RemainderSigned = (left: I64, right: I64, bits: I32): I64 => {
  const a = sx(left, bits);
  const b = sx(right, bits);
  if (b === 0n) return a;
  const minimum = bits === 32 ? -2147483648n : -0x8000000000000000n;
  if (a === minimum && b === -1n) return 0n;
  return sx(a % b, bits);
};

export const rv64RemainderUnsigned = (left: U64, right: U64, bits: I32): U64 => {
  const a = bits === 32 ? u32word(left) : ux(left);
  const b = bits === 32 ? u32word(right) : ux(right);
  if (b === 0n) return a;
  return bits === 32 ? u32word(a % b) : ux(a % b);
};
