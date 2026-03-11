

# Add Topic/Issue Motivation Data to Donor Universe

## Overview

Enrich the Donor Universe with motivation attribution — showing what topics, issues, and pain points drove each donor to give. This joins `actblue_transactions` → `refcode_mappings` → `meta_creative_insights` (and `sms_campaigns`) to aggregate the primary topics and donor motivations per identity.

## Changes

### 1. Update `get_donor_universe` RPC (migration)

Add a new CTE `motivation_data` that joins transactions → refcode_mappings → meta_creative_insights + sms_campaigns to collect per-donor:
- `topics` (text array) — aggregated from `topic` field
- `issues` (text array) — from `issue_specifics` arrays
- `pain_points` (text array) — from `donor_pain_points` arrays  
- `values_appealed` (text array) — from `values_appealed` arrays

```text
CTE flow:
  tx_stats ──────────────┐
  motivation_data ───────┤
  donor_base ────────────┤──→ unified ──→ filtered ──→ result
```

The `motivation_data` CTE:
- Joins `actblue_transactions` → `refcode_mappings` (on refcode + org) → `meta_creative_insights` (on creative_id + org)
- Also unions with `sms_campaigns` matched via refcode
- Aggregates distinct values per `lower(trim(donor_email))`
- Left-joined into `unified` CTE

Output columns added: `topics`, `issues`, `pain_points`, `values_appealed`

### 2. Update `DonorRow` interface in `DonorUniverse.tsx` and `DonorUniverseDetail.tsx`

Add optional array fields:
```ts
topics: string[] | null;
issues: string[] | null;
pain_points: string[] | null;
values_appealed: string[] | null;
```

### 3. Update `DonorUniverseDetail.tsx` — display motivation section

Add a fourth column (or a new row) in the detail panel titled "Motivation & Issues" showing:
- **Topics** — badges for each topic
- **Issues** — badges for each issue
- **Pain Points** — bullet list
- **Values** — badges

Only rendered when at least one array has data. Uses `MessageSquare` and `Heart` icons from lucide-react.

### 4. Update table columns in `DonorUniverse.tsx`

Add a "Top Topic" column to the table showing the first topic as a badge (if available), keeping the table scannable without clutter.

## Files Changed

| File | Change |
|------|--------|
| New migration SQL | `CREATE OR REPLACE FUNCTION get_donor_universe` with motivation CTE |
| `src/components/admin/DonorUniverse.tsx` | Add `topics/issues/pain_points/values_appealed` to `DonorRow`, add "Top Topic" column |
| `src/components/admin/DonorUniverseDetail.tsx` | Add motivation section with topic/issue/pain point badges |

