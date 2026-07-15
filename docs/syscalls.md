# System calls

System calls enter through `src/core/sys.ts`. The implementation
covers process control, descriptors, filesystems, credentials,
terminals, timing and the network operations exposed by the kernel.

Each call returns a guest result or a defined error. Missing
operations report `ENOSYS`; they are not treated as successful no-op
calls. Tests should cover both the result and the observable state
change.

The numeric ABI and shared target declarations are pinned through
the repository's KITTYX dependency.
