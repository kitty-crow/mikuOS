# apps/fs

Filesystem commands operate on guest paths through Sys rather than host file APIs. Argument validation, traversal, ownership and permission errors follow the same VFS rules as executable programs.

Public names: `Pwd`, `Ls`, `Cat`, `Touch`, `Mkdir`, `Rmdir`, `Rm`, `Cp`, `Mv`, `Ln`, `Readlink`, `StatApp`, `Chmod`, `Chown`, `Find`, `BaseName`, `DirName`.
