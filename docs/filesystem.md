# Filesystem

The VFS stores directories, regular files, symbolic links and device
nodes in a single tree. Path lookup applies the calling process's
root, working directory, credentials and link-following rules.

File permissions are checked at the VFS boundary. Operations that
alter the tree update its metadata so a host persistence layer can
write the same state back without inventing guest semantics.

Mounting and device handling are kernel concerns; packaging a
particular root tree is outside the VFS implementation.
