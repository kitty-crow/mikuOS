# Root image and userland

`.thistle.base/` is the committed root filesystem for mikuOS. Its metadata records guest modes, ownership, directories, links and inodes. Both the CLI and browser start from this image, including the prebuilt THX2 programmes in its `bin/` directory.

The CLI initialises a writable `.thistle/` mirror from the image on first boot. It restores that mirror on subsequent boots; it never writes to the committed base. A default root created by the earlier minimal-image CLI receives a one-time migration of missing system paths. Existing files and home directories are preserved. An empty explicit `--root PATH` is also initialised from the image; a nonempty custom root remains authoritative. `--no-root` selects the minimal diagnostic environment instead.

The browser packages the same base during the build and stores changes in its persistence overlay.

`/bin/thsh` remains the default shell, including its `command` and `:` built-ins. `/bin/bash` is an installed native alternative. GNU `head`, `dd` and `od` are native THX2 executables, not TypeScript launchers.

`root-image.lock.json` records project revisions used by a reproducible image build. Package and licence metadata belongs with the installed files rather than in the kernel source.
