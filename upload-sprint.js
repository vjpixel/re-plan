require('dotenv').config();
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
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SPRINT_FILE_PATH = path.join(__dirname, '.sprints', 'sprint-wip.md');
const DEPLOY_ID = process.env.APPS_SCRIPT_DEPLOY_ID;

async function loadSavedCredentials() {
  try {
    const content = fs.readFileSync(TOKEN_PATH, 'utf8');
    try { fs.chmodSync(TOKEN_PATH, 0o600); } catch {}
    return google.auth.fromJSON(JSON.parse(content));
  } catch {
    return null;
  }
}

async function saveCredentials(client) {
  const content = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const key = content.installed || content.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  // mode 0o600: token contains a long-lived refresh_token; restrict to the owning user
  fs.writeFileSync(TOKEN_PATH, payload, { mode: 0o600 });
  fs.chmodSync(TOKEN_PATH, 0o600);
}

async function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('credentials.json not found. See SETUP.md.');
  }

  // Reuse saved token if available
  const saved = await loadSavedCredentials();
  if (saved) return saved;

  // First run: open browser for OAuth, then save token
  const client = await authenticate({ scopes: SCOPES, keyfilePath: CREDENTIALS_PATH });
  if (client.credentials) await saveCredentials(client);
  return client;
}

async function triggerAppsScript(auth, fileContent) {
  if (!DEPLOY_ID) {
    throw new Error('APPS_SCRIPT_DEPLOY_ID not set in .env');
  }

  const script = google.script({ version: 'v1', auth });

  const response = await script.scripts.run({
    scriptId: DEPLOY_ID,
    requestBody: {
      function: 'insertSprintReview',
      parameters: [fileContent],
      devMode: true
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
      throw new Error('sprint-wip.md not found. Run /sprint-close first.');
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
