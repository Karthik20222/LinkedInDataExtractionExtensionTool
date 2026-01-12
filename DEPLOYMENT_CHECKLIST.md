# 🚀 Deployment Checklist

Complete this checklist before sharing the extension with others.

## ✅ Pre-Deployment Checklist

### Phase 1: Preparation (DO THIS FIRST)

- [ ] Read **SETUP_GOOGLE_SHEETS.md** completely
- [ ] Read **QUICK_REFERENCE.md** for overview  
- [ ] Have Google account ready
- [ ] Have 10-15 minutes available
- [ ] Browser: Chrome (required)

### Phase 2: Google Cloud Setup

- [ ] Go to https://console.cloud.google.com/
- [ ] Create new project named "LinkedIn Candidate Tracker"
- [ ] Enable Google Sheets API
- [ ] Create Service Account
- [ ] Download JSON key file
- [ ] Save JSON file in safe location
- [ ] Extract and verify credentials:
  - [ ] `client_email` available
  - [ ] `private_key` complete (includes BEGIN/END)
  - [ ] `project_id` available

### Phase 3: Google Sheet Creation

- [ ] Go to https://sheets.google.com
- [ ] Create new spreadsheet
- [ ] Name it: "LinkedIn Candidates"
- [ ] Add column headers (in order):
  - [ ] A: Full Name
  - [ ] B: LinkedIn ID
  - [ ] C: Headline
  - [ ] D: Location
  - [ ] E: Current Company
  - [ ] F: Profile URL
  - [ ] G: Notes
  - [ ] H: Processing Status
  - [ ] I: Added Date
- [ ] Copy Sheet ID from URL
- [ ] Share sheet with service account email
- [ ] Verify sheet is shared (try accessing with service account)

### Phase 4: Extension Deployment

- [ ] Open Chrome
- [ ] Navigate to `chrome://extensions/`
- [ ] Enable "Developer mode" (toggle top-right)
- [ ] Click "Load unpacked"
- [ ] Select the `extension` folder
- [ ] Extension appears in toolbar ✅
- [ ] Extension icon is clickable
- [ ] No errors in Extensions page

### Phase 5: Extension Configuration

- [ ] Click extension icon in toolbar
- [ ] Click "⚙️ Settings" button
- [ ] Settings page opens in new tab
- [ ] Fill in "Client Email":
  - [ ] Copy from JSON file
  - [ ] Paste correctly (check for spaces)
- [ ] Fill in "Private Key":
  - [ ] Copy entire key from JSON
  - [ ] Includes `-----BEGIN PRIVATE KEY-----`
  - [ ] Includes `-----END PRIVATE KEY-----`
  - [ ] Paste correctly (multi-line)
- [ ] Fill in "Sheet ID":
  - [ ] Copy from Google Sheet URL
  - [ ] Correct format (long string)
  - [ ] Paste correctly (no extra spaces)
- [ ] Click "Test Connection" button
- [ ] Test shows ✅ Success message
- [ ] Click "Save Settings"
- [ ] Extension popup shows "🟢 Configured"

### Phase 6: Basic Functionality Test

- [ ] Navigate to any LinkedIn profile
  - Good test: linkedin.com/in/linkedin/
- [ ] Wait 2-3 seconds
- [ ] Banner appears at top of page
- [ ] Banner shows candidate name
- [ ] Banner has input fields for notes
- [ ] Can click "Save & Update"
- [ ] No JavaScript errors (check F12 console)

### Phase 7: Google Sheet Verification

- [ ] Go to your Google Sheet in Google Drive
- [ ] Check if new candidate row appeared
  - If not: Test on a few more profiles
  - If yes: ✅ Working correctly
- [ ] Verify data is correct:
  - [ ] Full Name extracted correctly
  - [ ] LinkedIn ID populated
  - [ ] Headline populated
  - [ ] Location populated
  - [ ] Current Company populated
  - [ ] Profile URL correct
- [ ] Add test data manually to verify edit works
- [ ] Try adding from extension again

### Phase 8: Team Setup (If Sharing)

- [ ] Decide who has access
- [ ] Create Google account for each team member (if needed)
- [ ] Share Google Sheet with team:
  - [ ] Click "Share" button
  - [ ] Add team member emails
  - [ ] Give "Editor" permission
  - [ ] Uncheck "Notify people"
  - [ ] Click "Share"
- [ ] Verify team members can access sheet
- [ ] Test real-time sync:
  - [ ] Add candidate on your machine
  - [ ] Have team member refresh sheet
  - [ ] New candidate appears ✅

### Phase 9: Documentation

- [ ] Copy these files to share:
  - [ ] Extension folder (zipped)
  - [ ] SETUP_GOOGLE_SHEETS.md
  - [ ] QUICK_REFERENCE.md
  - [ ] README_GOOGLE_SHEETS.md (optional)

- [ ] Create deployment package:
  ```
  LinkedInTracker-Deployment/
  ├── extension/     (as zip file)
  ├── SETUP_GOOGLE_SHEETS.md
  ├── QUICK_REFERENCE.md
  └── README.txt (with link to guides)
  ```

