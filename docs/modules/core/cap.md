# Host resource limits

`Lim` carries the filesystem, memory, stack and execution fuel limits. `Lim.host` derives default byte limits from browser device memory or the Node host's RAM, with a conservative fallback when neither is available. THISTLE_FS_MB, THISTLE_MEM_MB, THISTLE_STACK_MB and THISTLE_FUEL override the defaults. Values must be positive safe integers except fuel, which also accepts zero.
