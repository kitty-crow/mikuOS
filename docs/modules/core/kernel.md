# core/kernel

The kernel owns processes, the VFS, command registration, scheduling and executable selection. It checks credentials and descriptor inheritance before starting work and reaps completed children without changing another process's identity.

Public names: `Start`, `PInfo`, `Mnt`, `Kern`.
