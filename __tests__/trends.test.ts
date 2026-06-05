import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadSprintRecords, computeTrends, loadProjectAliases } from '../lib/trends.js';

const tmpDirs: string[] = [];
after(() => { for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true }); });

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 're-plan-trends-'));
  fs.mkdirSync(path.join(dir, '.sprints', 'archive'), { recursive: true });
  tmpDirs.push(dir);
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

test('computeTrends: empty repo yields no sprints', () => {
  const t = computeTrends(makeRepo());
  assert.equal(t.sprints.length, 0);
  assert.deepEqual(t.latest_carryover.on_my_mind, []);
  assert.deepEqual(t.projects, []);
});

test('computeTrends: dedupes duplicate carryover items', () => {
  const r = makeRepo();
  writeArchive(r, '2026-02-02', `---\non_my_mind:\n  - X\n  - X\non_hold: []\n---\nbody\n`);
  const t = computeTrends(r);
  assert.equal(t.latest_carryover.on_my_mind.length, 1);
  assert.equal(t.latest_carryover.on_my_mind[0].item, 'X');
});

test('loadSprintRecords: empty results scalar is undefined, not 0', () => {
  const r = makeRepo();
  writeArchive(r, '2026-02-02', `---\nresults_planned: ""\nimprovement_goals: []\n---\nbody\n`);
  assert.equal(loadSprintRecords(r)[0].results_planned, undefined);
});

test('loadSprintRecords: includes pre-frontmatter (prose) archives via fallback', () => {
  const r = makeRepo();
  writeArchive(r, '2026-02-01', `---\non_my_mind:\n  - X\non_hold: []\n---\nbody\n`);
  writeArchive(r, '2026-02-08', `## On my mind\nProseItem\n## On hold\n`);
  const recs = loadSprintRecords(r);
  assert.equal(recs.length, 2);
  assert.equal(recs[1].date, '2026-02-08');
  assert.deepEqual(recs[1].on_my_mind, ['ProseItem']);
});

test('loadSprintRecords: falls back to legacy sprint-final.md when no dated archives', () => {
  const r = makeRepo();
  fs.writeFileSync(path.join(r, '.sprints', 'sprint-final.md'), `---\non_my_mind:\n  - L\non_hold: []\n---\nbody\n`);
  const recs = loadSprintRecords(r);
  assert.equal(recs.length, 1);
  assert.deepEqual(recs[0].on_my_mind, ['L']);
});

test('loadSprintRecords: normalizes health-goal encoding (>= → ≥) (#70)', () => {
  const r = makeRepo();
  writeArchive(r, '2026-03-01', `---\nhealth_goals:\n  Sleep Score: "avg >= 80"\non_hold: []\n---\nbody\n`);
  assert.equal(loadSprintRecords(r)[0].health_goals['Sleep Score'], 'avg ≥ 80');
});

test('computeTrends: project aliases merge spellings into one cadence row (#69)', () => {
  const r = makeRepo();
  fs.mkdirSync(path.join(r, '.sprints', 'projects'), { recursive: true });
  fs.writeFileSync(
    path.join(r, '.sprints', 'projects', 'SP Innovation Week.md'),
    `---\ntype: project\naliases:\n  - SPIW talk\n  - São Paulo Innovation Week\n---\n`,
  );
  writeArchive(r, '2026-03-01', `---\nprojects:\n  - São Paulo Innovation Week\non_hold: []\n---\nbody\n`);
  writeArchive(r, '2026-03-08', `---\nprojects:\n  - SPIW talk\non_hold: []\n---\nbody\n`);
  const merged = computeTrends(r).projects.filter(p => p.name === 'SP Innovation Week');
  assert.equal(merged.length, 1);
  assert.equal(merged[0].sprints, 2);
  assert.equal(merged[0].streak, 2);
});

test('loadProjectAliases: accepts a scalar (non-list) alias value', () => {
  const r = makeRepo();
  fs.mkdirSync(path.join(r, '.sprints', 'projects'), { recursive: true });
  fs.writeFileSync(path.join(r, '.sprints', 'projects', 'Foo.md'), `---\ntype: project\naliases: Bar\n---\n`);
  writeArchive(r, '2026-03-01', `---\nprojects:\n  - Bar\non_hold: []\n---\nbody\n`);
  const foo = computeTrends(r).projects.filter(p => p.name === 'Foo');
  assert.equal(foo.length, 1);
  assert.equal(foo[0].sprints, 1);
});

test('loadProjectAliases: an alias never shadows a real project note', () => {
  const r = makeRepo();
  fs.mkdirSync(path.join(r, '.sprints', 'projects'), { recursive: true });
  fs.writeFileSync(path.join(r, '.sprints', 'projects', 'Beta.md'), `---\ntype: project\n---\n`);
  fs.writeFileSync(path.join(r, '.sprints', 'projects', 'Zeta.md'), `---\ntype: project\naliases:\n  - Beta\n---\n`);
  writeArchive(r, '2026-03-01', `---\nprojects:\n  - Beta\non_hold: []\n---\nbody\n`);
  // "Beta" is a real project note, so a Zeta alias claiming it is ignored — the map
  // has no "Beta" key, independent of filesystem read order (deterministic guard).
  assert.equal(loadProjectAliases(r).get('Beta'), undefined);
  const beta = computeTrends(r).projects.find(p => p.name === 'Beta');
  assert.ok(beta, 'Beta must remain its own project, not absorbed into Zeta');
  assert.equal(beta.sprints, 1);
});

test('loadProjectAliases: same alias on two notes resolves deterministically (sorted first-wins)', () => {
  const r = makeRepo();
  fs.mkdirSync(path.join(r, '.sprints', 'projects'), { recursive: true });
  fs.writeFileSync(path.join(r, '.sprints', 'projects', 'Alpha.md'), `---\ntype: project\naliases:\n  - Shared\n---\n`);
  fs.writeFileSync(path.join(r, '.sprints', 'projects', 'Bravo.md'), `---\ntype: project\naliases:\n  - Shared\n---\n`);
  assert.equal(loadProjectAliases(r).get('Shared'), 'Alpha'); // Alpha.md sorts first → wins
});

test('loadSprintRecords: normalization preserves internal spacing (#70 fix)', () => {
  const r = makeRepo();
  writeArchive(r, '2026-03-02', `---\nhealth_goals:\n  Sleep Score: "82  (rested)"\non_hold: []\n---\nbody\n`);
  assert.equal(loadSprintRecords(r)[0].health_goals['Sleep Score'], '82  (rested)');
});
