# Host ELF conversion

The host command takes an input ELF path and an output THX path. It reads the executable, converts it with the ELF importer, serialises the result using the THX codec and sets executable permissions on the output. Invalid argument counts, unsupported input and filesystem failures stop the command.
