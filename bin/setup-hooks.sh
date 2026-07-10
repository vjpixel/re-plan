#!/usr/bin/env bash
# Point git at the repo-tracked hooks in bin/hooks/, so post-merge and
# post-checkout auto-run install-skills.sh and keep ~/.claude/commands in
# sync (see issue #108). Safe to run multiple times.
#
# Usage:
#   bash bin/setup-hooks.sh
#
# Runs automatically via `npm install` (postinstall).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "not a git repo — skipping git hook setup" >&2
  exit 0
fi

chmod +x "$REPO_DIR"/bin/hooks/post-merge "$REPO_DIR"/bin/hooks/post-checkout
git -C "$REPO_DIR" config core.hooksPath bin/hooks

echo "git hooks path set to bin/hooks — post-merge/post-checkout will keep ~/.claude/commands in sync"
