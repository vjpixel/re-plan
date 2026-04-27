'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHECK = path.join(REPO_ROOT, 'bin', 'check-skills.sh');

function runCheck(srcDir) {
  const args = srcDir ? [CHECK, srcDir] : [CHECK];
  return spawnSync('bash', args, { encoding: 'utf8' });
}

function writeFixture(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-fixture-'));
  fs.writeFileSync(path.join(dir, 'sprint-start.md'), content);
  fs.writeFileSync(path.join(dir, 'sprint-update.md'), '');
  fs.writeFileSync(path.join(dir, 'sprint-close.md'), '');
  return dir;
}

test('check-skills.sh passes against the live skill files', () => {
  const r = runCheck();
  assert.equal(r.status, 0, `expected exit 0; stdout=${r.stdout} stderr=${r.stderr}`);
});

test('catches hardcoded /c/Users/ path', () => {
  const dir = writeFixture('Read the file `/c/Users/baduser/.sprints/wip.md`.\n');
  const r = runCheck(dir);
  assert.equal(r.status, 1, 'expected exit 1 on hardcoded /c/Users path');
  assert.match(r.stderr, /hardcoded absolute user paths/);
});

test('catches hardcoded /home/ path', () => {
  const dir = writeFixture('Read `/home/alice/.sprints/wip.md`.\n');
  const r = runCheck(dir);
  assert.equal(r.status, 1, 'expected exit 1 on hardcoded /home path');
});

test('catches end-of-line /Users/<user> with no trailing slash', () => {
  // Regression for the "trailing-slash gap" the reviewer flagged: a path
  // that ends at end-of-line, no following segment, must still trip the guard.
  const dir = writeFixture('Read /Users/jane\n');
  const r = runCheck(dir);
  assert.equal(r.status, 1, 'expected exit 1 on end-of-line /Users/<user>');
});

test('does not flag the documented <<REPO_PATH>> placeholder', () => {
  const dir = writeFixture('Read `<<REPO_PATH>>/.sprints/sprint-wip.md`.\n');
  const r = runCheck(dir);
  assert.equal(r.status, 0, `placeholder usage must pass; stderr=${r.stderr}`);
});

test('install-skills materialization leaves no <<REPO_PATH>> tokens', () => {
  // The "clean install" check is part of check-skills.sh's positive run,
  // but assert it standalone to surface the failure mode clearly.
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
  const r = spawnSync('bash', [path.join(REPO_ROOT, 'bin', 'install-skills.sh'), dest], {
    encoding: 'utf8'
  });
  assert.equal(r.status, 0, `install-skills.sh failed: ${r.stderr}`);
  for (const f of fs.readdirSync(dest)) {
    const body = fs.readFileSync(path.join(dest, f), 'utf8');
    assert.doesNotMatch(body, /<<REPO_PATH>>/, `${f} still has <<REPO_PATH>>`);
  }
});
