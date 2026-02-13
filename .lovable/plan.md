
# Add Phone Number and Address Data to Detail Panel

## Overview

Display phone number and address (household) counts in the detail sidebar when selecting a state or congressional district.

## Current State

- **States table** already has `cell_phones` and `households` columns with data (e.g., MI has 128,768 cell phones and 126,373 households)
- **Districts table** does NOT have these columns yet -- they need to be added
- The `VoterImpactState` TypeScript interface already includes `cell_phones` and `households`

## Changes

### 1. Database Migration -- Add columns to `voter_impact_districts`

Add two new nullable integer columns to the districts table:
- `cell_phones` (integer, default 0)
- `households` (integer, default 0)

These will store per-district phone and address counts. They default to 0 so existing rows won't break.

### 2. TypeScript Type Update -- `src/queries/useVoterImpactQueries.ts`

Add `cell_phones` and `households` fields to the `VoterImpactDistrict` interface.

### 3. State Detail Panel -- `src/components/voter-impact/RegionSidebar.tsx`

Add a new "Contact Data" info section to the `StateDetails` component (after the Political Engagement section) showing:
- Phone numbers count (from `cell_phones`)
- Addresses count (from `households`)

### 4. District Detail Panel -- `src/components/voter-impact/RegionSidebar.tsx`

Add the same "Contact Data" section to the `DistrictDetails` component, displaying `cell_phones` and `households` for the selected district.

Both sections will use the existing dark card styling with a 2-column grid layout, matching the Political Engagement section design.

## Technical Details

```text
New DB columns:
  voter_impact_districts.cell_phones  INTEGER DEFAULT 0
  voter_impact_districts.households   INTEGER DEFAULT 0

Updated interface:
  VoterImpactDistrict {
    ...existing fields...
    cell_phones: number;
    households: number;
  }

New UI section (both State + District details):
  "Contact Data"
  ┌─────────────┬─────────────┐
  │  128,768    │  126,373    │
  │ Phone #s    │ Addresses   │
  └─────────────┴─────────────┘
```

## Files Modified
- `src/queries/useVoterImpactQueries.ts` -- add fields to `VoterImpactDistrict` interface
- `src/components/voter-impact/RegionSidebar.tsx` -- add Contact Data sections to both detail views
- Database migration -- add 2 columns to `voter_impact_districts`

## Note
District-level phone/address data will show 0 until you populate those columns with actual data (e.g., via the Excel import tool). State-level data is already populated and will display immediately.
