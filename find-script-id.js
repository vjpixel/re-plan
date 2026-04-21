require('dotenv').config();
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');
const path = require('path');

async function main() {
  const auth = await authenticate({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    keyfilePath: path.join(__dirname, 'credentials.json')
  });
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.script'",
    fields: 'files(id, name)'
  });
  console.log(JSON.stringify(res.data.files, null, 2));
}
main().catch(console.error);
