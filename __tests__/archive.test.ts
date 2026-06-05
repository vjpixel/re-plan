import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { latestArchivePath, parsePriorPlanning, parseFrontmatter, parseFrontmatterObject, loadLatestArchive } from '../lib/archive.js';

function makeTmpRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 're-plan-test-'));
  fs.mkdirSync(path.join(dir, '.sprints', 'archive'), { recursive: true });
  return dir;
}

function writeArchive(repo: string, date: string, content: string): void {
  fs.writeFileSync(path.join(repo, '.sprints', 'archive', `${date}.md`), content);
}

const SAMPLE_PLANNING = `
## Sprint Planning *(27/Abr–3/Mai, 5 workdays)*

### Projects Priority

1. Diar.ia
2. Job Hunt

## On my mind

Verificar status do projeto X
Responder email do João

## On hold

Job Hunt — aguardando resposta da Google

### Outcomes

1. Diar.ia → 4 editions published
2. Job Hunt → assessment enviado

### Next week's goals

| Improvement |
| :---- |
| Work +2h |
| Spend 1+ hours OoH |
| Make impact |

| Health | Goal |
| :---- | :---- |
| Meditate | **7 days** |
| Sleep Score | **82** |
`;

// latestArchivePath

test('latestArchivePath: returns null when no archive or legacy', () => {
  const repo = makeTmpRepo();
  assert.equal(latestArchivePath(repo), null);
});

test('latestArchivePath: picks lexically latest YYYY-MM-DD.md', () => {
  const repo = makeTmpRepo();
  writeArchive(repo, '2026-04-20', '');
  writeArchive(repo, '2026-04-27', '');
  writeArchive(repo, '2026-04-13', '');
  const p = latestArchivePath(repo);
  assert.ok(p?.endsWith('2026-04-27.md'));
});

test('latestArchivePath: falls back to sprint-final.md when archive is empty', () => {
  const repo = makeTmpRepo();
  const legacy = path.join(repo, '.sprints', 'sprint-final.md');
  fs.writeFileSync(legacy, '');
  const p = latestArchivePath(repo);
  assert.equal(p, legacy);
});

test('latestArchivePath: archive takes priority over legacy', () => {
  const repo = makeTmpRepo();
  const legacy = path.join(repo, '.sprints', 'sprint-final.md');
  fs.writeFileSync(legacy, '');
  writeArchive(repo, '2026-04-27', '');
  const p = latestArchivePath(repo);
  assert.ok(p?.endsWith('2026-04-27.md'));
});

// parsePriorPlanning

test('parsePriorPlanning: extracts on_my_mind items', () => {
  const r = parsePriorPlanning(SAMPLE_PLANNING);
  assert.deepEqual(r.on_my_mind, ['Verificar status do projeto X', 'Responder email do João']);
});

test('parsePriorPlanning: extracts on_hold items', () => {
  const r = parsePriorPlanning(SAMPLE_PLANNING);
  assert.deepEqual(r.on_hold, ['Job Hunt — aguardando resposta da Google']);
});

test('parsePriorPlanning: extracts health_goals from table', () => {
  const r = parsePriorPlanning(SAMPLE_PLANNING);
  assert.equal(r.health_goals['Meditate'], '7 days');
  assert.equal(r.health_goals['Sleep Score'], '82');
});

test('parsePriorPlanning: handles bullet-prefixed items', () => {
  const content = '## On my mind\n* Item com bullet\n- Item com dash\n## On hold\n';
  const r = parsePriorPlanning(content);
  assert.deepEqual(r.on_my_mind, ['Item com bullet', 'Item com dash']);
});

test('parsePriorPlanning: empty sections return empty arrays', () => {
  const r = parsePriorPlanning('## On my mind\n\n## On hold\n\n');
  assert.deepEqual(r.on_my_mind, []);
  assert.deepEqual(r.on_hold, []);
});

test('parsePriorPlanning: no health table returns empty object', () => {
  const r = parsePriorPlanning('## On my mind\nitem\n');
  assert.deepEqual(r.health_goals, {});
});

test('parsePriorPlanning: extracts improvement_goals from single-column table', () => {
  const r = parsePriorPlanning(SAMPLE_PLANNING);
  assert.deepEqual(r.improvement_goals, ['Work +2h', 'Spend 1+ hours OoH', 'Make impact']);
});

test('parsePriorPlanning: no improvement table returns empty array', () => {
  const r = parsePriorPlanning('## On my mind\nitem\n');
  assert.deepEqual(r.improvement_goals, []);
});

test('parsePriorPlanning: ignores Retro two-column "| Improvement | Result |" table', () => {
  // Regression: a real archive has BOTH the Retrospective table (2 columns:
  // Improvement | Result) AND the Planning table (1 column). The parser must
  // pick the single-column Planning table, not the 2-column Retro one.
  const content = `
### Last week's improvement goals

| Improvement | Result |
| :---- | :---: |
| Old goal A | **3 / 5** |
| Old goal B | **1 / 5** |

### Next week's goals

| Improvement |
| :---- |
| New goal A |
| New goal B |
`;
  const r = parsePriorPlanning(content);
  assert.deepEqual(r.improvement_goals, ['New goal A', 'New goal B']);
});

// loadLatestArchive

test('loadLatestArchive: returns null when no archive exists', () => {
  const repo = makeTmpRepo();
  assert.equal(loadLatestArchive(repo), null);
});

test('loadLatestArchive: returns structured data for latest archive', () => {
  const repo = makeTmpRepo();
  writeArchive(repo, '2026-04-27', SAMPLE_PLANNING);
  const result = loadLatestArchive(repo);
  assert.ok(result);
  assert.equal(result.date, '2026-04-27');
  assert.deepEqual(result.on_my_mind, ['Verificar status do projeto X', 'Responder email do João']);
  assert.equal(result.health_goals['Sleep Score'], '82');
  assert.deepEqual(result.improvement_goals, ['Work +2h', 'Spend 1+ hours OoH', 'Make impact']);
});

