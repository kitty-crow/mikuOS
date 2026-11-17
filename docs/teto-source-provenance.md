# Teto source provenance

mikuOS pins Teto as a Git submodule. The Teto snapshot consists of Baguette-generated modular WAT, its link layout and the source provenance manifest. Its Thistle gitlink must match the canonical revision in that manifest.

The build stages direct TypeScript compatibility files from that exact Thistle revision, validates their origin, builds the host and compiles the committed Teto source. It does not regenerate the production kernel from moving upstream branches.

The baseline and threaded binaries must match Teto's reference hashes. The same bytes are copied to the CLI and browser distributions. CI checks guest execution and the kernel ABI in explicit Teto mode; the CLI must not fall back silently.
