---
module: core
owns: [processes, scheduling, signals, syscalls, host-limits, boot-log]
---

# Core

`Kern` owns all global kernel state. `Proc` holds isolated process state and
`Sys` is the only object handed to programs. `Sched` admits ready processes on
microtask boundaries. Scheduling is cooperative because JavaScript controls
pre-emption, but lifecycle, waiting, groups and signals are kernel-managed
rather than inferred from terminal output.

`cap.ts` derives host-sensitive VFS, touched-page, stack and instruction limits.
Environment overrides change resource policy without changing the native ABI.
