

# Donor Universe — Admin Dashboard Tab

## Overview

Build an admin-only "Donor Universe" tab that aggregates all ~47k donors across 8 organizations into a single filterable, exportable view with channel attribution and AI-analyzed motivation data.

## What You'll Get

- **Unified donor table** with all available fields (name, email, phone, address, employer, occupation, voter data, donation history)
- **Channel attribution** column showing how each donor was acquired (SMS, Meta Ads, Organic, Email) using the existing multi-tier detection logic
- **Motivation intelligence** — for SMS-sourced donors: topics, pain points, emotional triggers from `sms_creative_insights`; for Meta-sourced donors: same from `meta_creative_insights`
- **Cross-org detection** using email + name + zip fuzzy matching, with a badge showing which orgs each donor has donated to
- **Rich filtering** by: Organization, Channel (SMS/Meta/Organic), State, Amount range, Recurring status, Crossover-only toggle, Search (name/email)
- **CSV export** of any filtered view

## Technical Plan

### Phase 1: Database — `get_donor_universe` RPC

A single `SECURITY DEFINER` function that:

1. Joins `donor_demographics` → `actblue_transactions` → `refcode_mappings` to determine channel per transaction
2. Left-joins `sms_creative_insights` (via refcode pattern matching on `refcode_mappings`) and `meta_creative_insights` (via `ad_id`/`creative_id` on `refcode_mappings`) to pull motivation data
3. Computes a `donor_identity_key` = `lower(trim(email))` as primary match, with `lower(trim(first_name)) || lower(trim(last_name)) || left(zip,5)` as secondary — groups donors appearing across multiple orgs
4. Aggregates per unified donor: `all_orgs` array, `crossover_count`, `channels` array, `top_motivations` (aggregated pain points/topics/triggers across their transactions)
5. Supports server-side pagination and all filter parameters
6. Guarded by `has_role(auth.uid(), 'admin')` check — returns empty for non-admins

Channel detection logic (matching existing waterfall):
```text
Priority 0: refcode_mappings.platform (if mapped)
Priority 1: refcode2 starts with 'fb_' → 'meta'
Priority 2: contribution_form ILIKE '%sms%' → 'sms'
Priority 3: refcode prefix 'text-' or 'sms-' → 'sms'
Priority 4: refcode prefix 'ads_' or 'fb-' → 'meta'
Priority 5: Otherwise → 'organic'
```

### Phase 2: Frontend Components

**New files:**

| File | Purpose |
|------|---------|
| `src/components/admin/DonorUniverse.tsx` | Main tab component — filter bar + paginated table + export button |
| `src/components/admin/DonorUniverseDetail.tsx` | Expandable row detail — all donor fields, org list, motivation breakdown, transaction history |

- Uses V3/portal design system (consistent with existing admin tabs)
- Server-side pagination (100 per page) with `@tanstack/react-virtual` for smooth scrolling
- Expandable rows showing full donor detail + motivation attribution
- Crossover donors get a badge with org count
- Channel shown as colored pills (SMS=green, Meta=blue, Organic=gray)
- "Export Filtered" button using existing `exportToCSV` utility

**Modified files:**

| File | Change |
|------|--------|
| `src/components/AdminSidebar.tsx` | Add "Donor Universe" item under Clients group with `Users` icon, `requiredRole: 'admin'` |
| `src/pages/Admin.tsx` | Add `donor-universe` case in `renderContent()`, import `DonorUniverse` component |

### Phase 3: SMS Campaign ID Backfill (deferred optimization)

The initial implementation will use refcode pattern matching to link transactions → SMS insights (which works for the majority of campaigns). A future backfill can populate `refcode_mappings.sms_campaign_id` for even tighter joins, but is not a blocker.

## Security

- RPC uses `SECURITY DEFINER` + `has_role()` admin check — no RLS bypass risk
- PII fully visible to admins (consistent with existing `actblue_pii` policy)
- Navigation item has `requiredRole: 'admin'`

