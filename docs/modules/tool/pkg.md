# tool/pkg

The host package writer walks a staged guest tree and writes a versioned compressed root package. It preserves inode identity, records payload offsets and uses the same file and framing checksums as the installer.

This module is an executable entry point rather than a reusable guest API.
