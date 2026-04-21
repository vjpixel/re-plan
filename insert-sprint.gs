function insertSprintReview(fileContent) {
  const DOC_ID = PropertiesService.getScriptProperties().getProperty('DOC_ID');
  if (!DOC_ID) { throw new Error('DOC_ID not configured in Script Properties'); }
  if (!fileContent) { throw new Error('No content received'); }

  const doc = DocumentApp.openById(DOC_ID);
  const body = doc.getBody();

  const lines = fileContent.split('\n');

  // Find where the review starts (first "# DD/Mon ---" heading)
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^# \d+\//.test(lines[i])) {
      startIdx = i;
      break;
    }
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

    // H1: # 19/Abr -----
    if (/^# .+\s-{3,}/.test(line)) {
      const text = line.replace(/^# /, '').replace(/-+$/, '').trim();
      body.insertParagraph(insertPos++, text)
          .setHeading(DocumentApp.ParagraphHeading.HEADING1);
      continue;
    }

    // H2: ## text  (may have italic part like "*(period)*")
    if (line.startsWith('## ')) {
      const raw = line.replace(/^## /, '').trim();
      const match = raw.match(/^(.+?)\s+\*(.+)\*$/);
      if (match) {
        const mainText = match[1];
        const italicText = match[2]; // asterisks stripped by regex
        const fullText = mainText + ' ' + italicText;
        const p = body.insertParagraph(insertPos++, fullText);
        p.setHeading(DocumentApp.ParagraphHeading.HEADING2);
        const t = p.editAsText();
        const italicStart = mainText.length + 1;
        const italicEnd = fullText.length - 1;
        t.setItalic(italicStart, italicEnd, true);
        t.setBold(italicStart, italicEnd, false);
        t.setFontSize(italicStart, italicEnd, 12);
      } else {
        body.insertParagraph(insertPos++, raw)
            .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      }
      continue;
    }

    // H3: ### text
    if (line.startsWith('### ')) {
      const text = line.replace(/^### /, '').trim();
      body.insertParagraph(insertPos++, text)
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
      const text = stripBold(line.replace(/^[*-] /, '').trim());
      const item = body.insertListItem(insertPos++, text);
      item.setGlyphType(DocumentApp.GlyphType.BULLET);
      item.editAsText().setBold(false);
      continue;
    }

    // Numbered list: 1. text
    if (/^\d+\. /.test(line)) {
      const text = stripBold(line.replace(/^\d+\. /, '').trim());
      const item = body.insertListItem(insertPos++, text);
      item.setGlyphType(DocumentApp.GlyphType.NUMBER);
      item.editAsText().setBold(false);
      continue;
    }

    // Regular paragraph (e.g. items under "On my mind")
    const text = stripBold(line.trim());
    if (text) {
      body.insertParagraph(insertPos++, text);
    }
  }

  // Flush any remaining table
  if (inTable && tableBuffer.length > 0) {
    flushTable(body, insertPos, tableBuffer);
  }

  Logger.log('Sprint review inserted successfully!');
}

function stripBold(text) {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1');
}

function flushTable(body, insertPos, tableLines) {
  // Remove separator rows (| :---- | :---: |)
  const dataLines = tableLines.filter(l => !/^\|[\s:|-]+\|$/.test(l));
  if (dataLines.length === 0) return insertPos;

  const rows = dataLines.map(row =>
    row.split('|').slice(1, -1).map(cell => stripBold(cell.trim()))
  );
  if (rows.length === 0 || rows[0].length === 0) return insertPos;

  const t = body.insertTable(insertPos++, rows);

  const borderAttrs = {
    [DocumentApp.Attribute.BORDER_COLOR]: '#000000',
    [DocumentApp.Attribute.BORDER_WIDTH]: 1
  };

  for (let r = 0; r < t.getNumRows(); r++) {
    const row = t.getRow(r);
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      cell.setAttributes(borderAttrs);
      if (r === 0) cell.editAsText().setBold(true);
    }
  }

  return insertPos;
}
