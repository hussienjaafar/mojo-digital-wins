
# Fix Phone Sorting, Add "Has Phone" Filter, and Fix Pop-Out Sheet

## Summary

This plan addresses three issues in the donor list table:
1. Phone sorting appears broken due to invalid data entries sorting to the top
2. No ability to filter donors by phone number availability
3. Pop-out sheet shows empty table due to virtualization race condition

---

## Issue 1: Phone Sorting Appears Broken

### Root Cause
The sorting logic is technically correct, but the database contains invalid phone entries:
- `"--------------"` (14 dashes)
- `"."` (single period)
- Other non-phone values

When sorting alphabetically, special characters have lower ASCII values than numbers, so these invalid entries appear first when sorting ascending by phone. This makes it look like sorting isn't working.

### Solution
Improve the sorting logic to:
1. Detect invalid phone numbers (less than 7 digits after cleaning)
2. Treat invalid phones the same as null (push to end of list)
3. Sort valid phone numbers normally

### Technical Changes

**File: `src/components/client/DonorSegmentResults.tsx`**

Add a helper function to validate phone numbers and update the sorting logic:

```typescript
// Helper to check if phone is valid (at least 7 digits)
function isValidPhone(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7;
}

// In sortedDonors useMemo, update the phone sorting:
const sortedDonors = useMemo(() => {
  return [...filteredDonors].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    // Special handling for phone - treat invalid phones as null
    if (sortField === 'phone') {
      const aValid = isValidPhone(aVal);
      const bValid = isValidPhone(bVal);
      
      // Both invalid/null - equal
      if (!aValid && !bValid) return 0;
      // Push invalid to end
      if (!aValid) return 1;
      if (!bValid) return -1;
      
      // Both valid - compare strings
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? comparison : -comparison;
    }

    // Handle nulls - push to end
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // ... rest of sorting logic unchanged
  });
}, [filteredDonors, sortField, sortDirection]);
```

**File: `src/components/client/DonorListSheet.tsx`**

Apply the same `isValidPhone` helper and sorting logic.

---

## Issue 2: Add "Has Phone Number" Filter

### Solution
Add a phone filter field to the segment builder that allows filtering by:
- `is_not_null` - Has a phone number
- `is_null` - No phone number

### Technical Changes

**File: `src/types/donorSegment.ts`**

Add phone field to `SEGMENT_FILTER_FIELDS`:

```typescript
// In the Demographics category section, add:
{
  key: 'phone',
  label: 'Phone Number',
  category: 'Demographics',
  type: 'string',
  operators: ['is_null', 'is_not_null', 'contains'],
  description: 'Donor phone number availability',
},
```

**File: `src/queries/useDonorSegmentQuery.ts`**

Ensure `applyServerFilter` handles phone field with `is_null` and `is_not_null` operators (should already work with existing logic).

---

## Issue 3: Pop-Out Sheet Shows Empty Table

### Root Cause
The `useVirtualizer` hook in `DonorListSheet.tsx` initializes with `getScrollElement: () => parentRef.current`, but when the Sheet first mounts, `parentRef.current` is `null`. The virtualizer calculates zero items to render.

### Solution
Use a callback ref pattern to detect when the scroll container mounts, and only enable the virtualizer after the container is ready.

### Technical Changes

**File: `src/components/client/DonorListSheet.tsx`**

```typescript
import React, { useState, useMemo, useCallback, useEffect } from "react";

export function DonorListSheet({ open, onOpenChange, donors, totalCount }: DonorListSheetProps) {
  // ... existing state
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Callback ref to detect when scroll container mounts
  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    parentRef.current = node;
    if (node) {
      setIsReady(true);
    }
  }, []);

  // Reset ready state when sheet closes
  useEffect(() => {
    if (!open) {
      setIsReady(false);
    }
  }, [open]);

  const rowVirtualizer = useVirtualizer({
    count: sortedDonors.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 15,
    enabled: isReady,  // Only enable when container is ready
  });

  // In JSX, use the callback ref:
  <div
    ref={setScrollRef}  // Changed from ref={parentRef}
    className="flex-1 overflow-auto ..."
  >
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/client/DonorSegmentResults.tsx` | Add `isValidPhone` helper, update phone sorting logic |
| `src/components/client/DonorListSheet.tsx` | Add `isValidPhone` helper, update phone sorting, add callback ref pattern for virtualizer |
| `src/types/donorSegment.ts` | Add phone field to `SEGMENT_FILTER_FIELDS` |

---

## Expected Outcomes

After implementation:
1. **Phone sorting works correctly** - Valid phone numbers sort first; invalid entries (dashes, periods) treated as empty and pushed to end
2. **Filter by phone** - Users can add a filter in the segment builder to show only donors with phone numbers
3. **Pop-out sheet displays data** - Opening the expanded view shows all 32,417+ donors correctly virtualized
