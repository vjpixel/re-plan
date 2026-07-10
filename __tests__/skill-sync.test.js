'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHECK_INSTALLED = path.join(REPO_ROOT, 'bin', 'check-installed-skills.sh');
const INSTALL = path.join(REPO_ROOT, 'bin', 'install-skills.sh');
const SETUP_HOOKS = path.join(REPO_ROOT, 'bin', 'setup-hooks.sh');
const POST_MERGE = path.join(REPO_ROOT, 'bin', 'hooks', 'post-merge');
const POST_CHECKOUT = path.join(REPO_ROOT, 'bin', 'hooks', 'post-checkout');

function runCheckInstalled(installedDir) {
  const args = installedDir ? [CHECK_INSTALLED, installedDir] : [CHECK_INSTALLED];
  return spawnSync('bash', args, { encoding: 'utf8' });
}

function freshInstall() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'installed-'));
  const r = spawnSync('bash', [INSTALL, dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, `install-skills.sh failed: ${r.stderr}`);
  return dir;
}

test('check-installed-skills.sh passes when installed copies match a fresh install', () => {
  const dir = freshInstall();
  const r = runCheckInstalled(dir);
  assert.equal(r.status, 0, `expected exit 0; stdout=${r.stdout} stderr=${r.stderr}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('check-installed-skills.sh detects a stale installed file', () => {
  const dir = freshInstall();
  fs.writeFileSync(path.join(dir, 'day-plan.md'), '## PASSO 1: stale content\n');

  const r = runCheckInstalled(dir);
  assert.equal(r.status, 1, 'expected exit 1 on stale installed file');
  assert.match(r.stderr, /day-plan\.md/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('check-installed-skills.sh detects a missing installed file', () => {
  const dir = freshInstall();
  fs.unlinkSync(path.join(dir, 'day-wrap.md'));

  const r = runCheckInstalled(dir);
  assert.equal(r.status, 1, 'expected exit 1 on missing installed file');
  assert.match(r.stderr, /day-wrap\.md/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('check-installed-skills.sh exits 0 when the installed dir does not exist', () => {
  const missing = path.join(os.tmpdir(), `no-such-installed-dir-${process.pid}`);
  const r = runCheckInstalled(missing);
  assert.equal(r.status, 0, `expected exit 0 for missing installed dir; stderr=${r.stderr}`);
});

test('setup-hooks.sh exits 0 gracefully outside a git repo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
  fs.mkdirSync(path.join(dir, 'bin', 'hooks'), { recursive: true });
  fs.copyFileSync(SETUP_HOOKS, path.join(dir, 'bin', 'setup-hooks.sh'));
  fs.copyFileSync(POST_MERGE, path.join(dir, 'bin', 'hooks', 'post-merge'));
  fs.copyFileSync(POST_CHECKOUT, path.join(dir, 'bin', 'hooks', 'post-checkout'));

  const r = spawnSync('bash', [path.join(dir, 'bin', 'setup-hooks.sh')], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `expected exit 0 outside git repo; stderr=${r.stderr}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('setup-hooks.sh wires post-checkout to auto re-sync skill files', () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-repo-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-home-'));

  try {
    const env = {
      ...process.env,
      HOME: homeDir,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };
    const git = (args) => spawnSync('git', args, { cwd: repoDir, encoding: 'utf8', env });

    assert.equal(git(['-c', 'init.defaultBranch=main', 'init']).status, 0);
    git(['config', 'commit.gpgsign', 'false']);

    fs.mkdirSync(path.join(repoDir, 'bin', 'hooks'), { recursive: true });
    fs.copyFileSync(SETUP_HOOKS, path.join(repoDir, 'bin', 'setup-hooks.sh'));
    fs.copyFileSync(INSTALL, path.join(repoDir, 'bin', 'install-skills.sh'));
    fs.copyFileSync(POST_MERGE, path.join(repoDir, 'bin', 'hooks', 'post-merge'));
    fs.copyFileSync(POST_CHECKOUT, path.join(repoDir, 'bin', 'hooks', 'post-checkout'));
    fs.writeFileSync(path.join(repoDir, 'day-plan.md'), '## fixture content\n');

    assert.equal(git(['add', '-A']).status, 0);
    assert.equal(git(['commit', '-m', 'initial']).status, 0);

    const setup = spawnSync('bash', [path.join(repoDir, 'bin', 'setup-hooks.sh')], {
      cwd: repoDir,
      encoding: 'utf8',
      env,
    });
    assert.equal(setup.status, 0, `setup-hooks.sh failed: ${setup.stderr}`);
    assert.equal(git(['config', '--get', 'core.hooksPath']).stdout.trim(), 'bin/hooks');

    // Creating+switching to a branch fires post-checkout, which should
    // re-run install-skills.sh against the overridden $HOME.
    const checkout = git(['checkout', '-b', 'other']);
    assert.equal(checkout.status, 0, `checkout failed: ${checkout.stderr}`);
    assert.match(checkout.stdout + checkout.stderr, /post-checkout: skill files re-synced/);

    const materialized = path.join(homeDir, '.claude', 'commands', 'day-plan.md');
    assert.ok(fs.existsSync(materialized), 'expected day-plan.md to be materialized via the hook');
    assert.equal(fs.readFileSync(materialized, 'utf8'), '## fixture content\n');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
