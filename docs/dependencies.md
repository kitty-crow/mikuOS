# Dependencies

The repository pins its non-fork dependencies as Git submodules:

- `kittyx` contains target and format contracts;
- `src/asm` contains ThistleASM;
- `baguette` contains the WebAssembly compiler;
- `thistlecc` contains the C and C++ compiler driver.

`project.dependencies.json` records the same commits in a
machine-readable form. A fresh checkout should run:

    git submodule update --init --recursive

Dependency update workflows test a proposed revision and open a
draft pull request. They do not merge or move the pinned commit
automatically.
