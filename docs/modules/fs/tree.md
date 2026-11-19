# fs/tree

Snapshots carry inode identifiers, metadata and resident or lazy file payloads between a VFS and a host tree. Restoration validates records and normalises omitted legacy fields before rebuilding directories, hard links and file contents.

Public names: `TreeEnt`, `Tree`, `fileSum`, `TreeFs`, `treeFs`.
