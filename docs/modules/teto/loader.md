# teto/loader

The Teto loader validates the WebAssembly module and required exports before constructing a kernel runtime. Baseline and shared-memory variants use explicit memory options; incompatible imports or missing ABI functions reject loading.

Public names: `TetoExports`, `TetoLoadOptions`, `TetoVariant`, `TetoImageProvider`, `TetoModule`, `loadTeto`.
