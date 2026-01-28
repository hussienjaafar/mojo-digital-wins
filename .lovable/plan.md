

# Fix Donor Intelligence Page Not Loading After Page Reload

## Problem Summary

After the recent changes to add stable pagination sorting (`.order('id')`), refreshing the donor intelligence page causes the data to never load - the page remains stuck in a loading state showing skeleton placeholders.

## Root Cause

The `fetchAllWithPagination` function in `src/queries/useDonorSegmentQuery.ts` mutates the same Supabase query object across multiple pagination requests:

```text
┌─────────────────────────────────────────────────────────────────────┐
│                   SUPABASE QUERY MUTATION ISSUE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  fetchAllWithPagination(baseQuery) {                                 │
│    while (hasMore) {                                                 │
│      baseQuery.range(0, 999);    ← First call: modifies baseQuery   │
│      baseQuery.range(1000, 1999); ← Second call: SAME object!       │
│      baseQuery.range(2000, 2999); ← Third call: accumulated state   │
│    }                                                                 │
│  }                                                                   │
│                                                                      │
│  Problem: Supabase query builder is MUTABLE                          │
│  - .order() appends to URL params each time                          │
│  - With TWO .order() calls, params may double on each iteration     │
│  - Query state becomes corrupted after multiple iterations          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

When the stable sort fix added `.order('id')` as a secondary sort, it compounded an existing latent bug: the `.order()` method **appends** to the existing order parameters rather than replacing them. After multiple pagination loops, the query URL accumulates duplicate order parameters, leading to malformed requests or server errors.

## Solution

Refactor `fetchAllWithPagination` to use a **query factory function** instead of passing a mutable query object. This ensures each pagination request builds a fresh query from scratch.

### Technical Changes

**File: `src/queries/useDonorSegmentQuery.ts`**

**Change 1: Update `fetchAllWithPagination` to accept a factory function**

Current code (lines 260-286):
```typescript
async function fetchAllWithPagination(
  baseQuery: any,
  batchSize: number = 1000
): Promise<any[]> {
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await baseQuery.range(from, from + batchSize - 1);
    // ...
  }
  return allData;
}
```

Updated code:
```typescript
async function fetchAllWithPagination(
  queryFactory: () => any,
  batchSize: number = 1000
): Promise<any[]> {
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    // Build fresh query for each page to avoid mutation issues
    const { data, error } = await queryFactory().range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Pagination fetch error:', error);
      throw error;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      hasMore = data.length === batchSize;
      from += batchSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}
```

**Change 2: Update the caller to pass a factory function**

Current code (lines 288-324):
```typescript
async function fetchSegmentDonors(
  organizationId: string,
  filters: FilterCondition[]
): Promise<SegmentQueryResult> {
  let query = supabase
    .from('donor_demographics')
    .select(`...`)
    .eq('organization_id', organizationId)
    .order('total_donated', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true });

  for (const filter of filters) {
    query = applyServerFilter(query, filter);
  }

  const demographics = await fetchAllWithPagination(query);
  // ...
}
```

Updated code:
```typescript
async function fetchSegmentDonors(
  organizationId: string,
  filters: FilterCondition[]
): Promise<SegmentQueryResult> {
  // Create a query factory that builds a fresh query each time
  const createQuery = () => {
    let query = supabase
      .from('donor_demographics')
      .select(`
        id,
        donor_key,
        donor_email,
        phone,
        first_name,
        last_name,
        state,
        city,
        zip,
        total_donated,
        donation_count,
        first_donation_date,
        last_donation_date,
        is_recurring,
        employer,
        occupation
      `)
      .eq('organization_id', organizationId)
      .order('total_donated', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true });

    // Apply server-side filters
    for (const filter of filters) {
      query = applyServerFilter(query, filter);
    }

    return query;
  };

  // Fetch ALL records using pagination with fresh queries
  const demographics = await fetchAllWithPagination(createQuery);
  // ...
}
```

## Why This Fixes the Issue

1. **Fresh Query Each Iteration**: Each pagination request now creates a brand new query object with clean state
2. **No Mutation Accumulation**: The `.order()` parameters won't accumulate across iterations
3. **Deterministic Behavior**: Every page request is identical except for the `.range()` offset
4. **Maintains Stable Sort**: The `.order('id')` secondary sort still works correctly for deterministic pagination

## Files to Modify

| File | Changes |
|------|---------|
| `src/queries/useDonorSegmentQuery.ts` | Refactor `fetchAllWithPagination` to use factory pattern; Update `fetchSegmentDonors` to pass query factory |

## Expected Outcome

After this fix:
- Page reload will correctly load donor data
- Pagination will work correctly with 32,417+ donors
- No query state corruption across pagination iterations
- Sorting and filtering will continue to work as expected

