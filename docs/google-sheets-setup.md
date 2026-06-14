# Google Sheets Backend Setup

This sets up a Google Sheet as the concert database so all visitors see published concerts.

## Step 1: Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. Name it **"Kutcheri Log — Concerts"**
3. The sheet will store concert data as JSON in column A. No headers needed.

## Step 2: Add the Apps Script

1. In the sheet, go to **Extensions → Apps Script**
2. Delete any code in the editor and paste the following:

```javascript
const SHEET_NAME = 'Sheet1';

function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const concerts = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i][0]) {
      try {
        concerts.push(JSON.parse(data[i][0]));
      } catch (e) {}
    }
  }
  concerts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return ContentService
    .createTextOutput(JSON.stringify({ concerts }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (body.action === 'delete') {
      return deleteConcert(sheet, body.concertId);
    }

    const concert = body.concert;
    if (!concert || !concert.id) {
      return jsonResponse({ error: 'Missing concert data' });
    }

    // Find existing row by concert ID
    const data = sheet.getDataRange().getValues();
    let existingRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0]) {
        try {
          const existing = JSON.parse(data[i][0]);
          if (existing.id === concert.id) {
            existingRow = i + 1;
            break;
          }
        } catch (e) {}
      }
    }

    const json = JSON.stringify(concert);
    if (existingRow > 0) {
      sheet.getRange(existingRow, 1).setValue(json);
    } else {
      sheet.appendRow([json]);
    }

    return jsonResponse({ ok: true, id: concert.id });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function deleteConcert(sheet, concertId) {
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][0]) {
      try {
        const existing = JSON.parse(data[i][0]);
        if (existing.id === concertId) {
          sheet.deleteRow(i + 1);
          return jsonResponse({ ok: true });
        }
      } catch (e) {}
    }
  }
  return jsonResponse({ ok: true });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Click **Save** (Ctrl+S), name the project **"Kutcheri Log Backend"**

## Step 3: Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the gear icon next to "Select type" → choose **Web app**
3. Settings:
   - **Description:** `Concert backend`
   - **Execute as:** `Me` (your Google account)
   - **Who has access:** `Anyone`
4. Click **Deploy**
5. Click **Authorize access** → select your Google account → click "Allow"
6. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/ABC.../exec`)

## Step 4: Configure the App

Add the URL to your `.env` file:

```
VITE_SHEETS_URL=https://script.google.com/macros/s/ABC.../exec
```

Then rebuild and deploy:

```bash
npm run build
git add -A && git commit -m "Add sheets URL" && git push origin main
```

Also add `VITE_SHEETS_URL` as a **repository secret** in GitHub (Settings → Secrets → Actions) so the GitHub Actions build picks it up.

## How It Works

- **On page load:** The app GETs the script URL → returns all concerts as JSON
- **On concert save:** The app POSTs the concert → script writes to the sheet
- **No user auth needed:** The script runs as your account, anyone can submit
- **localStorage still works:** Concerts save locally first (offline support), then sync to the sheet
- **Merge logic:** Published concerts (from sheet) merge with local ones; local edits take precedence

## Updating the Script

If you need to update the Apps Script code:
1. Go to the spreadsheet → Extensions → Apps Script
2. Edit the code
3. Deploy → Manage deployments → Edit (pencil icon) → Version: "New version" → Deploy
