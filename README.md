# Thistle

Thistle is the base kernel and the upstream history shared by Teto and
mikuOS. It runs directly as TypeScript and owns the process, filesystem,
descriptor, signal, network and syscall model.

ThistleASM is an independent dependency mounted at `src/asm`. The base
kernel executes Thistle32 and Thistle64 programmes. The downstream Teto fork
adds the generated WebAssembly kernel and the RV64GC execution integration.
