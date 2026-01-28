

# Redesign Organization Management Page with V3 Aesthetic and Member Management

## Overview

Redesign the `OrganizationDetail` page to match the clean, modern aesthetic of the client dashboard (V3 design system) and add a new "Members" tab to manage organization members directly from this page.

## Current State Analysis

The current `OrganizationDetail.tsx` uses:
- `AdminPageHeader` for the header (good)
- Standard shadcn `Card` and `Tabs` components (outdated styling)
- Portal-themed CSS variables (partially aligned)

The client dashboard uses:
- V3 design system components (`V3Card`, `V3SectionHeader`, motion animations)
- Gradient accents and premium visual treatments
- Clean spacing with CSS custom properties (`--portal-space-md`, etc.)
- Collapsible sections with smooth animations

## Design Changes

### Visual Redesign

| Current | New V3 Style |
|---------|--------------|
| Basic shadcn Card | V3Card with accent borders |
| Plain tabs | Styled tabs with icons and badges |
| Static layout | Animated sections with framer-motion |
| Dense spacing | Portal spacing tokens |

### New Members Tab

Add a dedicated "Members" tab that allows managing organization members without leaving the organization page. This tab will include:
- Member list with email, role, MFA status, last login
- Invite member functionality
- Role management (change role dropdown)
- Remove member action
- Pending invitations sub-section
- Seat usage display

## Implementation Plan

### 1. Create OrganizationMembersPanel Component

**New File: `src/components/admin/organization/OrganizationMembersPanel.tsx`**

A self-contained component that manages members for a specific organization:

```typescript
interface OrganizationMembersPanelProps {
  organizationId: string;
  organizationName: string;
}
```

Features:
- Uses `get_user_management_data` RPC with `p_org_id` locked to the organization
- Displays member list in V3Card styling
- Inline role editing via dropdown
- Quick actions: View details, Remove member
- Invite button that opens `InviteUserDialog`
- Shows pending invitations count as badge
- Integrates `SeatUsageDisplay` component at the top

### 2. Redesign OrganizationDetail Page

**File: `src/pages/admin/OrganizationDetail.tsx`**

#### Header Improvements
- Add organization logo display in header if available
- Add status badge (active/inactive) with better styling
- Add quick stats row (members count, integrations, onboarding status)

#### Tab Redesign
- Use V3Card for tab content containers
- Add "Members" tab between "Settings" and "Activity"
- Add badges showing counts on tabs (e.g., member count, pending invites)
- Animate tab content transitions with framer-motion

#### Updated Tab Structure
```text
[Details] [Profile] [Settings] [Members] [Activity]
     ^          ^         ^         ^          ^
     |          |         |         |          |
  Org info   Mission   Security  Team mgmt  Onboarding
```

### 3. V3 Styling Updates for Forms

**Files to Update:**
- `OrganizationDetailsForm.tsx`
- `OrganizationProfileForm.tsx`
- `OrganizationSettingsForm.tsx`

Changes:
- Replace `Card` with `V3Card` with appropriate accent colors
- Use `V3SectionHeader` for section titles within forms
- Add subtle hover/focus states matching portal theme
- Improve form grid layout for better visual hierarchy

### 4. Activity Tab Enhancement

Redesign the Activity tab content to use V3 components:
- Use V3Card with stats inside
- Add KPI-style metrics cards for onboarding, users, integrations
- Include a timeline of recent organization activity (if data available)

## Technical Implementation Details

### OrganizationMembersPanel Component Structure

```text
┌─────────────────────────────────────────────────────────────┐
│ SeatUsageDisplay (seats used / total)                       │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Members Header                           [Invite Member]│ │
│ │ Search input                                            │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Member Row: Avatar | Name | Email | Role | Last Login   │ │
│ │ Member Row: Avatar | Name | Email | Role | Last Login   │ │
│ │ Member Row: Avatar | Name | Email | Role | Last Login   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Pending Invitations (2)                                 │ │
│ │ - invite@example.com (Expires in 3 days) [Revoke]       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Fetching Strategy

The members panel will:
1. Call `get_user_management_data` RPC with `p_org_id` set to the current organization
2. Fetch pending invitations filtered by `organization_id`
3. Use `SeatUsageDisplay` which already handles its own data fetching

### Reusable Components

From existing codebase:
- `SeatUsageDisplay` - for seat allocation display
- `InviteUserDialog` - for inviting new members (will pass org pre-selected)
- `UserDetailSidebar` - for viewing member details
- V3 components: `V3Card`, `V3Button`, `V3Badge`, `V3SectionHeader`

## Files Summary

| Action | File Path |
|--------|-----------|
| **Create** | `src/components/admin/organization/OrganizationMembersPanel.tsx` |
| **Update** | `src/components/admin/organization/index.ts` (add export) |
| **Update** | `src/pages/admin/OrganizationDetail.tsx` (redesign + add Members tab) |
| **Update** | `src/components/admin/organization/OrganizationDetailsForm.tsx` (V3 styling) |
| **Update** | `src/components/admin/organization/OrganizationProfileForm.tsx` (V3 styling) |
| **Update** | `src/components/admin/organization/OrganizationSettingsForm.tsx` (V3 styling) |

## Expected Outcome

1. Organization management page has a premium, cohesive look matching the client dashboard
2. Admins can manage organization members without navigating away
3. Clean visual hierarchy with V3 design tokens
4. Smooth animations for tab transitions
5. Consistent use of accent colors and gradients
6. Mobile-responsive layout

