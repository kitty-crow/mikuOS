# Root image and userland

The root image contains system configuration, accounts, built-in
command launchers, native THX programmes and supporting files. The
command-line host may persist the tree on the host filesystem. The
browser host stores its persistent copy through the browser storage
adapter.

Built-in commands are dispatched through `src/apps`. Native
programmes are loaded from the same virtual filesystem and execute
through the selected kernel mode.

`root-image.lock.json` records the project revisions used by a
reproducible image build. Package and licence metadata belongs with
the installed files rather than in the kernel source.
