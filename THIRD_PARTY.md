# Third-party software

The source tree uses npm packages listed in `package.json` and
`package-lock.json`. The static browser build includes xterm.js and
its fit add-on.

The root image may contain software built from GNU, musl, shadow,
sudo, ncurses, nano and other upstream sources. Each installed
package retains its upstream licence and version metadata. Generated
root-image manifests record the source and checksum of installed
files.

Git submodules are separately versioned KITTYX projects and retain
their own licence files.
