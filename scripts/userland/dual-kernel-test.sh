#!/usr/bin/env bash
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROOT="$PROJECT/.thistle"
KEEP=0
EXPECTED=0

usage() {
  cat <<'EOF'
usage: dual-kernel-test.sh [--root PATH] [--expect-exit N] [--keep] -- 'guest command'

Runs the same guest command against disposable copies of the current root under
Teto and direct Thistle. The live .thistle tree is never modified.
EOF
}

while (($#)); do
  case "$1" in
    --root)
      (($# >= 2)) || { echo "error: --root needs a path" >&2; exit 2; }
      ROOT="$2"
      shift 2
      ;;
    --expect-exit)
      (($# >= 2)) || { echo "error: --expect-exit needs a number" >&2; exit 2; }
      EXPECTED="$2"
      [[ "$EXPECTED" =~ ^[0-9]+$ ]] || { echo "error: invalid exit status: $EXPECTED" >&2; exit 2; }
      shift 2
      ;;
    --keep)
      KEEP=1
      shift
      ;;
    --)
      shift
      break
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

(($# == 1)) || { echo "error: provide exactly one guest command string after --" >&2; usage >&2; exit 2; }
COMMAND="$1"
[[ -d "$ROOT" ]] || { echo "error: root does not exist: $ROOT" >&2; exit 2; }
[[ -f "$PROJECT/build/main/cli.js" && -f "$PROJECT/dist/teto/teto.wasm" ]] || {
  echo "error: build output is missing; run npm run build first" >&2
  exit 2
}
command -v node >/dev/null || { echo "error: node is required to launch the built CLI" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/mikuos-userland-test.XXXXXX")"
cleanup() {
  if ((KEEP)); then
    echo "kept test roots: $WORK"
  else
    rm -rf "$WORK"
  fi
}
trap cleanup EXIT

copy_root() {
  local destination="$1"
  mkdir -p "$destination"
  cp -a --reflink=auto "$ROOT/." "$destination/" 2>/dev/null || cp -a "$ROOT/." "$destination/"
}

run_one() {
  local kernel="$1"
  local root="$WORK/$kernel-root"
  local output="$WORK/$kernel.out"
  copy_root "$root"
  set +e
  printf '%s\n' "$COMMAND" | (
    cd "$PROJECT"
    MIKUOS_ROOT="$root" node build/main/cli.js "--kernel=$kernel"
  ) >"$output" 2>&1
  local status=$?
  set -e
  if ((status != EXPECTED)); then
    cat "$output"
    echo "error: $kernel returned $status, expected $EXPECTED" >&2
    return 1
  fi
  if grep -Eiq 'unsupported syscall|\bENOSYS\b|Teto WebAssembly core fault|RV64 fault' "$output"; then
    cat "$output"
    echo "error: $kernel reported a kernel compatibility failure" >&2
    return 1
  fi
  echo "[$kernel] passed: $COMMAND"
}

run_one teto
run_one thistle
