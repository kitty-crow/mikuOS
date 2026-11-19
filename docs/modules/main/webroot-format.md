# main/webroot-format

Browser root metadata distinguishes directories, symbolic links and files backed by core ranges or lazy blobs. Decoding validates the manifest, inode metadata and reference kind before offsets or blob paths are consumed.

Public names: `WebRootBaseEntry`, `WebRootDirectoryEntry`, `WebRootLinkEntry`, `WebRootCoreRef`, `WebRootBlobRef`, `WebRootFileEntry`, `WebRootEntry`, `WebRootManifest`, `readWebRoot`.
