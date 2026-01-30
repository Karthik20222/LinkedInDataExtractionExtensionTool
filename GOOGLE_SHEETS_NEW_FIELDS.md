# Google Sheets Integration Guide - Updated Fields

## 🔄 Updating Your Google Sheets Setup

Your LinkedIn Candidate Tracker now extracts **8 additional fields**. Here's how to update your Google Sheet:

---

## 📊 Recommended Column Layout

### Original Columns (A-I)
```
Column A: Full Name
Column B: LinkedIn ID
Column C: Headline
Column D: Location
Column E: Current Company
Column F: Profile URL
Column G: Notes
Column H: Processing Status
Column I: Added Date
```

### NEW Columns (J-R) - Add These
```
Column J: Industry              [NEW] - e.g., "Technology", "Finance"
Column K: Top 5 Skills         [NEW] - e.g., "Python, Data Analysis, Machine Learning"
Column L: Connections           [NEW] - e.g., "5.2K", "1,234"
Column M: Years at Current      - Job tenure in current role
Column N: Total Years Exp       - Years of overall experience
Column O: Education            [NEW] - e.g., "B.E @ IIT Bombay"
Column P: Qualification        [NEW] - e.g., "BE", "MBA"
Column Q: Passout Year         [NEW] - e.g., "2020"
Column R: Extracted Date       [NEW] - Date when profile was captured
Column S: Processed By          - Your name/email
```

---

## 📝 Step-by-Step Update Instructions

### Step 1: Add Column Headers
1. Open your Google Sheet
2. Click on **cell J1** and add headers:
   - J1: `Industry`
   - K1: `Top Skills`
   - L1: `Connections`
   - M1: `Years Current`
   - N1: `Total Years`
   - O1: `Education`
   - P1: `Qualification`
   - Q1: `Passout Year`
   - R1: `Extracted Date`
   - S1: `Processed By`

### Step 2: Format Columns
- **Column J (Industry)**: Text
- **Column K (Top Skills)**: Text (comma-separated)
- **Column L (Connections)**: Text (allows "5.2K" format)
- **Column M-N (Experience)**: Text (e.g., "2 yrs 6 mos")
- **Column O (Education)**: Text
- **Column P (Qualification)**: Text (3-4 chars)
- **Column Q (Passout Year)**: Text or Number (4 digits)
- **Column R (Extracted Date)**: Date
- **Column S (Processed By)**: Text

### Step 3: Add Column Widths for Better Display
- Column J (Industry): 120px
- Column K (Top Skills): 200px
- Column L (Connections): 100px
- Column R (Extracted Date): 120px

### Step 4: Optional - Add Data Validation
For **Column P (Qualification)**, add dropdown list:
1. Select cells P2:P1000
2. Go to **Data → Data validation**
3. Create dropdown with options: `BE, BTECH, BSC, ME, MTECH, MBA, MCA, BCA, BA, MA, MBBS, MD, LLB, LLM, PHD, DIPLOMA`

---

## 📋 Field Descriptions

### New Fields Explained

| Field | Format | Example | Notes |
|-------|--------|---------|-------|
| **Industry** | Text | "Technology", "Finance & Banking" | Auto-extracted or manually added |
| **Top Skills** | Comma-separated | "Python, Data Analysis, ML" | Top 5 endorsed skills on LinkedIn |
| **Connections** | Text | "5.2K", "1,234" | Network size indicator |
| **Years Current** | Duration | "2 yrs 6 mos", "1 yr" | Time in current position |
| **Total Years** | Duration | "5 yrs 3 mos" | Total career experience |
| **Education** | Text | "B.E in CSE @ IIT Bombay" | Degree + Institution |
| **Qualification** | Abbreviation | "BE", "MBA" | Degree abbreviation for quick filtering |
| **Passout Year** | Year | "2020", "2023" | Graduation year |
| **Extracted Date** | Date | "1/30/2026" | When profile was auto-captured |
| **Processed By** | Text | "Your Name" | Who reviewed/processed |

---

## 🎯 Usage Tips

### Filtering & Sorting
- **Sort by Connections** to find highly connected candidates
- **Filter by Qualification** to find specific degree holders
- **Filter by Industry** to target sector-specific candidates
- **Sort by Passout Year** to find recent graduates or experienced professionals

### Search & Analysis
- Search **Top Skills** to find candidates with specific expertise
- Use **Years Experience** to match job requirements
- Check **Extracted Date** to see fresh profile captures
- Review **Education** for academic background verification

### Data Quality
- Empty fields mean the data wasn't found on the profile
- Some candidates may have privacy restrictions limiting visible data
- **Qualification** auto-filled from education degree names
- **Industry** may be empty if not explicitly shown on profile

---

## 🔄 Backward Compatibility

✅ **Good news!** Your existing data remains unchanged.

The new columns are **optional add-ons**:
- New candidates will populate all fields
- Old entries can be manually filled or left empty
- The tracker continues to work without the new columns
- You can add columns gradually

---

## 💡 Smart Views to Create

### Recommended Filters/Views

**View 1: "Senior Candidates"**
- Filter: Total Years > 5
- Sort: Years at Current (Descending)

**View 2: "Recent Graduates"**
- Filter: Passout Year = Current Year
- Useful for entry-level positions

**View 3: "Highly Connected"**
- Filter: Connections > "1K"
- Good for network value

**View 4: "Tech Specialists"**
- Filter: Top Skills contains "Python OR Java OR AWS"
- For technical roles

---

## 📱 Mobile View

If viewing on mobile:
- Freeze first 3 columns (Name, LinkedIn ID, Headline)
- Hide less important columns (Extracted Date, Processed By)
- Use filters for quick access

---

## 🔐 Data Privacy

All new fields:
- ✅ Contain only **publicly visible** LinkedIn information
- ✅ Are stored securely in your own Google Sheet
- ✅ Are never shared without your permission
- ✅ Can be deleted anytime from your spreadsheet

---

## ⚡ Quick Setup

**TL;DR - Just add these column headers:**

```
J: Industry
K: Top Skills
L: Connections
M: Years Current
N: Total Years
O: Education
P: Qualification
Q: Passout Year
R: Extracted Date
```

Start using the extension - new data will automatically populate these columns!

