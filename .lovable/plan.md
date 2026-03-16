

# Fix Cross-Org Channel Leak in Donor Universe

## Problem

In the `unified` CTE (line 96-99), channels are aggregated across **all** organizations for each donor. When you filter by org + channel (e.g., "Abdul + SMS"), a donor who donated organically to Abdul but received SMS from a different org incorrectly appears in results. This affects 93 donors.

## Root Cause

```sql
-- Line 96-99: channels collected from ALL orgs, not scoped to filtered org
COALESCE(
  array_agg(DISTINCT ch.channel) FILTER (WHERE ch.channel IS NOT NULL),
  ARRAY['organic']::text[]
) AS channels,
```

## Fix

Single change in the `unified` CTE: scope the channel aggregation to only include channels from organizations matching the org filter (when one is applied). When no org filter is active, all channels are included as before.

```sql
COALESCE(
  array_agg(DISTINCT ch.channel) FILTER (
    WHERE ch.channel IS NOT NULL
    AND (_org_filter IS NULL OR db.organization_id = ANY(_org_filter))
  ),
  ARRAY['organic']::text[]
) AS channels,
```

This ensures that when filtering "Abdul + SMS", only channels from Abdul's transactions are considered for each donor.

## Files changed

| File | Change |
|------|--------|
| New migration SQL | `CREATE OR REPLACE FUNCTION get_donor_universe` with the scoped channel aggregation |

No frontend changes needed.

