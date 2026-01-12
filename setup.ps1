# LinkedIn Candidate Tracker - Installation & Setup Script
# This script helps users set up the Chrome extension with Google Sheets API

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LinkedIn Candidate Tracker - Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if extension folder exists
$extensionPath = ".\extension"
if (-not (Test-Path $extensionPath)) {
    Write-Host "❌ Error: Extension folder not found at $extensionPath" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Extension folder found: $extensionPath" -ForegroundColor Green
Write-Host ""

# Step 2: Display setup instructions
Write-Host "📋 SETUP INSTRUCTIONS" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This extension uses Google Sheets as a database (no server needed!)." -ForegroundColor Yellow
Write-Host ""
Write-Host "Complete these steps BEFORE loading the extension:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to: https://console.cloud.google.com/" -ForegroundColor White
Write-Host "2. Create a new project" -ForegroundColor White
Write-Host "3. Enable 'Google Sheets API'" -ForegroundColor White
Write-Host "4. Create a Service Account and download JSON key" -ForegroundColor White
Write-Host "5. Create a Google Sheet with these columns:" -ForegroundColor White
Write-Host "   - Full Name" -ForegroundColor White
Write-Host "   - LinkedIn ID" -ForegroundColor White
Write-Host "   - Headline" -ForegroundColor White
Write-Host "   - Location" -ForegroundColor White
Write-Host "   - Current Company" -ForegroundColor White
Write-Host "   - Profile URL" -ForegroundColor White
Write-Host "   - Notes" -ForegroundColor White
Write-Host "   - Processing Status" -ForegroundColor White
Write-Host "   - Added Date" -ForegroundColor White
Write-Host "6. Share the Google Sheet with your service account email" -ForegroundColor White
Write-Host ""
Write-Host "👉 DETAILED GUIDE: See SETUP_GOOGLE_SHEETS.md in the project" -ForegroundColor Cyan
Write-Host ""

# Step 3: Display Chrome installation instructions
Write-Host "🔧 LOADING EXTENSION IN CHROME" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open Chrome and go to: chrome://extensions/" -ForegroundColor White
Write-Host "2. Enable 'Developer mode' (toggle in top-right)" -ForegroundColor White
Write-Host "3. Click 'Load unpacked'" -ForegroundColor White
Write-Host "4. Select: $((Get-Item $extensionPath).FullName)" -ForegroundColor White
Write-Host "5. The extension should appear in your toolbar" -ForegroundColor White
Write-Host ""

# Step 4: Configuration instructions
Write-Host "⚙️  CONFIGURING THE EXTENSION" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Click the extension icon in Chrome" -ForegroundColor White
Write-Host "2. Click 'Settings' button" -ForegroundColor White
Write-Host "3. Paste your credentials:" -ForegroundColor White
Write-Host "   - Client Email (from JSON file)" -ForegroundColor White
Write-Host "   - Private Key (from JSON file)" -ForegroundColor White
Write-Host "   - Sheet ID (from Google Sheet URL)" -ForegroundColor White
Write-Host "4. Click 'Test Connection'" -ForegroundColor White
Write-Host "5. Click 'Save Settings'" -ForegroundColor White
Write-Host ""
Write-Host "✅ You're ready to use the extension!" -ForegroundColor Green
Write-Host ""

# Step 5: Quick start tips
Write-Host "🚀 QUICK START" -ForegroundColor Cyan
Write-Host "==============" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Navigate to any LinkedIn profile" -ForegroundColor White
Write-Host "2. The extension will automatically detect the profile" -ForegroundColor White
Write-Host "3. A banner will appear with options to add notes" -ForegroundColor White
Write-Host "4. The candidate will be saved to your Google Sheet" -ForegroundColor White
Write-Host "5. View all candidates: Click 'View All' in popup" -ForegroundColor White
Write-Host ""

# Step 6: Troubleshooting
Write-Host "❓ TROUBLESHOOTING" -ForegroundColor Cyan
Write-Host "=================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Issue: 'Authentication Failed'" -ForegroundColor Yellow
Write-Host "   → Check that you copied the correct API credentials" -ForegroundColor White
Write-Host "   → Verify the sheet is shared with your service account email" -ForegroundColor White
Write-Host "   → Ensure Google Sheets API is enabled in Cloud Console" -ForegroundColor White
Write-Host ""
Write-Host "Issue: 'Sheet Not Found'" -ForegroundColor Yellow
Write-Host "   → Verify you copied the correct Sheet ID" -ForegroundColor White
Write-Host "   → Make sure the sheet is shared with service account" -ForegroundColor White
Write-Host ""
Write-Host "Issue: Extension not appearing" -ForegroundColor Yellow
Write-Host "   → Go to chrome://extensions/" -ForegroundColor White
Write-Host "   → Enable 'Developer mode'" -ForegroundColor White
Write-Host "   → Check the extension is enabled (toggle on)" -ForegroundColor White
Write-Host ""

# Step 7: Additional resources
Write-Host "📚 ADDITIONAL RESOURCES" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Full Setup Guide:" -ForegroundColor White
Write-Host "  👉 Open: SETUP_GOOGLE_SHEETS.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "Google Cloud Console:" -ForegroundColor White
Write-Host "  👉 https://console.cloud.google.com/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Chrome Extensions:" -ForegroundColor White
Write-Host "  👉 chrome://extensions/" -ForegroundColor Cyan
Write-Host ""

# Final message
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Setup script completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Create Google Cloud project & service account" -ForegroundColor White
Write-Host "2. Create Google Sheet" -ForegroundColor White
Write-Host "3. Load extension in Chrome" -ForegroundColor White
Write-Host "4. Configure API credentials" -ForegroundColor White
Write-Host "5. Start tracking LinkedIn candidates!" -ForegroundColor White
Write-Host ""

# Ask if user wants to open setup guide
$openGuide = Read-Host "Would you like to open the setup guide now? (Y/n)"
if ($openGuide -ne "n" -and $openGuide -ne "N") {
    if (Test-Path "SETUP_GOOGLE_SHEETS.md") {
        Start-Process "SETUP_GOOGLE_SHEETS.md"
    } else {
        Write-Host "Setup guide not found. Please refer to SETUP_GOOGLE_SHEETS.md" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Happy recruiting! 🎯" -ForegroundColor Green
