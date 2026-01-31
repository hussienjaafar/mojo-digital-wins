

# Fix District Import Errors

## Problem Summary
The district import is failing with two distinct errors:

1. **Foreign Key Constraint Violations** - Districts from MN, NJ, and CO cannot be imported because those states are **not present in the National_Analysis.xlsx file** and therefore don't exist in `voter_impact_states`
2. **Value Too Long Error** - Party names like "DEMOCRATIC-FARMER-LABOR" (23 characters) exceed the `VARCHAR(20)` limit on `winner_party` and `runner_up_party` columns

## Root Cause Analysis

### Issue 1: Missing States in Source Data
The `National_Analysis.xlsx` file only contains 48 states. It is **missing**:
- **MN** (Minnesota)
- **NJ** (New Jersey)  
- **CO** (Colorado)

When the district import attempts to insert districts for these states (e.g., MN-001, NJ-001, CO-001), it fails because the `state_code` foreign key constraint requires the state to exist first.

### Issue 2: Database Column Too Short
The database schema has:
```text
winner_party:     VARCHAR(20)
runner_up_party:  VARCHAR(20)
```

But the Excel data contains longer party names:
- "DEMOCRATIC-FARMER-LABOR" = 23 characters (Minnesota's DFL party)
- Potentially "NO PARTY PREFERENCE" = 19 characters (fits, but close)

## Solution

### Step 1: Expand Party Column Lengths (Database Migration)
Increase the VARCHAR limits for party columns to accommodate all party names:

```sql
ALTER TABLE voter_impact_districts 
  ALTER COLUMN winner_party TYPE VARCHAR(50),
  ALTER COLUMN runner_up_party TYPE VARCHAR(50);
```

### Step 2: Auto-Create Missing States During District Import
Update the district import logic to:
1. Collect all unique state codes from the districts file
2. Check which states are missing from `voter_impact_states`
3. Insert placeholder state records for missing states before importing districts

```typescript
// Before importing districts, ensure all referenced states exist
const uniqueStateCodes = [...new Set(districtRows.map(d => d.state_code))];

for (const stateCode of uniqueStateCodes) {
  // Check if state exists
  const { data: existing } = await supabase
    .from("voter_impact_states")
    .select("state_code")
    .eq("state_code", stateCode)
    .single();

  if (!existing) {
    // Insert placeholder state with zero values
    await supabase.from("voter_impact_states").insert({
      state_code: stateCode,
      state_name: getStateName(stateCode),
      muslim_voters: 0,
      households: 0,
      // ... other fields default to 0
    });
  }
}
```

### Step 3: Truncate Long Party Names (Safety Fallback)
Add truncation in `parseString()` for party fields to prevent future issues:

```typescript
function parsePartyName(value: unknown, maxLength: number = 50): string | null {
  const str = parseString(value);
  if (str && str.length > maxLength) {
    return str.substring(0, maxLength);
  }
  return str;
}
```

## Files to Modify

| File | Changes |
|------|---------|
| Database Migration | Expand `winner_party` and `runner_up_party` to VARCHAR(50) |
| `src/components/admin/VoterImpactDataImport.tsx` | Add missing state auto-creation before district import |

## Technical Implementation Details

### Database Migration SQL
```sql
-- Expand party columns to accommodate longer party names like "DEMOCRATIC-FARMER-LABOR"
ALTER TABLE voter_impact_districts 
  ALTER COLUMN winner_party TYPE VARCHAR(50);

ALTER TABLE voter_impact_districts 
  ALTER COLUMN runner_up_party TYPE VARCHAR(50);
```

### Import Logic Update
In the `importDistricts` function, before the batch insert loop:

```typescript
// Step 1: Collect unique state codes from district data
const uniqueStateCodes = [...new Set(rows.map(r => r.state_code))];

// Step 2: Check which states are missing
const { data: existingStates } = await supabase
  .from("voter_impact_states" as never)
  .select("state_code");

const existingCodes = new Set(existingStates?.map(s => s.state_code) || []);
const missingCodes = uniqueStateCodes.filter(code => !existingCodes.has(code));

// Step 3: Insert placeholder records for missing states
if (missingCodes.length > 0) {
  const placeholderStates = missingCodes.map(code => ({
    state_code: code,
    state_name: getStateName(code),
    muslim_voters: 0,
    households: 0,
    cell_phones: 0,
    registered: 0,
    registered_pct: 0,
    vote_2024: 0,
    vote_2024_pct: 0,
    vote_2022: 0,
    vote_2022_pct: 0,
    political_donors: 0,
    political_activists: 0,
  }));
  
  await supabase
    .from("voter_impact_states" as never)
    .upsert(placeholderStates as never[], { onConflict: "state_code" });
}
```

## Expected Outcome
After these fixes:
- All 435 congressional districts can be imported successfully
- Missing states (MN, NJ, CO) will be auto-created with placeholder data
- Long party names like "DEMOCRATIC-FARMER-LABOR" will be stored correctly
- The voter impact map will display complete data for all states and districts

