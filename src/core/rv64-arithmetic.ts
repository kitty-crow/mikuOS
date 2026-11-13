/**
 * Canonical Thistle RV64GC M-extension arithmetic.
 *
 * Baguette compiles these exact functions to native WASM. The TypeScript
 * interpreter uses the same functions, so high-word products, signed
 * division and division-by-zero rules have one maintained implementation.
 */
import type { I32, I64, U64 } from "./native-types.js";

const MASK32: U64 = 0xffffffffn;
const unsigned = (value: I64): U64 => BigInt.asUintN(64, value);
const signed = (value: I64, bits: I32): I64 => BigInt.asIntN(bits, value);
const low32 = (value: I64): U64 => BigInt.asUintN(32, value);

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
  return unsigned(a1 * b1 + high + (product >> 32n));
};

export const rv64MulHighSigned = (left: I64, right: I64): I64 => {
  let high = rv64MulHighUnsigned(unsigned(left), unsigned(right));
  if (left < 0n) high = unsigned(high - unsigned(right));
  if (right < 0n) high = unsigned(high - unsigned(left));
  return signed(high, 64);
};

export const rv64MulHighSignedUnsigned = (left: I64, right: U64): I64 => {
  let high = rv64MulHighUnsigned(unsigned(left), right);
  if (left < 0n) high = unsigned(high - right);
  return signed(high, 64);
};

/** Division and remainder obey RISC-V division-by-zero and signed overflow semantics. */
export const rv64DivideSigned = (left: I64, right: I64, bits: I32): I64 => {
  const a = signed(left, bits);
  const b = signed(right, bits);
  if (b === 0n) return -1n;
  const minimum = -(1n << BigInt(bits - 1));
  if (a === minimum && b === -1n) return a;
  return signed(a / b, bits);
};

export const rv64DivideUnsigned = (left: U64, right: U64, bits: I32): U64 => {
  const a = bits === 32 ? low32(left) : unsigned(left);
  const b = bits === 32 ? low32(right) : unsigned(right);
  if (b === 0n) return bits === 32 ? MASK32 : 0xffffffffffffffffn;
  return bits === 32 ? low32(a / b) : unsigned(a / b);
};

export const rv64RemainderSigned = (left: I64, right: I64, bits: I32): I64 => {
  const a = signed(left, bits);
  const b = signed(right, bits);
  if (b === 0n) return a;
  const minimum = -(1n << BigInt(bits - 1));
  if (a === minimum && b === -1n) return 0n;
  return signed(a % b, bits);
};

export const rv64RemainderUnsigned = (left: U64, right: U64, bits: I32): U64 => {
  const a = bits === 32 ? low32(left) : unsigned(left);
  const b = bits === 32 ? low32(right) : unsigned(right);
  if (b === 0n) return a;
  return bits === 32 ? low32(a % b) : unsigned(a % b);
};
