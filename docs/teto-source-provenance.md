# Kernel source provenance

The pinned Teto snapshot contains modular WAT, its link layout,
ABI declarations and source provenance.

The Thistle gitlink in Teto identifies the corresponding canonical
kernel revision. The hosted build stages compatibility modules
from that same checkout and validates their origin.

Teto's standalone build assembles its committed WAT. The resulting
baseline and threaded WebAssembly binaries are copied into the
CLI and browser distributions.

The build checks the reference hashes. Explicit Teto execution
reports kernel-loading errors rather than selecting the hosted
fallback.

```sh
npm test
```

The integration suite verifies source staging, guest execution
and kernel compatibility.
