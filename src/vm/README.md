---
module: vm
owns: [thistle64-execution, rv64gc-execution, thistle32-compatibility, sparse-memory, native-syscall-bridge]
input: [thistle-executable-v2, thistle-executable-v1]
---

# Native virtual machine

`Vm64` executes `THX2` with BigInt registers, floating registers and sparse
64 KiB pages. A program gets a large virtual address space without an eager
host allocation; touched pages remain bounded by the host policy. `Vm` remains
the isolated `THX1` Thistle32 compatibility engine. Both reject writes to text
and read-only data and require instruction fetches to land in executable
sections.

`Rv64` executes the compiler-facing RV64GC profile inside the same THX2
container and sparse address space. It is an instruction profile, not a nested
Linux machine. Mature compilers can therefore use their standard RISC-V code
generators while all I/O still enters Thistle's `Sys` boundary.

Native syscalls enter the process-owned `Sys` object, so assembly programs use
the same descriptors, credentials, VFS, scheduler, process table and signals as
TypeScript apps and WASI modules. No native operation reaches the host
filesystem or host process APIs directly.

The RV64 loop yields every 16384 instructions and checks cancellation every
1024, keeping long compiler passes responsive without taxing every guest op.
`THISTLE_FUEL=0` disables the configurable instruction guard.
Details of registers, memory, stack frames and syscalls live in
`docs/native-abi.md`.
