
# Fix Organization Context Not Updating on Demographics Page

## Problem

When viewing the demographics page for "Abdul for Senate", data for "Michael Blake For Congress" is displayed instead. The cached data is correct for both organizations, but the wrong organization ID is being passed to the RPC.

## Root Cause

The `useClientOrganization` hook has a race condition and synchronization issue with the impersonation context:

1. When an admin switches organizations via the selector, `handleOrganizationChange` calls:
   ```typescript
   setImpersonation(session?.user?.id || '', 'System Admin', newOrg.id, newOrg.name);
   ```

2. But `isImpersonating` in the context is based on `impersonatedUserId !== null`

3. If the session user ID is an empty string (fallback case), `impersonatedUserId` becomes `''` which is NOT null, so `isImpersonating` becomes `true`

4. However, the `useClientOrganization` hook has a dependency array issue - it only re-runs when `impersonatedOrgId` or `isImpersonating` changes, but if these values are set in the wrong order or the effect doesn't re-run, stale data is used

5. Additionally, the localStorage listener only fires for cross-tab changes (not same-tab changes)

## Solution

### 1. Fix the useClientOrganization hook to handle same-tab localStorage updates

Add a custom event listener for same-tab organization changes and ensure the hook re-runs when the organization changes.

### 2. Ensure the impersonation context properly syncs

Update the dependency handling so the hook responds to organization changes immediately.

### 3. Add debugging to verify the correct org ID is being used

Add console logging (temporarily) and display the current organization in the UI header for clarity.

---

## Technical Changes

### File 1: `src/hooks/useClientOrganization.tsx`

**Changes:**
- Add a custom event dispatcher pattern for same-tab updates
- Add `organizationId` state reset when dependencies change
- Improve effect dependency handling

```typescript
// Add custom event listener for same-tab changes
useEffect(() => {
  const handleOrgChange = () => {
    const newOrgId = localStorage.getItem('selectedOrganizationId');
    if (newOrgId && newOrgId !== organizationId) {
      setOrganizationId(newOrgId);
    }
  };
  
  // Listen for custom event (same-tab) and storage event (cross-tab)
  window.addEventListener('organizationChanged', handleOrgChange);
  window.addEventListener('storage', handleStorageChange);
  
  return () => {
    window.removeEventListener('organizationChanged', handleOrgChange);
    window.removeEventListener('storage', handleStorageChange);
  };
}, [organizationId]);
```

### File 2: `src/components/client/ClientShell.tsx`

**Changes:**
- Dispatch a custom event when organization changes (for same-tab updates)

```typescript
const handleOrganizationChange = (newOrgId: string) => {
  const newOrg = organizations.find((org) => org.id === newOrgId);
  if (newOrg) {
    setOrganization(newOrg);
    localStorage.setItem("selectedOrganizationId", newOrgId);
    
    // Dispatch custom event for same-tab listeners
    window.dispatchEvent(new CustomEvent('organizationChanged', { detail: newOrgId }));
    
    // Also sync to impersonation context
    if (isAdmin) {
      setImpersonation(session?.user?.id || '', 'System Admin', newOrg.id, newOrg.name);
    }
    // ...
  }
};
```

### File 3: `src/pages/ClientDemographics.tsx`

**Changes:**
- Add a useEffect to reset state when organizationId changes
- Clear cached data when switching organizations

```typescript
// Reset state when organization changes
useEffect(() => {
  setSummary(null);
  setCacheStatus(null);
  setCalculatedAt(null);
  setCityCache(new Map());
  setSelectedState(null);
}, [organizationId]);
```

---

## Alternative Quick Fix

If you need an immediate workaround before the code changes:

1. **Clear localStorage**: Open browser dev tools, go to Application > Local Storage, and delete the `selectedOrganizationId` entry
2. **Re-select Abdul For Senate**: Use the organization switcher (⌘K) to select Abdul For Senate again
3. **Refresh the page**: Force a fresh load of the demographics page

---

## Testing Plan

1. Switch to Abdul For Senate using the organization selector
2. Navigate to the demographics page
3. Verify the Total Revenue shows ~$4.6M (not $215K)
4. Switch to Michael Blake For Congress
5. Verify the demographics update to show ~$215K
6. Switch back to Abdul For Senate
7. Verify the data updates correctly without needing a page refresh

---

## Files to Modify

| File | Change Type |
|------|-------------|
| `src/hooks/useClientOrganization.tsx` | Add custom event listener for same-tab org changes |
| `src/components/client/ClientShell.tsx` | Dispatch custom event when org changes |
| `src/pages/ClientDemographics.tsx` | Reset state when organizationId changes |
