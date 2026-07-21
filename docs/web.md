# Static web build

`npm run web` retains the current `npm run build` behaviour and produces a
static `dist/web` tree. Teto is the default kernel, while `?kernel=thistle`
selects the direct source path. Assets use relative URLs so the same output
can be served from a GitHub Pages subdirectory.

The deployed page has no Node, Bun, WebSocket or central-server requirement.
A local server is used only to preview or test the static files.
