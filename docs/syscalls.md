---
topic: syscall-surface
boundary: core/Sys
---

# Syscall surface

`Sys` is instantiated for one `Proc`; it is never shared across processes.

| Group | Calls |
| --- | --- |
| Streams | `input`, `inb`, `chunk`, `out`, `err` |
| Files | `read`, `write`, `mkdir`, `list`, `rm`, `mv`, `link`, `stat`, `chmod`, `chown`, `utime` |
| Descriptors | `open`, `close`, `dup`, `fdr`, `fdw`, `seek` |
| Process | `start`, `wait`, `reap`, `kill`, `ps`, `sleep`, `yield`, `chk` |
| Identity | `pid`, `ppid`, `uid`, `gid`, `cwd`, `cd`, `env`, `setenv` |
| Kernel | `apps`, `which`, `logs`, `uptime`, `reboot` |

Filesystem calls resolve the process credentials on every operation. Passing a
path is not a capability to bypass mode bits. The WASI adapter uses the same
calls, which is why uploaded binaries cannot escape into the host filesystem.
