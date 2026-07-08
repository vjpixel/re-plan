import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// day-plan.md, day-wrap.md, sprint-close.md, and sprint-start.md each hand-copy
// the same "Language" rule and the same filter-gcal heredoc/--file usage block
// (#106). Claude Code loads each skill .md standalone — there's no include
// mechanism — so this test is the guardrail: it fails the build the moment a
// skill file's copy drifts from shared/*.md, instead of drift going unnoticed
// until someone reads all four files side by side.

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILL_FILES = ['day-plan.md', 'day-wrap.md', 'sprint-close.md', 'sprint-start.md'];
const SHARED_FRAGMENTS = ['language-block.md', 'filter-heredoc-block.md'];

// Git's autocrlf can normalize .md files to CRLF on checkout independent of
// how they were authored — that's a checkout detail, not real drift between
// a skill file and its shared fragment, so line endings are normalized before
// comparing.
function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

for (const fragment of SHARED_FRAGMENTS) {
  const fragmentText = normalizeNewlines(fs.readFileSync(path.join(REPO_ROOT, 'shared', fragment), 'utf8')).trim();

  for (const skillFile of SKILL_FILES) {
    test(`skill consistency: ${skillFile} contains the exact shared/${fragment} block`, () => {
      const skillText = normalizeNewlines(fs.readFileSync(path.join(REPO_ROOT, skillFile), 'utf8'));
      assert.ok(
        skillText.includes(fragmentText),
        `${skillFile} does not contain the exact text of shared/${fragment} — ` +
        `sync it (or update shared/${fragment} if the change is intentional and should apply everywhere)`
      );
    });
  }
}
