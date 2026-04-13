const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');

const SCOPES = ['https://www.googleapis.com/auth/documents'];

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const SPRINT_FILE_PATH = path.join(__dirname, '.sprints', 'sprint-wip.md');
const DOC_ID = process.env.DOC_ID;

async function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`credentials.json not found. See SETUP.md.`);
  }
  return authenticate({ scopes: SCOPES, keyfilePath: CREDENTIALS_PATH });
}

function parseMarkdown(content) {
  const lines = content.split('\n');
  const blocks = [];
  let tableRows = [];
  let inTable = false;

  for (const line of lines) {
    if (line.startsWith('|')) {
      if (/^\|[\s:\-|]+\|$/.test(line)) continue; // skip separator rows
      inTable = true;
      const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
      tableRows.push(cells);
      continue;
    }

    if (inTable) {
      blocks.push({ type: 'table', rows: tableRows });
      tableRows = [];
      inTable = false;
    }

    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2).trim() });
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({ type: 'numbered', text: line.replace(/^\d+\.\s/, '').trim() });
    } else if (/^[*-]\s/.test(line)) {
      blocks.push({ type: 'bullet', text: line.slice(2).trim() });
    } else if (line.trim() === '') {
      // skip blank lines
    } else {
      const text = line.trim();
      const isBold = text.startsWith('**') && text.endsWith('**');
      blocks.push({ type: 'paragraph', text: text.replace(/\*\*/g, ''), bold: isBold });
    }
  }

  if (inTable && tableRows.length > 0) {
    blocks.push({ type: 'table', rows: tableRows });
  }

  return blocks;
}

async function insertToGoogleDoc(auth, blocks) {
  if (!DOC_ID) {
    throw new Error('DOC_ID not set. Run: $env:DOC_ID="your-doc-id" then node upload-sprint.js');
  }

  const docs = google.docs({ version: 'v1', auth });

  // --- Phase 1: Build text content and track positions for formatting ---
  let text = '';
  const formatRanges = []; // { start, end, type, bold }

  for (const block of blocks) {
    if (block.type === 'table') {
      // Render table as plain rows separated by tabs
      for (const row of block.rows) {
        const rowText = row.join('\t') + '\n';
        const start = text.length + 1; // +1 for doc start index
        text += rowText;
        formatRanges.push({ start, end: start + rowText.length - 1, type: 'paragraph', bold: false });
      }
    } else {
      const line = block.text + '\n';
      const start = text.length + 1;
      text += line;
      formatRanges.push({ start, end: start + line.length - 1, type: block.type, bold: block.bold || false });
    }
  }

  // --- Phase 2: Insert all text at once ---
  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: {
      requests: [{
        insertText: {
          text,
          location: { index: 1 }
        }
      }]
    }
  });

  console.log('✓ Text inserted');

  // --- Phase 3: Apply formatting ---
  const formatRequests = [];

  for (const range of formatRanges) {
    if (range.type === 'h1') {
      formatRequests.push({
        updateParagraphStyle: {
          range: { startIndex: range.start, endIndex: range.end },
          paragraphStyle: { namedStyleType: 'HEADING_1' },
          fields: 'namedStyleType'
        }
      });
    } else if (range.type === 'h2') {
      formatRequests.push({
        updateParagraphStyle: {
          range: { startIndex: range.start, endIndex: range.end },
          paragraphStyle: { namedStyleType: 'HEADING_2' },
          fields: 'namedStyleType'
        }
      });
    } else if (range.type === 'h3') {
      formatRequests.push({
        updateParagraphStyle: {
          range: { startIndex: range.start, endIndex: range.end },
          paragraphStyle: { namedStyleType: 'HEADING_3' },
          fields: 'namedStyleType'
        }
      });
    } else if (range.type === 'bullet') {
      formatRequests.push({
        createParagraphBullets: {
          range: { startIndex: range.start, endIndex: range.end },
          bulletPreset: 'BULLET_DISC'
        }
      });
    } else if (range.type === 'numbered') {
      formatRequests.push({
        createParagraphBullets: {
          range: { startIndex: range.start, endIndex: range.end },
          bulletPreset: 'NUMBERED_DECIMAL_ALPHA_ROMAN'
        }
      });
    } else if (range.bold) {
      formatRequests.push({
        updateTextStyle: {
          range: { startIndex: range.start, endIndex: range.end },
          textStyle: { bold: true },
          fields: 'bold'
        }
      });
    }
  }

  if (formatRequests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: DOC_ID,
      requestBody: { requests: formatRequests }
    });
    console.log('✓ Formatting applied');
  }
}

async function main() {
  try {
    if (!fs.existsSync(SPRINT_FILE_PATH)) {
      throw new Error(`File not found: ${SPRINT_FILE_PATH}`);
    }

    const fileContent = fs.readFileSync(SPRINT_FILE_PATH, 'utf8');
    const blocks = parseMarkdown(fileContent);
    console.log(`✓ Parsed ${blocks.length} blocks from sprint-wip.md`);

    const auth = await authorize();
    console.log('✓ Authenticated with Google');

    await insertToGoogleDoc(auth, blocks);
    console.log('\n✓ Done! Sprint review inserted into Google Doc.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
