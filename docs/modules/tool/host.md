# Host filesystem operations

`Path` permits host filesystem paths and URLs. `Ent` describes directory entries, while `FsP` defines the asynchronous operations required by the build tools. `fsp` returns an adapter backed by Node filesystem APIs. Directory creation resolves without a path value because callers only require successful completion. Errors propagate to the caller.
