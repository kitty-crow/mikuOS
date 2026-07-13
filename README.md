---
title: Thistle OS
release: 1.0.0
status: complete
targets: [browser, bun]
---

# Thistle OS

Thistle is a small Unix-like operating environment written entirely in
TypeScript and compiled to ordinary JavaScript. It is a user-space kernel: the
host provides CPU time, a clock and a terminal, while Thistle owns processes,
process groups, signals, file descriptors, pipes, users, permissions, an
in-memory inode filesystem, character devices, system calls, job control and
the programs running above them.

This is not a terminal animation. Commands are registered executables, every
command receives a separate process and syscall context, pipelines use kernel
pipes, redirects touch the VFS, and `ps`, `kill`, `/proc`, permissions and exit
codes all read live kernel state.

## Run book

### Browser

```sh
npm install
npm run build
```

Serve the project directory with any static HTTP server and open `index.html`.
With Bun installed, the verified shortest route is:

```sh
bun index.html
```

Then visit the printed local URL. The checked-in `build/` directory also means
the page can be served without installing development dependencies.

### Bun terminal

```sh
bun run thistle.ts
```

The CLI and browser boot exactly the same kernel image. Node can run the built
CLI as a useful compatibility check:

```sh
npm install
npm start
```

### Run external WebAssembly binaries

In the browser, press **Load WASM**, choose a `.wasm` file, then execute the
guest path printed in the terminal. The bytes are validated and copied into
`/tmp` with execute permission.

For Bun, import a host file while booting:

```sh
bun run thistle.ts --wasm ./assets/hello.wasm
```

Thistle prints its guest path. Execute that path at the prompt. Binaries can
also be moved entirely through guest tools, for example with `base64 -d` and a
redirect followed by `chmod +x`.

### Verify everything

```sh
npm install
npm run check
```

`check` removes generated JavaScript, compiles from clean TypeScript, and runs
the kernel, filesystem, shell, process, signal and userland integration suite.

## First commands

```sh
help
uname -a
ls -la /
cat /etc/motd
echo "red\ngreen\nblue" | sort | grep r
mkdir /tmp/demo && echo hello > /tmp/demo/note
cat /tmp/demo/note
sleep 20 &
jobs
ps
kill %1
```

Shell syntax includes single and double quotes, escapes, variables, globs,
pipelines, `<`, `>`, `>>`, `2>`, command lists, `&&`, `||` and background jobs.
Built-ins include `cd`, `export`, `unset`, `set`, `alias`, `unalias`, `history`,
`jobs`, `fg`, `wait`, `umask`, `exit` and `reboot`.

## Included userland

Thistle ships compact equivalents of the basic tools normally supplied by GNU
coreutils and friends: filesystem tools, text filters, identity tools, process
tools and kernel inspection tools. Run `help` for the live list or
`<command> --help` for a command synopsis.

## Architecture

| Layer | Responsibility | Replaceable unit |
| --- | --- | --- |
| Host | DOM or terminal input/output | `src/main` and `src/io` |
| Shell | Grammar, expansion, redirects and jobs | `src/sh` |
| Userland | Executable program classes | `src/apps` |
| Syscalls | Per-process capability boundary | `src/core/sys.ts` |
| Kernel | Process table, scheduler, signals and boot | `src/core` |
| VFS | Inodes, links, devices, paths and permissions | `src/fs` |

No user program imports the VFS or mutates a process directly. The `Sys` object
is the boundary, which keeps applications portable and makes each layer
forkable without dragging the others along.

## Deliberate boundary

JavaScript cannot enter CPU supervisor mode or programme a real MMU from a web
page. Thistle is therefore a genuine *user-space* kernel, in the same broad
family as library OSes and compatibility kernels, not a bootable hardware
kernel. Within that boundary its state and behaviour are implemented rather
than mocked. There is no fake command transcript and no native command is
silently delegated to the host OS.

## Repository map

Every folder has a YAML-front-matter `README.md` describing its contract.
Generated declarations and source maps live beside the JavaScript in `build/`.
The build output is committed intentionally so the browser is immediately
runnable.

## Licence

MIT. See `LICENSE`.
