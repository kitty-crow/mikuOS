/**
 * Canonical Thistle RV64 register-register integer execution.
 *
 * Native Teto compiles these exact functions through Bake/Baguette. Both
 * callers retain their own register storage, instruction fetch and faults,
 * but instruction validity and arithmetic behaviour live in one source.
 */
import type { I32, I64, U32 } from "./native-types.js";
import { sx, ux } from "./rv64-numbers.js";
import {
  rv64DivideSigned,
  rv64DivideUnsigned,
  rv64MulHighSigned,
  rv64MulHighSignedUnsigned,
  rv64MulHighUnsigned,
  rv64RemainderSigned,
  rv64RemainderUnsigned,
} from "./rv64-arithmetic.js";

export const rv64RegisterValid = (funct3: U32, top: U32): I32 => {
  if (funct3 > 7) return 0;
  if (top === 0 || top === 1) return 1;
  return top === 0x20 && (funct3 === 0 || funct3 === 5) ? 1 : 0;
};

/** Only call with a combination accepted by rv64RegisterValid. */
export const rv64RegisterValue = (funct3: U32, top: U32, left: I64, right: I64): I64 => {
  const shift = ux(right) & 63n;
  if (top === 1) {
    if (funct3 === 0) return sx(left * right, 64);
    if (funct3 === 1) return rv64MulHighSigned(left, right);
    if (funct3 === 2) return rv64MulHighSignedUnsigned(left, ux(right));
    if (funct3 === 3) return sx(rv64MulHighUnsigned(ux(left), ux(right)), 64);
    if (funct3 === 4) return rv64DivideSigned(left, right, 64);
    if (funct3 === 5) return sx(rv64DivideUnsigned(ux(left), ux(right), 64), 64);
    if (funct3 === 6) return rv64RemainderSigned(left, right, 64);
    if (funct3 === 7) return sx(rv64RemainderUnsigned(ux(left), ux(right), 64), 64);
    return 0n;
  }
  if (funct3 === 0) return sx(top === 0 ? left + right : left - right, 64);
  if (funct3 === 1) return sx(ux(left) << shift, 64);
  if (funct3 === 2) return left < right ? 1n : 0n;
  if (funct3 === 3) return ux(left) < ux(right) ? 1n : 0n;
  if (funct3 === 4) return left ^ right;
  if (funct3 === 5) return sx(top === 0 ? ux(left) >> shift : left >> shift, 64);
  if (funct3 === 6) return left | right;
  if (funct3 === 7) return left & right;
  return 0n;
};
