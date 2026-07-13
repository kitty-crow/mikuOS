---
topic: extending-thistle
audience: developers
---

# Porting and extension

To add a command, subclass `App`, implement `run(Sys, string[])`, export it from
an `src/apps` module and instantiate it in `apps/index.ts`. The boot image will
create its executable marker. The command should read descriptor 0 when no file
operand is supplied and return a Unix-style status.

To replace the filesystem, preserve the methods consumed by `Sys`; no app or
host imports the current storage implementation. To add a host, provide a
`Host.put` sink to `boot()` and feed complete lines to `Os.run()`.

WASI programs can be compiled for `wasm32-wasi` or `wasm32-wasip1`. Avoid
threads and sockets because Thistle does not expose those subsystems. Copy the
binary into `/tmp`, give it an execute bit, and invoke its path normally.
