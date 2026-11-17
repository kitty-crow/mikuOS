#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
work="$(mktemp -d /tmp/mikuos-base-userland.XXXXXXXX)"
trap 'rm -rf -- "$work"' EXIT
cat > "$work/commands" <<'GUEST'
command -v dd && command -v od && command -v head && command -v bash && command -v : && :
printf 'first\nsecond\n' | head -n 1
printf 'ABC' > /tmp/gnu-data; dd if=/tmp/gnu-data of=/tmp/gnu-copy bs=1 count=3 && od -An -tx1 /tmp/gnu-copy
bash -c 'printf "bash-ready\n"'
printf 'persisted\n' > /root/base-userland-test
GUEST
timeout 240 nice -n 10 bun run mikuos --kernel=teto --root "$work/root" < "$work/commands" 2>&1 | tee "$work/log"
tr -d '\r' < "$work/log" > "$work/plain"
grep -F 'Kernel source: Teto.' "$work/plain"
for cmd in dd od head bash; do
  grep -Fx "/bin/$cmd" "$work/plain"
  cmp ".thistle.base/bin/$cmd" "$work/root/bin/$cmd"
done
grep -Fx ':' "$work/plain"
grep -Fx 'first' "$work/plain"
grep -E '41[[:space:]]+42[[:space:]]+43' "$work/plain"
grep -Fx 'bash-ready' "$work/plain"
! grep -Ei 'ENOEXEC|not found|fell back to Thistle|Persistent root was not mounted|Persistence save failed' "$work/plain"
printf 'cat /root/base-userland-test\n' | timeout 180 nice -n 10 bun run mikuos --kernel=teto --root "$work/root" | tr -d '\r' | grep -Fx 'persisted'
