# Build and generated files

A complete build starts from a recursive checkout:

    git submodule update --init --recursive
    npm install
    npm run build

`npm run build` runs `build:thistle` followed by `teto:build`.
`build:thistle` compiles the TypeScript host and prepares the static
host files. `teto:build` runs the pinned Baguette compiler and then
updates the browser copy when the web tree exists.

Important outputs are:

- `build/` for compiled host JavaScript;
- `dist/teto/teto.wasm` and `teto-threads.wasm`;
- `dist/teto/teto.manifest.json`;
- `dist/web/` for the static site and packaged root image.

`npm test` rebuilds the project and runs the integration suite.
