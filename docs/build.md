# Build and generated files

A complete build starts from a recursive checkout:

    git submodule update --init --recursive
    npm install
    npm run build

mikuOS pins Teto. Teto pins Thistle, Bake and Baguette. Its source-generation workflow lowers Thistle through Bake and emits modular WAT through Baguette. mikuOS does not run this generation pipeline.

The normal build stages the exact Thistle compatibility source recorded in Teto's provenance, compiles the TypeScript host, runs Teto's standalone WAT build, and copies its validated binaries and ABI metadata to the CLI and static browser distributions.

Important outputs:

- `build/`: compiled host JavaScript.
- `dist/teto/`: baseline and threaded WebAssembly, manifest and ABI declaration.
- `dist/web/`: static browser application and packaged root image.

`npm test` rebuilds the project and runs the integration suite. `npm run teto:test:cli` boots the built kernel explicitly and runs a guest RV64GC executable.
