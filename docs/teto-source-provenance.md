# Canonical native Teto provenance in mikuOS

mikuOS builds Teto from the authoritative [Thistle](https://github.com/kitty-crow/thistle) `main` source. There is no checked-in `src/teto/kernel.ts` or separately maintained native kernel in mikuOS or Teto.

`npm run build` resolves and records an immutable Thistle commit SHA exactly once. It stages 17 byte-for-byte host-source views from that checkout (for the direct TypeScript execution and cross-checks), compiles mikuOS, then asks the pinned `deps/teto` build to **reuse that identical checkout** and compile baseline and threaded WASM through Bake and Baguette. A changed SHA, missing checkout, modified tracked upstream source, reintroduced tracked native copy, or generated-source mismatch fails the build.

The production Teto WebAssembly is copied unchanged into `dist/teto` and the web distribution. The source/ABI provenance test, 512 MiB linear-memory requirement (8,192 pages), guest instruction checks, native memory/VFS/THX tests, and strict Teto execution tests are required in CI. Explicit Teto mode must never fall back silently to the direct interpreter. Native-source validation is a required CI step, not a non-blocking diagnostic.

The older Thistle host adapters and compatibility tooling remain separate from the native Teto compilation entries. They do not supply an independently maintained native kernel.
