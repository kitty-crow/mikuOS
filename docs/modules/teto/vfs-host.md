# teto/vfs-host

The host bridge encodes a materialised guest tree for Teto's native VFS. It validates payload kinds, deduplicates inode content and preserves hard-link identity when translating paths and metadata into the kernel image.

Public names: `serializeTetoVfs`.
