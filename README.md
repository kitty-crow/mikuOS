# Thistle

**THISTLE** is the **Thistle Hosted Interactive Shell-based
TypeScript Live Environment**.

Thistle is a TypeScript kernel for the Thistle32 and Thistle64
execution environments. It provides processes, scheduling, signals,
file descriptors, pipes, terminals, a virtual filesystem, devices,
networking and the system-call layer used by guest programmes.

## Build and test

    git submodule update --init --recursive
    npm install
    npm run build
    npm test

`npm run build` compiles the TypeScript source into `build/`.
`npm test` performs the repository checks without constructing an
operating-system image.

## Source tree

- `src/core` contains kernel and process state;
- `src/fs` contains the virtual filesystem;
- `src/io` contains streams and terminal handling;
- `src/net` contains network transport;
- `src/vm` contains the Thistle32 and Thistle64 interpreters;
- `src/wasm` contains WASI support for guest WebAssembly;
- `src/asm` is the pinned ThistleASM checkout.

## Documentation

- [Kernel architecture](docs/architecture.md)
- [Processes and descriptors](docs/processes.md)
- [Filesystem](docs/filesystem.md)
- [Programme execution](docs/execution.md)
- [System calls](docs/syscalls.md)

## Licence

MIT. See `LICENSE`.
