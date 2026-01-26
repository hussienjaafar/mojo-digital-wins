
# Fix Meta Ads Performance Overview - Use Correct Link Metrics

## Problem Summary

The "Meta Ads Performance Overview" section displays incorrect metrics because:

| Issue | Current Value | Correct Value | Root Cause |
|-------|--------------|---------------|------------|
| **Total Clicks** | 12,305 (all clicks) | 1,359 (link clicks) | Using `clicks` instead of `link_clicks` |
| **CTR** | 7.61% | ~0.84% | Calculated from all clicks, not link clicks |
| **CPC** | $1 | ~$7 | Calculated from all clicks, not link clicks |
| **Missing: Attributed Revenue** | Not shown | $7,291 | Need to add to UI |
| **Missing: Attributed ROI** | Not shown | 0.77 | Need to add to UI |

## Root Cause

The `fetchChannelSpend` function queries `meta_ad_metrics` table, which does NOT have `link_clicks` or `link_ctr` columns:

```typescript
// Current (wrong table)
const metaQuery = supabase
  .from('meta_ad_metrics')  // ❌ No link_clicks/link_ctr columns
  .select('date, spend, conversions, impressions, clicks')
```

The correct table is `meta_ad_metrics_daily` which contains `link_clicks` and `link_ctr`.

---

## Solution

### Part 1: Update Data Fetching

Modify `fetchChannelSpend` to query `meta_ad_metrics_daily` instead:

```typescript
// Fixed - use correct table with link metrics
const metaQuery = supabase
  .from('meta_ad_metrics_daily')  // ✅ Has link_clicks, link_ctr
  .select('date, spend, conversions, impressions, clicks, link_clicks, link_ctr')
  .eq('organization_id', organizationId)
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date');
```

### Part 2: Update ChannelSpendData Interface

Add link-specific metrics:

```typescript
interface ChannelSpendData {
  metaSpend: number;
  smsSpend: number;
  metaConversions: number;
  smsConversions: number;
  metaImpressions: number;
  metaClicks: number;
  metaLinkClicks: number;      // NEW
  dailyMetaSpend: DailySpendPoint[];
  dailySmsSpend: DailySpendPoint[];
}
```

### Part 3: Add Aggregation for Link Clicks

```typescript
// After existing aggregations, add:
const metaLinkClicks = (metaResult.data || []).reduce(
  (sum: number, m: any) => sum + Number(m.link_clicks || 0),
  0
);
```

### Part 4: Update KPIs Mapping

The UI needs access to link clicks for proper CTR/CPC calculation:

```typescript
// In transformToLegacyFormat, update:
totalClicks: channelSpend.metaLinkClicks,  // Use link clicks
```

### Part 5: Update UI in ClientDashboardCharts.tsx

Update the metrics display to use link-specific values and add new rows:

```typescript
// Meta Ads Performance Overview section

// 1. Change "Total Clicks" to "Link Clicks"
<span>Link Clicks</span>
<span>{kpis.totalClicks.toLocaleString()}</span>

// 2. Update CTR label to "Link CTR" (calculation already uses totalClicks)
<span>Link CTR</span>
<span>{((kpis.totalClicks / kpis.totalImpressions) * 100).toFixed(2)}%</span>

// 3. Update CPC label to "Link CPC"
<span>Link CPC</span>
<span>{formatCurrency(metaSpend / kpis.totalClicks)}</span>

// 4. Add new row: Meta Attributed Revenue
<div className="flex items-center justify-between py-2 border-b ...">
  <span>Meta Attributed Revenue</span>
  <span>{formatCurrency(kpis.metaAttributedRevenue)}</span>
</div>

// 5. Add new row: Meta Attributed ROI
<div className="flex items-center justify-between py-2 border-b ...">
  <span>Meta Attributed ROI</span>
  <span>
    {metaSpend > 0 
      ? (kpis.metaAttributedRevenue / metaSpend).toFixed(2) + 'x'
      : '0.00x'}
  </span>
</div>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useDashboardMetricsV2.ts` | Change query from `meta_ad_metrics` to `meta_ad_metrics_daily`, add `link_clicks` aggregation, update interface |
| `src/components/client/ClientDashboardCharts.tsx` | Update labels, add Attributed Revenue and Attributed ROI rows |

---

## Detailed Code Changes

### useDashboardMetricsV2.ts

**1. Update meta query (line 72-78):**
```typescript
const metaQuery = supabase
  .from('meta_ad_metrics_daily')  // Changed table
  .select('date, spend, conversions, impressions, clicks, link_clicks')  // Added link_clicks
  .eq('organization_id', organizationId)
  .gte('date', startDate)
  .lte('date', endDate)
  .order('date');
```

**2. Update ChannelSpendData interface (add after line 36):**
```typescript
metaLinkClicks: number;
```

**3. Add link clicks aggregation (after line 112):**
```typescript
const metaLinkClicks = (metaResult.data || []).reduce(
  (sum: number, m: any) => sum + Number(m.link_clicks || 0),
  0
);
```

**4. Update return statement (add after line 153):**
```typescript
metaLinkClicks,
```

**5. Update KPIs mapping (line 210):**
```typescript
totalClicks: channelSpend.metaLinkClicks,  // Use link clicks instead of all clicks
```

### ClientDashboardCharts.tsx

**Update the Meta Ads Performance Overview section (lines 406-435):**

Current order: Impressions, Clicks, CTR, CPC, Conversions, Avg Donation

New order with additions:
1. Total Impressions (unchanged)
2. Link Clicks (renamed from "Total Clicks")
3. Link CTR (renamed)
4. Link CPC (renamed)
5. Meta Conversions (unchanged)
6. **Meta Attributed Revenue** (NEW)
7. **Meta Attributed ROI** (NEW)
8. Avg Donation (Meta) (keep at end)

---

## Expected Results After Fix

| Metric | Before | After |
|--------|--------|-------|
| Link Clicks | 12,305 | 1,359 |
| Link CTR | 7.61% | 0.84% |
| Link CPC | $1 | ~$7.00 |
| Meta Attributed Revenue | Not shown | $7,291 |
| Meta Attributed ROI | Not shown | 0.77x |

---

## Technical Notes

- The `meta_ad_metrics` table is campaign-level aggregates
- The `meta_ad_metrics_daily` table contains ad-level daily metrics with accurate link click data
- Link clicks represent actual clicks that navigate away from Facebook (outbound)
- Regular clicks include all engagement (likes, comments, shares, etc.)
- Link CTR and Link CPC are the industry-standard metrics for measuring ad performance

---

## No Database Changes Required

This fix only requires frontend/hook changes. The data already exists in `meta_ad_metrics_daily`.
