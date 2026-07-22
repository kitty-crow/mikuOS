# Userland migration plan

mikuOS currently includes original implementations of common Unix
commands. These are bootstrap implementations rather than the
intended final userland. They remain available as recovery tools
while upstream packages are ported to Thistle64. A replacement is
adopted only after it passes the same command, pipe, redirection,
filesystem and exit-status tests in both kernel modes and in the
browser build.

## Stage 1: low-risk coreutils

`true`, `false`, `basename`, `dirname`, `pwd`, `printenv`, `whoami`,
`yes`, `seq` and `sleep`.

## Stage 2: stream and text utilities

`cat`, `head`, `tail`, `wc`, `cut`, `tr`, `tee`, `base64`, `sort`,
`uniq`, `echo` and `printf`, followed by GNU grep and GNU sed.

## Stage 3: filesystem utilities

Begin with `mkdir`, `rmdir`, `touch`, `readlink`, `ln`, `chmod`,
`chown`, `stat` and `ls`. Add recursive or destructive tools only
after the lower-risk operations pass.

## Stage 4: system and process utilities

This stage is led by kernel-interface availability. Its exact command
list will be fixed here before implementation begins. It covers
process control, identity, time, filesystem reporting and system
information only after their required interfaces are available.

## Stage 5: larger userland facilities

Port `file`, `clear` and `wget`, then introduce Bash as the normal
shell when its required interfaces pass. `thsh` remains available as
the recovery shell.

## Stage 6: toolchain cleanup

Separate native Thistle tools from the upstream compiler and binutils
commands, and make each installed binary reproducible from its source
and toolchain lock.

## Stage 7: remaining packages

Assign every package not covered by an earlier stage before porting
work begins. Each addition must meet the same reproducibility and
cross-kernel test requirements.

## Stage 8: default-image cleanup

Remove duplicate default commands only after image reproduction and
rollback tests pass. The original implementations remain in the
recovery set until that final verification is complete.
