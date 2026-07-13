---
topic: architecture
stability: public
---

# Architecture

Thistle starts by creating a `Kern`, mounting the VFS image, registering
applications and creating PID 1. A host session is PID 2. The DOM and terminal
hosts differ only in the `In` and `Out` objects attached to PID 2.

For `echo one | wc -c`, `thsh` lexes and parses one pipeline, allocates a
`Pipe`, then asks `Sys.start` for two children in one process group. The kernel
resolves `/bin/echo` and `/bin/wc`, checks execute permission, creates isolated
descriptor tables and runs each `App`. `echo` writes bytes to descriptor 1;
`wc` consumes them from descriptor 0. Writer reference counts generate EOF and
reader reference counts generate `EPIPE`. The shell waits, reaps both children
and retains the final exit status in `$?`.

Regular executable files carry `#!thistle:name`. Shell scripts carry
`#!/bin/thsh`. Files beginning with the four-byte WebAssembly magic header are
sent to the WASI loader. That decision is made by the kernel, not the shell.

The runtime is cooperative: application promises yield CPU time and blocking
kernel calls change process state. Signals abort waits and cooperative programs
call `Sys.chk` where they can run indefinitely.
