# MIKU

**MIKU**: MIKU Is Not the Kernel; it's Userspace.

mikuOS (初音ミクOS) provides a Unix-like userspace with a common root image,
accounts, shell, command set and THX executable support. Release 0.3 is styled
**v｡三**.

## Build

```sh
git submodule update --init --recursive
npm install
npm run build
```

The build compiles the hosted runtime, assembles the pinned Teto WAT
modules and prepares the static browser files. See [build and generated files](docs/build.md).

## Run

```sh
bun mikuos.ts --kernel=teto
bun mikuos.ts --kernel=thistle
bun mikuos.ts --kernel=auto
```

The CLI and browser default to Teto. `auto` permits fallback to the hosted
Thistle implementation if Teto cannot be loaded. The kernel choices above
are the modes exposed by this branch's host.

A host directory can be selected with `--root PATH`. `--bin PATH NAME`
loads a supported guest executable into the running system.

Build and preview the static site:

```sh
npm run web
npm run serve:web
```

Static files are written to `dist/web/`.

The CLI initialises its writable root from `.thistle.base/`.
The default shell is `/bin/thsh`; `/bin/bash` is an installed
alternative. See [root image and userland](docs/userland.md).

## Documentation

- [System architecture](docs/architecture.md)
- [Build and generated files](docs/build.md)
- [Dependencies](docs/dependencies.md)
- [Root image and userland](docs/userland.md)
- [Static browser build](docs/web.md)
- [Userland migration plan](docs/userland-migration.md)

## Licence

[MIT](LICENSE) for original code. Bundled software retains its upstream
licences; see [third-party software](THIRD_PARTY.md).
