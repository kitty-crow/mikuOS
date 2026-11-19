# boot/loader

The early browser bridge instantiates the boot-screen WASM and reports progress before the main runtime loads. It adapts terminal dimensions, keeps the splash centred, and restores display placement when boot finishes or fails.

Public names: `BootTerminal`, `BootDisplay`, `BootApi`.
