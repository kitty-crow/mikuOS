# Sparse 64-bit guest memory

`PG` is the 65,536-byte page size. `RvMemory` describes the range, budget and typed memory access contract. `Mem64` implements zero-filled sparse pages, little-endian integer and floating-point access, and page removal or clearing through `drop`. Reads do not allocate untouched pages. Writes allocate only when non-zero data requires storage; out-of-range accesses and exhausted host memory budgets raise kernel errors.

`hostNumber` rejects integers outside the host safe range. `randomFill` checks writable mappings before filling chunks, and `readString` bounds zero-terminated guest reads through the active VM permission checks.
