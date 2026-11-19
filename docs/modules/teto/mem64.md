# teto/mem64

The Teto memory adapter implements the RV64 memory contract on kernel-managed pages. Reads, writes and releases use the generated runtime's translation and ownership rules rather than allocating a second guest address space.

Public names: `TetoPageLookup`, `TetoMem64`.
