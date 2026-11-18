# Dependencies

Git submodules identify the dependency revisions for a checkout.

| Path | Purpose |
| --- | --- |
| `kittyx` | Machine and executable-format contracts |
| `src/asm` | Assembler and binary tooling |
| `thistlecc` | C and C++ compiler driver |
| `deps/teto` | Generated modular WAT and standalone kernel build |

Initialise the dependencies with:

```sh
git submodule update --init --recursive
```

Teto owns its source and compiler dependency pins. mikuOS consumes
the generated kernel through its pinned Teto checkout.

`project.dependencies.json` records dependency relationships and
revisions. Review manifest entries, Git submodule pins and test
results together when accepting dependency updates.
