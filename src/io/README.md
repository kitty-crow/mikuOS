---
module: io
owns: [byte-streams, pipes, host-sinks]
---

# I/O

Kernel descriptors speak byte streams. `Pipe` supplies back-pressure-free
in-memory IPC, while host adapters decide whether bytes become DOM nodes or
terminal text. Closing the writer produces EOF for readers, just as it should.
