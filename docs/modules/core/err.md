# core/err

Kernel failures carry a stable errno and a readable message. Checked value access rejects missing runtime state, nullable operations preserve explicit absence, and invariant checks construct their failure only when needed.

Public names: `Errno`, `KErr`, `bad`, `msg`, `requireValue`, `withValue`, `ensure`.
