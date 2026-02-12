

# Filter ROI/ROAS to Fundraising Campaigns Only

## Problem

Currently, all Meta ad spend is included in ROI and ROAS calculations, regardless of campaign objective. Awareness campaigns (e.g., `OUTCOME_AWARENESS`) are not designed to generate donations, so including their spend deflates ROI numbers and misrepresents fundraising performance. For example, Wesam Shahed's account has both a `OUTCOME_AWARENESS` GOTV campaign and a `OUTCOME_SALES` fundraising campaign, but both are lumped together.

## Solution

Join `meta_ad_metrics` with `meta_campaigns` on `campaign_id` and filter to only fundraising objectives when calculating ROI and ROAS. Non-fundraising spend will still be visible in total spend breakdowns but will be excluded from the ROI denominator.

### Fundraising Objectives (included in ROI)
- `OUTCOME_SALES` (current standard for purchase/donation campaigns)
- `CONVERSIONS` (legacy equivalent)

### Non-Fundraising Objectives (excluded from ROI)
- `OUTCOME_AWARENESS`, `AWARENESS`, `REACH`
- `OUTCOME_ENGAGEMENT`, `POST_ENGAGEMENT`
- `OUTCOME_TRAFFIC`, `LINK_CLICKS`

## Changes

### 1. Database: Update `get_dashboard_sparkline_data` RPC

The `daily_meta_spend` CTE currently sums ALL spend from `meta_ad_metrics`. Update it to JOIN with `meta_campaigns` and filter to fundraising objectives only.

```sql
daily_meta_spend AS (
  SELECT m.date as day, SUM(m.spend) as meta_spend
  FROM meta_ad_metrics m
  JOIN meta_campaigns mc ON m.campaign_id = mc.campaign_id 
    AND m.organization_id = mc.organization_id
  WHERE m.organization_id = p_organization_id
    AND m.date BETWEEN p_start_date AND p_end_date
    AND mc.objective IN ('OUTCOME_SALES', 'CONVERSIONS')
  GROUP BY m.date
)
```

### 2. Frontend: Update `useDashboardMetricsV2.ts` - `fetchChannelSpend`

The Meta query fetches from `meta_ad_metrics_daily` without filtering by objective. Update to JOIN with `meta_campaigns` and filter. Since `meta_ad_metrics_daily` may not easily join in a Supabase `.from()` call, we have two options:

**Option A (preferred):** Create a database view `meta_fundraising_metrics_daily` that pre-joins and filters, then query from that view.

**Option B:** Use an RPC function to return filtered spend data.

I recommend **Option A** -- a view keeps the frontend code simple and the filtering logic in one place.

### 3. Database: Create `meta_fundraising_metrics_daily` view

```sql
CREATE VIEW meta_fundraising_metrics_daily AS
SELECT m.*
FROM meta_ad_metrics_daily m
JOIN meta_campaigns mc ON m.campaign_id = mc.campaign_id 
  AND m.organization_id = mc.organization_id
WHERE mc.objective IN ('OUTCOME_SALES', 'CONVERSIONS');
```

Then update `fetchChannelSpend` to query from `meta_fundraising_metrics_daily` instead of `meta_ad_metrics_daily` for the ROI-relevant spend fields.

### 4. Frontend: Update `useChannelSummaries.tsx`

The Meta section queries `meta_ad_metrics` for total spend/ROAS. Update to JOIN-filter or use the new view so ROAS only reflects fundraising campaigns.

### 5. Frontend: Update `useDashboardKPIsQuery.ts` (legacy)

Though deprecated, it still queries `meta_ad_metrics` for spend. Update to use the filtered view.

### 6. UI: Show both total and fundraising spend

Add a small annotation or tooltip in the Meta spend KPI card indicating the split:
- "Fundraising Spend: $X" (used for ROI)
- "Awareness Spend: $Y" (excluded from ROI)

This gives transparency without hiding data.

## Files to Create/Modify

| File | Action |
|------|--------|
| New migration SQL | Create `meta_fundraising_metrics_daily` view + update `get_dashboard_sparkline_data` RPC |
| `src/hooks/useDashboardMetricsV2.ts` | Query from filtered view for ROI spend |
| `src/hooks/useChannelSummaries.tsx` | Filter Meta spend for ROAS calculation |
| `src/queries/useDashboardKPIsQuery.ts` | Filter Meta spend (legacy) |
| `src/components/dashboard/` (KPI display) | Add fundraising vs awareness spend annotation |

## Technical Details

### View vs. Materialized View
A regular view is sufficient here since the underlying tables are not huge and the JOIN is indexed on `campaign_id`. No need for materialized view complexity.

### RLS on Views
The view inherits RLS from the underlying tables, so no additional policy changes are needed.

### Edge Cases
- Campaigns without a matching `meta_campaigns` row (orphaned metrics): These will be excluded from the view. A LEFT JOIN variant could be used if we want to default-include unknown campaigns, but excluding is safer since it forces proper campaign syncing.
- New objective types added by Meta in the future: Only `OUTCOME_SALES` and `CONVERSIONS` are included, so new objectives default to excluded (safe default for ROI accuracy).
