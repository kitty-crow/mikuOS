# Browser Teto smoke-test assets

This build script copies the baseline and threaded Teto modules, manifest, host declarations and smoke-test HTML into the static web distribution. esbuild bundles the browser smoke-test TypeScript entry as an ES module targeting ES2022. The script expects the Teto artefacts to have been generated already and terminates after preparing the files.
