import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { sprintsDir } from '../lib/paths.js';

const PREV = process.env.SPRINT_DATA_DIR;
function restore(): void {
  if (PREV === undefined) delete process.env.SPRINT_DATA_DIR;
  else process.env.SPRINT_DATA_DIR = PREV;
}

test('sprintsDir: defaults to <repo>/.sprints when env is unset', () => {
  delete process.env.SPRINT_DATA_DIR;
  try {
    assert.equal(sprintsDir(path.join('/tmp', 'repo')), path.join('/tmp', 'repo', '.sprints'));
  } finally { restore(); }
});

test('sprintsDir: SPRINT_DATA_DIR overrides the default', () => {
  process.env.SPRINT_DATA_DIR = path.join('/data', 'sprints');
  try {
    assert.equal(sprintsDir(path.join('/tmp', 'repo')), path.join('/data', 'sprints'));
  } finally { restore(); }
});

test('sprintsDir: blank/whitespace env is treated as unset', () => {
  process.env.SPRINT_DATA_DIR = '   ';
  try {
    assert.equal(sprintsDir(path.join('/tmp', 'repo')), path.join('/tmp', 'repo', '.sprints'));
  } finally { restore(); }
});