### Phase 10: Security Review

- [ ] JSON file is NOT shared (keep safe)
- [ ] Only Google Sheet link is shared
- [ ] API credentials NOT in any code files
- [ ] No test credentials left in code
- [ ] Privacy statement reviewed
- [ ] All sensitive data secured

### Phase 11: Communication

Before sharing with users:

- [ ] Prepare user onboarding instructions
- [ ] Create FAQ document if needed
- [ ] Plan how to distribute:
  - [ ] Email
  - [ ] Google Drive
  - [ ] GitHub (if public)
- [ ] Set up support channel (email/chat)
- [ ] Document known limitations
- [ ] Have troubleshooting guide ready

### Phase 12: Final Checks

- [ ] Test on different LinkedIn pages:
  - [ ] /in/ profile pages
  - [ ] /talent/ pages
  - [ ] /recruiter/ pages
  
- [ ] Test with different browsers (Chrome variants):
  - [ ] Chrome (regular)
  - [ ] Chromium (if available)
  
- [ ] Test edge cases:
  - [ ] Profiles with no headline
  - [ ] Profiles with no company
  - [ ] Profiles with special characters in name
  
- [ ] Verify extension doesn't break on:
  - [ ] Other websites (should be inactive)
  - [ ] LinkedIn feed (should not interfere)
  - [ ] LinkedIn search results (should not interfere)

---

## 📦 Deployment Package Structure

Ready to share? Package like this:

```
LinkedInCandidateTracker-v2.0.0/
│
├── README.txt (START HERE)
│   └── Points to SETUP_GOOGLE_SHEETS.md
│
├── extension/ (as .zip file)
│   ├── manifest.json
│   ├── popup.html
│   ├── content.js
│   ├── settings.html
│   └── [all extension files]
│
├── SETUP_GOOGLE_SHEETS.md
│   └── 10-step setup guide
│
├── QUICK_REFERENCE.md
│   └── Quick checklist
│
└── FAQ.md (optional)
    └── Common questions
```

---

## 🚀 Distribution Methods

### Method 1: Email Package (Easiest)
```
1. Create ZIP file with everything
2. Send via email
3. Users extract and follow SETUP_GOOGLE_SHEETS.md
```

### Method 2: Google Drive
```
1. Upload ZIP to shared Google Drive folder
2. Send link to team
3. Users download and setup
```

### Method 3: GitHub (Public)
```
1. Create GitHub repository
2. Upload files
3. Add detailed README.md
4. Share GitHub link
```

### Method 4: Chrome Web Store (Professional)
```
1. Package as CRX file
2. Submit to Chrome Web Store
3. Pay $5 one-time fee
4. Share public store link
5. Users install directly
```

---

## ✅ Post-Deployment

After sharing:

- [ ] Collect feedback from users
- [ ] Track reported issues
- [ ] Fix bugs quickly
- [ ] Release updates as needed
- [ ] Maintain documentation
- [ ] Provide user support

---

## 🎓 User Onboarding

When users get the extension:

1. **Send them:**
   - [ ] Download link
   - [ ] Setup guide (SETUP_GOOGLE_SHEETS.md)
   - [ ] Quick reference (QUICK_REFERENCE.md)

2. **They should:**
   - [ ] Read setup guide
   - [ ] Create Google Cloud project
   - [ ] Download JSON credentials
   - [ ] Create Google Sheet
   - [ ] Share sheet with service account

3. **Then:**
   - [ ] Load extension in Chrome
   - [ ] Configure credentials
   - [ ] Test connection
   - [ ] Start using!

---

## 🔒 Security Reminders

Before deployment:

- ⚠️ **DO NOT** include JSON file in package
- ⚠️ **DO NOT** hardcode any API keys
- ⚠️ **DO NOT** share service account email publicly
- ✅ **DO** instruct users to keep JSON file safe
- ✅ **DO** remind users to never share credentials
- ✅ **DO** document security best practices

---

## 📋 Deployment Approval

### Sign-off Checklist

- [ ] All tests passed
- [ ] Documentation complete
- [ ] Security reviewed
- [ ] Performance acceptable
- [ ] No error messages
- [ ] Team consensus obtained
- [ ] Deployment approved

---

## 🎉 You're Ready!

If all boxes are checked, your extension is ready for deployment.

**Next steps:**
1. Package the deployment files
2. Distribute to users
3. Provide support
4. Collect feedback
5. Iterate & improve

---

## 📞 Support Resources

Keep these ready:

- [ ] Copy of SETUP_GOOGLE_SHEETS.md
- [ ] FAQ document
- [ ] Troubleshooting guide
- [ ] Contact info for support
- [ ] Known issues list

---

**Happy deploying! 🚀**

For help, refer to:
- SETUP_GOOGLE_SHEETS.md (detailed guide)
- QUICK_REFERENCE.md (quick checklist)
- MIGRATION_GUIDE.md (what changed)

---

**Version:** 2.0.0 (Google Sheets Edition)
**Last Updated:** 2026-01-09
**Status:** Ready for Deployment ✅
