const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseInlineBold,
  findStartIdx,
  classifyLine,
  parseTable,
} = require('../parser');

test('parseInlineBold: single bold run', () => {
  const { text, ranges } = parseInlineBold('hello **world**');
  assert.equal(text, 'hello world');
  assert.deepEqual(ranges, [[6, 10]]);
});

test('parseInlineBold: multiple bold runs', () => {
  const { text, ranges } = parseInlineBold('**a** and **b**');
  assert.equal(text, 'a and b');
  assert.deepEqual(ranges, [[0, 0], [6, 6]]);
});

test('parseInlineBold: no bold markers returns empty ranges', () => {
  const { text, ranges } = parseInlineBold('plain text');
  assert.equal(text, 'plain text');
  assert.deepEqual(ranges, []);
});

test('parseInlineBold: unclosed marker is kept literal', () => {
  const { text, ranges } = parseInlineBold('hello **world');
  assert.equal(text, 'hello **world');
  assert.deepEqual(ranges, []);
});

test('parseInlineBold: empty bold run (****) is skipped', () => {
  const { text, ranges } = parseInlineBold('a****b');
  assert.equal(text, 'ab');
  assert.deepEqual(ranges, []);
});

test('findStartIdx: finds the first "# D/Month" heading', () => {
  const lines = ['<!-- header -->', '', '# 19/Abr ------', '## other'];
  assert.equal(findStartIdx(lines), 2);
});

test('findStartIdx: returns -1 when no heading (regression for #7)', () => {
  const lines = ['<!-- header -->', 'plain text'];
  assert.equal(findStartIdx(lines), -1);
});

test('findStartIdx: ignores "# text" without leading digit', () => {
  assert.equal(findStartIdx(['# Overview', '# 5/Mar']), 1);
});

test('classifyLine: h1 with trailing hyphen rule', () => {
  const r = classifyLine('# 19/Abr -------------------------------------');
  assert.equal(r.type, 'h1');
  assert.equal(r.text, '19/Abr ' + '_'.repeat(20));
});

test('classifyLine: h1 without trailing hyphens (regression for #6)', () => {
  const r = classifyLine('# 19/Abr');
  assert.equal(r.type, 'h1');
  assert.equal(r.text, '19/Abr');
});

test('classifyLine: h2 with italic period', () => {
  const r = classifyLine('## Sprint Review *(Mar 30-Apr 5, 5 workdays)*');
  assert.equal(r.type, 'h2');
  assert.equal(r.mainText, 'Sprint Review');
  assert.equal(r.italicText, '(Mar 30-Apr 5, 5 workdays)');
});

test('classifyLine: h2 without italic part', () => {
  const r = classifyLine('## Just a heading');
  assert.equal(r.type, 'h2');
  assert.equal(r.mainText, 'Just a heading');
  assert.equal(r.italicText, undefined);
});

test('classifyLine: h3', () => {
  const r = classifyLine('### Outcomes');
  assert.equal(r.type, 'h3');
  assert.equal(r.text, 'Outcomes');
});

test('classifyLine: bullet with inline bold preserves ranges (regression for #3)', () => {
  const r = classifyLine('* Meditate **7 days**');
  assert.equal(r.type, 'bullet');
  assert.equal(r.text, 'Meditate 7 days');
  assert.deepEqual(r.ranges, [[9, 14]]);
});

test('classifyLine: numbered item with inline bold', () => {
  const r = classifyLine('1. **Health**');
  assert.equal(r.type, 'numbered');
  assert.equal(r.text, 'Health');
  assert.deepEqual(r.ranges, [[0, 5]]);
});

test('classifyLine: standalone **bold** line is bold-header', () => {
  const r = classifyLine('**Personal**');
  assert.equal(r.type, 'bold-header');
  assert.equal(r.text, 'Personal');
});

test('classifyLine: HTML comment is ignored', () => {
  assert.equal(classifyLine('<!-- sprint-wip: ... -->').type, 'comment');
});

test('classifyLine: table row', () => {
  const r = classifyLine('| Improvement | Result |');
  assert.equal(r.type, 'table-row');
  assert.equal(r.raw, '| Improvement | Result |');
});

test('classifyLine: blank line is empty', () => {
  assert.equal(classifyLine('').type, 'empty');
  assert.equal(classifyLine('   ').type, 'empty');
});

