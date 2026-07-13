---
module: fs
owns: [inodes, paths, permissions, links, devices, persistent-root]
filesystem: memory-vfs-with-host-root-mirror
---

# Filesystem

The VFS uses byte-backed regular files, directories, symbolic links and
character devices. Names belong to directory entries rather than inodes, so
hard links behave correctly. All public operations resolve credentials and
directory traversal permissions before touching data.

Paths are POSIX-like. `tree.ts` serialises the complete VFS root to ordinary
host files. Bun defaults to `<repo>/.thistle`; browsers use OPFS `.thistle` or
the same child inside a user-selected project directory. A small
`.thistle-meta.json` file retains guest permissions and link identity; file
contents are never packed into an image or database. Character devices and
`/proc` entries are live nodes and are remounted after restore.

The host tree is authoritative for file bytes and real inode relationships at
boot. Guest writes flush after each shell command. Files added or edited by the
host are imported by a fresh boot, which avoids silently replacing an editor's
in-flight changes while a guest command is running.
