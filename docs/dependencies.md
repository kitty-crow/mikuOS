# Dependencies

Git submodules identify the dependency revisions for a checkout.

| Path | Purpose |
| --- | --- |
| `src/asm` | Assembler and binary tooling |
| `thistlecc` | C and C++ compiler driver |
| `deps/teto` | Generated modular WAT and standalone kernel build |

KITTYX is inherited through ThistleASM and the selected kernel's toolchain; mikuOS does not maintain a separate KITTYX pin. ThistleCC also inherits the contract through its ThistleASM pin.

Initialise the dependencies with:

```sh
git submodule update --init --recursive
```

Teto owns its source and compiler dependency pins. `project.dependencies.json` records the direct dependency relationships and revisions. Review manifest entries, gitlinks and test results together when accepting dependency updates.
