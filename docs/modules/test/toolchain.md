# Guest compiler integration test

The test boots a host runtime with the root toolchain package, checks guest compiler version output and compiles C and C++ fixtures using the packaged compilers. It verifies THX machine and ISA metadata before executing each output, compares its greeting and fails if the runtime logged unsupported syscalls. A root package containing the expected tools is required.
