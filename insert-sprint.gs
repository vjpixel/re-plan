// Apps Script entry point. The pure parsing helpers (parseInlineBold,
// stripBold, and the regex-based dispatching) are duplicated in parser.js at
// the repo root — that file is what the Node test suite (__tests__/parser.test.js)
// runs against. Keep the two in sync when editing either.

function insertSprintReview(fileContent) {
  const DOC_ID = PropertiesService.getScriptProperties().getProperty('DOC_ID');
  if (!DOC_ID) { throw new Error('DOC_ID not configured in Script Properties'); }
  if (!fileContent) { throw new Error('No content received'); }

  const doc = DocumentApp.openById(DOC_ID);
  const body = doc.getBody();

  const lines = fileContent.split('\n');

  // Find where the review starts (first "# DD/Mon ---" heading)
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^# \d+\//.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) {
    throw new Error('No H1 sprint heading found (expected a line matching "# D/Month ..."). Check sprint-wip.md format.');
  }

  let insertPos = 0;
  let tableBuffer = [];
  let inTable = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    // Skip HTML comments
    if (line.trim().startsWith('<!--')) continue;

    // Table: buffer rows until table ends
    if (line.startsWith('|')) {
      tableBuffer.push(line);
      inTable = true;
      continue;
    } else if (inTable) {
      insertPos = flushTable(body, insertPos, tableBuffer);
      tableBuffer = [];
      inTable = false;
    }

    // Empty lines
    if (line.trim() === '') continue;

    // H1: # 19/Abr [-----]  (trailing hyphen run optional — replaced with underscores to render as a continuous line)
    if (/^# \d+\//.test(line)) {
      let raw = line.replace(/^# /, '').trim();
      raw = raw.replace(/-{3,}\s*$/, '_'.repeat(20));
      const parsed = parseInlineBold(raw);
      body.insertParagraph(insertPos++, parsed.text)
          .setHeading(DocumentApp.ParagraphHeading.HEADING1);
      continue;
    }

    // H2: ## text  (may have italic part like "*(period)*")
    if (line.startsWith('## ')) {
      const raw = line.replace(/^## /, '').trim();
      const match = raw.match(/^(.+?)\s+\*(.+)\*$/);
      if (match) {
        const parsedMain = parseInlineBold(match[1]);
        const italicText = match[2]; // single-asterisks stripped by regex
        const fullText = parsedMain.text + ' ' + italicText;
        const p = body.insertParagraph(insertPos++, fullText);
        p.setHeading(DocumentApp.ParagraphHeading.HEADING2);
        const t = p.editAsText();
        const italicStart = parsedMain.text.length + 1;
        const italicEnd = fullText.length - 1;
        t.setItalic(italicStart, italicEnd, true);
        t.setBold(italicStart, italicEnd, false);
        t.setFontSize(italicStart, italicEnd, 12);
      } else {
        const parsed = parseInlineBold(raw);
        body.insertParagraph(insertPos++, parsed.text)
            .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      }
      continue;
    }

    // H3: ### text
    if (line.startsWith('### ')) {
      const parsed = parseInlineBold(line.replace(/^### /, '').trim());
      body.insertParagraph(insertPos++, parsed.text)
          .setHeading(DocumentApp.ParagraphHeading.HEADING3);
      continue;
    }

    // Bold project header: **Text**
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      const text = line.replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
      const p = body.insertParagraph(insertPos++, text);
      p.editAsText().setBold(true);
      continue;
    }

    // Bullet: * text or - text
    if (/^[*-] /.test(line)) {
      const parsed = parseInlineBold(line.replace(/^[*-] /, '').trim());
      const item = body.insertListItem(insertPos++, parsed.text);
      item.setGlyphType(DocumentApp.GlyphType.BULLET);
      applyBoldRanges(item, parsed.ranges);
      continue;
    }

    // Numbered list: 1. text
    if (/^\d+\. /.test(line)) {
      const parsed = parseInlineBold(line.replace(/^\d+\. /, '').trim());
      const item = body.insertListItem(insertPos++, parsed.text);
      item.setGlyphType(DocumentApp.GlyphType.NUMBER);
      applyBoldRanges(item, parsed.ranges);
      continue;
    }

    // Regular paragraph (e.g. items under "On my mind")
    const parsed = parseInlineBold(line.trim());
    if (parsed.text) {
      const p = body.insertParagraph(insertPos++, parsed.text);
      applyBoldRanges(p, parsed.ranges);
    }
  }

  // Flush any remaining table
  if (inTable && tableBuffer.length > 0) {
    flushTable(body, insertPos, tableBuffer);
  }

  Logger.log('Sprint review inserted successfully!');
}

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
  return { text: text, ranges: ranges };
}

function applyBoldRanges(element, ranges) {
  const t = element.editAsText();
  t.setBold(false);
  for (let k = 0; k < ranges.length; k++) {
    const r = ranges[k];
    if (r[1] >= r[0]) {
      t.setBold(r[0], r[1], true);
    }
  }
}

function flushTable(body, insertPos, tableLines) {
  // Remove separator rows (| :---- | :---: |)
  const dataLines = tableLines.filter(l => !/^\|[\s:|-]+\|$/.test(l));
  if (dataLines.length === 0) return insertPos;

  const parsedRows = dataLines.map(row =>
    row.split('|').slice(1, -1).map(cell => parseInlineBold(cell.trim()))
  );
  if (parsedRows.length === 0 || parsedRows[0].length === 0) return insertPos;

  const textRows = parsedRows.map(row => row.map(p => p.text));
  const t = body.insertTable(insertPos++, textRows);

  const borderAttrs = {
    [DocumentApp.Attribute.BORDER_COLOR]: '#000000',
    [DocumentApp.Attribute.BORDER_WIDTH]: 1
  };

  for (let r = 0; r < t.getNumRows(); r++) {
    const row = t.getRow(r);
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      cell.setAttributes(borderAttrs);
      if (r === 0) {
        cell.editAsText().setBold(true);
      } else {
        applyBoldRanges(cell, parsedRows[r][c].ranges);
      }
    }
  }

  return insertPos;
}
