#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
log="$(mktemp /tmp/mikuos-teto-cli.XXXXXXXX)"
printf 'echo MIKUOS_TETO_SMOKE\n/tmp/hello-rv64.39\n' |
  timeout 180 nice -n 10 bun run mikuos --kernel=teto --no-root --bin assets/hello-rv64.39 hello-rv64.39 2>&1 | tee "$log"
grep -F 'Kernel source: Teto.' "$log"
grep -Fx 'MIKUOS_TETO_SMOKE' <(tr -d '\r' < "$log")
grep -F 'hello from Teto RV64GC' "$log"
! grep -Ei 'ENOEXEC|fell back to Thistle|not found|startup validation failed' "$log"
