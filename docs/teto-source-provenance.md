# Teto build provenance in mikuOS

The production mikuOS build invokes the pinned `deps/teto` repository, not a local compiler entry for `src/teto/kernel.ts`. That dependency fetches the current selected Thistle HEAD, runs Bake lowering, and then uses Baguette to emit and verify both baseline and threaded WASM kernels. mikuOS copies those exact artefacts into `dist/teto` and its web package.

The draft integration uses `THISTLE_REF=fix/canonical-teto-512m-source` until Thistle's native-source PR is merged. The script resolves and records an immutable source SHA for every build. **Do not merge while runtime, ABI or full guest tests fail.**

The legacy mikuOS `src/teto/kernel.ts` remains for migration comparison but is never a production WASM compilation entry. It must be removed after the new build passes the complete guest regression suite to avoid independently maintained versions of the kernel.
