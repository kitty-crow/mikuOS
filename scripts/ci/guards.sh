#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
root="$PWD"
scope="$(mktemp -d)"
trap 'rm -rf -- "$scope"' EXIT

# Preserve source and document ownership. Submodule directories remain
# symlinks for type resolution, never an input to the guard suite.
git ls-files --cached --others --exclude-standard -z | sort -zu > "$scope/.guard-files"
while IFS= read -r -d '' file; do
    mkdir -p "$scope/$(dirname "$file")"
    if [[ -d "$file" ]]; then
        ln -s "$root/$file" "$scope/$file"
    else
        case "$file" in
            *.ts|*.tsx|*.mts|*.cts|*.json|*.md|*.yaml|*.yml|*.sh|*.toml)
                cp -a -- "$file" "$scope/$file" ;;
            *)
                ln -s "$root/$file" "$scope/$file" ;;
        esac
    fi
done < "$scope/.guard-files"

# Canonical Thistle sources are staged into mikuOS under ignored paths.
# They remain type-checkable but are not in the owned-file set.
while IFS= read -r file; do
    file="${file#/}"
    [[ -f "$file" ]] || { echo "Missing staged Thistle source: $file" >&2; exit 1; }
    mkdir -p "$scope/$(dirname "$file")"
    cp -a -- "$file" "$scope/$file"
done < <(sed -n '/^# Canonical Thistle native files/,$ { /^\/src\/.*\.ts$/p; }' .gitignore)

ln -s "$root/node_modules" "$scope/node_modules"
mkdir -p logs
bun "$root/scripts/ci/guards.mts" "$scope" | tee logs/code-guards.json
