# Third-party software

mikuOS contains original KITTYX code and integrates separately versioned
dependencies through Git submodules. Baguette builds the Teto WebAssembly
kernel. ThistleASM provides the assembly languages and THX tooling.
ThistleCC drives the external RISC-V compiler used for native userland.

Upstream userland sources are not copied into the public repository merely
because they are used during a local build. Each installed upstream package
keeps its own licence and version in the root-image manifest.
