#!/usr/bin/env bash
set -Eeuo pipefail
revision="${1:?upstream revision required}"
upstream_url="${KITTYX_UPSTREAM_URL:-https://github.com/${GITHUB_REPOSITORY_OWNER}/thistle.git}"
git remote get-url upstream >/dev/null 2>&1 || git remote add upstream "$upstream_url"
git remote set-url upstream "$upstream_url"
git fetch upstream "$revision"
git merge --no-edit "$revision"
