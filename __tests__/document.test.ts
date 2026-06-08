import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripDayPlan } from '../lib/document.js';

const FRONT = `---
type: sprint
---
<!-- sprint-wip: 8/Jun–14/Jun | gerado em: 2026-06-05 -03 -->

# 5/Jun -------------------------------------
`;

const DAY_PLAN = `
## Plano do dia — 5/Jun (sexta-feira)

Objetivo da semana: keep cadence.

Status: Done — stuff. Pending — other stuff.

Prioridades:
1. Weekly Review
2. Diar.ia

Blocos de tempo sugeridos:
16:00–17:00  Weekly Review
`;

const REVIEW = `
## Sprint Review *(1/Jun–7/Jun, 5 workdays)*

### Outcomes

* Full recovery
`;

test('stripDayPlan: removes the day-plan section, keeping header + review', () => {
  const out = stripDayPlan(FRONT + DAY_PLAN + REVIEW);
  assert.doesNotMatch(out, /Plano do dia/);
  assert.doesNotMatch(out, /Blocos de tempo/);
  assert.match(out, /# 5\/Jun -+/);            // date header preserved
  assert.match(out, /## Sprint Review/);        // review preserved
  assert.match(out, /sprint-wip: 8\/Jun/);      // frontmatter/comment preserved
  // date header is followed by exactly one blank line then Sprint Review
  assert.match(out, /# 5\/Jun -+\n\n## Sprint Review/);
});

test('stripDayPlan: idempotent — no day plan returns content unchanged', () => {
  const noPlan = FRONT + REVIEW;
  assert.equal(stripDayPlan(noPlan), noPlan);
  // running twice on a doc that had a plan yields the same result
  const once = stripDayPlan(FRONT + DAY_PLAN + REVIEW);
  assert.equal(stripDayPlan(once), once);
});

test('stripDayPlan: handles a day plan that runs to end of file', () => {
  const out = stripDayPlan(FRONT + DAY_PLAN);
  assert.doesNotMatch(out, /Plano do dia/);
  assert.match(out, /# 5\/Jun -+/);
  assert.ok(out.endsWith('\n'));
});

test('stripDayPlan: tolerates CRLF input and normalizes the seam to LF', () => {
  const crlf = (FRONT + DAY_PLAN + REVIEW).replace(/\n/g, '\r\n');
  const out = stripDayPlan(crlf);
  assert.doesNotMatch(out, /Plano do dia/);
  assert.match(out, /# 5\/Jun -+\n\n## Sprint Review/); // seam has no stray \r
});

test('stripDayPlan: matches heading case-insensitively', () => {
  const upper = FRONT + '\n## PLANO DO DIA — x\n\ntext\n' + REVIEW;
  const out = stripDayPlan(upper);
  assert.doesNotMatch(out, /PLANO DO DIA/i);
  assert.match(out, /## Sprint Review/);
});
