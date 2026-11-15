#!/usr/bin/env bash
# Acceptance test for the exact same Node.js RV64 guest on Thistle and compiled Teto.
set -Eeuo pipefail

REPO="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
GUEST="${1:-$HOME/mikuos-node-build/node.39}"
LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mikuos-node-parity.XXXXXX")"

if [[ ! -f "$GUEST" ]]; then
  printf 'Missing Node.js guest: %s\n' "$GUEST" >&2
  exit 2
fi
if [[ ! -f "$REPO/dist/teto/teto.wasm" ]]; then
  printf 'Missing compiled Teto. Run npm run build first.\n' >&2
  exit 2
fi
if ! command -v bun >/dev/null || ! command -v timeout >/dev/null; then
  printf 'This test requires Bun and GNU timeout.\n' >&2
  exit 2
fi

cd "$REPO"
printf 'Node.js guest: %s\nLogs: %s\n' "$GUEST" "$LOG_DIR"
FAILURES=0

probe() {
  local kernel="$1"
  local log="$LOG_DIR/$kernel.log"
  local status=0

  printf '\nChecking %s with the original guest binary\n' "$kernel"
  set +e
  printf '%s\n' '/tmp/node.39 -e "console.log(6*7)"' |
    timeout -k 5s 600s bun mikuos.ts \
      --no-root --kernel="$kernel" --bin "$GUEST" node.39 \
      2>&1 | tee "$log"
  status="${PIPESTATUS[1]}"
  set -e

  if [[ "$status" -ne 0 ]] ||
      ! tr -d '\r' < "$log" | grep -Fxq '42' ||
      grep -Eq 'ENOEXEC:|Teto source core fault|Assertion failed|Asseption failed' "$log"; then
    printf 'FAIL: %s (host exit status %s)\n' "$kernel" "$status"
    FAILURES=$((FAILURES + 1))
  else
    printf 'PASS: %s printed 42 and exited cleanly\n' "$kernel"
  fi
}

probe thistle
probe teto
printf '\nThistle/Teto Node.js parity failures: %s\n' "$FAILURES"
printf 'Diagnostic logs: %s\n' "$LOG_DIR"
[[ "$FAILURES" -eq 0 ]]
