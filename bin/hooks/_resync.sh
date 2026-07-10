#!/usr/bin/env bash
# Shared body for bin/hooks/post-merge and bin/hooks/post-checkout. Not a git
# hook itself (git only dispatches to exact hook names) — invoked by both via
# `bash .../_resync.sh <label>`, so it doesn't need the executable bit.
#
# Resolves the MAIN worktree root, never the worktree the hook happened to
# fire from. core.hooksPath is shared across every worktree of a repo, but
# `git rev-parse --show-toplevel` returns the *current* worktree's path — and
# a linked worktree is disposable. Materializing skill files with
# <<REPO_PATH>> pointed at a worktree leaves ~/.claude/commands referencing a
# path that vanishes the moment the worktree is removed. --git-common-dir
# always points at the shared main .git directory regardless of which
# worktree invokes it, so its parent is the stable path to substitute.
set -euo pipefail

label="${1:-hook}"

main_git_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
REPO_DIR="$(cd "$(dirname "$main_git_dir")" && pwd)"

bash "$REPO_DIR/bin/install-skills.sh" >/dev/null
echo "${label}: skill files re-synced to ~/.claude/commands"
