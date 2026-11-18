# Cooperative scheduling

`Sched` holds the ready process IDs and a tick count. `add` marks a process ready and starts its asynchronous operation in a microtask; operation rejection ends it with status 126. `yield` allows the host event loop to run, periodically using a timer instead of a microtask. A process which has not exited resumes in the running state. This scheduler does not provide pre-emptive CPU scheduling.
