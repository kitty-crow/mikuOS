# ELF import

`elf.ts` accepts a statically linked 64-bit RISC-V ELF executable,
checks its machine, programme headers, address ranges and dynamic
linking state, and imports the loadable segments into a THX2 image.

The importer expects the compiler and linker to have completed
relocation. It does not load shared libraries or resolve symbols at
run time. Invalid or dynamic inputs are rejected before a THX image
is produced.
