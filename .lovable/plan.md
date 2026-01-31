
# Fix Voter Impact Data Import

## Problem Summary
The data import is failing due to two issues:
1. **State Column Mismatch**: The Excel file contains state **abbreviations** (CA, TX, NY) but the code expects full state names to convert
2. **Foreign Key Cascade**: Since states fail to import, districts fail with FK constraint errors

## Root Cause Analysis

### States File Issue
The National_Analysis.xlsx file structure:
```
State | Muslim Voters | ...
CA    | 551,639       | ...
NY    | 435,214       | ...
```

Current code in `VoterImpactDataImport.tsx`:
```typescript
const stateCode = getStateAbbreviation(stateName);
if (!stateCode || stateCode === stateName) {
  console.warn(`Unknown state: ${stateName}`);  // <- "Unknown state: WA"
  continue;
}
```

The `getStateAbbreviation()` function expects "California" and returns "CA", but the file already has "CA" so it returns "CA" unchanged, causing the `stateCode === stateName` check to skip every row.

### Districts File Issue
Districts require states to exist first (foreign key), but since all states were skipped, all district inserts fail.

## Solution

### Step 1: Fix State Import Logic
Update `parseStatesFile()` to handle **both** abbreviations and full names:

```typescript
// Check if it's already a valid abbreviation
let stateCode = stateName;
let fullStateName = stateName;

if (stateName.length === 2 && isValidStateAbbreviation(stateName)) {
  // It's already an abbreviation, get the full name
  stateCode = stateName.toUpperCase();
  fullStateName = getStateName(stateCode);
} else {
  // It's a full name, get the abbreviation
  stateCode = getStateAbbreviation(stateName);
  if (stateCode === stateName) {
    console.warn(`Unknown state: ${stateName}`);
    continue;
  }
}
```

### Step 2: Update Districts Parser Similarly
The districts file has a "State Code" column with abbreviations, which should work correctly, but we should validate it exists in `STATE_ABBREVIATIONS`.

### Step 3: Handle Edge Cases
- Skip "NATIONAL" summary row (already handled)
- Handle empty/null values gracefully (already handled)

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/VoterImpactDataImport.tsx` | Fix state parsing logic to handle abbreviations |
| `src/lib/us-states.ts` | Ensure `isValidStateAbbreviation()` is exported (already is) |

## Technical Implementation

### Update parseStatesFile function
```typescript
const parseStatesFile = useCallback(async (file: File): Promise<StateRow[]> => {
  // ... existing file reading code ...

  for (const row of rows) {
    const rawState = String(row["State"] || "").trim();
    
    // Skip "NATIONAL" summary row
    if (!rawState || rawState.toUpperCase() === "NATIONAL") continue;

    let stateCode: string;
    let stateName: string;

    // Check if the value is already a 2-letter abbreviation
    if (rawState.length === 2 && isValidStateAbbreviation(rawState)) {
      stateCode = rawState.toUpperCase();
      stateName = getStateName(stateCode);
    } else {
      // Assume it's a full state name
      const abbr = getStateAbbreviation(rawState);
      if (abbr === rawState) {
        console.warn(`Unknown state: ${rawState}`);
        continue;
      }
      stateCode = abbr;
      stateName = rawState;
    }

    stateRows.push({
      state_code: stateCode,
      state_name: stateName,
      // ... rest of fields ...
    });
  }
}, []);
```

## Expected Outcome
After this fix:
- States import will correctly handle "CA" → store as state_code="CA", state_name="California"
- All 50+ states will import successfully
- Districts import will succeed (states exist for FK constraint)
- The voter impact map will display with real data
