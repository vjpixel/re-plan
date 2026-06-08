const fs = require('fs');
const path = require('path');
// Load .env from the script's own dir (not cwd) so config is found regardless
// of where the upload is invoked from.
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');

const SCOPES = [
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive'
];

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
// Mirror lib/paths.ts sprintsDir(): SPRINT_DATA_DIR relocates the sprint data
// (e.g. a OneDrive-synced folder); default to the in-repo .sprints. (#74)
const DATA_DIR = process.env.SPRINT_DATA_DIR && process.env.SPRINT_DATA_DIR.trim()
  ? process.env.SPRINT_DATA_DIR
  : path.join(__dirname, '.sprints');
const SPRINT_FILE_PATH = path.join(DATA_DIR, 'sprint-wip.md');
const SCRIPT_ID = process.env.APPS_SCRIPT_ID;

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
  if (!SCRIPT_ID) {
    throw new Error('APPS_SCRIPT_ID not set in .env (see SETUP.md)');
  }

  const script = google.script({ version: 'v1', auth });

  const response = await script.scripts.run({
    scriptId: SCRIPT_ID,
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
