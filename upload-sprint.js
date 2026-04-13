const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents'
];

const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const SPRINT_FILE_PATH = path.join(__dirname, '.sprints', 'sprint-wip.md');
const DOC_ID = process.env.DOC_ID; // Set via environment variable

async function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Credentials file not found: ${CREDENTIALS_PATH}\nSee SETUP.md for configuration instructions.`);
  }

  const client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH
  });

  return client;
}

function parseMarkdown(content) {
  const lines = content.split('\n');
  const sections = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      sections.push({ type: 'heading1', text: line.replace('# ', '').trim() });
    } else if (line.startsWith('## ')) {
      sections.push({ type: 'heading2', text: line.replace('## ', '').trim() });
    } else if (line.startsWith('### ')) {
      sections.push({ type: 'heading3', text: line.replace('### ', '').trim() });
    } else if (line.startsWith('* ') || line.startsWith('- ')) {
      sections.push({ type: 'bullet', text: line.replace(/^[\*\-]\s/, '').trim() });
    } else if (line.startsWith('| ')) {
      // Skip tables for now
      continue;
    } else if (line.trim() === '') {
      // Skip empty lines
      continue;
    } else if (line.trim()) {
      sections.push({ type: 'paragraph', text: line.trim() });
    }
  }

  return sections;
}

async function insertToGoogleDoc(auth, sections) {
  if (!DOC_ID) {
    throw new Error('DOC_ID not set. Use: DOC_ID=your-doc-id node upload-sprint.js');
  }

  const docs = google.docs({ version: 'v1', auth });

  // Build requests to insert content
  const requests = [];
  let insertIndex = 1;

  for (const section of sections) {
    if (section.type === 'heading1') {
      requests.push({
        insertText: {
          text: section.text + '\n',
          location: { index: insertIndex }
        }
      });
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: insertIndex,
            endIndex: insertIndex + section.text.length
          },
          textStyle: {
            fontSize: { magnitude: 28, unit: 'pt' },
            bold: true
          },
          fields: 'fontSize,bold'
        }
      });
      insertIndex += section.text.length + 1;
    } else if (section.type === 'heading2') {
      requests.push({
        insertText: {
          text: section.text + '\n',
          location: { index: insertIndex }
        }
      });
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: insertIndex,
            endIndex: insertIndex + section.text.length
          },
          textStyle: {
            fontSize: { magnitude: 20, unit: 'pt' },
            bold: true
          },
          fields: 'fontSize,bold'
        }
      });
      insertIndex += section.text.length + 1;
    } else if (section.type === 'heading3') {
      requests.push({
        insertText: {
          text: section.text + '\n',
          location: { index: insertIndex }
        }
      });
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: insertIndex,
            endIndex: insertIndex + section.text.length
          },
          textStyle: {
            fontSize: { magnitude: 14, unit: 'pt' },
            bold: true
          },
          fields: 'fontSize,bold'
        }
      });
      insertIndex += section.text.length + 1;
    } else if (section.type === 'bullet') {
      requests.push({
        insertText: {
          text: section.text + '\n',
          location: { index: insertIndex }
        }
      });
      insertIndex += section.text.length + 1;
    } else if (section.type === 'paragraph') {
      requests.push({
        insertText: {
          text: section.text + '\n',
          location: { index: insertIndex }
        }
      });
      insertIndex += section.text.length + 1;
    }
  }

  try {
    await docs.documents.batchUpdate({
      documentId: DOC_ID,
      requestBody: {
        requests: requests
      }
    });

    return true;
  } catch (error) {
    throw new Error(`Failed to insert into Google Doc: ${error.message}`);
  }
}

async function main() {
  try {
    console.log('🚀 Inserting sprint-wip.md into Google Doc...\n');

    if (!fs.existsSync(SPRINT_FILE_PATH)) {
      throw new Error(`File not found: ${SPRINT_FILE_PATH}`);
    }

    const fileContent = fs.readFileSync(SPRINT_FILE_PATH, 'utf8');
    console.log('✓ Read local file');

    const sections = parseMarkdown(fileContent);
    console.log(`✓ Parsed ${sections.length} sections`);

    const auth = await authorize();
    console.log('✓ Authenticated with Google');

    await insertToGoogleDoc(auth, sections);
    console.log('✓ Inserted content into Google Doc\n');

    console.log('✓ Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
