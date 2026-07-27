# Build and generated files

A complete build starts from a recursive checkout:

    git submodule update --init --recursive
    npm install
    npm run build

`npm run build` runs `build:thistle` followed by `teto:build`.
`build:thistle` compiles the TypeScript host and prepares the static
host files.

`teto:build` is a two-stage kernel compiler pipeline:

    src/teto TypeScript
        -> Bake safe lowering
        -> build/teto-baked TypeScript
        -> pinned Baguette compiler
        -> dist/teto WebAssembly

Bake receives only the five Teto kernel entries from `tsconfig.teto.json`
and their imported kernel dependencies. Browser loaders, host adapters and
alternative kernels are outside that project boundary. Baguette remains the
final validator and WebAssembly compiler.

The build prefers a local Bake checkout at `bake/`, `../bake/` or
`../../bake/`. `BAKE_CLI` can select another checkout. When no local checkout
is available, the wrapper runs the Bake commit pinned in
`scripts/teto-build.ts`. `MIKUOS_BAKE_ENGINE` may select `auto`, `host` or
`wasm`; `auto` is the default.

Important outputs are:

- `build/` for compiled host JavaScript;
- `build/teto-baked/` for Bake-lowered kernel TypeScript;
- `build/teto-bake-report.json` for Bake diagnostics and provenance;
- `build/teto-baguette.config.json` for the generated Baguette input;
- `dist/teto/teto.wasm` and `teto-threads.wasm`;
- `dist/teto/teto.manifest.json`;
- `dist/web/` for the static site and packaged root image.

`npm test` rebuilds the project and runs the integration suite.
