# Teto

**TETO** is **Teto Executes Thistle Optimally**.

Teto is the WebAssembly form of the Thistle kernel. It retains the
Thistle source tree and adds the RV64GC execution core, the
WebAssembly host interface, and the build configuration used to
generate baseline and threaded kernel modules with Baguette.

## Build and test

    git submodule update --init --recursive
    npm install
    npm run build
    npm test

The build writes:

- `dist/teto/teto.wasm`;
- `dist/teto/teto-threads.wasm`;
- `dist/teto/teto.manifest.json`.

Validate the configured source without replacing the generated
modules with:

    npm run teto:validate

## Documentation

- [Architecture](docs/architecture.md)
- [Building Teto](docs/build.md)
- [Host interface](docs/host-interface.md)
- [Compatibility path](docs/compatibility.md)

## Licence

MIT. See `LICENSE`.