// parseFrontmatter (frontmatter-as-data, #61)

const SAMPLE_FRONTMATTER = `---
type: sprint
review_period: 1/Jun–7/Jun
review_workdays: 5
plan_period: 8/Jun–14/Jun
projects:
  - Diar.ia
  - Jandig
improvement_goals:
  - Stop working by 9 PM
  - Make impact
health_goals:
  Meditate: 4 days
  Sleep Score: avg ≥ 80
on_my_mind:
  - Job Hunt (awaiting Google's response)
  - FAPESP proposal
on_hold: []
---
<!-- sprint-wip: 8/Jun–14/Jun -->

## On my mind

Prose value that must be ignored when frontmatter exists
`;

test('parseFrontmatter: returns null without frontmatter', () => {
  assert.equal(parseFrontmatter('# just prose\nno frontmatter here\n'), null);
});

test('parseFrontmatter: returns null when frontmatter has no planning keys', () => {
  assert.equal(parseFrontmatter('---\ntype: sprint\nreview_workdays: 5\n---\n'), null);
});

test('parseFrontmatter: parses block lists, nested map, and empty list', () => {
  const r = parseFrontmatter(SAMPLE_FRONTMATTER);
  assert.ok(r);
  assert.deepEqual(r.on_my_mind, ["Job Hunt (awaiting Google's response)", 'FAPESP proposal']);
  assert.deepEqual(r.on_hold, []);
  assert.deepEqual(r.improvement_goals, ['Stop working by 9 PM', 'Make impact']);
  assert.equal(r.health_goals['Meditate'], '4 days');
  assert.equal(r.health_goals['Sleep Score'], 'avg ≥ 80');
});

test('parseFrontmatter: supports inline list and inline empty list', () => {
  const r = parseFrontmatter('---\non_my_mind: [a, b]\non_hold: []\n---\n');
  assert.ok(r);
  assert.deepEqual(r.on_my_mind, ['a', 'b']);
  assert.deepEqual(r.on_hold, []);
});

test('loadLatestArchive: prefers frontmatter over prose body', () => {
  const repo = makeTmpRepo();
  writeArchive(repo, '2026-06-07', SAMPLE_FRONTMATTER);
  const r = loadLatestArchive(repo);
  assert.ok(r);
  assert.equal(r.date, '2026-06-07');
  assert.deepEqual(r.on_my_mind, ["Job Hunt (awaiting Google's response)", 'FAPESP proposal']);
  assert.equal(r.health_goals['Sleep Score'], 'avg ≥ 80');
});

test('loadLatestArchive: falls back to prose when no frontmatter', () => {
  const repo = makeTmpRepo();
  writeArchive(repo, '2026-06-07', SAMPLE_PLANNING);
  const r = loadLatestArchive(repo);
  assert.ok(r);
  assert.deepEqual(r.improvement_goals, ['Work +2h', 'Spend 1+ hours OoH', 'Make impact']);
});

// parseFrontmatterObject (generic reader, #64/#65)

test('parseFrontmatterObject: scalars, block lists, inline lists, nested map', () => {
  const o = parseFrontmatterObject(`---
type: sprint
review_workdays: 5
projects:
  - Diar.ia
  - Jandig
tags: [a, b]
empty: []
health_goals:
  Meditate: "4 days"
  Sleep Score: avg ≥ 80
---
body
`);
  assert.ok(o);
  assert.equal(o.type, 'sprint');
  assert.equal(o.review_workdays, '5');
  assert.deepEqual(o.projects, ['Diar.ia', 'Jandig']);
  assert.deepEqual(o.tags, ['a', 'b']);
  assert.deepEqual(o.empty, []);
  assert.deepEqual(o.health_goals, { Meditate: '4 days', 'Sleep Score': 'avg ≥ 80' });
});

test('parseFrontmatterObject: returns null without frontmatter', () => {
  assert.equal(parseFrontmatterObject('# no frontmatter\n'), null);
});

test('parseFrontmatter: a bare empty planning key still registers (not null)', () => {
  // Regression (#64 review): the generic rewrite must register `on_my_mind:`
  // with no children, so frontmatter stays authoritative over stale prose.
  const r = parseFrontmatter('---\ntype: sprint\non_my_mind:\n---\n');
  assert.ok(r, 'bare empty planning key must keep frontmatter authoritative');
  assert.deepEqual(r.on_my_mind, []);
});

test('parseFrontmatterObject: a populated list ignores a stray map child (no flip)', () => {
  const o = parseFrontmatterObject('---\non_my_mind:\n  - First\n  stray: x\n---\n');
  assert.ok(o);
  assert.deepEqual(o.on_my_mind, ['First']);
});

test('parseFrontmatterObject: inline list respects quoted commas', () => {
  const o = parseFrontmatterObject('---\nprojects: [Diar.ia, "Bar, Inc", Jandig]\n---\n');
  assert.ok(o);
  assert.deepEqual(o.projects, ['Diar.ia', 'Bar, Inc', 'Jandig']);
});

test('loadLatestArchive: normalizes health-goal encoding (>= → ≥) (#70)', () => {
  const repo = makeTmpRepo();
  writeArchive(repo, '2026-03-01', '---\nhealth_goals:\n  Sleep Score: "avg >= 80"\non_hold: []\n---\n');
  const r = loadLatestArchive(repo);
  assert.ok(r);
  assert.equal(r.health_goals['Sleep Score'], 'avg ≥ 80');
});
