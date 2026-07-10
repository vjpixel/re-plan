#!/usr/bin/env bash
# Detect drift between the repo's skill .md files and the materialized
# copies that install-skills.sh already wrote out (default ~/.claude/commands).
#
# Unlike check-skills.sh (which runs in CI against a scratch temp dir and
# never touches a real machine), this script is meant to run locally, since
# CI has no access to the developer's ~/.claude/commands.
#
# Usage:
#   bash bin/check-installed-skills.sh [installed-dir]
#   npm run check-installed-skills
#
# Exit 0: installed copies match what the repo would produce, or the
#         installed dir doesn't exist yet (nothing to compare).
# Exit 1: one or more installed files are stale or missing.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALLED_DIR="${1:-${HOME}/.claude/commands}"

if [ ! -d "$INSTALLED_DIR" ]; then
  echo "installed dir not found: $INSTALLED_DIR — nothing to check" >&2
  exit 0
fi

fresh="$(mktemp -d)"
trap 'rm -rf "$fresh"' EXIT
bash "$REPO_DIR/bin/install-skills.sh" "$fresh" >/dev/null

stale=()
for f in sprint-start.md sprint-update.md sprint-close.md day-plan.md day-wrap.md; do
  expected="${fresh}/${f}"
  [ -f "$expected" ] || continue

  actual="${INSTALLED_DIR}/${f}"
  if [ ! -f "$actual" ] || ! diff -q "$expected" "$actual" >/dev/null 2>&1; then
    stale+=("$f")
  fi
done

if [ "${#stale[@]}" -gt 0 ]; then
  echo "::warning::Installed skill files are out of sync with the repo — run 'npm run install-skills' to update:" >&2
  for f in "${stale[@]}"; do
    echo "  - $f" >&2
  done
  exit 1
fi

echo "Installed skill files are in sync with the repo."
