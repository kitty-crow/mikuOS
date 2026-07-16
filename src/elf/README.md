# ELF import

`elf.ts` accepts a static linked ELF64 RISC-V executable, checks its machine,
program headers, address ranges and dynamic-linking state, then imports its load
segments into a THX2 container.

ELF is an interchange format for existing compiler backends. The guest still
executes a checked THX process image. The importer does not relocate objects or
load shared libraries; a normal linker must finish those jobs first.
