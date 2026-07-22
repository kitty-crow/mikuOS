# Compatibility path

Teto runs migrated operations in the generated WebAssembly kernel.
Operations that have not yet been migrated return an explicit
fallback request and temporarily use the direct Thistle
compatibility implementation. Parity tests cover both paths.

`THISTLE_TETO_STRICT=1` disables fallback during testing. In strict
mode, an unmigrated operation reports an unimplemented system call
instead of crossing into Thistle.

New kernel work should pass in both modes until Teto provides the
same result and state changes without fallback.
