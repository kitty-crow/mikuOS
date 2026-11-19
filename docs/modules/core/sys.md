# core/sys

A process-facing system-call view applies the current credentials and working directory to kernel services. File, process, environment and I/O operations use the process descriptor table and return guest-domain failures on invalid requests.

Public names: `Sys`, `AppInfo`.
