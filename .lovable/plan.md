
# Improve Donor List Sorting for Better UX

## Problem Summary

The Donor Intelligence page shows emails that appear to have "random numbers prepended" but are actually **legitimate email addresses** that start with numbers (e.g., `1pam.hall@gmail.com`). These appear first because:

1. The query has no explicit `ORDER BY` clause
2. Default alphabetical sorting puts numbers before letters (ASCII order)
3. Apple's "Hide My Email" generates random addresses like `00_oblique_trick@icloud.com`

This creates a confusing first impression where users see unusual-looking emails at the top of the list.

## Solution: Sort by Most Relevant Fields

Add default sorting to show the most valuable/recent donors first instead of alphabetically by email.

## Technical Changes

### File 1: `src/queries/useDonorSegmentQuery.ts`

**Change**: Add `.order()` to the demographics query to sort by `total_donated DESC` by default, so high-value donors appear first.

**Location**: Around line 293-312, modify the query builder:

```typescript
// Before:
let query = supabase
  .from('donor_demographics')
  .select(...)
  .eq('organization_id', organizationId);

// After:
let query = supabase
  .from('donor_demographics')
  .select(...)
  .eq('organization_id', organizationId)
  .order('total_donated', { ascending: false });  // Show highest donors first
```

### File 2 (Optional Enhancement): `src/components/client/DonorSegmentResults.tsx`

**Change**: Add column sorting capability so users can click headers to sort by Name, Email, State, Total Donated, etc.

This would involve:
- Adding sort state (`sortField`, `sortDirection`)
- Adding click handlers to column headers
- Sorting the `donors` array before virtualization

## Why This Approach

1. **High-value donors first** - Shows major donors ($1,000+) at the top, which is more useful than alphabetical
2. **No data changes needed** - The underlying data is correct
3. **Quick fix** - Single line addition to the query
4. **Future extensibility** - Column sorting gives users full control

## Expected Outcome

After implementation:
- First donors shown will be highest-value (e.g., $7,000+ donors)
- Emails starting with numbers will be scattered throughout the list
- Users will see meaningful data ordering instead of confusing alphabetical order

## Files to Modify

| File | Change |
|------|--------|
| `src/queries/useDonorSegmentQuery.ts` | Add `.order('total_donated', { ascending: false })` to query |
| `src/components/client/DonorSegmentResults.tsx` | (Optional) Add clickable column headers for sorting |
