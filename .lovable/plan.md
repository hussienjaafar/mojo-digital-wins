
# Add Single-Day View for Meta Ads Performance Overview

## Current Situation

When a user selects a **single day** (start date = end date), the dashboard switches from `ClientDashboardCharts` to `TodayViewDashboard`. However:

- `TodayViewDashboard` only displays **ActBlue donation metrics** (Total Raised, Donations, Unique Donors, Recurring Rate)
- The **Meta Ads Performance Overview** section (Link Clicks, Link CTR, Link CPC, Attributed Revenue, ROI) is only visible in the multi-day `ClientDashboardCharts` view
- Users have no visibility into Meta performance when viewing a single day

## Solution Overview

Add a **Meta Ads Performance Overview** card to `TodayViewDashboard` that displays the same metrics shown in `ClientDashboardCharts`, but formatted for single-day comparison (current day vs. previous day).

## Implementation Plan

### Step 1: Create a New Hook for Single-Day Meta Metrics

Create `useSingleDayMetaMetrics` hook that fetches:
- Current day: Meta spend, impressions, link clicks, conversions, attributed revenue from `meta_ad_metrics_daily`
- Previous day: Same metrics for comparison

```typescript
// src/hooks/useSingleDayMetaMetrics.ts
interface SingleDayMetaData {
  current: {
    spend: number;
    impressions: number;
    linkClicks: number;
    conversions: number;
    attributedRevenue: number;
  };
  previous: {
    spend: number;
    impressions: number;
    linkClicks: number;
    conversions: number;
    attributedRevenue: number;
  };
}
```

### Step 2: Update TodayViewDashboard Component

Add the Meta Ads Performance Overview section after the existing KPI cards:

```text
Current Layout:
┌─────────────────────────────────────────────────────┐
│  Header: "Today's Performance"                      │
├─────────────────────────────────────────────────────┤
│  KPI Row: Total Raised | Donations | Donors | Rec%  │
├─────────────────────────────────────────────────────┤
│  Hourly Breakdown Chart                             │
├───────────────────────────┬─────────────────────────┤
│  Recent Activity Feed     │  Week Comparison        │
└───────────────────────────┴─────────────────────────┘

New Layout (adding Meta section):
┌─────────────────────────────────────────────────────┐
│  Header: "Today's Performance"                      │
├─────────────────────────────────────────────────────┤
│  KPI Row: Total Raised | Donations | Donors | Rec%  │
├─────────────────────────────────────────────────────┤
│  NEW: Meta Ads Performance Overview                 │
│  ┌─────────┬─────────┬─────────┬─────────┐         │
│  │ Spend   │ LinkClk │LinkCTR  │ LinkCPC │         │
│  ├─────────┼─────────┼─────────┼─────────┤         │
│  │ Conver. │ Attr Rev│ Attr ROI│ Avg Gift│         │
│  └─────────┴─────────┴─────────┴─────────┘         │
├─────────────────────────────────────────────────────┤
│  Hourly Breakdown Chart                             │
├───────────────────────────┬─────────────────────────┤
│  Recent Activity Feed     │  Week Comparison        │
└───────────────────────────┴─────────────────────────┘
```

### Step 3: Use SingleDayMetricGrid Component

Leverage the existing `SingleDayMetricGrid` component (already used in `MetaAdsMetrics.tsx`) to display the Meta performance metrics with trend indicators comparing to the previous day.

Metrics to display in the grid (2 rows x 4 columns):
1. **Ad Spend** - Total Meta spend for the day
2. **Link Clicks** - Number of outbound clicks
3. **Link CTR** - Click-through rate percentage
4. **Link CPC** - Cost per link click
5. **Conversions** - Meta-attributed donations
6. **Attributed Revenue** - Meta-attributed donation revenue
7. **Attributed ROI** - Revenue / Spend ratio
8. **Avg Gift (Meta)** - Average donation amount from Meta

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useSingleDayMetaMetrics.ts` | **CREATE** | Hook to fetch single-day Meta metrics with previous day comparison |
| `src/components/client/TodayViewDashboard.tsx` | **MODIFY** | Add Meta Ads Performance Overview section using SingleDayMetricGrid |

---

## Detailed Code Changes

### New Hook: `useSingleDayMetaMetrics.ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";
import { subDays, format } from "date-fns";

interface MetaDayMetrics {
  spend: number;
  impressions: number;
  linkClicks: number;
  conversions: number;
  conversionValue: number;
}

interface SingleDayMetaData {
  current: MetaDayMetrics;
  previous: MetaDayMetrics;
}

async function fetchDayMetaMetrics(
  organizationId: string,
  date: string
): Promise<MetaDayMetrics> {
  const { data, error } = await supabase
    .from('meta_ad_metrics_daily')
    .select('spend, impressions, link_clicks, conversions, conversion_value')
    .eq('organization_id', organizationId)
    .eq('date', date);

  if (error) throw error;

  // Aggregate all rows for the day
  return (data || []).reduce(
    (acc, row) => ({
      spend: acc.spend + Number(row.spend || 0),
      impressions: acc.impressions + Number(row.impressions || 0),
      linkClicks: acc.linkClicks + Number(row.link_clicks || 0),
      conversions: acc.conversions + Number(row.conversions || 0),
      conversionValue: acc.conversionValue + Number(row.conversion_value || 0),
    }),
    { spend: 0, impressions: 0, linkClicks: 0, conversions: 0, conversionValue: 0 }
  );
}

