---
topic: executable-abi
abis: [thistle-app, thistle-script, wasi-preview1]
---

# Executable ABI

## Registered applications

A regular file containing `#!thistle:<name>` dispatches to the `App` registered
under `<name>`. Execute bits and path lookup still apply.

## Scripts

`#!/bin/thsh` and `#!/bin/sh` scripts execute in a child shell. Positional
arguments are exposed as `$0` through `$9`.

## WebAssembly

Standard WASM magic bytes select native WebAssembly execution. The module must
export `memory` and either `_start` or `main`.

The `wasi_snapshot_preview1` namespace implements the following. The legacy
name `wasi_unstable` is an alias for early toolchains.

- arguments and environment;
- descriptor read, write, seek, tell, positioned I/O, allocation and metadata;
- pre-opened directories, path open, links, rename, directory and file removal;
- clocks, polling, random bytes, yielding, signals and process exit;
- directory enumeration and file timestamps.

Descriptors 0, 1 and 2 are standard I/O. Descriptor 3 pre-opens `/`; descriptor
4 pre-opens the process working directory. Socket calls return `ENOTSUP` because
the kernel deliberately has no network stack.

Hand-written modules may instead import `thistle.write`, `read`, `exit`,
`getpid`, `now` and `random`. Pointers and lengths address the exported linear
memory; results use signed 32-bit integers.
