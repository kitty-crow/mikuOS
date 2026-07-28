# Build and generated files

A complete build starts from a recursive checkout:

    git submodule update --init --recursive
    npm install
    npm run build

`npm run build` runs `build:thistle` followed by `teto:build`.
`build:thistle` compiles the TypeScript host and prepares the static
host files.

Teto compilation has one canonical toolchain dependency:

    src/teto TypeScript
        -> pinned Baguette compiler
        -> Baguette's pinned Bake validation and safe lowering stage
        -> Baguette subset validation and AOT compilation
        -> dist/teto WebAssembly

mikuOS tracks Baguette as a submodule. Bake is owned and pinned recursively by
Baguette, so mikuOS does not carry a separate Bake dependency or preprocessing
script. Baguette isolates the five Teto kernel entries from `tsconfig.teto.json`
and their imported kernel dependencies before passing them through Bake. Browser
loaders, host adapters and alternative kernels remain outside that project
boundary.

Baguette remains the final validator and WebAssembly compiler. Its Bake stage is
compile-time tooling only and introduces no runtime, interpreter or virtual
machine into Teto. `BAGUETTE_BAKE_ENGINE` may select Bake's `auto`, `host` or
`wasm` core; `auto` is the default.

Important outputs are:

- `build/` for compiled host JavaScript;
- `build/baguette-bake/` for Baguette's Bake input, lowered source and report;
- `build/teto-generated/` for Baguette's generated TypeScript;
- `dist/teto/teto.wasm` and `teto-threads.wasm`;
- `dist/teto/teto.manifest.json`;
- `dist/web/` for the static site and packaged root image.

`npm test` rebuilds the project and runs the integration suite.
