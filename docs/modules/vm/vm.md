# vm/vm

The compatibility Thistle32 interpreter loads executable sections into bounded memory and dispatches instructions and native syscalls. Register width, stack layout and memory checks follow the 32-bit ABI; execution yields periodically to the host.

Public names: `Sc`, `Vm`.
