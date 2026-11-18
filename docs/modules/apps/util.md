# Application formatting helpers

`esc` expands recognised backslash escapes. `narg` parses a finite numeric argument and raises EINVAL on invalid input. `size` formats a byte count in powers of 1024, `globRx` translates a simple wildcard pattern into an anchored expression, and `cols` lays out strings in columns within an 80-character display width.
