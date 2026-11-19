# main/cli

The host CLI parses kernel and executable options, loads configuration and connects terminal I/O to the guest session. It chooses Bun or Node file access and writes diagnostic output through the host's standard streams.

This module is an executable entry point rather than a reusable guest API.
