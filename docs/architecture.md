# System architecture

MIKU provides the userspace shared by both kernel modes. Teto is the
default; `--kernel=thistle` selects the direct TypeScript kernel.
Both modes use the same process model, root image, accounts, shell
and command set.

`src/main` contains the command-line and browser hosts. `src/apps`
contains built-in commands. `src/sh` contains the shell and line
editor. System configuration and the packaged filesystem are loaded
by the main boot path.

Kernel selection is a launch decision. Userland code should not
branch on it unless a test is explicitly comparing the two modes.
