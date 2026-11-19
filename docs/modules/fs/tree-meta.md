# fs/tree-meta

Host metadata serialises inode attributes without resident byte arrays or loader callbacks. Versioned readers validate paths, kinds and non-negative integers, returning explicit nulls for optional fields omitted by older snapshots.

Public names: `TreeMeta`, `TreeManifest`, `treeMeta`, `readTreeManifest`.
