require('dotenv').config();
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');
const path = require('path');

const SCRIPT_ID = process.env.APPS_SCRIPT_ID;

async function main() {
  const auth = await authenticate({
    scopes: [
      'https://www.googleapis.com/auth/script.external_request',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive'
    ],
    keyfilePath: path.join(__dirname, 'credentials.json')
  });

  console.log('Authenticated');
  console.log('Script ID:', SCRIPT_ID);

  const script = google.script({ version: 'v1', auth });

  // Try to get project info
  try {
    const proj = await script.projects.get({ scriptId: SCRIPT_ID });
    console.log('Project info:', JSON.stringify(proj.data, null, 2));
  } catch (e) {
    console.log('projects.get error:', e.message);
  }

  // Try to run with devMode
  try {
    const res = await script.scripts.run({
      scriptId: SCRIPT_ID,
      requestBody: {
        function: 'insertSprintReview',
        parameters: ['test'],
        devMode: true
      }
    });
    console.log('Run result:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log('scripts.run error:', e.message, e.code);
  }
}

main().catch(console.error);
