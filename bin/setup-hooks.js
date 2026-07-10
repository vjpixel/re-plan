#!/usr/bin/env node
'use strict';

// Cross-platform entry point for bin/setup-hooks.sh. npm always has node
// available to run this (it's the runtime executing npm itself), which
// bash/true are not guaranteed to be on every machine's PATH — notably a
// default Git for Windows install only adds Git\cmd (git.exe) to PATH, not
// Git\usr\bin (bash.exe, true.exe). A shell one-liner like
// `bash bin/setup-hooks.sh || true` can itself fail to resolve `true` under
// cmd.exe, turning a missing-bash environment into a hard `npm install`
// failure instead of a harmless skip.
//
// Usage:
//   node bin/setup-hooks.js          — propagates failure (manual run)
//   node bin/setup-hooks.js --soft   — never exits non-zero (postinstall)

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const soft = process.argv.includes('--soft');
const script = path.join(__dirname, 'setup-hooks.sh');
const result = spawnSync('bash', [script], { encoding: 'utf8' });

if (result.error && result.error.code === 'ENOENT') {
  console.warn(
    'bash not found on PATH — skipping git hook setup. Install Git Bash (or WSL), ' +
      "then run `npm run setup-hooks` manually so post-merge/post-checkout keep " +
      '~/.claude/commands in sync.'
  );
  process.exit(soft ? 0 : 1);
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0 && soft) {
  console.warn(
    `setup-hooks.sh exited with status ${result.status} — git hooks may not be wired up. ` +
      "Run 'npm run setup-hooks' manually to retry."
  );
  process.exit(0);
}

process.exit(result.status ?? 0);
