

# Fix Meta Ads Performance: Use Consistent Attribution Source

## Problem Summary

The "Meta Ads Performance Overview" section shows **different data** depending on whether you're viewing a single day or multiple days:

| Metric | Single-Day View (Today) | Multi-Day View | Issue |
|--------|------------------------|----------------|-------|
| Attributed Revenue | $67 (Meta's data) | $72.01 (Our data) | Different sources |
| Conversions | 5 (Meta's data) | 6 (Our data) | Different sources |
| Attributed ROI | $67 / $107.33 = 0.62x | $72.01 / $107.33 = 0.67x | Wrong ROI |

The single-day view uses `conversion_value` from Meta's API (`meta_ad_metrics_daily` table), while the multi-day view uses our own attribution system via `get_actblue_dashboard_metrics` RPC.

## Root Cause

**Single-Day Hook** (`useSingleDayMetaMetrics.ts`):
- Queries `meta_ad_metrics_daily.conversion_value` directly
- This is Meta's reported conversion value, not our attributed revenue

**Multi-Day Hook** (`useDashboardMetricsV2.ts`):
- Uses `get_actblue_dashboard_metrics` RPC which calculates channel breakdown
- Revenue comes from actual ActBlue donations attributed to Meta via our waterfall

## Solution: Align Single-Day View with Our Attribution System

Update `useSingleDayMetaMetrics` to fetch **our attributed revenue** instead of Meta's `conversion_value`. This requires calling the same RPC used for multi-day views.

---

## Implementation Plan

### Step 1: Update useSingleDayMetaMetrics Hook

Modify the hook to fetch two types of data:

1. **Meta Ads Metrics** (keep as-is): Spend, impressions, link clicks from `meta_ad_metrics_daily`
2. **Our Attribution** (new): Revenue and donation count from `get_actblue_dashboard_metrics` RPC

```text
NEW DATA FLOW:
┌─────────────────────────────────────────────────────────────────┐
│  useSingleDayMetaMetrics                                        │
├─────────────────────────────────────────────────────────────────┤
│  Query 1: meta_ad_metrics_daily                                 │
│    → spend, impressions, link_clicks (for CTR/CPC)              │
│                                                                 │
│  Query 2: get_actblue_dashboard_metrics RPC                     │
│    → channels[].channel === 'meta' → net (our attributed rev)   │
│    → channels[].count (our attributed donations)                │
└─────────────────────────────────────────────────────────────────┘
```

### Step 2: Update the Interface

Update `MetaDayMetrics` interface:

```typescript
interface MetaDayMetrics {
  // From meta_ad_metrics_daily (keep)
  spend: number;
  impressions: number;
  linkClicks: number;
  
  // From Meta API (for reference only - remove from UI)
  metaConversions: number;      // Meta's reported conversions
  metaConversionValue: number;  // Meta's reported revenue
  
  // From our attribution system (NEW - use for display)
  ourAttributedRevenue: number;     // Our calculated revenue
  ourAttributedDonations: number;   // Our calculated donation count
}
```

### Step 3: Fetch Our Attribution Data

Add RPC call to get channel breakdown:

```typescript
async function fetchDayMetaMetrics(
  organizationId: string,
  date: string
): Promise<MetaDayMetrics> {
  // Query 1: Meta ad metrics (existing)
  const metricsQuery = supabase
    .from('meta_ad_metrics_daily')
    .select('spend, impressions, link_clicks, conversions, conversion_value')
    .eq('organization_id', organizationId)
    .eq('date', date);

  // Query 2: Our attribution via RPC
  const attributionQuery = supabase.rpc('get_actblue_dashboard_metrics', {
    p_organization_id: organizationId,
    p_start_date: date,
    p_end_date: date,
    p_campaign_id: null,
    p_creative_id: null,
    p_use_utc: false,
  });

  const [metricsResult, attributionResult] = await Promise.all([
    metricsQuery,
    attributionQuery,
  ]);

  // Aggregate Meta metrics
  const metaMetrics = (metricsResult.data || []).reduce(...);
  
  // Extract Meta channel from our attribution
  const channels = attributionResult.data?.channels || [];
  const metaChannel = channels.find((c: any) => c.channel === 'meta');
  
  return {
    spend: metaMetrics.spend,
    impressions: metaMetrics.impressions,
    linkClicks: metaMetrics.linkClicks,
    metaConversions: metaMetrics.conversions,
    metaConversionValue: metaMetrics.conversionValue,
    ourAttributedRevenue: metaChannel?.revenue || 0,      // NET revenue
    ourAttributedDonations: metaChannel?.count || 0,
  };
}
```

### Step 4: Update TodayViewDashboard Display

Update the metric calculations in `TodayViewDashboard.tsx`:

```typescript
const metaMetrics: SingleDayMetric[] = useMemo(() => {
  if (!metaData) return [];
  
  const { current, previous } = metaData;
  
  // Use OUR attribution for revenue and ROI
  const roi = current.spend > 0 
    ? current.ourAttributedRevenue / current.spend 
    : 0;
  const prevRoi = previous.spend > 0 
    ? previous.ourAttributedRevenue / previous.spend 
    : 0;
  const avgGift = current.ourAttributedDonations > 0 
    ? current.ourAttributedRevenue / current.ourAttributedDonations 
    : 0;
  const prevAvgGift = previous.ourAttributedDonations > 0 
    ? previous.ourAttributedRevenue / previous.ourAttributedDonations 
    : 0;

  return [
    // ... other metrics unchanged ...
    
    // Use OUR data for these:
    { label: "Conversions", 
      value: current.ourAttributedDonations,     // Changed
      previousValue: previous.ourAttributedDonations,  // Changed
      format: "number", accent: "green" },
    { label: "Attributed Revenue", 
      value: current.ourAttributedRevenue,       // Changed
      previousValue: previous.ourAttributedRevenue,  // Changed
      format: "currency", accent: "green" },
    { label: "Attributed ROI", 
      value: roi,          // Now uses our attribution
      previousValue: prevRoi, 
      format: "ratio", accent: "amber" },
    { label: "Avg Gift (Meta)", 
      value: avgGift,      // Now uses our attribution
      previousValue: prevAvgGift, 
      format: "currency", accent: "purple" },
  ];
}, [metaData]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useSingleDayMetaMetrics.ts` | Add RPC call for attribution, update interface, return both Meta and our data |
| `src/components/client/TodayViewDashboard.tsx` | Update metric calculations to use `ourAttributedRevenue` and `ourAttributedDonations` |

---

## Expected Results After Fix

| Metric | Before (Single-Day) | After (Single-Day) | Multi-Day |
|--------|--------------------|--------------------|-----------|
| Conversions | 5 (Meta's) | 6 (ours) | 6 (ours) |
| Attributed Revenue | $67 (Meta's) | $72.01 (ours) | $72.01 (ours) |
| Attributed ROI | 0.62x | 0.67x | 0.67x |
| Avg Gift (Meta) | $13.40 | $12.00 | $12.00 |

Now single-day and multi-day views will show consistent, accurate data.

---

## Why This Matters

1. **Meta's Attribution vs Ours**: Meta uses a 7-day click / 1-day view window and their own modeling. Our system uses deterministic matching (click IDs, refcodes, form names).

2. **Our Attribution is More Accurate for ROI**: We know exactly which ActBlue donations came from Meta ads because we match on click IDs and refcodes.

3. **Consistency is Critical**: Users expect the same numbers whether viewing one day or a date range.

---

## Technical Details

### RPC Channel Breakdown Structure

The `get_actblue_dashboard_metrics` RPC returns:

```json
{
  "channels": [
    {"channel": "meta", "revenue": 72.01, "count": 6, "donors": 6},
    {"channel": "other", "revenue": 1057.51, "count": 3, "donors": 3}
  ]
}
```

The `revenue` field is `net_revenue` (after fees), which matches what `kpis.metaAttributedRevenue` uses in the multi-day view.

### Performance Consideration

Adding an RPC call to the single-day hook increases the query count from 2 to 4 (current + previous for both sources). However:
- The RPC is already optimized and fast
- Both queries run in parallel
- Data is cached with 2-minute stale time

