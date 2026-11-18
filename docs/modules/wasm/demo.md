# WASI demonstration fixture

`demoWasm` constructs a WebAssembly binary as a byte array. It creates the type, import, function, memory, export, code and data sections directly. The guest exports memory and an entry function which calls WASI preview-one fd_write to print a short greeting. No external compiler is required to build this fixture.
