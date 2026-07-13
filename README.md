# Thistle

Thistle is the base TypeScript kernel in the KITTYX project family. It owns
processes, scheduling, filesystems, descriptors, signals, system calls and
direct execution of the Thistle machine languages.

The assembler and binary format implementation is kept in the independent
ThistleASM repository and mounted at `src/asm`. Userland, the interactive
shell and browser packaging are downstream concerns.
