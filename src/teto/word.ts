import type { F32, F64, I32, I64, Ptr, U32, U64 } from "./types.js";

const MASK32 = 0xffffffffn;
const floatBuffer = new ArrayBuffer(8);
const floatView = new DataView(floatBuffer);

export const word = (value: I32 | U32): I64 => BigInt(value);
export const sx = (value: I64 | U64, bits: I32): I64 => BigInt.asIntN(bits, value);
export const ux = (value: I64 | U64): U64 => BigInt.asUintN(64, value);
export const u32word = (value: I32 | U32 | I64 | U64): U64 => BigInt.asUintN(32, BigInt(value));
export const mulU32 = (left: U32, right: U32): U32 => Math.imul(left, right) >>> 0;
export const wordToI32 = (value: I64 | U64): I32 => Number(BigInt.asIntN(32, value));
export const wordToU32 = (value: I64 | U64): U32 => Number(BigInt.asUintN(32, value));

export const wordToPtr = (value: I64 | U64): Ptr => {
  const unsigned = ux(value);
  if (unsigned > 0x7fffffffn) return 0xffffffff;
  return Number(unsigned);
};

export const bitsToF32 = (value: U64): F32 => {
  floatView.setUint32(0, Number(value & MASK32), true);
  return floatView.getFloat32(0, true);
};

export const bitsToF64 = (value: U64): F64 => {
  floatView.setBigUint64(0, ux(value), true);
  return floatView.getFloat64(0, true);
};

export const f32ToBits = (value: F32 | F64): U64 => {
  floatView.setFloat32(0, Math.fround(value), true);
  return BigInt(floatView.getUint32(0, true));
};

export const f64ToBits = (value: F64): U64 => {
  floatView.setFloat64(0, value, true);
  return floatView.getBigUint64(0, true);
};

export const roundF32 = (value: F64): F32 => Math.fround(value);
export const floatIsNaN = (value: F64): boolean => Number.isNaN(value);
export const floatSqrt = (value: F64): F64 => Math.sqrt(value);
export const floatMin = (left: F64, right: F64): F64 => Math.min(left, right);
export const floatMax = (left: F64, right: F64): F64 => Math.max(left, right);
export const floatTrunc = (value: F64): F64 => Math.trunc(value);
export const floatFloor = (value: F64): F64 => Math.floor(value);
export const floatCeil = (value: F64): F64 => Math.ceil(value);
export const floatToI64 = (value: F64): I64 => BigInt(value);
export const floatToU64 = (value: F64): U64 => BigInt(value);
export const wordToFloat = (value: I64): F64 => Number(value);
export const unsignedWordToFloat = (value: U64): F64 => Number(value);

export const mulHighUnsigned = (left: U64, right: U64): U64 => {
  const a0 = left & MASK32;
  const a1 = left >> 32n;
  const b0 = right & MASK32;
  const b1 = right >> 32n;
  let t = a0 * b0;
  const carry = t >> 32n;
  t = a1 * b0 + carry;
  const middle = t & MASK32;
  const high = t >> 32n;
  t = a0 * b1 + middle;
  return ux(a1 * b1 + high + (t >> 32n));
};

export const mulHighSigned = (left: I64, right: I64): I64 => {
  let high = mulHighUnsigned(ux(left), ux(right));
  if (left < 0n) high = ux(high - ux(right));
  if (right < 0n) high = ux(high - ux(left));
  return sx(high, 64);
};

export const mulHighSignedUnsigned = (left: I64, right: U64): I64 => {
  let high = mulHighUnsigned(ux(left), right);
  if (left < 0n) high = ux(high - right);
  return sx(high, 64);
};

export const divSigned = (left: I64, right: I64, bits: I32): I64 => {
  const a = sx(left, bits);
  const b = sx(right, bits);
  if (b === 0n) return -1n;
  const min = -(1n << word(bits - 1));
  if (a === min && b === -1n) return a;
  return sx(a / b, bits);
};

export const divUnsigned = (left: U64, right: U64, bits: I32): U64 => {
  const a = bits === 32 ? u32word(left) : ux(left);
  const b = bits === 32 ? u32word(right) : ux(right);
  if (b === 0n) return bits === 32 ? MASK32 : 0xffffffffffffffffn;
  return bits === 32 ? u32word(a / b) : ux(a / b);
};

export const remSigned = (left: I64, right: I64, bits: I32): I64 => {
  const a = sx(left, bits);
  const b = sx(right, bits);
  if (b === 0n) return a;
  const min = -(1n << word(bits - 1));
  if (a === min && b === -1n) return 0n;
  return sx(a % b, bits);
};

export const remUnsigned = (left: U64, right: U64, bits: I32): U64 => {
  const a = bits === 32 ? u32word(left) : ux(left);
  const b = bits === 32 ? u32word(right) : ux(right);
  if (b === 0n) return a;
  return bits === 32 ? u32word(a % b) : ux(a % b);
};
