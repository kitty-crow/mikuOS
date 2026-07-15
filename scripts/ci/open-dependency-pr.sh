#!/usr/bin/env bash
set -Eeuo pipefail
dependency="${1:?dependency name required}"
revision="${2:?dependency revision required}"
safe="$(printf '%s' "$dependency" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-')"
branch="dependencies/${safe}"
git config user.name "KITTYX compatibility worker"
git config user.email "kittyx-bot@users.noreply.github.com"
git checkout -B "$branch"
git add -A
git commit -m "Test ${dependency} ${revision:0:12}" || true
git push --force-with-lease origin "$branch"
title="Update ${dependency} to ${revision:0:12}"
body="Compatibility checks passed for exact dependency revision ${revision}. This pull request is draft and requires human approval."
number="$(gh pr list --head "$branch" --json number --jq '.[0].number // empty')"
if [[ -n "$number" ]]; then
  gh pr edit "$number" --title "$title" --body "$body"
else
  gh pr create --draft --head "$branch" --base main --title "$title" --body "$body"
fi
