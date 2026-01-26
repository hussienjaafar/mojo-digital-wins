
# Fix Dashboard Metrics: MRR Sparkline, Direct Donations, and Meta Ads Section

## Problem Summary

| Issue | Root Cause | Fix Required |
|-------|------------|--------------|
| **Current Active MRR Sparkline** | Shows daily recurring revenue raised, not cumulative MRR | Add `dailyActiveMrr` to RPC function calculating running total |
| **Direct Donations shows 73,215.1** | Uses `c.raised` (revenue) instead of `c.donations` (count) | Change to sum donations count |
| **Campaign Health shows 0 impressions/clicks** | `fetchChannelSpend` doesn't fetch these; hardcoded to 0 | Add impressions/clicks to channel spend fetch |
| **Section naming** | Currently "Campaign Health" | Rename to "Meta Ads Performance Overview" |

---

## Part 1: Fix Direct Donations Attribution Bug

### Current Code (Bug)
```typescript
// src/hooks/useDashboardMetricsV2.ts lines 250-253
const directDonations = channelBreakdown
  .filter((c) => c.channel === 'other' || c.channel === 'unattributed')
  .reduce((sum, c) => sum + c.raised, 0); // BUG: Uses revenue
```

### Fix
Change `c.raised` to `c.donations`:
```typescript
const directDonations = channelBreakdown
  .filter((c) => c.channel === 'other' || c.channel === 'unattributed')
  .reduce((sum, c) => sum + c.donations, 0); // FIXED: Uses donation count
```

---

## Part 2: Add Meta Impressions and Clicks

### Update `fetchChannelSpend` to Include Impressions/Clicks

Modify the meta query to also fetch impressions and clicks:

```typescript
const metaQuery = supabase
  .from('meta_ad_metrics')
  .select('date, spend, conversions, impressions, clicks')  // Add impressions, clicks
  .eq('organization_id', organizationId)
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date');
```

Add aggregation and return fields:

```typescript
// Aggregate Meta impressions and clicks
const metaImpressions = (metaResult.data || []).reduce(
  (sum: number, m: any) => sum + Number(m.impressions || 0),
  0
);
const metaClicks = (metaResult.data || []).reduce(
  (sum: number, m: any) => sum + Number(m.clicks || 0),
  0
);
```

Update the `ChannelSpendData` interface and return object to include these.

### Update KPIs Mapping

Change hardcoded zeros to use actual data:

```typescript
// Before (lines 196-197)
totalImpressions: 0, // Not available from unified yet
totalClicks: 0, // Not available from unified yet

// After
totalImpressions: channelSpend.metaImpressions,
totalClicks: channelSpend.metaClicks,
```

---

## Part 3: Add Cumulative MRR Sparkline

### The Challenge
"Current Active MRR" is a point-in-time metric representing the expected monthly revenue from **currently active** recurring donors. A true cumulative sparkline would need to calculate MRR at each day in the past, which is computationally expensive.

### Solution: Add Daily Cumulative MRR to RPC

Update `get_dashboard_sparkline_data` to include a cumulative MRR calculation:

```sql
-- Calculate cumulative active MRR as of each date in the range
-- This is an approximation: sum of most recent recurring amount per donor who was active at that date
daily_cumulative_mrr AS (
  SELECT 
    d.day,
    COALESCE((
      SELECT SUM(latest_amount) FROM (
        SELECT DISTINCT ON (donor_email) 
          donor_email, amount as latest_amount
        FROM actblue_transactions t
        WHERE t.organization_id = p_organization_id
          AND t.is_recurring = true
          AND t.transaction_type = 'donation'
          AND t.recurring_status = 'active'
          AND DATE(t.transaction_date) <= d.day
        ORDER BY donor_email, transaction_date DESC
      ) active_at_date
    ), 0) as cumulative_mrr
  FROM (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date as day
  ) d
)
```

Add to JSON output:
```sql
'dailyActiveMrr', (
  SELECT COALESCE(json_agg(
    json_build_object('date', day::text, 'value', cumulative_mrr)
    ORDER BY day
  ), '[]'::json)
  FROM daily_cumulative_mrr WHERE cumulative_mrr > 0
),
```

### Update Frontend to Use New Data

