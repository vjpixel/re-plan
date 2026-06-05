import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadSprintRecords, computeTrends } from '../lib/trends.js';

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 're-plan-trends-'));
  fs.mkdirSync(path.join(dir, '.sprints', 'archive'), { recursive: true });
  return dir;
}
function writeArchive(repo: string, date: string, content: string): void {
  fs.writeFileSync(path.join(repo, '.sprints', 'archive', `${date}.md`), content);
}

const A = `---
type: sprint
review_period: A
projects:
  - Diar.ia
  - Jandig
improvement_goals:
  - G1
health_goals:
  Meditate: "7 days"
on_my_mind:
  - X
  - Y
on_hold:
  - B
---
body
`;

const B = `---
type: sprint
projects:
  - Diar.ia
improvement_goals:
  - G1
  - G2
health_goals:
  Meditate: "7 days"
results_health:
  Meditate: "5/7"
results_planned: 3
results_shipped: 2
on_my_mind:
  - X
on_hold: []
---
body
`;

const C = `---
type: sprint
projects:
  - Diar.ia
  - Jandig
improvement_goals:
  - G2
health_goals:
  Meditate: "7 days"
  Sleep: "80"
results_improvement:
  G1: "yes"
on_my_mind:
  - X
  - Z
on_hold:
  - B
---
body
`;

function seed(): string {
  const r = makeRepo();
  writeArchive(r, '2026-01-05', A);
  writeArchive(r, '2026-01-12', B);
  writeArchive(r, '2026-01-19', C);
  return r;
}

test('loadSprintRecords: parses all archives ascending with fields', () => {
  const recs = loadSprintRecords(seed());
  assert.equal(recs.length, 3);
  assert.deepEqual(recs.map(r => r.date), ['2026-01-05', '2026-01-12', '2026-01-19']);
  assert.deepEqual(recs[0].projects, ['Diar.ia', 'Jandig']);
  assert.deepEqual(recs[2].improvement_goals, ['G2']);
  assert.equal(recs[2].health_goals['Sleep'], '80');
});

test('loadSprintRecords: reads results_* (#65)', () => {
  const recs = loadSprintRecords(seed());
  assert.equal(recs[1].results_planned, 3);
  assert.equal(recs[1].results_shipped, 2);
  assert.equal(recs[1].results_health?.Meditate, '5/7');
  assert.equal(recs[2].results_improvement?.G1, 'yes');
  assert.equal(recs[0].results_planned, undefined);
});

test('computeTrends: carryover age counts consecutive sprints from latest', () => {
  const t = computeTrends(seed());
  const omm = Object.fromEntries(t.latest_carryover.on_my_mind.map(c => [c.item, c.age]));
  assert.equal(omm['X'], 3); // present in C, B, A
  assert.equal(omm['Z'], 1); // only in C
  const hold = Object.fromEntries(t.latest_carryover.on_hold.map(c => [c.item, c.age]));
  assert.equal(hold['B'], 1); // C yes, B absent -> stops
});

test('computeTrends: project cadence (count, streak, lastSeen)', () => {
  const t = computeTrends(seed());
  const byName = Object.fromEntries(t.projects.map(p => [p.name, p]));
  assert.equal(byName['Diar.ia'].sprints, 3);
  assert.equal(byName['Diar.ia'].streak, 3);
  assert.equal(byName['Diar.ia'].lastSeen, '2026-01-19');
  assert.equal(byName['Jandig'].sprints, 2);
  assert.equal(byName['Jandig'].streak, 1); // absent in middle sprint, present in latest
});

test('computeTrends: empty repo yields zero count', () => {
  const t = computeTrends(makeRepo());
  assert.equal(t.count, 0);
  assert.deepEqual(t.latest_carryover.on_my_mind, []);
  assert.deepEqual(t.projects, []);
});
