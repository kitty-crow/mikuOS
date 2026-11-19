# io/stream

Guest descriptors read and write byte arrays through small asynchronous stream contracts. Memory streams collect deterministic test input and output, while pipes retain unread bytes and wake waiting readers when producers write or close.

Public names: `enc`, `dec`, `TerminalState`, `In`, `Out`, `MemIn`, `MemOut`, `FnOut`, `Pipe`, `TeeOut`.
