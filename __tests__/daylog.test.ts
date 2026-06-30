import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { appendDayLog } from '../lib/daylog.js';

function makeTmpRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 're-plan-daylog-test-'));
  fs.mkdirSync(path.join(dir, '.sprints'), { recursive: true });
  return dir;
}

test('appendDayLog: creates day-log.md with a dated line', () => {
  const repo = makeTmpRepo();
  const dest = appendDayLog(repo, '2026-06-30', 'output: shipped X | blocker: none');
  assert.ok(fs.existsSync(dest));
  assert.equal(
    fs.readFileSync(dest, 'utf8'),
    '- [2026-06-30]: output: shipped X | blocker: none\n'
  );
  assert.ok(dest.endsWith('day-log.md'));
});

test('appendDayLog: appends, never overwrites', () => {
  const repo = makeTmpRepo();
  appendDayLog(repo, '2026-06-30', 'first entry');
  const dest = appendDayLog(repo, '2026-07-01', 'second entry');
  const body = fs.readFileSync(dest, 'utf8');
  assert.equal(body, '- [2026-06-30]: first entry\n- [2026-07-01]: second entry\n');
});

test('appendDayLog: trims surrounding whitespace from the line', () => {
  const repo = makeTmpRepo();
  const dest = appendDayLog(repo, '2026-06-30', '  output: x  \n');
  assert.equal(fs.readFileSync(dest, 'utf8'), '- [2026-06-30]: output: x\n');
});

test('appendDayLog: creates the data dir if it does not exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 're-plan-daylog-nodir-'));
  const dest = appendDayLog(dir, '2026-06-30', 'entry');
  assert.ok(fs.existsSync(dest));
});

test('appendDayLog: throws on invalid date format', () => {
  const repo = makeTmpRepo();
  assert.throws(() => appendDayLog(repo, '30/Jun', 'entry'), /Invalid date/);
});

test('appendDayLog: does not shell-expand $ or backticks in the line (#7 review finding)', () => {
  const repo = makeTmpRepo();
  const dest = appendDayLog(repo, '2026-06-30', 'output: saved $50 via `discount`');
  assert.equal(
    fs.readFileSync(dest, 'utf8'),
    '- [2026-06-30]: output: saved $50 via `discount`\n'
  );
});
