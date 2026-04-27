#!/usr/bin/env bash
# Validate the slash-command skill files.
#
# Two checks:
#   1. No hardcoded user-home paths in the skill files (must use <<REPO_PATH>>)
#   2. install-skills.sh produces output free of <<REPO_PATH>> tokens
#
# Usage:
#   bash bin/check-skills.sh [src-dir]
#
# Default src-dir is the repo root. Pass a custom dir to validate a fixture
# (used by the unit tests in __tests__/skill-checks.test.js).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${1:-$REPO_DIR}"

skills=( "$SRC_DIR/sprint-start.md" "$SRC_DIR/sprint-update.md" "$SRC_DIR/sprint-close.md" )

# ----------------------------------------------------------------------------
# Check 1: skill files must not embed clone-specific user-home paths.
#
# The regex catches /c/Users/<user>, /Users/<user>, /home/<user> followed by
# either a slash OR end-of-line — so it fires on both `/c/Users/foo/bar` and
# the bare end-of-line form `/c/Users/foo`. The leading `(^|[^<])` excludes
# matches that come from inside the documented `<<REPO_PATH>>` token.
# ----------------------------------------------------------------------------
HARDCODED_RE='(^|[^<])(/c/Users/|/Users/|/home/)[A-Za-z0-9_.-]+(/|$)'

if grep -nE "$HARDCODED_RE" "${skills[@]}" 2>/dev/null; then
  echo "::error::Skill files contain hardcoded absolute user paths. Use <<REPO_PATH>> instead." >&2
  exit 1
fi

# ----------------------------------------------------------------------------
# Check 2: a fresh install must materialize cleanly — no surviving
# <<REPO_PATH>> tokens. install-skills.sh always reads from the repo root,
# so this exercises the live skills regardless of SRC_DIR.
# ----------------------------------------------------------------------------
dest="$(mktemp -d)"
trap 'rm -rf "$dest"' EXIT

bash "$REPO_DIR/bin/install-skills.sh" "$dest" >/dev/null

if grep -l '<<REPO_PATH>>' "$dest"/*.md 2>/dev/null; then
  echo "::error::install-skills.sh left <<REPO_PATH>> tokens in output — placeholder spelling drift?" >&2
  exit 1
fi

echo "Skill checks passed."
