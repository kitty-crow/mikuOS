# MIKU

**MIKU** (**MIKU Is Not the Kernel; it's Userspace**) is the
userspace of **初音ミクOS**, written **mikuOS** in Latin script.

The 0.3 release is styled **v｡三**.

## Build

    git submodule update --init --recursive
    npm install
    npm run build

The build compiles the TypeScript host, compiles the pinned modular WAT into the baseline and
threaded Teto kernels, validates their manifest and prepares the
static browser files.

## Run

The default CLI uses Teto. Automatic selection allows fallback to Thistle:

    bun mikuos.ts
    bun mikuos.ts --kernel=auto

Select either kernel explicitly:

    bun mikuos.ts --kernel=teto
    bun mikuos.ts --kernel=thistle

Build the static site:

    npm run web

The resulting site is in `dist/web`.

The CLI initialises its writable root from the committed `.thistle.base/` image. It uses `/bin/thsh` by default; `/bin/bash` is an installed alternative. See [root image and userland](docs/userland.md).

## Documentation

- [System architecture](docs/architecture.md)
- [Build and generated files](docs/build.md)
- [Dependencies](docs/dependencies.md)
- [Root image and userland](docs/userland.md)
- [Static browser build](docs/web.md)
- [Userland migration plan](docs/userland-migration.md)

## Licence

Original project code is MIT licensed. Bundled and installed
third-party software retains its own licence; see `THIRD_PARTY.md`.
