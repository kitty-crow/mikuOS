# Build and generated files

```sh
git submodule update --init --recursive
bun install --frozen-lockfile --ignore-scripts
bun run build
```

The build runs three stages:

1. `stage:thistle` initialises the pinned Teto and Thistle checkouts
   and stages the required compatibility source.
2. `build:thistle:staged` runs Code Guards in strict mode before type-checking the TypeScript host and producing browser assets.
3. `teto:build:staged` assembles the committed Teto WAT and copies
   the resulting artefacts into the distribution.

Kernel source generation belongs to Teto's regeneration workflow.
The mikuOS build consumes the pinned source snapshot.

| Output | Contents |
| --- | --- |
| `build/` | Generated build assets; host TypeScript runs directly with Bun |
| `dist/teto/` | Baseline and threaded WASM, manifest and ABI metadata |
| `dist/web/` | Static browser application and packaged root image |

## Code Guards

Code Guards is installed as a Bun development dependency pinned to an exact Git revision in `package.json` and `bun.lock`.

`bun run guards` stages the native source and runs every Code Guards check,
including documentation and tests. Warnings fail the command. Findings are
written to `logs/code-guards.json` and printed to standard output. Semantic
guards require the local model, downloaded on first use.

## Test

```sh
bun run test
bun run teto:test:cli
```

The first command rebuilds the project and runs the integration
suite. The second boots the compiled kernel explicitly and runs
a guest RV64GC executable.
