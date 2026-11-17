# Dependencies

mikuOS pins its dependencies as Git submodules:

- `kittyx`: target and format contracts.
- `src/asm`: ThistleASM.
- `thistlecc`: the C and C++ compiler driver.
- `deps/teto`: generated modular WAT and its standalone kernel build.

Teto owns the pins for Thistle, Bake and Baguette. mikuOS consumes the compiled WASM and does not maintain a separate compiler pin for kernel generation.

`project.dependencies.json` records the exact direct and contract dependency revisions. Initialise recursive submodules on a fresh checkout.

Dependency update workflows test exact candidate revisions and open draft pull requests. They do not merge them automatically.
