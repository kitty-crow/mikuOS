# Architecture

Teto uses the Thistle source tree as its kernel definition. The
Teto-specific source under `src/teto` provides the WebAssembly ABI,
linear-memory layout, virtual filesystem bridge and kernel entry
points. `src/vm/rv64.ts` connects RV64GC programme execution to that
generated core.

Two modules are produced from the same configured source. The
baseline module uses ordinary WebAssembly memory. The threaded
module enables the shared-memory path required by the threaded
runtime.

The generated manifest records inputs, output hashes, ABI exports,
memory limits and the compiler revision used for the build.
