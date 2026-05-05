import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readWip, archiveWip } from '../lib/wip.js';

function makeTmpRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 're-plan-wip-test-'));
  fs.mkdirSync(path.join(dir, '.sprints'), { recursive: true });
  return dir;
}

const SAMPLE_WIP = `<!-- sprint-wip: 27/Abr–3/Mai | gerado em: 02/05/2026, 18:30 -->
# 3/Mai -------------------------------------

## Sprint Review *(27/Abr–3/Mai, 5 workdays)*
`;

// readWip

test('readWip: returns null when file does not exist', () => {
  const repo = makeTmpRepo();
  assert.equal(readWip(repo), null);
});

test('readWip: parses period and generated_at from header', () => {
  const repo = makeTmpRepo();
  fs.writeFileSync(path.join(repo, '.sprints', 'sprint-wip.md'), SAMPLE_WIP);
  const result = readWip(repo);
  assert.ok(result);
  assert.equal(result.period, '27/Abr–3/Mai');
  assert.equal(result.generated_at, '02/05/2026, 18:30');
  assert.ok(result.content.includes('Sprint Review'));
});

test('readWip: returns empty strings for missing header fields', () => {
  const repo = makeTmpRepo();
  fs.writeFileSync(path.join(repo, '.sprints', 'sprint-wip.md'), '# No header here\n');
  const result = readWip(repo);
  assert.ok(result);
  assert.equal(result.period, '');
  assert.equal(result.generated_at, '');
});

// archiveWip

test('archiveWip: copies wip to archive dir with date filename', () => {
  const repo = makeTmpRepo();
  fs.writeFileSync(path.join(repo, '.sprints', 'sprint-wip.md'), SAMPLE_WIP);
  const dest = archiveWip(repo, '2026-05-03');
  assert.ok(fs.existsSync(dest));
  assert.equal(fs.readFileSync(dest, 'utf8'), SAMPLE_WIP);
  assert.ok(dest.endsWith('2026-05-03.md'));
});

test('archiveWip: creates archive dir if it does not exist', () => {
  const repo = makeTmpRepo();
  fs.writeFileSync(path.join(repo, '.sprints', 'sprint-wip.md'), SAMPLE_WIP);
  archiveWip(repo, '2026-05-03');
  assert.ok(fs.existsSync(path.join(repo, '.sprints', 'archive')));
});

test('archiveWip: overwrites existing archive for same date', () => {
  const repo = makeTmpRepo();
  fs.writeFileSync(path.join(repo, '.sprints', 'sprint-wip.md'), SAMPLE_WIP);
  archiveWip(repo, '2026-05-03');
  const newContent = SAMPLE_WIP + '\n(updated)';
  fs.writeFileSync(path.join(repo, '.sprints', 'sprint-wip.md'), newContent);
  archiveWip(repo, '2026-05-03');
  const dest = path.join(repo, '.sprints', 'archive', '2026-05-03.md');
  assert.equal(fs.readFileSync(dest, 'utf8'), newContent);
});

test('archiveWip: throws on invalid date format', () => {
  const repo = makeTmpRepo();
  fs.writeFileSync(path.join(repo, '.sprints', 'sprint-wip.md'), SAMPLE_WIP);
  assert.throws(() => archiveWip(repo, '3-Mai'), /Invalid date/);
});

test('archiveWip: throws when sprint-wip.md does not exist', () => {
  const repo = makeTmpRepo();
  assert.throws(() => archiveWip(repo, '2026-05-03'), /sprint-wip\.md not found/);
});
