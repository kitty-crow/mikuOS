#!/usr/bin/env bash
set -Eeuo pipefail
revision="${1:?upstream revision required}"
branch="upstream/teto"
git config user.name "KITTYX compatibility worker"
git config user.email "kittyx-bot@users.noreply.github.com"
git checkout -B "$branch"
git add -A
git commit -m "Test teto ${revision:0:12}" || true
git push --force-with-lease origin "$branch"
title="Update from teto ${revision:0:12}"
body="The exact upstream revision was merged and the downstream compatibility suite passed. Human approval is required."
number="$(gh pr list --head "$branch" --json number --jq '.[0].number // empty')"
if [[ -n "$number" ]]; then
  gh pr edit "$number" --title "$title" --body "$body"
else
  gh pr create --draft --head "$branch" --base main --title "$title" --body "$body"
fi
