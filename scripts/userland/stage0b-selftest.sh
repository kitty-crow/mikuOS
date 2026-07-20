#!/usr/bin/env bash
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOOL="$PROJECT/scripts/userland/mikuos-userland.py"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/mikuos-stage0b.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

ROOT="$WORK/root"
mkdir -p "$ROOT"
cp -a --reflink=auto "$PROJECT/.thistle/." "$ROOT/" 2>/dev/null || cp -a "$PROJECT/.thistle/." "$ROOT/"

CANDIDATE="$WORK/true.thx"
cp "$ROOT/bin/true" "$CANDIDATE"

python3 "$TOOL" --project "$WORK/project" --root "$ROOT" stage true \
  --package stage0b-selftest \
  --candidate "$CANDIDATE" \
  --provider mikuOS-selftest \
  --version 0

python3 "$TOOL" --project "$WORK/project" --root "$ROOT" activate true
python3 "$TOOL" --project "$WORK/project" --root "$ROOT" status true --json >"$WORK/active.json"
python3 - <<'PY' "$WORK/active.json" "$ROOT/.thistle-meta.json"
import json
from pathlib import Path
import sys
status = json.loads(Path(sys.argv[1]).read_text())
assert status["commands"][0]["state"] == "upstream", status
meta = json.loads(Path(sys.argv[2]).read_text())
entry = next(item for item in meta["ent"] if item["p"] == "/bin/true")
assert entry["k"] == "l", entry
assert entry["to"] == "/usr/libexec/mikuos/upstream/stage0b-selftest/true", entry
PY

python3 "$TOOL" --project "$WORK/project" --root "$ROOT" rollback true
python3 "$TOOL" --project "$WORK/project" --root "$ROOT" status true --json >"$WORK/rollback.json"
python3 - <<'PY' "$WORK/rollback.json" "$ROOT/.thistle-meta.json"
import json
from pathlib import Path
import sys
status = json.loads(Path(sys.argv[1]).read_text())
assert status["commands"][0]["state"] == "builtin", status
meta = json.loads(Path(sys.argv[2]).read_text())
entry = next(item for item in meta["ent"] if item["p"] == "/bin/true")
assert entry["k"] == "l", entry
assert entry["to"] == "/usr/libexec/mikuos/builtin/true", entry
PY

echo "Stage 0B switch and rollback metadata self-test passed"
