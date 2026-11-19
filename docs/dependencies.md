# Dependencies

| Path | Release | Purpose |
| --- | --- | --- |
| `src/asm` | v2.1.1 | Assembler and binary tools |
| `thistlecc` | v2.1.1 | Compiler driver |
| `deps/teto` | v2.2.0 | Teto kernel |

KITTYX is inherited from the pinned upstream ancestry, not pinned separately in mikuOS. The selected kernel owns its own compiler dependencies. The exact gitlinks are recorded in `project.dependencies.json`; corresponding published releases are recorded in `upstream.releases.json`.

Initialise with `git submodule update --init --recursive`.

The existing Teto host integration is retained.
