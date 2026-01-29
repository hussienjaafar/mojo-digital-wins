

# Fix Console Errors: React Key Warning and RPC 400 Error

## Summary

Two distinct issues need to be resolved:

1. **React Key Warning in ClientOrganizationManager** - Missing key prop on Fragment elements
2. **RPC 400 Error in get_creative_intelligence** - Function references non-existent column `purchase_roas` (should be `roas`)

---

## Issue 1: React Key Warning

### Root Cause

In `src/components/admin/ClientOrganizationManager.tsx` lines 717-871, the map function returns a React Fragment (`<>...</>`) containing two TableRows. However, the key is placed on the inner `<TableRow>` instead of the Fragment wrapper.

```typescript
// Current problematic code (lines 717-871)
filteredOrganizations.map((org) => {
  return (
    <>
      <TableRow key={org.id}>...</TableRow>   // Key is here, but...
      {isExpanded && (
        <TableRow key={`${org.id}-stats`}>...</TableRow>
      )}
    </>   // ...React needs key on THIS element
  );
})
```

### Solution

Add the `key` prop to the Fragment using the explicit `<Fragment key={...}>` syntax (since shorthand `<>` cannot accept props).

```typescript
// Fixed code
import { Fragment } from "react";

filteredOrganizations.map((org) => {
  return (
    <Fragment key={org.id}>
      <TableRow>...</TableRow>
      {isExpanded && (
        <TableRow>...</TableRow>
      )}
    </Fragment>
  );
})
```

---

## Issue 2: RPC 400 Error (Column Does Not Exist)

### Root Cause

The `get_creative_intelligence` function references `mci.purchase_roas` in multiple places, but the actual column in `meta_creative_insights` is named `roas`.

**Database schema shows:**
- Column exists: `roas` (numeric)
- Column does NOT exist: `purchase_roas`

**Error from console logs:**
```
"column mci.purchase_roas does not exist"
```

### Affected Lines in Current Function

The migration `20260129020339_b0e2e4d6-cc11-4292-aafa-eb9ae0e8c06a.sql` contains these incorrect references:

| Line | Incorrect | Correct |
|------|-----------|---------|
| 42 | `mci.purchase_roas * mci.spend` | `mci.roas * mci.spend` |
| 90 | `AVG(mci.purchase_roas)` | `AVG(mci.roas)` |
| 91 | `STDDEV(mci.purchase_roas)` | `STDDEV(mci.roas)` |
| 92 | `PERCENTILE_CONT... ORDER BY mci.purchase_roas` | `ORDER BY mci.roas` |
| 93 | `MIN(mci.purchase_roas)` | `MIN(mci.roas)` |
| 94 | `MAX(mci.purchase_roas)` | `MAX(mci.roas)` |
| 97 | `mci.purchase_roas * mci.spend` | `mci.roas * mci.spend` |
| 98-99 | `AVG(mci.purchase_roas)` (confidence interval) | `AVG(mci.roas)` |
| 101 | `STDDEV(mci.purchase_roas)` | `STDDEV(mci.roas)` |
| 124 | `AVG(mci.purchase_roas)` | `AVG(mci.roas)` |
| 127 | `mci.purchase_roas * mci.spend` | `mci.roas * mci.spend` |
| 143 | `AVG(mci.purchase_roas)` | `AVG(mci.roas)` |
| 144 | `mci.purchase_roas * mci.spend` | `mci.roas * mci.spend` |
| 179-180 | `mci.purchase_roas * mci.spend`, `mci.purchase_roas` | `mci.roas * mci.spend`, `mci.roas` |
| 186-190 | `mci.purchase_roas >= 3.0`, etc. | `mci.roas >= 3.0`, etc. |
| 203 | `mci.purchase_roas as roas` | `mci.roas as roas` |
| 207 | `ORDER BY mci.purchase_roas DESC` | `ORDER BY mci.roas DESC` |

### Solution

Create a new database migration that:
1. Drops the current function
2. Recreates it with all `purchase_roas` references replaced with `roas`

---

## Technical Implementation

### Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/ClientOrganizationManager.tsx` | Add Fragment import, replace `<>` with `<Fragment key={org.id}>` |
| Database migration (new) | Fix `get_creative_intelligence` function to use `roas` column |

### Code Changes

#### 1. ClientOrganizationManager.tsx

**Line 1: Add Fragment import**
```typescript
import { useState, useEffect, useMemo, useRef, Fragment } from "react";
```

**Lines 717-718: Replace shorthand Fragment with keyed Fragment**
```typescript
// Before
return (
  <>
    <TableRow key={org.id} className="group">

// After  
return (
  <Fragment key={org.id}>
    <TableRow className="group">
```

**Line 865: Update the inner row key**
```typescript
// Before
<TableRow key={`${org.id}-stats`}>

// After
<TableRow>
```

**Line 871: Close with Fragment**
```typescript
// Before
</>

// After
</Fragment>
```

#### 2. Database Migration

Create new migration to fix the RPC function by replacing all 20+ occurrences of `purchase_roas` with `roas`.

---

## Expected Results

After implementation:
1. React key warning will be eliminated
2. RPC calls to `get_creative_intelligence` will succeed (200 OK)
3. Creative Intelligence V2 page will load data correctly

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `src/components/admin/ClientOrganizationManager.tsx` |
| Create | Database migration to fix `get_creative_intelligence` RPC |

