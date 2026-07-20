# Host interface

The host creates or supplies the WebAssembly memory and calls the
exported Teto entry points recorded in the manifest. Kernel and
process state is stored at fixed offsets described by the Teto ABI
module.

Host operations are explicit. The generated core may request a
supported host write or return a system-call request to the
compatibility path. Unknown operation numbers are errors.

The baseline and threaded modules expose the same logical kernel
interface. Their memory and synchronisation requirements differ, so
a host must load the variant it supports.
