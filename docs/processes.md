# Processes and descriptors

The process table records process identifiers, parentage, groups,
sessions, credentials, environment and open descriptors. Fork-like
creation copies the required process state; execution replaces the
programme image while retaining the process identity and applicable
descriptors.

Descriptors refer to open file descriptions rather than directly to
paths. This preserves offsets and pipe endpoints across duplication.
Signals and process-group operations are resolved through the process
table.