export function useSingleDayMetaMetrics(organizationId: string | undefined) {
  const { startDate } = useDateRange();
  const previousDate = format(subDays(new Date(startDate), 1), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['single-day-meta', organizationId, startDate],
    queryFn: async () => {
      const [current, previous] = await Promise.all([
        fetchDayMetaMetrics(organizationId!, startDate),
        fetchDayMetaMetrics(organizationId!, previousDate),
      ]);
      return { current, previous };
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000,
  });
}
```

### Updated TodayViewDashboard.tsx

Add after the KPI cards section:

```typescript
// Import the new hook and SingleDayMetricGrid
import { useSingleDayMetaMetrics } from "@/hooks/useSingleDayMetaMetrics";
import { SingleDayMetricGrid, type SingleDayMetric } from "./SingleDayMetricGrid";

// Inside the component, after existing data fetching:
const { data: metaData } = useSingleDayMetaMetrics(organizationId);

// Build Meta metrics for the grid
const metaMetrics: SingleDayMetric[] = useMemo(() => {
  if (!metaData) return [];
  
  const { current, previous } = metaData;
  const linkCtr = current.impressions > 0 ? (current.linkClicks / current.impressions) * 100 : 0;
  const prevLinkCtr = previous.impressions > 0 ? (previous.linkClicks / previous.impressions) * 100 : 0;
  const linkCpc = current.linkClicks > 0 ? current.spend / current.linkClicks : 0;
  const prevLinkCpc = previous.linkClicks > 0 ? previous.spend / previous.linkClicks : 0;
  const roi = current.spend > 0 ? current.conversionValue / current.spend : 0;
  const prevRoi = previous.spend > 0 ? previous.conversionValue / previous.spend : 0;
  const avgGift = current.conversions > 0 ? current.conversionValue / current.conversions : 0;
  const prevAvgGift = previous.conversions > 0 ? previous.conversionValue / previous.conversions : 0;

  return [
    { label: "Ad Spend", value: current.spend, previousValue: previous.spend, format: "currency", accent: "blue" },
    { label: "Link Clicks", value: current.linkClicks, previousValue: previous.linkClicks, format: "number", accent: "blue" },
    { label: "Link CTR", value: linkCtr, previousValue: prevLinkCtr, format: "percent", accent: "default" },
    { label: "Link CPC", value: linkCpc, previousValue: prevLinkCpc, format: "currency", accent: "default" },
    { label: "Conversions", value: current.conversions, previousValue: previous.conversions, format: "number", accent: "green" },
    { label: "Attributed Revenue", value: current.conversionValue, previousValue: previous.conversionValue, format: "currency", accent: "green" },
    { label: "Attributed ROI", value: roi, previousValue: prevRoi, format: "ratio", accent: "amber" },
    { label: "Avg Gift (Meta)", value: avgGift, previousValue: prevAvgGift, format: "currency", accent: "purple" },
  ];
}, [metaData]);

// In the JSX, add after KPI Cards Row:
{metaMetrics.length > 0 && (
  <motion.div variants={itemVariants}>
    <V3Card className="p-4 sm:p-6">
      <h3 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))] mb-4">
        Meta Ads Performance Overview
      </h3>
      <SingleDayMetricGrid metrics={metaMetrics} columns={4} />
    </V3Card>
  </motion.div>
)}
```

---

## Expected Results

When viewing a single day:

| Metric | Display | Comparison |
|--------|---------|------------|
| Ad Spend | $114.14 | vs $296.07 yesterday (+trend indicator) |
| Link Clicks | 45 | vs 82 yesterday |
| Link CTR | 0.84% | vs 0.92% yesterday |
| Link CPC | $2.54 | vs $3.61 yesterday |
| Conversions | 5 | vs 18 yesterday |
| Attributed Revenue | $67 | vs $189 yesterday |
| Attributed ROI | 0.59x | vs 0.64x yesterday |
| Avg Gift (Meta) | $13.40 | vs $10.50 yesterday |

Each metric will show:
- Current day value (large, primary text)
- Trend indicator (up/down arrow with percentage)
- Accent color based on metric type

---

## Technical Notes

1. **Data Source**: Uses `meta_ad_metrics_daily` table (same as multi-day view) for accurate link click data
2. **Comparison Logic**: Always compares to the previous calendar day
3. **Fallback**: If no Meta data exists for the selected day, the section is hidden rather than showing zeros
4. **Performance**: Single-day queries are lightweight (2 small queries in parallel)
5. **Reuse**: Leverages existing `SingleDayMetricGrid` component for consistent styling
