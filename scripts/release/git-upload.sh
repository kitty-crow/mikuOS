#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
KITTYX="$(cd "$ROOT/.." && pwd -P)"
PRIVATE_ROOT="$HOME/mikuos-private-backups"
MESSAGE="${1:-build: sync controlled browser base}"
EXPECTED_REMOTE_HTTPS="https://github.com/kitty-crow/mikuOS.git"
EXPECTED_REMOTE_SSH="git@github.com:kitty-crow/mikuOS.git"

die() {
    printf '\nERROR: %s\n' "$*" >&2
    exit 1
}

need() {
    command -v "$1" >/dev/null 2>&1 ||
        die "Required command is missing: $1"
}

for command in git python3 tar gzip sha256sum npm node find gitleaks; do
    need "$command"
done

cd "$ROOT"

[ "$(git branch --show-current)" = "main" ] ||
    die "mikuOS must be on branch main"

REMOTE="$(git remote get-url origin)"
case "$REMOTE" in
    "$EXPECTED_REMOTE_HTTPS"|"$EXPECTED_REMOTE_SSH") ;;
    *) die "Unexpected origin remote: $REMOTE" ;;
esac

[ ! -e .git/MERGE_HEAD ] || die "A merge is in progress"
[ ! -d .git/rebase-merge ] || die "A rebase is in progress"
[ ! -d .git/rebase-apply ] || die "A rebase is in progress"

if [ "${MIKUOS_SKIP_BACKUP:-0}" != "1" ]; then
    STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
    BACKUP="$PRIVATE_ROOT/KITTYX-BEFORE-MIKUOS-UPLOAD-$STAMP.tar.gz"
    BACKUP_SUM="$BACKUP.sha256"

    mkdir -p "$PRIVATE_ROOT"

    printf '\n===== Backing up KITTYX =====\n'

    sudo tar \
        --acls \
        --xattrs \
        --exclude='KITTYX/mikuOS/staging' \
        --exclude='KITTYX/mikuOS/staging/**' \
        --exclude='KITTYX/mikuOS/.rebuild-userland' \
        --exclude='KITTYX/mikuOS/.rebuild-userland/**' \
        -I 'gzip -9' \
        -cf "$BACKUP" \
        -C "$(dirname "$KITTYX")" \
        "$(basename "$KITTYX")"

    sudo tar -tzf "$BACKUP" >/dev/null ||
        die "The pre-upload backup could not be verified"

    sudo chown "$USER":"$(id -gn)" "$BACKUP"
    sha256sum "$BACKUP" > "$BACKUP_SUM"

    printf 'Backup:   %s\n' "$BACKUP"
    printf 'Checksum: %s\n' "$BACKUP_SUM"
fi

printf '\n===== Checking remote ancestry =====\n'

git fetch origin main

BEHIND="$(git rev-list --count HEAD..origin/main)"
[ "$BEHIND" -eq 0 ] ||
    die "Local main is behind or diverged from origin/main; reconcile it before uploading"

printf '\n===== Synchronising .thistle.base =====\n'

python3 scripts/release/sync-thistle-base.py

printf '\n===== Building and testing mikuOS =====\n'

npm ci
npm run build
node build/test/all.js

test -s dist/web/root/manifest.json ||
    die "The browser root manifest was not created"

test -s dist/web/teto/teto.wasm ||
    die "Teto was not built"

printf '\n===== Staging repository changes =====\n'

git add -A

if git diff --cached --name-only | grep -Eq '^\.thistle(?:/|$)'; then
    die "The private .thistle root was staged; refusing to continue"
fi

python3 <<'PYVERIFY'
from __future__ import annotations

import json
from pathlib import Path
import subprocess

root = Path(".thistle.base")
metadata = json.loads(
    (root / ".thistle-meta.json").read_text(encoding="utf-8")
)

tracked_raw = subprocess.check_output(
    ["git", "ls-files", "-z", "--", ".thistle.base"],
)
tracked = {
    Path(value.decode())
    for value in tracked_raw.split(b"\0")
    if value
}

missing: list[Path] = []

for path in root.rglob("*"):
    if path.is_file() or path.is_symlink():
        if path not in tracked:
            missing.append(path)

for entry in metadata.get("ent", []):
    if entry.get("k") not in {"f", "l"}:
        continue
    guest = str(entry["p"])
    path = Path(".thistle.base" + guest)
    if path not in tracked:
        missing.append(path)

if missing:
    print("ERROR: Controlled-base payloads are not tracked by Git:")
    for path in sorted(set(missing))[:100]:
        print(f"  - {path}")
    raise SystemExit(1)
PYVERIFY

OVERSIZED="$(find .thistle.base -type f -size +95M -print -quit)"
[ -z "$OVERSIZED" ] ||
    die "GitHub file-size limit would be exceeded by: $OVERSIZED"

git diff --cached --check -- . ':(exclude).thistle.base/**'

git status --short
git diff --cached --stat

BEFORE="$(git rev-parse HEAD)"
CREATED_COMMIT=0

if ! git diff --cached --quiet; then
    git commit -m "$MESSAGE"
    CREATED_COMMIT=1
else
    printf 'No repository changes needed a commit.\n'
fi

printf '\n===== Running Gitleaks =====\n'

if ! gitleaks git --no-banner --redact .; then
    if [ "$CREATED_COMMIT" -eq 1 ]; then
        git reset --soft "$BEFORE"
    fi
    die "Gitleaks rejected the upload; nothing was pushed"
fi

printf '\n===== Pushing mikuOS =====\n'

git push origin main

printf '\nUpload complete.\n'
printf 'Pages: https://kitty-crow.github.io/mikuOS/\n'
