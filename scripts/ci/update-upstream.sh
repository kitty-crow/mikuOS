#!/usr/bin/env bash
set -Eeuo pipefail
revision="${1:?upstream revision required}"
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
bash scripts/ci/update-dependency.sh Teto "$revision"
git add deps/teto project.dependencies.json
git -C deps/teto submodule update --init --recursive
