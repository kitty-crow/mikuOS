# Root image and userland

`.thistle.base/` contains the committed root filesystem, including
system configuration, accounts, native THX2 programmes, links
and filesystem metadata.

## Persistence

The CLI initialises `.thistle/` from the base image on first boot
and restores the writable tree on subsequent boots. The committed
base remains unchanged.

Roots created by the earlier minimal-image CLI receive missing
system paths through a one-time migration. Existing files and
home directories are preserved.

An empty directory selected with `--root PATH` is initialised
from the base image. A nonempty custom root remains authoritative.
`--no-root` selects the minimal diagnostic environment.

The browser packages the same base and stores modifications
in its persistence overlay.

## Shell and commands

`/bin/thsh` is the default shell and provides the `command` and
`:` built-ins. `/bin/bash` is an installed native alternative.

GNU `head`, `dd` and `od` are native THX2 executables.

## ELF conversion

The host converter imports compatible statically linked,
little-endian RISC-V ELF64 executables into THX2:

```sh
bun run build
bun run host:elf2thx -- input.elf output.39
```

Dynamic interpreters and dynamic ELF segments are rejected.
Conversion preserves loadable segments and the entry point.
Participating programmes must use a supported instruction
profile and runtime ABI.

## Image provenance

`root-image.lock.json` records image build inputs. Installed
packages retain their upstream licence and version metadata.
