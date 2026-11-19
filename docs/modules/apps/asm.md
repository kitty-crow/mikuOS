# apps/asm

Guest assembler, linker, ELF conversion and binary inspection commands expose the pinned toolchain through the command registry. They parse guest arguments, read sources through Sys and write results using guest permissions.

Public names: `AsApp`, `LdApp`, `Elf2ThxApp`, `DisApp`, `ObjdumpApp`, `NmApp`, `SizeApp`.
