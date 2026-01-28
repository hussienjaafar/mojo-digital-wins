
# Fix Inline Donor List Table Not Loading After Page Reload

## Problem

After page reload, the donor list table in `DonorSegmentResults.tsx` shows an empty container despite the data being successfully fetched (verified via network requests showing 200 status with donor data).

The screenshot shows:
- KPI cards are visible (as placeholders/loading)
- Table header with "Donor List" title is visible
- Table content area is completely empty

## Root Cause

The inline `TableView` component has the same virtualization race condition that we fixed in `DonorListSheet.tsx`:

```typescript
// Current code in DonorSegmentResults.tsx (lines 466-471)
const rowVirtualizer = useVirtualizer({
  count: sortedDonors.length,
  getScrollElement: () => parentRef.current,  // Returns null on first render!
  estimateSize: () => 52,
  overscan: 10,
});
```

When the component mounts, `parentRef.current` is `null` because the ref hasn't been attached to the DOM element yet. The virtualizer calculates that there are zero items to display because it has no scroll container to measure.

Unlike class components with `componentDidMount`, React refs in function components are set **after** the first render, but `useVirtualizer` runs **during** the first render. This creates a timing mismatch.

## Solution

Apply the same callback ref pattern we used in `DonorListSheet.tsx`:

1. Add an `isReady` state to track when the scroll container is mounted
2. Use a callback ref (`setScrollRef`) to detect when the DOM element is attached
3. Pass `enabled: isReady` to the virtualizer so it only calculates after the container is ready

## Technical Changes

**File: `src/components/client/DonorSegmentResults.tsx`**

Update imports:
```typescript
import React, { useState, useMemo, useCallback, useEffect } from "react";
```

Add state and callback ref inside `TableView`:
```typescript
function TableView({ donors }: { donors: SegmentDonor[] }) {
  const [sortField, setSortField] = useState<SortField>('total_donated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);  // NEW

  // Callback ref to detect when scroll container mounts
  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    parentRef.current = node;
    if (node) {
      setIsReady(true);
    }
  }, []);

  // ... rest of the component
```

Update the virtualizer configuration:
```typescript
const rowVirtualizer = useVirtualizer({
  count: sortedDonors.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 52,
  overscan: 10,
  enabled: isReady,  // Only enable when container is ready
});
```

Update the scroll container to use the callback ref:
```typescript
<div
  ref={setScrollRef}  // Changed from ref={parentRef}
  className="h-[500px] overflow-auto"
>
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/client/DonorSegmentResults.tsx` | Add `useCallback`/`useEffect` imports, `isReady` state, callback ref pattern, and `enabled: isReady` to virtualizer |

## Expected Outcome

After this fix:
- Page reload will correctly display all donor rows
- Virtualization will work correctly after the scroll container mounts
- Sorting and filtering will continue to work as expected
- No visible delay or flicker for users
