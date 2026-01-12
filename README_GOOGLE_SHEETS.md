# LinkedIn Candidate Tracker - Google Sheets Edition

Track LinkedIn candidates in real-time using Google Sheets. **No server needed!** Just configure Google Sheets API and you're ready to go.

## Features

✨ **Key Features:**
- 📊 Uses Google Sheets as your database
- 🔐 End-to-end encrypted with service account authentication
- ⚡ Real-time candidate tracking
- 👥 Share data with your team via Google Sheet
- 📱 Works on all LinkedIn pages (profiles, recruiter, talent)
- 🎯 Automatic candidate detection
- 📝 Add notes and custom fields
- 🚀 No backend server needed
- ✅ One-click setup with automated scripts

## Installation

### Quick Start (Recommended)

1. **Run the setup script:**
   ```powershell
   # Navigate to project directory
   cd LinkedInDataExtractionTool
   
   # Run setup script
   .\setup.ps1
   ```

2. **Follow the setup guide:**
   - Open `SETUP_GOOGLE_SHEETS.md`
   - Create Google Cloud project & service account
   - Create Google Sheet with candidate data
   - Get API credentials

3. **Load extension in Chrome:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` folder

4. **Configure extension:**
   - Click extension icon
   - Click "⚙️ Settings"
   - Paste API credentials
   - Click "Test Connection"
   - Click "Save Settings"

### Manual Installation

If you prefer to do it manually, follow the detailed steps in [SETUP_GOOGLE_SHEETS.md](SETUP_GOOGLE_SHEETS.md).

## What's Inside

```
extension/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── content.js            # LinkedIn page integration
├── background.js         # Background service worker
├── settings.html         # Settings/configuration page
├── settings.js           # Settings logic
├── google-sheets-db.js  # Google Sheets API wrapper
├── styles.css            # Styles
└── icons/                # Extension icons
```

## How It Works

1. **You install the extension** → Works on LinkedIn pages
2. **Visit a LinkedIn profile** → Extension automatically detects it
3. **Extension extracts candidate data:**
   - Full name
   - LinkedIn ID
   - Headline
   - Location
   - Current company
   - Profile URL
4. **Data is sent to your Google Sheet** → Updated in real-time
5. **Add notes & collaborate** → Share the sheet with your team

## Configuration

### Getting API Credentials

Detailed guide: [SETUP_GOOGLE_SHEETS.md](SETUP_GOOGLE_SHEETS.md)

**TL;DR:**
1. Create Google Cloud project
2. Enable Google Sheets API
3. Create service account → Download JSON
4. Create Google Sheet
5. Share sheet with service account email
6. Extract credentials and paste in Settings

### Google Sheet Structure

Your Google Sheet should have these columns:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Full Name | LinkedIn ID | Headline | Location | Current Company | Profile URL | Notes | Status | Date Added |

The extension will automatically add rows to your sheet!

## Usage

### Basic Workflow

1. Navigate to any LinkedIn profile
2. See banner at the top with candidate info
3. Add optional notes about the candidate
4. Click "Save & Update"
5. Candidate saved to Google Sheet ✅

### Viewing All Candidates

1. Click extension icon
2. Click "📊 View All Candidates"
3. Opens your Google Sheet in new tab
4. Edit, filter, and sort as needed

### Managing Candidates

**In Google Sheet:**
- Edit candidate details directly
- Add custom columns
- Filter by status
- Sort by date
- Export to CSV

**In Extension:**
- Recheck current profile
- View extraction status
- Update settings anytime

## Security & Privacy

🔒 **Security First:**
- API credentials stored locally in Chrome browser only
- We never send credentials to external servers
- Direct authentication with Google API
- You control all data access
- Share only what you want with team

⚠️ **Important:**
- Keep your Google Cloud credentials private
- Don't share JSON file with others
- Share only the Google Sheet link
- You can revoke access anytime

## Troubleshooting

### "Google Sheets API not configured"

**Solution:**
1. Click extension icon
2. Click "⚙️ Settings"
3. Fill in all required fields
4. Test connection
5. Save settings

### "Authentication Failed"

**Check:**
- ✓ Correct API credentials pasted
- ✓ Service account email shared with sheet
- ✓ Google Sheets API enabled
- ✓ Private key includes BEGIN/END markers

### "Sheet Not Found"

**Check:**
- ✓ Correct Sheet ID copied from URL
- ✓ Sheet is shared with service account email
- ✓ Sheet exists and is accessible

### Extension not working on LinkedIn

**Try:**
1. Refresh the LinkedIn page
2. Check extension is enabled (chrome://extensions/)
3. Check Developer Console for errors (right-click → Inspect)
4. Reload extension: Chrome → More Tools → Extensions → Reload

## Limitations

⚠️ **Known Limitations:**
- Requires manual credential setup (one-time)
- Google Sheets API has rate limits (free tier: 500 requests/minute)
- Limited to 5 million cells per sheet
- Batch operations via API are slower than direct edits

## Cost

✅ **Completely Free:**
- Google Cloud free tier (eligible for credits)
- Google Sheets (free)
- Google Drive storage (15GB free)
- Chrome extension hosting (free)

## FAQ

**Q: Do I need Node.js installed?**
A: No! This version uses Google Sheets instead of a backend server.

**Q: Is my data safe?**
A: Yes! Your Google Sheet is stored in your Google Drive, and API credentials are only stored locally in your browser.

**Q: Can I share with my team?**
A: Yes! Share the Google Sheet link with your team. They'll see all candidates in real-time.

**Q: Can I export the data?**
A: Yes! Google Sheets lets you download as CSV, Excel, PDF, etc.

**Q: What if I reach the API rate limit?**
A: Wait a minute and try again. Free tier allows 500 requests/minute. Upgrade to paid if needed.

## Support & Contribution

### Having Issues?

1. Check [SETUP_GOOGLE_SHEETS.md](SETUP_GOOGLE_SHEETS.md)
2. Review troubleshooting section above
3. Check Chrome Developer Console for errors
4. Check Google Cloud Console for API status

### Want to Contribute?

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

MIT License - See LICENSE file for details

## Changelog

### v2.0.0 (Google Sheets Edition)
- ✨ Replaced Node.js backend with Google Sheets API
- ✨ Added Settings page for API configuration
- ✨ Automated setup script
- ✨ Zero backend infrastructure
- ✨ Real-time data sync
- ✨ Team collaboration support

### v1.0.0 (Original)
- Initial release with Node.js backend

## Next Steps

1. **Get Started:** Run `.\setup.ps1`
2. **Read Guide:** Open `SETUP_GOOGLE_SHEETS.md`
3. **Install:** Load extension in Chrome
4. **Configure:** Add API credentials
5. **Track:** Start using on LinkedIn!

---

**Happy recruiting! 🎯**

For detailed setup instructions, see [SETUP_GOOGLE_SHEETS.md](SETUP_GOOGLE_SHEETS.md)
