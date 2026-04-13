# Sprint Review Automation Setup

## Overview

Two-part workflow:
1. **upload-sprint.js** (Node.js) — Reads local `sprint-wip.md` and passes content directly to Apps Script
2. **insert-sprint.gs** (Google Apps Script) — Receives the content and inserts it formatted at the top of your Google Doc

No file upload to Google Drive required.

---

## Setup Instructions

### Step 1: Google Cloud Project Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g. "Re-plan")
3. Enable these APIs:
   - Google Docs API
   - Google Apps Script API
4. Go to **APIs & Services → OAuth consent screen**:
   - App name: `Re-plan`
   - Add yourself as a **Test user**
5. Create OAuth 2.0 credentials:
   - Type: **Desktop app**
   - Download JSON and save as `credentials.json` in this repo directory
6. Link your Apps Script project to this GCP project:
   - In Apps Script editor → gear icon → Project Settings → Change project

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Deploy Apps Script as API Executable
1. Open your Google Apps Script project (where `insert-sprint.gs` is deployed)
2. Click **Deploy** → **New deployment**
3. Type: **API Executable**
4. Copy the **Deployment ID**

### Step 4: Set DOC_ID in Script Properties
1. In Apps Script editor → **Tools** → **Script properties**
2. Add property:
   - Key: `DOC_ID`
   - Value: your Google Doc ID (from the URL: `docs.google.com/document/d/[ID]/edit`)
3. Save

### Step 5: Run the Workflow

**Windows PowerShell:**
```powershell
$env:APPS_SCRIPT_DEPLOY_ID="your-deployment-id"
node upload-sprint.js
```

**macOS / Linux:**
```bash
APPS_SCRIPT_DEPLOY_ID=your-deployment-id node upload-sprint.js
```

On first run, a browser window will open for Google authentication.

---

## What It Does

1. **Reads** `sprint-wip.md` from local `.sprints/` folder
2. **Passes the content** directly to the Apps Script function (no Drive upload)
3. **Apps Script** parses the markdown and inserts it formatted at the top of your Google Doc:
   - Headings (H1, H2, H3)
   - Bullet lists and numbered lists
   - Tables with borders
   - Bold text

---

## Files

| File | Purpose |
|------|---------|
| `upload-sprint.js` | Node.js script — reads file and calls Apps Script |
| `insert-sprint.gs` | Google Apps Script — formats and inserts into Google Doc |
| `credentials.json` | OAuth 2.0 credentials (create via Google Cloud Console, don't commit) |
| `token.json` | Auto-generated after first auth (don't commit) |

---

## Troubleshooting

**"credentials.json not found"**
- Download from Google Cloud Console → APIs & Services → Credentials → Create OAuth Client ID

**"Access blocked: app has not completed verification"**
- Go to Google Cloud Console → APIs & Services → OAuth consent screen
- Add your email under **Test users**

**"Apps Script execution failed: Insufficient Permission"**
- Delete `token.json` and re-authenticate (new scopes may be needed)
- Ensure `insert-sprint.gs` is deployed as **API Executable**
- Ensure your GCP project is linked to the Apps Script project

**"DOC_ID not configured"**
- Set `DOC_ID` in Apps Script → Tools → Script properties

**"File not found"**
- Ensure `sprint-wip.md` exists in `.sprints/` folder
- Run `/sprint-close` first to generate the file
