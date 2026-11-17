# Neru integration

Neru owns the Linux-WASM build, boot and filesystem transport. mikuOS supplies the existing persistent userland; the selector does not build an initramfs or maintain a separate root.

```sh
git submodule update --init --recursive deps/neru
bun mikuos.ts --kernel=neru --root /path/to/initialised/root
```

The default root is `.thistle`, not `.thistle.base`. Initialise a new root through the normal mikuOS CLI before selecting Neru. The standalone Neru launcher can also be invoked directly with `--fs-root` or `--fs-endpoint`.

Browser integration and end-to-end live-filesystem boot remain unvalidated. The former prototype is retained in the branch's history, not installed into the current web build.
