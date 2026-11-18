# System architecture

mikuOS supplies the root image, accounts, shell, command set and host
integration. Guest programmes use the kernel's process and filesystem
interfaces.

The CLI and browser on `main` expose `teto`, `thistle` and `auto` kernel modes.
Teto is the default; `auto` permits fallback to the hosted TypeScript kernel.
Explicit Teto selection reports kernel-loading errors. The two execution
paths share the same userspace. Native Rei, Rusty Rei and the Linux
compatibility architecture are separate from the hosted modes documented
here.

| Path | Purpose |
| --- | --- |
| `src/main` | CLI, browser, boot and persistent root adapters |
| `src/apps` | Built-in commands |
| `src/sh` | Shell and line editor |

Native kernel source is staged from the Thistle revision selected by the
build. See [source provenance](teto-source-provenance.md).
