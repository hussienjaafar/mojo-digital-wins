
# Add Organization Management Feature to Admin Panel

## Overview

Create a comprehensive organization detail/edit page that allows admins to manage all organization information that was initially collected through the onboarding wizard. This will be accessible via clicking on an organization row in the `ClientOrganizationManager` or through a direct URL.

## Implementation Approach

### New Files to Create

#### 1. Organization Detail Page
**File: `src/pages/admin/OrganizationDetail.tsx`**

A tabbed interface for managing all organization data:

| Tab | Content |
|-----|---------|
| **Details** | Name, slug, logo URL, primary contact email, website URL, timezone |
| **Profile** | Organization type, geo level, mission statement, focus areas, policy domains |
| **Settings** | MFA requirements, seat limits, concurrent session limits |
| **Activity** | Onboarding progress, user count, integration status (read-only) |

#### 2. Reusable Edit Forms
**File: `src/components/admin/organization/OrganizationDetailsForm.tsx`**

Editable form for `client_organizations` table fields:
- Organization name (with slug auto-generation option)
- Slug (with availability checker - reuse logic from Step1CreateOrg)
- Primary contact email
- Logo URL (with preview)
- Website URL
- Timezone selector

**File: `src/components/admin/organization/OrganizationProfileForm.tsx`**

Editable form for `organization_profiles` table fields:
- Organization type dropdown (reuse ORG_TYPE_OPTIONS from Step2)
- Geographic level and locations (reuse GeoLocationPicker)
- Mission statement
- Focus areas (tag-based selection)
- Policy domains (checkbox selection)
- Sensitivity and risk tolerance settings

**File: `src/components/admin/organization/OrganizationSettingsForm.tsx`**

Administrative settings form:
- MFA required toggle
- MFA grace period days
- Seat limit management
- Max concurrent sessions

### Modifications to Existing Files

#### 1. Add Route
**File: `src/App.tsx`**

Add new route for organization detail page:
```typescript
<Route path="/admin/organizations/:organizationId" element={<OrganizationDetail />} />
```

#### 2. Add Edit Action to Organization List
**File: `src/components/admin/ClientOrganizationManager.tsx`**

- Add "Edit" menu item in the actions dropdown
- Make organization name/row clickable to navigate to detail page
- Add pencil icon for quick edit access

### Data Flow

```text
                                   ┌─────────────────────────────────┐
                                   │     OrganizationDetail Page     │
                                   │   /admin/organizations/:id      │
                                   └─────────────────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
    ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
    │  OrganizationDetails  │  │  OrganizationProfile  │  │ OrganizationSettings  │
    │        Form           │  │        Form           │  │        Form           │
    └───────────────────────┘  └───────────────────────┘  └───────────────────────┘
              │                          │                          │
              ▼                          ▼                          ▼
    ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
    │  client_organizations │  │ organization_profiles │  │  client_organizations │
    │       (update)        │  │       (upsert)        │  │       (update)        │
    └───────────────────────┘  └───────────────────────┘  └───────────────────────┘
```

### Shared Components Reuse

Extract and reuse these from onboarding:
- Slug availability checker logic from `Step1CreateOrg`
- Organization type options from `Step2OrgProfile`
- Geo level options from `Step2OrgProfile`
- Focus area/policy domain tag pickers
- `GeoLocationPicker` component

### UI Design

Match the existing admin panel design system:
- Use `AdminPageHeader` for consistent header
- Use `Card`, `CardHeader`, `CardContent` for sections
- Use `V3Button` for actions
- Use portal-themed colors and styling
- Add breadcrumb navigation back to organization list

### Form Validation

- Slug uniqueness check (exclude current org)
- Email format validation
- URL format validation (website, logo)
- Required field validation (name, slug)

## Files Summary

| Action | File Path |
|--------|-----------|
| Create | `src/pages/admin/OrganizationDetail.tsx` |
| Create | `src/components/admin/organization/OrganizationDetailsForm.tsx` |
| Create | `src/components/admin/organization/OrganizationProfileForm.tsx` |
| Create | `src/components/admin/organization/OrganizationSettingsForm.tsx` |
| Create | `src/components/admin/organization/index.ts` (barrel export) |
| Modify | `src/App.tsx` (add route) |
| Modify | `src/components/admin/ClientOrganizationManager.tsx` (add edit links) |

## Expected Outcome

- Admins can click any organization row to view/edit all details
- All onboarding data can be modified after initial setup
- Changes are saved immediately with success/error feedback
- Consistent UI with existing admin panel design
- Breadcrumb navigation for easy return to organization list
