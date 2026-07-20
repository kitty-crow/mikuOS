# Compatibility path

Teto currently generates the migrated kernel path and returns an
explicit fallback request for operations that still use the direct
Thistle implementation. The fallback is part of the current runtime
contract and is covered by parity tests.

`THISTLE_TETO_STRICT=1` disables this path during testing. A strict
run reports an unimplemented system call instead of crossing to the
direct implementation.

New kernel work should be tested in both modes until the generated
path provides the same result and state changes.
