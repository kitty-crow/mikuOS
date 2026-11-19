# wasm/wasi

The WASI preview1 bridge translates guest pointers and descriptors into checked kernel operations. It validates guest memory ranges, translates kernel errors into WASI numbers, and releases host descriptors when an executable finishes.

Public names: `Wasi`.
