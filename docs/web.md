# Static browser build

`npm run web` performs the normal build and leaves a static site in
`dist/web`. The page loads the compiled host, the packaged root image
and the Teto modules using relative URLs.

Teto is the default browser kernel. Add `?kernel=thistle` to select
the direct TypeScript path.

The deployed site does not require Node, Bun, a WebSocket service or
a central mikuOS server. `npm run serve:web` starts a local preview
server for testing the generated files.

## Early boot screen

`src/boot/boot.c` is a freestanding C programme compiled to a small
`dist/web/boot.wasm` before the main browser bundle is built. It
draws the supplied mikuOS logo, a dark Mac OS 9-inspired panel, a
spinner and a progress bar entirely through ANSI terminal sequences.
The supplied SVG was palette-reduced for true-colour half-block
terminal rendering, so no CSS or image addon is required.

`dist/web/bootloader.js` is only the minimal browser bridge needed
to instantiate WASM, connect its byte output to xterm.js, and drive
the spinner. It never guesses progress or simulates completed stages.
The bar advances on actual browser-runtime, guest manifest, compressed
filesystem download, persistent filesystem, kernel, and interactive
shell milestones. When the HTTP server supplies `Content-Length`, the
filesystem download contributes measured byte progress within its
stage. Without that header the bar stays at the last completed
milestone until the operation finishes.

The standalone page runs `boot-standalone.js` after loading xterm.js
and the small WASM bridge. It does **not** request `thistle.js` until
the C programme is visible. Embedded hosts can use the exact same
mikuOS-owned assets:

```js
const boot = await MikuBoot.create(xterm, new URL("/dist/mikuos/", location.origin));
await MikuBoot.loadRuntime("/dist/mikuos/thistle.js");
const os = await Thistle.launchThistle({ terminal: xterm, boot });
```

The boot screen uses xterm's alternate buffer and restores the normal
screen when the shell is ready. Only the spinner cell is repainted
between milestones. The main guest filesystem and its persistence
overlay remain independent of the boot screen.

To rebuild the C programme on its own, use:

```sh
clang --target=wasm32 -Oz -fno-builtin -nostdlib \
  -Wl,--no-entry -Wl,--export-memory -Wl,--initial-memory=131072 \
  -Wl,--strip-all -o dist/web/boot.wasm src/boot/boot.c
```

The regular `npm run build` already performs this compilation before
building the main browser runtime.
