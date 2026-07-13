---
module: net
owns: [http-policy, redirects, host-transport]
contract: core/Sys.net
---

# Network

`Net` is the kernel-owned HTTP stack. It validates URLs, applies request limits,
follows redirects, counts traffic and cancels work when a process is signalled.
`NetDev` is the replaceable host-facing transport; `FetchDev` uses native
`fetch` in Bun and a same-origin Bun proxy in the browser.

Userland only sees `Sys.net`, never `fetch`. This keeps commands portable and
gives a future TCP, WebTransport or test device one small interface to replace.

Browsers do not expose raw TCP and enforce CORS. `bun run web` therefore serves
the UI and an HTTP relay on loopback. Static hosting still works for URLs whose
servers opt into CORS.
