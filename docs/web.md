# Static browser build

`npm run web` performs the normal build and leaves a static site in
`dist/web`. The page loads the compiled host, the packaged root image
and the Teto modules using relative URLs.

Teto is the default browser kernel. Add `?kernel=thistle` to select
the direct TypeScript path.

The deployed site does not require Node, Bun, a WebSocket service or
a central mikuOS server. `npm run serve:web` starts a local preview
server for testing the generated files.
