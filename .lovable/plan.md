
# Fix Duplicate Donors in Donor List Table

## Problem Summary

Users are seeing duplicate donor entries in the Donor List table, despite each donor having a unique ID in the database. React is throwing console warnings: `Encountered two children with the same key, '32e77ae2-d712-4551-ae98-202bbc6349d3'`.

## Root Cause

The issue stems from the pagination logic in `fetchAllWithPagination`:

### 1. Unstable Sort Order

```text
┌──────────────────────────────────────────────────────────────┐
│                     PAGE BOUNDARY RACE                        │
├──────────────────────────────────────────────────────────────┤
│  Query: ORDER BY total_donated DESC                           │
│                                                               │
│  Page 1 (rows 0-999):                     Page 2 (rows 1000-1999):
│  ┌─────────────────────────┐              ┌─────────────────────────┐
│  │ ...                     │              │ Donor X ($50)           │  ← Shifted!
│  │ Donor Y ($50) - row 998 │              │ Donor Y ($50) - row 1000│  ← DUPLICATE!
│  │ Donor X ($50) - row 999 │              │ ...                     │
│  └─────────────────────────┘              └─────────────────────────┘
│                                                               │
│  Result: Donor Y and Donor X appear in BOTH pages            │
└──────────────────────────────────────────────────────────────┘
```

The query sorts by `total_donated` only. When multiple donors share the same donation amount (very common - many donors have $50, $25, etc.), the database returns them in a **non-deterministic order**. Between pagination calls, rows can shift positions, causing the same donor to appear on multiple pages.

### 2. Data Verified

Database check confirmed:
- `Andrew Lewis` (ID: `32e77ae2-d712-4551-ae98-202bbc6349d3`) exists exactly **once** in the database
- Total rows: 32,417 (unique)
- Duplicates are occurring in the JavaScript array during fetch

## Solution

### Fix 1: Stable Secondary Sort Key

Add `id` as a secondary sort column to guarantee deterministic ordering across all pagination requests.

**File: `src/queries/useDonorSegmentQuery.ts`**

Current code (line 315):
```typescript
.order('total_donated', { ascending: false, nullsFirst: false });
```

Updated code:
```typescript
.order('total_donated', { ascending: false, nullsFirst: false })
.order('id', { ascending: true });  // Stable tiebreaker
```

### Fix 2: Deduplicate After Fetch (Safety Net)

Add a deduplication step after the paginated fetch to prevent any edge cases from causing duplicate entries.

**File: `src/queries/useDonorSegmentQuery.ts`**

After Step 4 transformation (around line 471):
```typescript
// Step 4: Transform and enrich donors with attribution
let donors = demographics.map(row => {
  const email = row.donor_email?.toLowerCase().trim();
  const attribution = email ? attributionMap.get(email) : undefined;
  return transformToDonor(row, ltvMap.get(row.donor_key || ''), attribution);
});

// Deduplicate by ID (safety net for pagination edge cases)
const uniqueMap = new Map(donors.map(d => [d.id, d]));
donors = Array.from(uniqueMap.values());
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/queries/useDonorSegmentQuery.ts` | Add secondary `.order('id')` for stable pagination; Add deduplication step after transformation |

## Technical Details

### Why Secondary Sort Works

PostgreSQL (Supabase) uses an unstable sort algorithm. When multiple rows have the same value for the sort column, their relative order is undefined and may change between queries. Adding a unique secondary sort key (`id`) guarantees the same order every time:

```sql
-- Before: Unstable
ORDER BY total_donated DESC

-- After: Stable and deterministic  
ORDER BY total_donated DESC, id ASC
```

### Why Deduplication is a Safety Net

Even with stable sorting, edge cases can occur:
- Concurrent inserts during pagination
- Cache inconsistencies
- Network retries

The Map-based deduplication (`new Map(donors.map(d => [d.id, d]))`) ensures uniqueness by ID, keeping only the last occurrence of each donor.

## Expected Outcome

After this fix:
- No duplicate donors in the table
- React console warnings about duplicate keys will disappear
- Pagination will fetch exactly 32,417 unique donors
- Sorting will be stable and predictable
