/**
 * RV64GC branch semantics shared by Thistle's direct interpreter and the
 * Bake/Baguette native execution path. Inputs are signed 64-bit register
 * values; unsigned comparisons must preserve their 64-bit interpretation.
 *
 * A negative result denotes an instruction with an invalid funct3 field.
 */
export const rv64Branch = (funct3: number, left: bigint, right: bigint): number => {
  if (funct3 === 0) return left === right ? 1 : 0;
  if (funct3 === 1) return left !== right ? 1 : 0;
  if (funct3 === 4) return left < right ? 1 : 0;
  if (funct3 === 5) return left >= right ? 1 : 0;
  if (funct3 === 6 || funct3 === 7) {
    const leftNegative = left < 0n;
    const rightNegative = right < 0n;
    const less = leftNegative === rightNegative ? left < right : !leftNegative;
    return (funct3 === 6 ? less : !less) ? 1 : 0;
  }
  return -1;
};
