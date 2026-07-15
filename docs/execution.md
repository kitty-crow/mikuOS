# Programme execution

Thistle recognises script commands, Thistle32 and Thistle64 THX
executables, and supported WebAssembly programmes. The executable
header selects the machine and instruction profile.

Loading validates the container before creating machine state.
Arguments and environment are supplied by the process, and the
resulting exit status is returned through the normal process path.

`.thx` and `.39` name the same executable format. Execution depends
on the header, not the filename.
