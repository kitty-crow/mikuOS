/**
 * Thistle's scalar normalisation boundary.
 *
 * Direct TypeScript uses BigInt's exact-width operations. Baguette treats this
 * module as intrinsic and lowers the same sx/ux/u32word operations to native
 * sign extension and integer casts, never to a JavaScript runtime.
 */
import type { I32, I64, U64 } from "./native-types.js";

export const sx = (value: I64, bits: I32): I64 => BigInt.asIntN(bits, value);
export const ux = (value: I64): U64 => BigInt.asUintN(64, value);
export const u32word = (value: I64): U64 => BigInt.asUintN(32, value);
