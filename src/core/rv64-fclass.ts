/**
 * RV64GC FCLASS classification, from Thistle's canonical floating-point code.
 * The two runtimes supply the raw IEEE-754 bits; this function owns the
 * shared sign, exponent, fraction and quiet/signalling NaN classifications.
 */
import type { I32, I64, U64 } from "./native-types.js";

export const rv64FloatClass = (raw: U64, bits: I32): I64 => {
  const exponentBits = bits === 32 ? 8n : 11n;
  const fractionBits = bits === 32 ? 23n : 52n;
  const sign = raw >> (exponentBits + fractionBits) & 1n;
  const exponent = raw >> fractionBits & ((1n << exponentBits) - 1n);
  const fraction = raw & ((1n << fractionBits) - 1n);
  const all = (1n << exponentBits) - 1n;
  if (exponent === all) {
    if (fraction === 0n) return 1n << (sign !== 0n ? 0n : 7n);
    return 1n << ((fraction & (1n << (fractionBits - 1n))) !== 0n ? 9n : 8n);
  }
  if (exponent === 0n) {
    if (fraction === 0n) return 1n << (sign !== 0n ? 3n : 4n);
    return 1n << (sign !== 0n ? 2n : 5n);
  }
  return 1n << (sign !== 0n ? 1n : 6n);
};
