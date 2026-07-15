# Kernel architecture

`Kernel` owns global process and filesystem state. A process carries
its credentials, environment, descriptors, working directory and
execution state. System calls operate on that state through the
`Sys` interface.

The virtual filesystem is independent of the host filesystem. Host
adapters populate or persist a tree, while guest operations continue
to use the same VFS interfaces.

Terminal input and output are streams. The command-line and browser
hosts supply different terminal adapters without changing the guest
process model.
