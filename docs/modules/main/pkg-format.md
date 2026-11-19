# main/pkg-format

Root package headers use validated serialised inode metadata plus payload offsets and lengths. The reader checks the schema and release text; the installer separately verifies payload bounds, file checksums and kernel compatibility.

Public names: `PackageEntry`, `PackageManifest`, `readPackage`.
