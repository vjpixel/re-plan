const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  createFakeDocumentApp,
  createFakePropertiesService,
  fakeLogger,
} = require('./doc-fake');

const SCRIPT_PATH = path.join(__dirname, '..', 'insert-sprint.gs');
const SCRIPT_SOURCE = fs.readFileSync(SCRIPT_PATH, 'utf8');

// Loads insert-sprint.gs into a fresh vm context with fakes for DocumentApp /
// PropertiesService / Logger, calls insertSprintReview(content), and returns
// the FakeBody so tests can inspect the recorded operations.
function runInsert(content, props = { DOC_ID: 'fake-doc-id' }) {
  const DocumentApp = createFakeDocumentApp();
  const PropertiesService = createFakePropertiesService(props);
  const sandbox = { DocumentApp, PropertiesService, Logger: fakeLogger };
  vm.createContext(sandbox);
  vm.runInContext(SCRIPT_SOURCE, sandbox);
  vm.runInContext(`insertSprintReview(${JSON.stringify(content)})`, sandbox);
  return DocumentApp._getCurrentBody();
}

const MIN_HEADER = '# 19/Abr -----\n';

test('insert: throws when DOC_ID is not configured', () => {
  assert.throws(
    () => runInsert(MIN_HEADER, {}),
    /DOC_ID not configured/
  );
});

test('insert: throws when input has no H1 sprint heading (regression for #7)', () => {
  assert.throws(
    () => runInsert('## just an h2\n* item\n'),
    /No H1 sprint heading found/
  );
});

test('insert: H1 line produces a HEADING1 paragraph with underscore rule', () => {
  const body = runInsert(MIN_HEADER);
  assert.equal(body._nodes.length, 1);
  assert.equal(body._nodes[0].nodeType, 'paragraph');
  assert.equal(body._nodes[0].heading, 'HEADING1');
  assert.equal(body._nodes[0].text, '19/Abr ' + '_'.repeat(20));
});

test('insert: H2 with italic period sets HEADING2 + setItalic on the right range', () => {
  const body = runInsert(MIN_HEADER + '## Sprint Review *(Mar 30-Apr 5, 5 workdays)*\n');
  const h2 = body._nodes[1];
  assert.equal(h2.heading, 'HEADING2');
  // Full text is mainText + ' ' + italicText: "Sprint Review (Mar 30-Apr 5, 5 workdays)"
  assert.equal(h2.text, 'Sprint Review (Mar 30-Apr 5, 5 workdays)');
  // italicStart = mainText.length + 1, italicEnd = fullText.length - 1
  // mainText = "Sprint Review" (length 13) → italicStart = 14
  // fullText length = 40 → italicEnd = 39
  const italicCall = h2._text._ops.find((o) => o.op === 'setItalic' && o.value === true);
  assert.deepEqual(italicCall, { op: 'setItalic', start: 14, end: 39, value: true });
});

test('insert: H3 produces HEADING3 paragraph with stripped text', () => {
  const body = runInsert(MIN_HEADER + '### **Outcomes** for week\n');
  const h3 = body._nodes[1];
  assert.equal(h3.heading, 'HEADING3');
  assert.equal(h3.text, 'Outcomes for week');
});

test('insert: bullet item with inline bold uses BULLET glyph and bold range', () => {
  const body = runInsert(MIN_HEADER + '* Meditate **7 days**\n');
  const item = body._nodes[1];
  assert.equal(item.nodeType, 'list-item');
  assert.equal(item.glyph, 'BULLET');
  assert.equal(item.text, 'Meditate 7 days');
  // applyBoldRanges does setBold(false) then setBold(start, end, true) per range
  const ops = item._text._ops;
  assert.deepEqual(ops[0], { op: 'setBold', value: false });
  assert.deepEqual(ops[1], { op: 'setBold', start: 9, end: 14, value: true });
});

test('insert: numbered item uses NUMBER glyph', () => {
  const body = runInsert(MIN_HEADER + '1. **Health**\n');
  const item = body._nodes[1];
  assert.equal(item.nodeType, 'list-item');
  assert.equal(item.glyph, 'NUMBER');
  assert.equal(item.text, 'Health');
  const range = item._text._ops.find((o) => o.value === true);
  assert.deepEqual(range, { op: 'setBold', start: 0, end: 5, value: true });
});

test('insert: standalone **bold** line produces an all-bold paragraph', () => {
  const body = runInsert(MIN_HEADER + '**Personal**\n');
  const p = body._nodes[1];
  assert.equal(p.nodeType, 'paragraph');
  assert.equal(p.heading, null);
  assert.equal(p.text, 'Personal');
  // Special branch in insert-sprint.gs: applies setBold(true) without ranges
  assert.deepEqual(p._text._ops, [{ op: 'setBold', value: true }]);
});

test('insert: table renders with borders and header bold', () => {
  const input =
    MIN_HEADER +
    '| Improvement | Result |\n' +
    '| :---- | :---: |\n' +
    '| Work +2h | **3 / 5** |\n';
  const body = runInsert(input);
  const table = body._nodes[1];
  assert.equal(table.nodeType, 'table');
  // Header row + 1 data row (separator is filtered)
  assert.equal(table.getNumRows(), 2);
  // Header: each cell got setBold(true) and a border attribute
  const headerCell = table.getRow(0).getCell(0);
  assert.equal(headerCell.text, 'Improvement');
  // borderAttrs is created inside the vm context, so its prototype differs
  // from the test realm's Object.prototype — compare property-by-property
  // instead of with deepStrictEqual.
  assert.equal(headerCell.attributes.BORDER_COLOR, '#000000');
  assert.equal(headerCell.attributes.BORDER_WIDTH, 1);
  assert.deepEqual(headerCell._text._ops, [{ op: 'setBold', value: true }]);
});

test('insert: table body cell with **bold** applies setBold range', () => {
  const input =
    MIN_HEADER +
    '| Metric | Value |\n' +
    '| :---- | :---: |\n' +
    '| Sleep | **7h30** / 8h |\n';
  const body = runInsert(input);
  const valueCell = body._nodes[1].getRow(1).getCell(1);
  assert.equal(valueCell.text, '7h30 / 8h');
  const ops = valueCell._text._ops;
  assert.deepEqual(ops[0], { op: 'setBold', value: false });
  assert.deepEqual(ops[1], { op: 'setBold', start: 0, end: 3, value: true });
});

test('insert: HTML comment lines are ignored', () => {
  const body = runInsert(
    '<!-- sprint-wip: ... -->\n' + MIN_HEADER + '### Outcomes\n'
  );
  // Two nodes: H1 + H3. The comment is dropped.
  assert.equal(body._nodes.length, 2);
  assert.equal(body._nodes[0].heading, 'HEADING1');
  assert.equal(body._nodes[1].heading, 'HEADING3');
});

test('insert: empty/blank lines do not produce nodes', () => {
  const body = runInsert(MIN_HEADER + '\n   \n### Outcomes\n');
  assert.equal(body._nodes.length, 2);
});
