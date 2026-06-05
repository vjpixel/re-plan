import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync, SpawnSyncOptionsWithStringEncoding } from 'node:child_process';

const REPO_ROOT = path.resolve(__dirname, '..');
const SPRINT_BIN = path.join(REPO_ROOT, 'bin', 'sprint.ts');
// Resolve tsx/cjs absolutely so spawning with cwd=<tmpdir> still finds the loader.
const TSX_CJS = createRequire(path.join(REPO_ROOT, 'package.json')).resolve('tsx/cjs');

interface RunResult { status: number | null; stdout: string; stderr: string }

function run(args: string[], opts: { input?: string; cwd?: string } = {}): RunResult {
  const spawnOpts: SpawnSyncOptionsWithStringEncoding = {
    encoding: 'utf8',
    cwd: opts.cwd ?? REPO_ROOT,
    input: opts.input,
    timeout: 10_000,
  };
  const r = spawnSync('node', ['-r', TSX_CJS, SPRINT_BIN, ...args], spawnOpts);
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function tmpRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 're-plan-cli-e2e-'));
  fs.mkdirSync(path.join(dir, '.sprints', 'archive'), { recursive: true });
  return dir;
}

// ──────────────────────────── period ────────────────────────────

test('cli: period --today returns current+next JSON to stdout', () => {
  const r = run(['period', '--today', '2026-05-08']); // a Friday (last-workday cadence)
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout);
  // Fri 8/May → in-progress week Mon 4–Sun 10/May (5 workdays), not the previous one (#68)
  assert.equal(json.current.start, '2026-05-04');
  assert.equal(json.current.end, '2026-05-10');
  assert.equal(json.current.workdays, 5);
  // Next: Mon 11–Sun 17/May (5 workdays)
  assert.equal(json.next.start, '2026-05-11');
  assert.equal(json.next.end, '2026-05-17');
  assert.equal(json.next.workdays, 5);
});

test('cli: period rejects bad date format', () => {
  const r = run(['period', '--today', 'not-a-date']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Invalid date format/);
});

// ──────────────────────────── archive ───────────────────────────

test('cli: archive returns null when no archive or legacy file', () => {
  const repo = tmpRepo();
  const r = run(['archive', '--repo', repo]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout), null);
});

test('cli: archive defaults --repo to cwd when flag is omitted', () => {
  const repo = tmpRepo();
  const r = run(['archive'], { cwd: repo });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout), null);
});

test('cli: archive returns parsed sections from latest archive', () => {
  const repo = tmpRepo();
  const archive = `## On my mind\nVerificar Google\nResponder João\n## On hold\nProjeto X — bloqueio\n### Next week's goals\n| Health | Goal |\n| :---- | :---- |\n| Meditate | **7 days** |\n`;
  fs.writeFileSync(path.join(repo, '.sprints', 'archive', '2026-04-27.md'), archive);
  const r = run(['archive', '--repo', repo]);
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout);
  assert.equal(json.date, '2026-04-27');
  assert.deepEqual(json.on_my_mind, ['Verificar Google', 'Responder João']);
  assert.deepEqual(json.on_hold, ['Projeto X — bloqueio']);
  assert.equal(json.health_goals['Meditate'], '7 days');
});

// ──────────────────────────── trends ─────────────────────────────

test('cli: trends aggregates archives with carryover age + project cadence', () => {
  const repo = tmpRepo();
  const fm = (omm: string) => `---\ntype: sprint\nprojects:\n  - Diar.ia\non_my_mind:\n  - ${omm}\non_hold: []\n---\nbody\n`;
  fs.writeFileSync(path.join(repo, '.sprints', 'archive', '2026-04-20.md'), fm('Carryover X'));
  fs.writeFileSync(path.join(repo, '.sprints', 'archive', '2026-04-27.md'), fm('Carryover X'));
  const r = run(['trends', '--repo', repo]);
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout);
  assert.equal(json.sprints.length, 2);
  assert.equal(json.latest_carryover.on_my_mind[0].item, 'Carryover X');
  assert.equal(json.latest_carryover.on_my_mind[0].age, 2);
  const diaria = json.projects.find((p: { name: string }) => p.name === 'Diar.ia');
  assert.equal(diaria.streak, 2);
});

// ──────────────────────────── read-wip + archive-wip ─────────────

test('cli: read-wip exits 1 when sprint-wip.md is absent', () => {
  const repo = tmpRepo();
  const r = run(['read-wip', '--repo', repo]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /sprint-wip\.md not found/);
});

test('cli: read-wip parses period and generated_at from header', () => {
  const repo = tmpRepo();
  const wip = `<!-- sprint-wip: 27/Abr–3/Mai | gerado em: 02/05/2026, 18:30 -->\nbody here\n`;
  fs.writeFileSync(path.join(repo, '.sprints', 'sprint-wip.md'), wip);
  const r = run(['read-wip', '--repo', repo]);
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout);
  assert.equal(json.period, '27/Abr–3/Mai');
  assert.equal(json.generated_at, '02/05/2026, 18:30');
  assert.match(json.content, /body here/);
});

