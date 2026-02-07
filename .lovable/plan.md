

# Deep Audit: Organization Selection in Ad Copy Studio

## Current State

The Ad Copy Studio (`AdminAdCopyStudio.tsx`) fetches ALL active organizations on mount using a flat query (`SELECT id, name FROM client_organizations WHERE is_active = true ORDER BY name`). Currently 12 orgs exist, but the system needs to scale to hundreds.

The org picker is a basic Radix `<Select>` dropdown embedded in the wizard header (lines 771-793 of `AdCopyWizard.tsx`). It renders every org as a `<SelectItem>` in a flat list with no search, no grouping, no logos, and no recent-org tracking.

Meanwhile, the client portal already has a sophisticated `OrganizationPicker` component (`src/components/client/OrganizationPicker.tsx`) that uses a `CommandDialog` with:
- Full-text search
- Recent orgs (localStorage-backed)
- Org logos/initials
- Keyboard navigation hints
- Scales to any number of orgs

This component is NOT used in the Ad Copy Studio -- the wizard rolls its own basic `<Select>`.

---

## Recommendation: Keep It In the Existing Page, Replace the Picker

Moving Ad Copy Studio into the Organization Detail page (`/admin/organizations/:orgId`) would eliminate the need for an org picker entirely (you'd navigate to an org first, then launch the studio). However, this creates friction: users would need to navigate away from the studio, find the org, go into its detail page, and then find an "Ad Copy Studio" tab. It also makes the studio feel like a subordinate feature rather than a standalone tool.

The better approach is to **keep the studio as a standalone page** but replace the basic `<Select>` with the existing `OrganizationPicker` component (or an adapted version of it), and add persistent org context so the user always knows which org they're working with.

---

## Issues Found

### Issue 1: CRITICAL -- Basic Select Dropdown Won't Scale Past ~20 Orgs

The current `<Select>` renders all orgs in a flat scrollable list. At 100+ orgs, this becomes unusable -- no search, no way to quickly find an org. The `OrganizationPicker` component already solves this with search + recents but isn't used here.

**Fix:** Replace the `<Select>` in `AdCopyWizard.tsx` header with a button that opens the existing `OrganizationPicker` (or a dark-themed variant). Pass `organizations` with `logo_url` included (currently only `id` and `name` are fetched).

### Issue 2: HIGH -- No Logo or Visual Identifier for Selected Org

The header shows `Creating ads for <org name>` in small text, but with hundreds of similarly-named orgs (e.g., "Smith for Senate", "Smith for Congress"), names alone are insufficient. Logos provide instant visual confirmation.

**Fix:** Fetch `logo_url` alongside `id, name` in `AdminAdCopyStudio.tsx`. Display the org logo (or initials fallback) next to the org name in the header.

### Issue 3: HIGH -- No Recent/Pinned Orgs for Power Users

Admins managing hundreds of orgs will repeatedly work with a small subset. The `OrganizationPicker` already has localStorage-backed "Recent" tracking, but the current `<Select>` has none.

**Fix:** Solved automatically by adopting the `OrganizationPicker` component.

### Issue 4: MEDIUM -- Org Data Fetch Loads All Orgs Without Pagination

`AdminAdCopyStudio.tsx` line 65-68 fetches all active orgs in one query. At 500+ orgs, this will hit the Supabase 1000-row default limit and slow page load.

**Fix:** The `OrganizationPicker` already does client-side filtering, which works fine up to ~1000 orgs. For true scale, add server-side search via an RPC function. For now, ensure the query explicitly sets a high limit or uses pagination.

### Issue 5: MEDIUM -- Selected Org Has No Persistent Visual Anchor

Once the user is deep in steps 3-5, the org context is only visible in the sticky header's small subtitle text. If a user scrolls or the header is partially obscured, they lose context.

**Fix:** Add a persistent "org badge" in the step indicator area or as a fixed pill, showing logo + name. This stays visible regardless of scroll position.

### Issue 6: MEDIUM -- Org Switch Doesn't Use the Confirmation Dialog Consistently

The current `handleOrgChange` triggers the `AlertDialog` for session reset, which is correct. But the dialog text is generic ("reset your current session"). It should explicitly say which org you're switching FROM and TO.

**Fix:** Include both org names in the confirmation dialog: "Switch from **Org A** to **Org B**? This will reset your current session."

### Issue 7: LOW -- OrganizationPicker Uses Portal Theme CSS Variables

The existing `OrganizationPicker` uses `hsl(var(--portal-*))` CSS variables which are defined in the client portal theme. The Ad Copy Studio uses hardcoded dark colors (`#0a0f1a`, `#141b2d`, etc.). Dropping `OrganizationPicker` directly into the studio would have mismatched styling.

**Fix:** Create an `AdminOrganizationPicker` wrapper that either (a) provides the portal CSS variables in a scoped container, or (b) adapts the picker to accept a `theme` prop with the admin color tokens.

---

## Implementation Plan

### Step 1: Extend org data to include logo_url

In `AdminAdCopyStudio.tsx`, change the org query from `.select('id, name')` to `.select('id, name, logo_url')` and update the `Organization` interface.

### Step 2: Create AdminOrganizationPicker

Create `src/components/ad-copy-studio/AdminOrganizationPicker.tsx` -- a thin wrapper around the `OrganizationPicker` pattern but styled with the admin dark theme colors instead of portal CSS variables. Features:
- CommandDialog with search input
- Recent orgs section (localStorage)
- Org logos/initials
- Count badge showing total orgs
- Keyboard shortcut (Cmd+K)

### Step 3: Replace Select in wizard header

In `AdCopyWizard.tsx`, replace the `<Select>` dropdown (lines 768-793) with a button showing the current org logo + name that opens the new `AdminOrganizationPicker`. The button should show:
- Org logo (or initials)
- Org name (truncated)
- ChevronDown icon
- Cmd+K hint

### Step 4: Add org context badge to step area

Below the step indicator, add a subtle persistent badge: `[logo] Org Name | X videos | Step Y of 5`. This ensures the user never loses context about which org they're working on.

### Step 5: Improve confirmation dialog with org names

Update the org-switch `AlertDialog` to show: "Switch from **Current Org** to **New Org**? This will reset your current session including uploaded videos and generated copy."

### Step 6: Update AdCopyWizardProps

Update the `organizations` prop type from `Array<{ id: string; name: string }>` to `Array<{ id: string; name: string; logo_url: string | null }>` to pass through logo data.

---

## Technical Details

### Files to Change

| File | Change |
|------|--------|
| `src/pages/AdminAdCopyStudio.tsx` | Add `logo_url` to org query and interface |
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Replace Select with picker button, add org badge, update props type, improve confirmation dialog |
| **New:** `src/components/ad-copy-studio/AdminOrganizationPicker.tsx` | Dark-themed command palette org picker with search, recents, logos |

### Scalability Notes

- Client-side search in the CommandDialog handles up to ~1000 orgs efficiently
- The "Recent" localStorage pattern ensures power users always have quick access to their top 5 orgs
- If orgs exceed 1000, a future enhancement would add server-side search via an RPC function -- but this is not needed now with 12 orgs and is easy to add later

