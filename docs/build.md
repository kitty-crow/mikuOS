# Building Teto

`npm run build` first compiles the TypeScript host and then invokes
the pinned Baguette checkout with `baguette.config.json`.

The configuration selects the kernel entry modules, ABI exports,
memory layout, allowed host imports and output variants. Baguette
validates the source before writing either module. A normal build
also performs its deterministic-output check.

Useful commands:

    npm run build
    npm run teto:validate
    npm run teto:build:fast

`teto:build:fast` is intended for local iteration. Release and
compatibility builds use the normal deterministic path.
