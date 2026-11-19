# Static browser build

```sh
bun run web
bun run serve:web
```

The site in `dist/web/` loads the host, root image and Teto modules using
relative URLs. Teto is the default browser kernel; `?kernel=thistle`
selects the hosted TypeScript implementation and `?kernel=auto` permits
fallback. The deployed site requires no server-side kernel process.

## Boot screen

`src/boot/boot.c` compiles to `dist/web/boot.wasm`. It draws the supplied
Unicode artwork, panel, spinner and progress bar using ANSI terminal
sequences. `src/boot/logo.txt` contains the original artwork; `colour.h`
is the MIT-licensed parser from
[Unicode Art Studio](https://github.com/kitty-crow/unicode-art-studio).
The host C build tool generates `build/boot/generated-logo.h` before compiling
the freestanding module as part of the normal build.

The Pages build generates `bootloader.js` and `boot-standalone.js` from
`src/boot/loader.ts` and `src/boot/standalone.ts`. The browser asset names
and entry points remain unchanged.

`bootloader.js` instantiates the module and directs its output to xterm.js.
Progress advances at runtime loading, manifest, filesystem download,
persistence, kernel and shell milestones. The download stage uses measured
byte progress when `Content-Length` is available.

The standalone page loads `boot-standalone.js`. Embedded hosts can use the
same assets:

```js
const boot = await MikuBoot.create(xterm, new URL("/dist/mikuos/", location.origin));
await MikuBoot.loadRuntime("/dist/mikuos/thistle.js");
const os = await Thistle.launchThistle({ terminal: xterm, boot });
```

The boot screen uses the alternate terminal buffer and restores the normal
screen when the shell is ready. The persistence overlay belongs to the
runtime, not the boot screen.
