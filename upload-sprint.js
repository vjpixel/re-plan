const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/script.projects'
];

const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const SPRINT_FILE_PATH = path.join(__dirname, '.sprints', 'sprint-wip.md');
const SPRINT_FILE_NAME = 'sprint-wip.md';
const DEPLOY_ID = process.env.APPS_SCRIPT_DEPLOY_ID; // Set this via environment variable

async function authorize() {
  let client = null;

  // Load saved token if exists
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    client = google.oauth2({
      clientId: require(CREDENTIALS_PATH).installed.client_id,
      clientSecret: require(CREDENTIALS_PATH).installed.client_secret,
      redirectUrl: require(CREDENTIALS_PATH).installed.redirect_uris[0]
    }).oauth2Client;
    client.setCredentials(token);
  } else {
    // Authenticate and save token
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH
    });

    if (client.credentials) {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(client.credentials));
    }
  }

  return client;
}

async function uploadSprintFile(auth) {
  const drive = google.drive({ version: 'v3', auth });

  // Read local file
  if (!fs.existsSync(SPRINT_FILE_PATH)) {
    throw new Error(`File not found: ${SPRINT_FILE_PATH}`);
  }

  const fileContent = fs.readFileSync(SPRINT_FILE_PATH);

  // Search for existing file
  const listResponse = await drive.files.list({
    q: `name='${SPRINT_FILE_NAME}' and trashed=false`,
    spaces: 'drive',
    pageSize: 1,
    fields: 'files(id, name)'
  });

  let fileId = null;
  if (listResponse.data.files.length > 0) {
    fileId = listResponse.data.files[0].id;
    console.log(`Found existing file: ${fileId}`);
  }

  // Upload or update file
  if (fileId) {
    // Update existing file
    await drive.files.update({
      fileId: fileId,
      media: {
        mimeType: 'text/plain',
        body: fileContent
      }
    });
    console.log(`✓ Updated file: ${SPRINT_FILE_NAME}`);
  } else {
    // Create new file
    const createResponse = await drive.files.create({
      resource: {
        name: SPRINT_FILE_NAME,
        mimeType: 'text/plain'
      },
      media: {
        mimeType: 'text/plain',
        body: fileContent
      }
    });
    fileId = createResponse.data.id;
    console.log(`✓ Created file: ${SPRINT_FILE_NAME} (${fileId})`);
  }

  return fileId;
}

async function triggerAppsScript(auth) {
  if (!DEPLOY_ID) {
    console.log('⚠ APPS_SCRIPT_DEPLOY_ID not set. Skipping Apps Script execution.');
    console.log('To trigger the script, run:');
    console.log('  APPS_SCRIPT_DEPLOY_ID=<deployment-id> node upload-sprint.js');
    return;
  }

  const script = google.script({ version: 'v1', auth });

  try {
    const response = await script.scripts.run({
      scriptId: DEPLOY_ID,
      requestBody: {
        function: 'insertSprintReview'
      }
    });

    if (response.data.error) {
      console.error('✗ Apps Script error:', response.data.error);
    } else {
      console.log('✓ Apps Script executed: insertSprintReview()');
    }
  } catch (error) {
    console.error('✗ Failed to trigger Apps Script:', error.message);
  }
}

async function main() {
  try {
    console.log('🚀 Uploading sprint-wip.md to Google Drive...\n');

    const auth = await authorize();
    await uploadSprintFile(auth);
    await triggerAppsScript(auth);

    console.log('\n✓ Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
