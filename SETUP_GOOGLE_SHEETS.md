# Google Sheets Integration Setup Guide

This guide will help you set up the LinkedIn Candidate Tracker extension with Google Sheets as your database.

## Step 1: Create a Google Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on **"Select a Project"** → **"NEW PROJECT"**
3. Enter project name: `LinkedIn Candidate Tracker`
4. Click **CREATE**
5. Wait for the project to be created (may take a few seconds)
6. Select your new project from the dropdown

## Step 2: Enable Google Sheets API

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for **"Google Sheets API"**
3. Click on it and press **ENABLE**
4. You should see a confirmation message

## Step 3: Create Service Account

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **Service Account**
3. Enter details:
   - **Service account name:** `linkedin-tracker-bot`
   - **Service account ID:** (auto-filled, keep as is)
   - Click **CREATE AND CONTINUE**
4. Skip optional steps, click **CONTINUE** and then **DONE**

## Step 4: Generate API Key

1. In **Credentials** page, find your newly created service account
2. Click on the **Service account email** (looks like `linkedin-tracker-bot@...`)
3. Go to **KEYS** tab
4. Click **ADD KEY** → **Create new key**
5. Choose **JSON** format
6. Click **CREATE**
7. A JSON file will download automatically - **SAVE THIS FILE SAFELY**

## Step 5: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Click **+ Blank** to create new sheet
3. Name it: `LinkedIn Candidates`
4. Create columns:
   - **A:** Full Name
   - **B:** LinkedIn ID
   - **C:** Headline
   - **D:** Location
   - **E:** Current Company
   - **F:** Profile URL
   - **G:** Notes
   - **H:** Processing Status
   - **I:** Added Date

5. Add a header row with these titles

## Step 6: Share Sheet with Service Account

1. In your JSON file (from Step 4), find the **client_email** value
2. Copy it (looks like: `linkedin-tracker-bot@...iam.gserviceaccount.com`)
3. Go back to your Google Sheet
4. Click **SHARE** button (top right)
5. Paste the client email
6. Select **Editor** permission
7. Uncheck "Notify people"
8. Click **SHARE**

## Step 7: Get Your Sheet ID

1. Look at the URL of your Google Sheet
2. Extract the sheet ID from the URL: 
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
   ```
3. Copy the SHEET_ID (long string of characters)

## Step 8: Extract API Credentials

From your downloaded JSON file, copy these values:

```
{
  "type": "service_account",
  "project_id": "YOUR_PROJECT_ID",
  "private_key_id": "YOUR_PRIVATE_KEY_ID",
  "private_key": "YOUR_PRIVATE_KEY",
  "client_email": "YOUR_CLIENT_EMAIL",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "YOUR_CERT_URL"
}
```

## Step 9: Configure Extension

1. Install the extension in Chrome (Load Unpacked)
2. Click the extension icon
3. Click **⚙️ Settings** button
4. Paste your API credentials:
   - **API Key (Private Key):** Paste the `private_key` value from JSON
   - **Client Email:** Paste the `client_email` value
   - **Google Sheet ID:** Paste your sheet ID from Step 7
5. Click **SAVE SETTINGS**
6. Extension will test the connection

## Step 10: Test the Setup

1. Go to any LinkedIn profile page
2. You should see a notification at the top
3. The extension will automatically add the candidate to your Google Sheet
4. Check your Google Sheet - new candidate should appear!

---

## Troubleshooting

### "Authentication Failed" Error
- Verify you copied the correct API key and client email
- Make sure you shared the Google Sheet with the service account email
- Check that the Google Sheets API is enabled in Cloud Console

### "Sheet Not Found" Error
- Verify you copied the correct Sheet ID
- Make sure the sheet is shared with your service account email

### No Data Appearing in Sheet
- Check extension console (right-click extension → Inspect)
- Verify the Google Sheet has proper column headers
- Ensure the service account has Editor access to the sheet

### Rate Limiting
- If you get "quota exceeded" errors, wait a minute before retrying
- Google Sheets API has usage limits for free tier

---

## Cost

✅ **FREE** - All of this uses Google's free tier:
- Google Cloud Console (free tier)
- Google Sheets API (free tier)
- Storage in Google Drive (15GB free)

---

## Next Steps

After setup:
1. Share the Google Sheet with your team
2. Share the extension with others
3. Everyone can see candidates in real-time!

---

## Security Notes

⚠️ **IMPORTANT:**
- Never share your API key or private_key with anyone
- Keep your JSON file safe
- Only share the Google Sheet (not the API credentials)
- The extension stores API key locally in your browser only