Update `useDashboardMetricsV2.ts` to pass `dailyActiveMrr` to sparklines:

```typescript
// In SparklineExtras interface
interface SparklineExtras {
  dailyRoi?: Array<{ date: string; value: number }>;
  dailyNewMrr?: Array<{ date: string; value: number }>;
  dailyActiveMrr?: Array<{ date: string; value: number }>;  // NEW
  newDonors?: number;
  returningDonors?: number;
}

// In legacySparklines mapping
recurringHealth: sparklineExtras?.dailyActiveMrr?.slice(-7) || 
  dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.recurring_amount })),
```

---

## Part 4: Rename "Campaign Health" to "Meta Ads Performance Overview"

### Update ClientDashboardCharts.tsx

Change the section title and description (lines 400-403):

```typescript
// Before
<V3CardTitle>Campaign Health</V3CardTitle>
<p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">Key efficiency metrics</p>

// After
<V3CardTitle>Meta Ads Performance Overview</V3CardTitle>
<p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">Meta ad campaign metrics</p>
```

### Update Metrics Displayed

Remove non-Meta metrics (Recurring %, Upsell Conversion, Total Donations) and focus on Meta-specific data:

| Current Metric | Action |
|----------------|--------|
| Average Donation | Keep (for Meta-attributed) |
| Total Impressions | Keep |
| Total Clicks | Keep |
| Recurring % | Remove (not Meta-specific) |
| Upsell Conversion | Remove (not Meta-specific) |
| Total Donations | Replace with "Meta Conversions" |

Add CTR and CPC calculations:

```typescript
// Calculate CTR and CPC for display
const ctr = kpis.totalImpressions > 0 ? (kpis.totalClicks / kpis.totalImpressions) * 100 : 0;
const cpc = kpis.totalClicks > 0 ? metaSpend / kpis.totalClicks : 0;
```

New section content:
- Total Impressions
- Total Clicks
- CTR (Click-Through Rate)
- CPC (Cost Per Click)
- Meta Conversions (from `metaConversions` prop)
- Avg Donation (Meta-attributed)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useDashboardMetricsV2.ts` | Fix directDonations (use count), add impressions/clicks to ChannelSpendData and KPIs |
| `supabase/migrations/NEW.sql` | Update `get_dashboard_sparkline_data` to include `dailyActiveMrr` |
| `src/components/client/ClientDashboardCharts.tsx` | Rename section, update metrics displayed, add CTR/CPC |

---

## Technical Implementation Details

### 1. ChannelSpendData Interface Update

```typescript
interface ChannelSpendData {
  metaSpend: number;
  smsSpend: number;
  metaConversions: number;
  smsConversions: number;
  metaImpressions: number;  // NEW
  metaClicks: number;       // NEW
  dailyMetaSpend: DailySpendPoint[];
  dailySmsSpend: DailySpendPoint[];
}
```

### 2. Updated transformToLegacyFormat

```typescript
const kpis: DashboardKPIs = {
  // ... existing fields ...
  totalImpressions: channelSpend.metaImpressions,
  totalClicks: channelSpend.metaClicks,
  deterministicRate: 0, // Still not available
};
```

### 3. SQL Migration for Cumulative MRR

The query uses `generate_series` to create all dates in range, then for each date calculates the sum of the most recent recurring donation amount for each donor who was active at that point.

This is an approximation since we don't track MRR changes over time, but it provides a meaningful trend visualization.

---

## Expected Results After Fix

| Metric | Before | After |
|--------|--------|-------|
| Current Active MRR sparkline | Daily recurring raised ($35) | Cumulative MRR (~$1.1K) |
| Direct Donations | 73,215.1 (revenue) | Actual count (e.g., 371) |
| Total Impressions | 0 | Real count from Meta |
| Total Clicks | 0 | Real count from Meta |
| Section title | "Campaign Health" | "Meta Ads Performance Overview" |

---

## Performance Considerations

The cumulative MRR calculation uses a correlated subquery for each date, which could be slow for large date ranges. Two mitigations:

1. **Limit to 7-14 days**: The sparkline only shows the last 7 days anyway
2. **Add index**: Consider adding an index on `(organization_id, is_recurring, recurring_status, transaction_date)` if performance becomes an issue