test('cli: archive-wip copies wip to archive/<date>.md', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, '.sprints', 'sprint-wip.md'), 'final content\n');
  const r = run(['archive-wip', '--repo', repo, '--date', '2026-05-03']);
  assert.equal(r.status, 0, r.stderr);
  const archived = path.join(repo, '.sprints', 'archive', '2026-05-03.md');
  assert.ok(fs.existsSync(archived));
  assert.equal(fs.readFileSync(archived, 'utf8'), 'final content\n');
});

test('cli: archive-wip rejects bad date format', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, '.sprints', 'sprint-wip.md'), 'x\n');
  const r = run(['archive-wip', '--repo', repo, '--date', '3-Mai']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /YYYY-MM-DD/);
});

// ──────────────────────────── filters via stdin ─────────────────

test('cli: filter-gcal drops non-accepted events from stdin JSON', () => {
  const events = [
    { id: 'a', myResponseStatus: 'accepted', summary: 'Standup' },
    { id: 'b', myResponseStatus: 'declined', summary: 'Skip me' },
    { id: 'c', myResponseStatus: 'accepted', summary: 'Planning' },
  ];
  const r = run(['filter-gcal'], { input: JSON.stringify(events) });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((e: { id: string }) => e.id), ['a', 'c']);
});

test('cli: filter-gmail drops Amazon emails by sender', () => {
  const msgs = [
    { from: 'noreply@amazon.com.br', subject: 'Pedido enviado' },
    { from: 'recruiter@google.com', subject: 'Engineer role' },
  ];
  const r = run(['filter-gmail'], { input: JSON.stringify(msgs) });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.length, 1);
  assert.equal(out[0].from, 'recruiter@google.com');
});

test('cli: filter-github windows events to date range', () => {
  const events = [
    { id: 1, created_at: '2026-04-26T10:00:00Z' }, // before
    { id: 2, created_at: '2026-04-30T15:30:00Z' }, // in
    { id: 3, created_at: '2026-05-04T08:00:00Z' }, // after
  ];
  const r = run(['filter-github', '--start', '2026-04-27', '--end', '2026-05-03'], {
    input: JSON.stringify(events),
  });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 2);
});

test('cli: filter-github rejects missing --start flag', () => {
  const r = run(['filter-github', '--end', '2026-05-03'], { input: '[]' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--start requires YYYY-MM-DD/);
});

test('cli: filter-github rejects missing --end flag', () => {
  const r = run(['filter-github', '--start', '2026-04-27'], { input: '[]' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--end requires YYYY-MM-DD/);
});

test('cli: filter-gcal rejects non-array stdin with clear error', () => {
  const r = run(['filter-gcal'], { input: '{"not":"array"}' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Stdin JSON must be an array/);
});

test('cli: filter-gcal rejects malformed JSON on stdin', () => {
  const r = run(['filter-gcal'], { input: 'not json at all' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Invalid JSON on stdin/);
});

// ──────────────────────────── dispatcher ────────────────────────

test('cli: unknown subcommand exits 1 with error', () => {
  const r = run(['nonexistent-subcommand']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown subcommand/);
});

test('cli: missing subcommand exits 1', () => {
  const r = run([]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown subcommand/);
});

// ──────────────────── workflow integration ──────────────────────

test('cli: full sprint-close-style flow (read-wip → archive-wip → archive)', () => {
  const repo = tmpRepo();
  const wip = `<!-- sprint-wip: 27/Abr–3/Mai | gerado em: 02/05/2026, 18:30 -->
# 3/Mai

## Sprint Planning *(4/Mai–8/Mai, 5 workdays)*

## On my mind

Item carried forward A
Item carried forward B

## On hold

External dependency — waiting on review

### Next week's goals

| Health | Goal |
| :---- | :---- |
| Meditate | **7 days** |
| Sleep Score | **85** |
`;
  fs.writeFileSync(path.join(repo, '.sprints', 'sprint-wip.md'), wip);

  // Step 1: read the WIP
  const read = run(['read-wip', '--repo', repo]);
  assert.equal(read.status, 0, read.stderr);
  assert.equal(JSON.parse(read.stdout).period, '27/Abr–3/Mai');

  // Step 2: archive under the period's end date
  const archived = run(['archive-wip', '--repo', repo, '--date', '2026-05-03']);
  assert.equal(archived.status, 0, archived.stderr);
  assert.match(JSON.parse(archived.stdout).archived_to, /2026-05-03\.md$/);

  // Step 3: next sprint-start loads the archive and recovers context
  const archive = run(['archive', '--repo', repo]);
  assert.equal(archive.status, 0, archive.stderr);
  const archiveJson = JSON.parse(archive.stdout);
  assert.equal(archiveJson.date, '2026-05-03');
  assert.deepEqual(archiveJson.on_my_mind, ['Item carried forward A', 'Item carried forward B']);
  assert.deepEqual(archiveJson.on_hold, ['External dependency — waiting on review']);
  assert.equal(archiveJson.health_goals['Meditate'], '7 days');
  assert.equal(archiveJson.health_goals['Sleep Score'], '85');
});
