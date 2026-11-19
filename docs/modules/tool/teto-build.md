# Teto build entry point

This host script accepts --validate-only, --test-cli and --test-web. It selects the npm validation or full build script, forwards the child process output and exits on a failed command. The CLI test and the Bun web server are launched only when requested.
