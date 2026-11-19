# vm/linux-events

Event descriptors emulate event counters, timers and epoll readiness for guest programs. Duplicates share device state, pipe transitions wake waiters, and status flags remain attached to the descriptor's underlying device.

Public names: `RvLinuxEvents`.
