const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');

const SCOPES = [
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive'
];

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const SPRINT_FILE_PATH = path.join(__dirname, '.sprints', 'sprint-wip.md');
const DEPLOY_ID = process.env.APPS_SCRIPT_DEPLOY_ID;

async function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`credentials.json not found. See SETUP.md.`);
  }
  return authenticate({ scopes: SCOPES, keyfilePath: CREDENTIALS_PATH });
}

async function triggerAppsScript(auth, fileContent) {
  if (!DEPLOY_ID) {
    throw new Error('APPS_SCRIPT_DEPLOY_ID not set.');
  }

  const script = google.script({ version: 'v1', auth });

  const response = await script.scripts.run({
    scriptId: DEPLOY_ID,
    requestBody: {
      function: 'insertSprintReview',
      parameters: [fileContent]
    }
  });

  if (response.data.error) {
    throw new Error('Apps Script error: ' + JSON.stringify(response.data.error));
  }

  console.log('✓ Apps Script executed insertSprintReview()');
}

async function main() {
  try {
    if (!fs.existsSync(SPRINT_FILE_PATH)) {
      throw new Error(`File not found: ${SPRINT_FILE_PATH}`);
    }

    const fileContent = fs.readFileSync(SPRINT_FILE_PATH, 'utf8');
    console.log('✓ Read sprint-wip.md');

    const auth = await authorize();
    console.log('✓ Authenticated with Google');

    await triggerAppsScript(auth, fileContent);
    console.log('\n✓ Done! Sprint review inserted into Google Doc.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
