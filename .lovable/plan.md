
# Fix Voter Impact Data Import - Column Name Mismatch

## Problem Analysis

After examining the uploaded Excel files and comparing them with the import script, I've identified the root cause:

### Current Database State
- **436 districts** exist but **ALL have 0 muslim_voters** and **null margin_votes**
- **48/51 states** have correct data, but **CO, MN, NJ show 0** (these are missing from the uploaded National_Analysis file)
- The district structure (cd_code, state_code) imported correctly, but numeric columns failed

### Root Cause
The `xlsx` library parses Excel column headers differently than how they appear. When there are special characters or formatting, the actual JavaScript object keys may differ. The current `getCol` helper function may not be matching correctly.

### Key Evidence
Looking at the CD_GOTV_ANALYSIS Excel file:
- TX-001 should have MUSLIM = 1941, but database shows 0
- TX-007 should have MUSLIM = 38819, but database shows 0
- All 436 districts have muslim_voters = 0

## Solution Overview

### 1. Add Robust Column Name Logging
First, add debug logging that outputs the **exact** JavaScript object keys that xlsx produces, not the display names. This will reveal any hidden characters, encoding issues, or formatting differences.

### 2. Implement Fuzzy Column Matching
Replace the simple `getCol` helper with a more sophisticated matcher that:
- Normalizes column names (remove spaces, underscores, special chars)
- Logs which column name variant was matched
- Reports unmatched expected columns

### 3. Handle the Missing States
The National_Analysis file uploaded is missing CO, MN, NJ entirely. These states need data from a complete source file.

### 4. Fix Column Name Matching for Districts
Based on Excel analysis, these columns need flexible matching:

| Excel Column | Needs to Match |
|--------------|----------------|
| `MUSLIM` | muslim_voters |
| `MUS-REG` | muslim_registered |
| `MUS-UNREG` | muslim_unregistered |
| `MUS_VOTED24` | voted_2024 |
| `MUS_DIDN'TVOTE24` | didnt_vote_2024 |
| `Margin (Votes)` | margin_votes |
| `Margin (%)` | margin_pct |

---

## Technical Implementation

### Changes to `src/components/admin/VoterImpactDataImport.tsx`

#### 1. Improve the `getCol` Helper with Normalization

Replace the current `getCol` function with a version that:
- Creates a normalized lookup map of all column names
- Strips special characters, spaces, and underscores for comparison
- Logs the exact match found for debugging

```typescript
// Create a normalized key for matching
const normalizeKey = (key: string): string => {
  return key.toLowerCase().replace(/[\s_\-()%']/g, '');
};

// Build a lookup map for the row's columns once
const buildColumnLookup = (row: Record<string, unknown>): Map<string, string> => {
  const lookup = new Map<string, string>();
  for (const key of Object.keys(row)) {
    lookup.set(normalizeKey(key), key);
  }
  return lookup;
};
```

#### 2. Add Explicit Column Mapping with Fallbacks

For each column, try multiple variations and log which one matched:

```typescript
const COLUMN_MAPPINGS = {
  muslim_voters: ['MUSLIM', 'Muslim', 'Muslim Voters', 'muslim_voters'],
  muslim_registered: ['MUS-REG', 'MUS_REG', 'MusReg'],
  muslim_unregistered: ['MUS-UNREG', 'MUS_UNREG', 'MusUnreg'],
  voted_2024: ['MUS_VOTED24', 'MUS-VOTED24', 'MusVoted24'],
  didnt_vote_2024: ["MUS_DIDN'TVOTE24", 'MUS_DIDNTVOTE24', 'MusDidntVote24'],
  margin_votes: ['Margin (Votes)', 'MarginVotes', 'Margin_Votes'],
  margin_pct: ['Margin (%)', 'MarginPct', 'Margin_Pct'],
};
```

#### 3. Add Diagnostic Output After Parsing

After parsing, display a summary showing:
- Actual column names found in Excel
- Which columns were successfully matched
- Sample values from first row to verify parsing

#### 4. Log All Columns When Import Fails

If parsing produces all-zero values for muslim_voters, halt and display the column mapping mismatch as an error to the user.

### Expected File Changes

| File | Changes |
|------|---------|
| `src/components/admin/VoterImpactDataImport.tsx` | Enhanced column matching with normalization, better logging, diagnostic output |

---

## Post-Implementation Verification

After the fix, re-import should show:
1. TX-001: muslim_voters = 1941
2. TX-007: muslim_voters = 38819  
3. CA districts sum ≈ 551,639 total
4. All 436 districts with proper muslim_voters values
5. Margin data populated for competitive districts

### Database Verification Query
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN muslim_voters > 0 THEN 1 ELSE 0 END) as with_voters,
  SUM(muslim_voters) as total_voters
FROM voter_impact_districts;
```

Expected result: ~380+ districts with voters, total voters ~3.4M

---

## Note on Missing States (CO, MN, NJ)

The uploaded National_Analysis file does not contain Colorado, Minnesota, or New Jersey. This is a **data file issue**, not a code issue. The user should:
1. Verify they have the complete National_Analysis file with all states
2. Re-upload once the complete file is obtained

Alternatively, if this is the authoritative source, these states genuinely have no tracked Muslim voter data.
