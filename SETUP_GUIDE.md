# 🚀 Quick Setup Guide - LinkedIn Candidate Tracker

Follow these steps in order to get your system running.

---

## Step 1: Install PostgreSQL

### Windows
1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer (recommended version: 14 or higher)
3. During installation:
   - Remember the **password** you set for user `postgres`
   - Default port: **5432** (keep it)
   - Install pgAdmin 4 (recommended for GUI management)

### Verify Installation
```powershell
# Check if PostgreSQL is running
Get-Service -Name postgresql*

# If stopped, start it
Start-Service postgresql-x64-14  # Adjust version number
```

---

## Step 2: Setup Database

### Option A: Automatic Setup (Recommended)
```powershell
# Navigate to database folder
cd database

# Run setup script (creates database + tables + sample data)
psql -U postgres -f setup.sql

# Enter your postgres password when prompted
```

This will:
- ✅ Create `linkedin_recruiter_db` database
- ✅ Create `candidates` table with indexes
- ✅ Add sample test data
- ✅ Show table structure and statistics

### Option B: Manual Setup
```powershell
# Open PostgreSQL command line
psql -U postgres

# Create database
CREATE DATABASE linkedin_recruiter_db;

# Exit
\q

# Run schema script
cd database
psql -U postgres -d linkedin_recruiter_db -f init.sql
```

---

## Step 3: Configure Backend

```powershell
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create .env file from example
copy .env.example .env

# Edit .env file
notepad .env
```

### Update `.env` with your settings:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=linkedin_recruiter_db
DB_USER=postgres
DB_PASSWORD=kushi123     # ⚠️ Change this to YOUR password!
PORT=3000
NODE_ENV=development
```

---

## Step 4: Test Database Connection

```powershell
# Still in backend folder
npm test
```

Expected output:
```
================================================
  LinkedIn Recruiter - Database Connection Test
================================================

[1/5] Checking environment variables...
✅ All environment variables found
   Host: localhost
   Port: 5432
   Database: linkedin_recruiter_db
   User: postgres

[2/5] Creating PostgreSQL connection pool...
✅ Connection pool created

[3/5] Testing database connection...
✅ Connection successful!
   Server time: 2025-12-29 15:30:00

[4/5] Checking if 'candidates' table exists...
✅ Table 'candidates' found

[5/5] Fetching table statistics...
✅ Statistics retrieved
   Total Candidates: 2
   Unique Recruiters: 1

================================================
✅ All tests passed! Database is ready to use.
================================================
```

### If you see errors:

**❌ Connection refused**
```powershell
# Start PostgreSQL service
Start-Service postgresql-x64-14
```

**❌ Database does not exist**
```powershell
# Run setup script
cd ../database
psql -U postgres -f setup.sql
```

**❌ Authentication failed**
- Check `DB_PASSWORD` in `.env` file
- Make sure it matches your PostgreSQL password

---

## Step 5: Start Backend Server

```powershell
# In backend folder
npm start
```

Expected output:
```
✅ Connected to PostgreSQL database
✅ Database connection test successful: 2025-12-29...
🚀 Server running on http://localhost:3000
📊 Health check: http://localhost:3000/health
```

### Test the API:
Open browser: **http://localhost:3000/health**

Should see:
```json
{
  "status": "OK",
  "message": "LinkedIn Recruiter API is running",
  "timestamp": "2025-12-29T10:30:00.000Z"
}
```

---

## Step 6: Load Chrome Extension

1. Open Chrome browser
2. Go to: **chrome://extensions/**
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Navigate to and select: `LinkedInDataExtractionTool/extension`
6. Extension should appear with title: **"LinkedIn Recruiter - Candidate Tracker"**

---

## Step 7: Test the Extension

1. Keep backend server running (`npm start` in terminal)
2. Open LinkedIn (any profile page):
   - `linkedin.com/in/username`
   - `linkedin.com/talent/profile/...`
   - `linkedin.com/recruiter/...`

3. **What should happen:**
   - Extension automatically extracts profile data
   - If candidate is NEW → Green success banner appears
   - If candidate EXISTS → Red warning banner appears

4. Click extension icon (toolbar) to see:
   - Total candidates count
   - Server status (🟢 Online)
   - Recheck button

---

## ✅ Verification Checklist

- [ ] PostgreSQL service is running
- [ ] Database `linkedin_recruiter_db` exists
- [ ] Table `candidates` has sample data
- [ ] `npm test` shows "All tests passed"
- [ ] Backend server running on port 3000
- [ ] `/health` endpoint returns OK
- [ ] Chrome extension loaded without errors
- [ ] Extension icon appears in toolbar
- [ ] Tested on at least one LinkedIn profile

---

## 🐛 Troubleshooting

### Backend won't start
```powershell
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill the process if needed
taskkill /PID <PID> /F

# Or change port in .env
PORT=3001
```

### Extension not detecting profiles
1. Open Chrome DevTools (F12) on LinkedIn page
2. Go to **Console** tab
3. Look for `[LinkedIn Tracker]` logs
4. Check for errors

### Database connection issues
```powershell
# Test PostgreSQL connection
cd backend
npm test

# Follow the error messages and suggestions
```

---

## 📊 View Your Data

### Option 1: API Endpoint
Open browser: **http://localhost:3000/api/candidates**

### Option 2: PostgreSQL Command Line
```powershell
psql -U postgres -d linkedin_recruiter_db

# View all candidates
SELECT * FROM candidates;

# Count total
SELECT COUNT(*) FROM candidates;

# Exit
\q
```

### Option 3: pgAdmin 4
1. Open pgAdmin 4
2. Connect to server (localhost)
3. Navigate: Databases → linkedin_recruiter_db → Schemas → public → Tables → candidates
4. Right-click candidates → View/Edit Data → All Rows

---

## 🎉 You're Done!

Your LinkedIn Candidate Tracker is now fully operational!

**Workflow:**
1. Recruiter visits LinkedIn profile
2. Extension automatically checks database
3. If duplicate → Shows warning
4. If new → Saves to database
5. All data stored in PostgreSQL

---

## 📞 Need Help?

1. Check [README.md](README.md) for detailed documentation
2. Review console logs: `[LinkedIn Tracker]` prefix
3. Run `npm test` to verify database connection
4. Check backend terminal for error messages

---

**Happy Recruiting! 🎯**

*Kushi Structural Consultancy Pvt Ltd*
