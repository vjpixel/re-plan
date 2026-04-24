// Pure parsing helpers used by insert-sprint.gs.
//
// Apps Script cannot import Node modules, so insert-sprint.gs carries its own
// copy of these functions. Keep the two implementations in sync — the tests in
// __tests__/parser.test.js run against this file and catch regressions here;
// manual verification is still required for the .gs copy.

// Returns { text, ranges } where text has **...** markers removed and
// ranges is an array of [startIndex, endIndex] (both inclusive) pointing at
// the positions of the originally bold runs in the stripped text.
function parseInlineBold(raw) {
  const ranges = [];
  let text = '';
  let i = 0;
  while (i < raw.length) {
    if (raw.charAt(i) === '*' && raw.charAt(i + 1) === '*') {
      const end = raw.indexOf('**', i + 2);
      if (end === -1) {
        text += raw.substring(i);
        break;
      }
      const boldText = raw.substring(i + 2, end);
      if (boldText.length > 0) {
        const startPos = text.length;
        text += boldText;
        ranges.push([startPos, text.length - 1]);
      }
      i = end + 2;
    } else {
      text += raw.charAt(i);
      i++;
    }
  }
  return { text, ranges };
}

// Finds the first line matching the sprint H1 pattern ("# D/Month ...").
// Returns the line index, or -1 if none found.
function findStartIdx(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (/^# \d+\//.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

// Classifies a single line into a structured descriptor.
// Types: comment, table-row, empty, h1, h2, h3, bold-header, bullet,
// numbered, paragraph.
function classifyLine(line) {
  if (line.trim().startsWith('<!--')) return { type: 'comment' };
  if (line.startsWith('|')) return { type: 'table-row', raw: line };
  if (line.trim() === '') return { type: 'empty' };

  if (/^# \d+\//.test(line)) {
    let text = line.replace(/^# /, '').trim();
    text = text.replace(/-{3,}\s*$/, '_'.repeat(20));
    return { type: 'h1', text };
  }

  if (line.startsWith('## ')) {
    const raw = line.replace(/^## /, '').trim();
    const match = raw.match(/^(.+?)\s+\*(.+)\*$/);
    if (match) {
      return { type: 'h2', mainText: match[1], italicText: match[2] };
    }
    return { type: 'h2', mainText: raw };
  }

  if (line.startsWith('### ')) {
    return { type: 'h3', text: line.replace(/^### /, '').trim() };
  }

  if (/^\*\*[^*]+\*\*$/.test(line)) {
    return {
      type: 'bold-header',
      text: line.replace(/^\*\*/, '').replace(/\*\*$/, '').trim(),
    };
  }

  if (/^[*-] /.test(line)) {
    const parsed = parseInlineBold(line.replace(/^[*-] /, '').trim());
    return { type: 'bullet', text: parsed.text, ranges: parsed.ranges };
  }

  if (/^\d+\. /.test(line)) {
    const parsed = parseInlineBold(line.replace(/^\d+\. /, '').trim());
    return { type: 'numbered', text: parsed.text, ranges: parsed.ranges };
  }

  const parsed = parseInlineBold(line.trim());
  if (!parsed.text) return { type: 'empty' };
  return { type: 'paragraph', text: parsed.text, ranges: parsed.ranges };
}

// Parses buffered table lines into an array of rows, each a list of
// { text, ranges } cells. Separator rows (| :---- | :---: |) are skipped.
function parseTable(tableLines) {
  const dataLines = tableLines.filter(l => !/^\|[\s:|-]+\|$/.test(l));
  return dataLines.map(row =>
    row.split('|').slice(1, -1).map(cell => parseInlineBold(cell.trim()))
  );
}

module.exports = { parseInlineBold, findStartIdx, classifyLine, parseTable };
