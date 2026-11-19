# Checked guard exceptions

The build runs the pinned Code Guards engine over repository-owned TypeScript, including tests and host scripts. Canonical Thistle files and Git submodules remain available for type resolution and are checked in their owning repositories.

Each reviewed exception uses `//@cg-expect-warning` immediately before its source line. The runner resolves expectations after combining all guard results. An obsolete expectation fails strict mode, so exceptions must be reviewed when the relevant code or checker changes.

The retained contracts cover fixed WASM and WASI scalar signatures, compatible public constructors, distinct commands implementing `App`, and composition points that bring kernel services together. Parser, terminal and filesystem checks keep their selected state or transaction scope where flattening would obscure the required ordering. Comments at these lines explain that scope.

The JSON parser, whitelisted dynamic host-module loader and isolated bundle-evaluation tests are explicit external typing boundaries. JSON consumers validate their concrete metadata formats before accessing them. Ordinary source values use checked access, complete records or explicit null alternatives.
