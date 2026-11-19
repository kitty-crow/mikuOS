# elf/elf

The ELF reader validates compatible static executable headers and loadable segments before constructing a THX executable. ISA, bounds and mapping checks still apply; reading an ELF file does not provide an arbitrary foreign syscall ABI.

Public names: `ElfErr`, `isElf`, `Elf`, `elf`.
