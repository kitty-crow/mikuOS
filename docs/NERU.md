# NERU/Linux kernel selection

mikuOS has one userland. Selecting NERU does not start a second mikuOS
implementation or replace the existing filesystem and command contracts.

```text
mikuOS userland (.thistle.base)
        |
        | NERU ahead-of-time build
        v
Linux-WASM kernel + initramfs
        |
        v
NEMUNEMU compatibility layer
        |
        v
same packaged mikuOS command and THX contracts
```

NERU owns image construction and Linux kernel integration. NEMUNEMU owns the
compatibility boundary that lets the existing userland contracts run under
Linux.

## CLI

```bash
bun mikuos.ts --kernel=neru
```

`--kernel=linux` is an alias. Selection invokes `bun neru/neru.ts`, stages
`.thistle.base` into a deterministic image and boots that output. Thistle
and Teto continue through the existing CLI implementation unchanged.

## Web

```bash
npm run build:neru
npm run serve:web:neru
```

Then open the normal static page with `?kernel=neru` or `?kernel=linux`.
The page loads the NERU artefacts built ahead of time in `dist/web/neru`.
The browser does not compile the userland after page load.

The local server supplies COOP/COEP headers directly. Static HTTPS hosts
such as GitHub Pages use the generated `coi-serviceworker.js` bootstrap to
apply the same cross-origin-isolation policy before NERU starts. Browsers
without SharedArrayBuffer support cannot run the Linux-WASM kernel.

A normal `npm run build` still builds the existing Thistle/Teto site and
does not require a Linux toolchain.

Inside a successful NERU boot, `uname` reports `Linux` and the actual Linux
kernel release.
