---
module: fs
owns: [inodes, paths, permissions, links, devices]
filesystem: volatile-memory
---

# Filesystem

The VFS uses byte-backed regular files, directories, symbolic links and
character devices. Names belong to directory entries rather than inodes, so
hard links behave correctly. All public operations resolve credentials and
directory traversal permissions before touching data.

Paths are POSIX-like and the root image is deliberately volatile: `reboot`
constructs a fresh instance.