test('classifyLine: paragraph with inline bold keeps ranges', () => {
  const r = classifyLine('Some **bold** text');
  assert.equal(r.type, 'paragraph');
  assert.equal(r.text, 'Some bold text');
  assert.deepEqual(r.ranges, [[5, 8]]);
});

test('parseTable: filters separator rows and parses cells', () => {
  const lines = [
    '| Improvement | Result |',
    '| :---- | :---: |',
    '| Work +2h | **3 / 5** |',
  ];
  const rows = parseTable(lines);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][0].text, 'Improvement');
  assert.equal(rows[0][1].text, 'Result');
  assert.equal(rows[1][1].text, '3 / 5');
  assert.deepEqual(rows[1][1].ranges, [[0, 4]]);
});

test('parseTable: keeps inline bold ranges in body cells (regression for #3)', () => {
  const lines = [
    '| Metric | Value |',
    '| :---- | :---: |',
    '| Sleep | **7h30** / 8h |',
  ];
  const rows = parseTable(lines);
  assert.equal(rows[1][1].text, '7h30 / 8h');
  assert.deepEqual(rows[1][1].ranges, [[0, 3]]);
});

// ---- Edge cases ----

test('parseInlineBold: adjacent bold runs without separator', () => {
  const { text, ranges } = parseInlineBold('**a****b**');
  assert.equal(text, 'ab');
  assert.deepEqual(ranges, [[0, 0], [1, 1]]);
});

test('parseInlineBold: bold at string boundaries', () => {
  const { text, ranges } = parseInlineBold('**start**middle**end**');
  assert.equal(text, 'startmiddleend');
  assert.deepEqual(ranges, [[0, 4], [11, 13]]);
});

test('parseInlineBold: unicode characters inside bold', () => {
  const { text, ranges } = parseInlineBold('status: **✓ done**');
  assert.equal(text, 'status: ✓ done');
  assert.deepEqual(ranges, [[8, 13]]);
});

test('parseInlineBold: empty input returns empty text and ranges', () => {
  const { text, ranges } = parseInlineBold('');
  assert.equal(text, '');
  assert.deepEqual(ranges, []);
});

test('parseInlineBold: lone asterisk does not trigger bold', () => {
  const { text, ranges } = parseInlineBold('a * b');
  assert.equal(text, 'a * b');
  assert.deepEqual(ranges, []);
});

test('findStartIdx: matches only at the start of a line, not mid-line', () => {
  const lines = ['foo # 5/Mar', '# 5/Mar'];
  assert.equal(findStartIdx(lines), 1);
});

test('classifyLine: bullet using "-" marker (not just "*")', () => {
  const r = classifyLine('- item text');
  assert.equal(r.type, 'bullet');
  assert.equal(r.text, 'item text');
});

test('classifyLine: line with only whitespace after "## " falls back to paragraph', () => {
  // "## " without content: line.startsWith('## ') is true, raw="" after trim.
  // The italic regex does not match; returns h2 with empty mainText.
  const r = classifyLine('## ');
  assert.equal(r.type, 'h2');
  assert.equal(r.mainText, '');
});

test('classifyLine: numbered list accepts multi-digit index', () => {
  const r = classifyLine('42. forty-two');
  assert.equal(r.type, 'numbered');
  assert.equal(r.text, 'forty-two');
});

test('classifyLine: standalone bold with internal asterisk does NOT match bold-header', () => {
  // Pattern is /^\*\*[^*]+\*\*$/ — the [^*]+ forbids asterisks inside.
  const r = classifyLine('**foo*bar**');
  // Falls through to inline bold parsing at paragraph level.
  assert.equal(r.type, 'paragraph');
});

test('parseTable: table with a single column', () => {
  const lines = [
    '| Improvement |',
    '| :---- |',
    '| Work +2h |',
    '| **Impact** |',
  ];
  const rows = parseTable(lines);
  assert.equal(rows.length, 3);
  assert.equal(rows[0][0].text, 'Improvement');
  assert.equal(rows[2][0].text, 'Impact');
  assert.deepEqual(rows[2][0].ranges, [[0, 5]]);
});

test('parseTable: only the separator row produces no data rows', () => {
  const rows = parseTable(['| :---- | :---: |']);
  assert.deepEqual(rows, []);
});
