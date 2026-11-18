# Historical build entry point

This host-side module imports the Teto build entry point for callers still using the original Baguette tool path. It forwards the existing process arguments through that entry point and has no independent compilation or validation logic. New callers should use the Teto build command.
