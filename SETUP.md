# Sprint Review Automation Setup

## Overview
Two-part workflow:
1. **upload-sprint.js** (Node.js) — Reads local `sprint-wip.md` and uploads to Google Drive
2. **insert-sprint.gs** (Google Apps Script) — Inserts content at the beginning of your Google Doc

---

## Setup Instructions

### Step 1: Google Cloud Project Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable these APIs:
   - Google Drive API
   - Google Apps Script API
4. Create OAuth 2.0 credentials:
   - Type: Desktop app
   - Download JSON and save as `credentials.json` in this repo directory

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Get Your Apps Script Deployment ID
1. Open your Google Apps Script project (where `insert-sprint.gs` is deployed)
2. Go to "Deploy" → "New deployment"
3. Type: "API Executable"
4. Copy the Deployment ID

### Step 4: Test the Workflow

**First run (authenticates):**
```bash
node upload-sprint.js
```
This will open a browser to authenticate with Google. A `token.json` will be saved.

**With Apps Script execution:**
```bash
APPS_SCRIPT_DEPLOY_ID=<your-deployment-id> node upload-sprint.js
```

---

## What It Does

1. **Reads** `sprint-wip.md` from local `.sprints/` folder
2. **Uploads** to Google Drive (creates or updates `sprint-wip.md`)
3. **Triggers** `insertSprintReview()` function to insert content at the top of your Google Doc

---

## Files

- `upload-sprint.js` — Node.js upload script
- `insert-sprint.gs` — Google Apps Script (must be deployed)
- `credentials.json` — OAuth 2.0 credentials (create via Google Cloud Console)
- `token.json` — Auto-generated after first auth (don't commit)

---

## Troubleshooting

**"credentials.json not found"**
- Download from Google Cloud Console → Create OAuth credentials

**"Apps Script execution failed"**
- Ensure `APPS_SCRIPT_DEPLOY_ID` is set
- Check that `insert-sprint.gs` is deployed as "API Executable"
- Verify `DOC_ID` is configured in Script Properties

**"File not found"**
- Ensure `sprint-wip.md` exists in `.sprints/` folder
