

# Hide Creative Intelligence V2 from Organization Members

## Current Behavior
- The **Creative Intelligence V2** page already uses `ProductionGate` to show a "Coming Soon" message to non-admin users
- However, the **sidebar navigation** still displays "Creative V2 (Test)" to ALL users, which is confusing since clicking it leads to a placeholder

## Goal
Completely hide the Creative Intelligence V2 page from organization members (non-admins) until it's fully operational:
1. Remove the navigation link from the sidebar for non-admins
2. Optionally add route-level protection to redirect non-admins who navigate directly

## Implementation Approach

### Step 1: Add Admin Check to AppSidebar

Modify `src/components/client/AppSidebar.tsx` to conditionally include the "Creative V2 (Test)" item only for admins.

**Changes:**
- Import the `useIsAdmin` hook
- Filter out admin-only items from the navigation sections

```text
Location: src/components/client/AppSidebar.tsx

1. Add import:
   import { useIsAdmin } from "@/hooks/useIsAdmin";

2. Inside AppSidebar component, call the hook:
   const { isAdmin } = useIsAdmin();

3. Modify the "Creative Intelligence" section (lines 123-129):
   - Add an `adminOnly: true` property to the Creative V2 item
   - Filter items based on admin status before rendering
```

### Step 2: Add Route Protection (Optional but Recommended)

While `ProductionGate` already shows a "Coming Soon" message, for a cleaner UX we could redirect non-admins who directly navigate to the URL.

**Option A - Keep Current Behavior (Recommended):**
- Non-admins who somehow access `/client/creative-intelligence-v2` see a polished "Coming Soon" message
- This is already working via `ProductionGate`

**Option B - Redirect Non-Admins:**
- Add route-level protection that redirects to the main Creative Intelligence page
- Requires a new wrapper component

I recommend **Option A** since it's already implemented and provides a better UX than a redirect.

## Technical Details

### File Changes

**`src/components/client/AppSidebar.tsx`**

```typescript
// Add to imports (line ~3)
import { useIsAdmin } from "@/hooks/useIsAdmin";

// Add inside component (after line 45)
const { isAdmin } = useIsAdmin();

// Modify the Creative Intelligence section (lines 123-129)
{
  label: "Creative Intelligence",
  items: [
    { title: "Creative Analysis", url: "/client/creative-intelligence", icon: Sparkles },
    // Only show V2 to admins
    ...(isAdmin 
      ? [{ title: "Creative V2 (Test)", url: "/client/creative-intelligence-v2", icon: FlaskConical }]
      : []),
    { title: "Ad Performance", url: "/client/ad-performance", icon: Target },
    { title: "A/B Test Analytics", url: "/client/ab-tests", icon: FlaskConical },
  ],
},
```

## Expected Outcome

| User Type | Sidebar Shows | Direct URL Access |
|-----------|--------------|-------------------|
| System Admin | "Creative V2 (Test)" link visible | Full page access |
| Org Member | Link NOT visible | "Coming Soon" placeholder |

## Future Considerations

When the V2 page is ready for production:
1. Remove the `isAdmin` conditional from AppSidebar
2. Remove the `ProductionGate` wrapper from the page
3. Optionally replace the V1 page with V2

