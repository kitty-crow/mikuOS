#!/usr/bin/env python3
import json, os, subprocess
from pathlib import Path

source = os.environ["SOURCE_REPOSITORY"]
sha = os.environ["SOURCE_SHA"]
data = json.loads(Path("project.dependants.json").read_text())
for item in data.get("dependants", []):
    repository = item["repository"]
    event = item.get("event", "dependency-updated")
    dependency = item.get("dependency", source.rsplit("/", 1)[-1])
    payload = {
        "event_type": event,
        "client_payload": {
            "dependency": dependency,
            "source_repository": source,
            "new_commit": sha,
            "impact": item.get("impact", []),
            "advisory": bool(item.get("advisory", False)),
        },
    }
    subprocess.run([
        "gh", "api", "--method", "POST",
        f"repos/{repository}/dispatches",
        "--input", "-",
    ], input=json.dumps(payload), text=True, check=True)
