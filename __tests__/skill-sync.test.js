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
const SETUP_HOOKS_JS = path.join(REPO_ROOT, 'bin', 'setup-hooks.js');
const POST_MERGE = path.join(REPO_ROOT, 'bin', 'hooks', 'post-merge');
const POST_CHECKOUT = path.join(REPO_ROOT, 'bin', 'hooks', 'post-checkout');
const RESYNC = path.join(REPO_ROOT, 'bin', 'hooks', '_resync.sh');

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

function gitEnv(extra) {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: 'test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    ...extra,
  };
}

// Scaffolds a throwaway repo with the hook plumbing copied in, so tests don't
// touch this repo's own git config or hooks.
function scaffoldHookRepo(repoDir, env) {
  const git = (args, cwd = repoDir) => spawnSync('git', args, { cwd, encoding: 'utf8', env });

  assert.equal(git(['-c', 'init.defaultBranch=main', 'init']).status, 0);
  git(['config', 'commit.gpgsign', 'false']);

  fs.mkdirSync(path.join(repoDir, 'bin', 'hooks'), { recursive: true });
  fs.copyFileSync(SETUP_HOOKS, path.join(repoDir, 'bin', 'setup-hooks.sh'));
  fs.copyFileSync(INSTALL, path.join(repoDir, 'bin', 'install-skills.sh'));
  fs.copyFileSync(POST_MERGE, path.join(repoDir, 'bin', 'hooks', 'post-merge'));
  fs.copyFileSync(POST_CHECKOUT, path.join(repoDir, 'bin', 'hooks', 'post-checkout'));
  fs.copyFileSync(RESYNC, path.join(repoDir, 'bin', 'hooks', '_resync.sh'));

  return git;
}

function envWithoutBash() {
  // Restrict PATH to node's own directory so `bash` can't resolve, without
  // breaking the outer node invocation (spawned via process.execPath, an
  // absolute path that doesn't need PATH resolution at all).
  return { ...process.env, PATH: path.dirname(process.execPath) };
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

test('setup-hooks.sh does not clobber a pre-existing different core.hooksPath', () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-repo-'));
  try {
    const env = gitEnv();
    const git = (args) => spawnSync('git', args, { cwd: repoDir, encoding: 'utf8', env });

    assert.equal(git(['-c', 'init.defaultBranch=main', 'init']).status, 0);
    git(['config', 'core.hooksPath', 'some-other-hooks-dir']);

    fs.mkdirSync(path.join(repoDir, 'bin', 'hooks'), { recursive: true });
    fs.copyFileSync(SETUP_HOOKS, path.join(repoDir, 'bin', 'setup-hooks.sh'));

    const setup = spawnSync('bash', [path.join(repoDir, 'bin', 'setup-hooks.sh')], {
      cwd: repoDir,
      encoding: 'utf8',
      env,
    });
    assert.equal(setup.status, 0, `expected graceful exit 0; stderr=${setup.stderr}`);
    assert.match(setup.stderr, /already set to 'some-other-hooks-dir'/);
    assert.equal(git(['config', '--get', 'core.hooksPath']).stdout.trim(), 'some-other-hooks-dir');
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

test('setup-hooks.js --soft never fails even when bash is unavailable', () => {
  const r = spawnSync(process.execPath, [SETUP_HOOKS_JS, '--soft'], {
    encoding: 'utf8',
    env: envWithoutBash(),
  });
  assert.equal(r.status, 0, `expected soft mode to exit 0; stdout=${r.stdout} stderr=${r.stderr}`);
  assert.match(r.stdout + r.stderr, /bash not found/i);
});

test('setup-hooks.js (hard mode) surfaces failure when bash is unavailable', () => {
  const r = spawnSync(process.execPath, [SETUP_HOOKS_JS], {
    encoding: 'utf8',
    env: envWithoutBash(),
  });
  assert.notEqual(r.status, 0, 'expected hard mode to propagate a non-zero exit without bash');
});

test('setup-hooks.sh wires post-checkout to auto re-sync skill files', () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-repo-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-home-'));

  try {
    const env = gitEnv({ HOME: homeDir });
    const git = scaffoldHookRepo(repoDir, env);

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

test('post-checkout resolves the main worktree path, not a linked worktree\'s ephemeral path', () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-repo-'));
  const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-worktree-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-home-'));

  try {
    const env = gitEnv({ HOME: homeDir });
    const git = scaffoldHookRepo(repoDir, env);

    fs.writeFileSync(path.join(repoDir, 'day-plan.md'), 'Run <<REPO_PATH>>/bin/sprint.ts\n');
    assert.equal(git(['add', '-A']).status, 0);
    assert.equal(git(['commit', '-m', 'initial']).status, 0);

    const setup = spawnSync('bash', [path.join(repoDir, 'bin', 'setup-hooks.sh')], {
      cwd: repoDir,
      encoding: 'utf8',
      env,
    });
    assert.equal(setup.status, 0, `setup-hooks.sh failed: ${setup.stderr}`);

    assert.equal(git(['branch', 'wt-branch']).status, 0);
    const wtAdd = git(['worktree', 'add', worktreeDir, 'wt-branch']);
    assert.equal(wtAdd.status, 0, `worktree add failed: ${wtAdd.stderr}`);

    // core.hooksPath is shared across worktrees; a checkout fired FROM the
    // linked worktree must still resolve <<REPO_PATH>> to the main repo dir.
    const wtCheckout = git(['checkout', '-b', 'wt-branch-2'], worktreeDir);
    assert.equal(wtCheckout.status, 0, `checkout inside worktree failed: ${wtCheckout.stderr}`);
    assert.match(wtCheckout.stdout + wtCheckout.stderr, /post-checkout: skill files re-synced/);

    const materialized = path.join(homeDir, '.claude', 'commands', 'day-plan.md');
    assert.ok(fs.existsSync(materialized), 'expected day-plan.md to be materialized via the worktree-triggered hook');

    // Compare basenames rather than full paths: bash on Windows (MSYS)
    // translates the Windows temp path (e.g. C:\Users\...\Temp\hooks-repo-X)
    // to its own mount form (e.g. /tmp/hooks-repo-X), so a raw string/format
    // match on the original Windows path would false-negative even when the
    // fix is working correctly. The mkdtemp-generated basename survives that
    // translation unchanged and uniquely identifies which dir was used.
    const body = fs.readFileSync(materialized, 'utf8');
    const repoDirBase = path.basename(fs.realpathSync(repoDir));
    const worktreeDirBase = path.basename(worktreeDir);
    assert.ok(!body.includes(worktreeDirBase), `REPO_PATH must not point at the disposable worktree; got: ${body}`);
    assert.ok(body.includes(repoDirBase), `expected REPO_PATH to resolve to the main repo dir (${repoDirBase}); got: ${body}`);
  } finally {
    fs.rmSync(worktreeDir, { recursive: true, force: true });
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
});
