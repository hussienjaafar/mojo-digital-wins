
# Fix Donor Intelligence Page Organization Context Issue

## Problem

The Donor Intelligence page has the same organization synchronization issue that was affecting the Demographics page. When switching organizations, the page displays stale data because:

1. The `DonorSegmentBuilder` component maintains internal state (`pendingFilters`, `appliedFilters`, `selectedSavedSegment`, `viewMode`) that is not reset when the `organizationId` prop changes
2. The parent `ClientDonorIntelligence` page does not reset its local state (`activeTab`) when the organization changes
3. React Query caches may still hold data from the previous organization until the new queries complete

The fix implemented for Demographics (custom event dispatch + state reset on org change) already provides the infrastructure. We just need to apply the same state-reset pattern to the Donor Intelligence components.

---

## Solution

Apply the same pattern used for Demographics: add `useEffect` hooks that reset all local state when `organizationId` changes.

---

## Technical Changes

### File 1: `src/pages/ClientDonorIntelligence.tsx`

Add a `useEffect` to reset page-level state when organization changes:

```typescript
import { useState, useEffect } from "react";  // Add useEffect import

// Inside the component, after state declarations:

// Reset state when organization changes to prevent showing stale data
useEffect(() => {
  setActiveTab("builder");
  setIsRunningJourneys(false);
  setIsRunningLtv(false);
}, [organizationId]);
```

### File 2: `src/components/client/DonorSegmentBuilder.tsx`

Add a `useEffect` to reset all filter and selection state when `organizationId` changes:

```typescript
import React, { useState, useCallback, useMemo, useEffect } from "react";  // Add useEffect

// Inside the component, after state declarations:

// Reset all state when organization changes to prevent stale data
useEffect(() => {
  setPendingFilters([]);
  setAppliedFilters([]);
  setViewMode('aggregate');
  setIsSaveDialogOpen(false);
  setSelectedSavedSegment(null);
}, [organizationId]);
```

This ensures that when an admin switches from "Michael Blake" to "Abdul for Senate", the segment builder:
- Clears all pending and applied filters
- Resets to aggregate view
- Closes any open dialogs
- Clears saved segment selection

The React Query hooks (`useDonorSegmentQuery`, `useSavedSegmentsQuery`) will automatically refetch with the new `organizationId` since it's part of their query keys.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/ClientDonorIntelligence.tsx` | Add `useEffect` to reset `activeTab` and pipeline states on org change |
| `src/components/client/DonorSegmentBuilder.tsx` | Add `useEffect` to reset filters, view mode, and selections on org change |

---

## Why This Works

The `useClientOrganization` hook (already fixed in the previous update) now properly listens for the `organizationChanged` custom event and updates its `organizationId` state immediately. This triggers:

1. The parent page (`ClientDonorIntelligence`) re-renders with the new `organizationId`
2. The new `useEffect` in the page resets the tab state
3. The `DonorSegmentBuilder` receives the new `organizationId` as a prop
4. The new `useEffect` in `DonorSegmentBuilder` resets all filters and selections
5. React Query detects the changed `organizationId` in query keys and refetches fresh data

---

## Expected Outcome

After this fix:
- Switching from "Michael Blake" to "Abdul for Senate" will immediately clear the filter panel
- The segment builder will start fresh with no applied filters
- Data will reload for the correct organization
- No stale data from the previous organization will be visible
