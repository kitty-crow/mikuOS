# Build and generated files

A complete build starts from a recursive checkout:

    git submodule update --init --recursive
    npm install
    npm run build

`npm run build` runs `build:thistle` followed by `teto:build`.
`build:thistle` compiles the TypeScript host and prepares the static
host files.

The npm `preteto:*` lifecycle hooks turn each Teto command into a two-stage
kernel compiler pipeline without changing Baguette itself:

    src/teto TypeScript
        -> pinned sibling Bake tool
        -> build/teto-baked TypeScript
        -> pinned sibling Baguette compiler
        -> dist/teto WebAssembly

Bake receives only the five Teto kernel entries from `tsconfig.teto.json`
and their imported kernel dependencies. Browser loaders, host adapters and
alternative kernels are outside that project boundary. The committed
`baguette.config.json` consumes the generated tree, and Baguette remains the
final validator and WebAssembly compiler.

Both Bake and Baguette are independent sibling submodules. Recursive checkout
pins the exact compiler revisions and avoids a circular dependency between
them. `BAKE_CLI` may select another Bake CLI for local development.
`MIKUOS_BAKE_ENGINE` may select `auto`, `host` or `wasm`; `auto` is the
default.

Important outputs are:

- `build/` for compiled host JavaScript;
- `build/teto-baked/` for Bake-lowered kernel TypeScript;
- `build/teto-bake-report.json` for Bake diagnostics and provenance;
- `dist/teto/teto.wasm` and `teto-threads.wasm`;
- `dist/teto/teto.manifest.json`;
- `dist/web/` for the static site and packaged root image.

`npm test` rebuilds the project and runs the integration suite.
