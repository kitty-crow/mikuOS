# fs/vfs

The virtual filesystem resolves guest paths, enforces ownership and modes, and maintains directory, regular-file, symbolic-link and character-device nodes. Lazy regular files retain a loader until materialisation; failed capacity checks restore the previous inode state.

Public names: `Cred`, `Kind`, `Rfn`, `Wfn`, `RegSource`, `VNode`, `Reg`, `Dir`, `Sym`, `Chr`, `St`, `Hit`, `credUid`, `credGid`, `norm`, `fmtMode`, `Vfs`.
