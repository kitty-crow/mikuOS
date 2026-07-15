#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
dependency="${1:?dependency name required}"
revision="${2:?dependency revision required}"
python3 - "$dependency" "$revision" <<'PYUPDATE'
import json, subprocess, sys
from pathlib import Path
name, revision = sys.argv[1:]
path = Path("project.dependencies.json")
data = json.loads(path.read_text())
items = {item["name"]: item for item in data.get("dependencies", [])}
if name not in items:
    raise SystemExit(f"unknown dependency: {name}")
item = items[name]
submodule = item["path"]
subprocess.run(["git", "-C", submodule, "fetch", "origin", revision], check=True)
subprocess.run(["git", "-C", submodule, "checkout", "--detach", revision], check=True)
item["commit"] = subprocess.check_output(["git", "-C", submodule, "rev-parse", "HEAD"], text=True).strip()
path.write_text(json.dumps(data, indent=2) + "\n")
PYUPDATE
