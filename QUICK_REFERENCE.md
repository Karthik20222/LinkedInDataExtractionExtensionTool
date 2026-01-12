# Quick Reference Guide

## 🎯 What You Need

Before setting up the extension:

1. **Google Account** (free)
2. **Google Cloud Project** (free tier)
3. **5 minutes** for setup

## 📋 Step-by-Step Setup

### Phase 1: Google Cloud Setup (5 minutes)

```
1. Go to console.cloud.google.com
2. Create new project
3. Enable Google Sheets API
4. Create Service Account
5. Download JSON key → Save securely
```

### Phase 2: Google Sheet Setup (2 minutes)

```
1. Go to sheets.google.com
2. Create new spreadsheet
3. Add column headers:
   - Full Name
   - LinkedIn ID
   - Headline
   - Location
   - Current Company
   - Profile URL
   - Notes
   - Status
   - Date Added
4. Share with service account email from JSON
```

### Phase 3: Chrome Extension Setup (3 minutes)

```
1. Chrome Settings → Go to chrome://extensions/
2. Enable Developer mode
3. Click "Load unpacked"
4. Select extension folder
5. Click extension icon
6. Click "Settings" button
7. Paste credentials from JSON:
   - Client Email
   - Private Key
   - Sheet ID
8. Click "Test Connection" → Should pass
9. Click "Save Settings"
```

## ✅ Verification Checklist

After setup, verify:

- [ ] Extension appears in Chrome toolbar
- [ ] Settings test passes
- [ ] Can navigate to LinkedIn profile
- [ ] Banner appears on LinkedIn page
- [ ] Can view Google Sheet from popup

## 🔑 Where to Get Your Credentials

**Client Email:**
```
From JSON file, look for:
"client_email": "linkedin-tracker-bot@your-project.iam.gserviceaccount.com"
```

**Private Key:**
```
From JSON file, copy entire value:
"private_key": "-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----\n"
```

**Sheet ID:**
```
From Google Sheet URL:
https://docs.google.com/spreadsheets/d/[THIS_IS_YOUR_SHEET_ID]/edit
```

## 🚀 Using the Extension

### On LinkedIn

1. Navigate to any LinkedIn profile
2. Wait 2 seconds
3. Banner appears at top
4. (Optional) Add notes about candidate
5. Click "Save & Update"
6. ✅ Candidate saved to Google Sheet

### Viewing Your Data

- **In Extension:** Click "View All" button → Opens Google Sheet
- **Direct:** https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID

### Sharing with Team

1. Go to your Google Sheet
2. Click "Share" button
3. Add team member emails
4. Give "Editor" permission
5. They'll see real-time updates

## ⚠️ Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "Not Configured" status | Go to Settings, fill all fields, test connection |
| "Auth Failed" banner | Check credentials are correct and sheet is shared |
| Extension doesn't work | Refresh LinkedIn page, check extension is enabled |
| No data appearing | Check sheet has proper column headers |

## 📞 Support Resources

**Full Setup Guide:** `SETUP_GOOGLE_SHEETS.md`

**Main README:** `README_GOOGLE_SHEETS.md`

**Troubleshooting:** See "Support" section in README

## 🎓 Learning Resources

**Google Sheets API:**
- https://developers.google.com/sheets/api

**Chrome Extensions:**
- https://developer.chrome.com/docs/extensions/

**LinkedIn Data Extraction:**
- Data extraction works on public profiles

## 💡 Pro Tips

- **Duplicate Check:** Extension checks if candidate already exists
- **Multiple Users:** Share sheet for team collaboration
- **Custom Fields:** Add custom columns to Google Sheet
- **Bulk Operations:** Use Google Sheets features for sorting/filtering
- **Export:** Download as CSV, Excel, PDF anytime
- **Backups:** Google Drive auto-backs up your data

## 🔄 Updating the Extension

When we release updates:

1. Download new version
2. Go to chrome://extensions/
3. Click "Reload" on the extension
4. That's it! No settings needed

## 🎯 Success Indicators

You've set up correctly when:

✅ Popup shows "🟢 Configured"
✅ Settings test passes
✅ Banner appears on LinkedIn profiles
✅ Data appears in Google Sheet
✅ Multiple team members can see sheet

---

**Questions?** See full guides in project documentation.

**Ready?** Run `.\setup.ps1` to get started! 🚀
