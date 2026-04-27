#!/usr/bin/env bash
# Materialize the slash-command skill files into Claude Code's commands dir,
# substituting the <<REPO_PATH>> placeholder with this clone's actual path.
#
# Usage:
#   bash install-skills.sh [destination]
#
# Default destination: ~/.claude/commands
#
# Re-run after pulling skill-file updates.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Normalize Windows-style "C:/..." to git-bash "/c/..." so the substituted
# path matches what Claude Code resolves on bash on Windows. Leave Unix
# paths untouched.
case "$REPO_DIR" in
  [A-Za-z]:*)
    drive="$(printf '%s' "${REPO_DIR%%:*}" | tr '[:upper:]' '[:lower:]')"
    REPO_DIR="/${drive}${REPO_DIR#?:}"
    ;;
esac

DEST="${1:-${HOME}/.claude/commands}"
mkdir -p "$DEST"

for f in sprint-start.md sprint-update.md sprint-close.md; do
  src="${REPO_DIR}/${f}"
  if [ ! -f "$src" ]; then
    echo "skip ${f} (not found at ${src})" >&2
    continue
  fi

  out="${DEST}/${f}"
  # If the destination is a symlink (e.g. left from a previous install),
  # remove it so we write a real file rather than following the link back
  # into the repo and corrupting the placeholder source.
  if [ -L "$out" ]; then
    rm "$out"
  fi

  # Portable in-place rewrite without sed -i (BSD vs GNU incompatibility):
  # render to a temp file, then move into place atomically.
  tmp="$(mktemp "${out}.XXXXXX")"
  sed "s|<<REPO_PATH>>|${REPO_DIR}|g" "$src" > "$tmp"
  mv "$tmp" "$out"

  echo "installed ${f} -> ${out}"
done
