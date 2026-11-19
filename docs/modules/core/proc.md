# core/proc

Processes retain credentials, descriptor tables, cancellation state and their completion promise. Descriptor objects record access flags and stream endpoints; process exit resolves its completion once and preserves zombie state until the parent reaps it.

Public names: `PState`, `Sig`, `Io`, `ExecReplace`, `Fd`, `Proc`.
