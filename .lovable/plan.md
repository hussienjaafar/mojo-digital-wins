
# Fix Hero KPI Sparklines and New/Returning Donor Metrics

## Problem Summary

From the screenshot and code investigation, there are **4 issues** to address:

| Issue | Current State | Expected State |
|-------|--------------|----------------|
| **Attributed ROI sparkline** | Empty (no sparkline) | Day-by-day ROI line graph |
| **Current Active MRR sparkline** | Shows `recurring_amount` from period | Should show cumulative active MRR day-by-day |
| **New MRR Added sparkline** | Empty (no sparkline) | Net new MRR added each day |
| **New/Returning Donors** | Always shows "New 0 / Returning 0" | Correct breakdown of first-time vs repeat donors |

---

## Root Cause Analysis

### 1. Missing Sparkline Data (`useDashboardMetricsV2.ts`)

Lines 206-214 explicitly set sparklines to empty arrays:

```typescript
const legacySparklines: SparklineData = {
  netRevenue: dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.net })),
  roi: [], // ❌ Not computed per-day
  refundRate: [], // Not computed per-day
  recurringHealth: dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.recurring_amount })), // ⚠️ Wrong metric
  uniqueDonors: dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.donors })),
  attributionQuality: [], // Not available
  newMrr: [], // ❌ Not available
};
```

### 2. Missing New/Returning Donors (`useDashboardMetricsV2.ts`)

Lines 176-177 hardcode both values to 0:

```typescript
newDonors: 0, // Not available from unified yet
returningDonors: 0, // Not available from unified yet
```

### 3. Data Availability Assessment

| Metric | Data Source | Available? |
|--------|------------|------------|
| Daily ROI | `meta_ad_metrics.spend` + channel attribution from RPC | **Partially** - need to calculate ROI = attributed_revenue / spend per day |
| Active MRR | Requires cumulative calculation across recurring donors | **Needs new query** - RPC only returns current snapshot |
| New MRR Added | First recurring donation per donor per day | **Needs new query** - can be derived from transactions |
| New/Returning Donors | Compare `transaction_date` to `first_donation_date` | **Available** - needs JOIN with first donation subquery |

---

## Solution Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                     ClientDashboard.tsx                         │
│    - Calls useDashboardMetricsV2()                              │
│    - Calls useRecurringHealthQuery()                            │
│    - Calls NEW: useDailySparklineQuery()   <-- NEW HOOK         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌────────────────────────┐
│useDashboard   │  │useRecurring    │  │useDailySparklineQuery  │
│MetricsV2      │  │HealthQuery     │  │(NEW)                   │
│               │  │                │  │                        │
│Returns:       │  │Returns:        │  │Returns:                │
│- kpis         │  │- current_mrr   │  │- dailyRoi[]            │
│- sparklines   │  │- new_mrr       │  │- dailyNewMrr[]         │
│  (partial)    │  │- donors        │  │- dailyActiveMrr[]      │
└───────────────┘  └────────────────┘  │- newDonorsCount        │
                                       │- returningDonorsCount  │
                                       └────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Create New Database RPC Function

Create `get_dashboard_sparkline_data` that returns:

```sql
CREATE OR REPLACE FUNCTION public.get_dashboard_sparkline_data(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH 
  -- First donation date for each donor (org-scoped)
  first_donations AS (
    SELECT 
      donor_email,
      MIN(transaction_date) as first_donation_date
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND transaction_type = 'donation'
    GROUP BY donor_email
  ),
  
  -- Daily donor breakdown
  daily_donors AS (
    SELECT 
      DATE(t.transaction_date) as day,
      COUNT(DISTINCT CASE 
        WHEN DATE(fd.first_donation_date) = DATE(t.transaction_date) 
        THEN t.donor_email 
      END) as new_donors,
      COUNT(DISTINCT CASE 
        WHEN DATE(fd.first_donation_date) < DATE(t.transaction_date) 
        THEN t.donor_email 
      END) as returning_donors
    FROM actblue_transactions t
    LEFT JOIN first_donations fd ON t.donor_email = fd.donor_email
    WHERE t.organization_id = p_organization_id
      AND DATE(t.transaction_date) BETWEEN p_start_date AND p_end_date
      AND t.transaction_type = 'donation'
    GROUP BY DATE(t.transaction_date)
  ),
  
  -- First recurring transaction per donor
  first_recurring AS (
    SELECT 
      donor_email,
      MIN(transaction_date) as first_recurring_date,
      (SELECT amount FROM actblue_transactions t2 
       WHERE t2.donor_email = actblue_transactions.donor_email 
         AND t2.organization_id = p_organization_id
         AND t2.is_recurring = true
       ORDER BY t2.transaction_date ASC LIMIT 1) as first_amount
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND is_recurring = true
    GROUP BY donor_email
  ),
  
  -- Daily new MRR (from new recurring starters)
  daily_new_mrr AS (
    SELECT 
      DATE(first_recurring_date) as day,
      COALESCE(SUM(first_amount), 0) as new_mrr_added,
      COUNT(*) as new_recurring_donors
    FROM first_recurring
    WHERE first_recurring_date >= p_start_date
      AND first_recurring_date <= p_end_date
    GROUP BY DATE(first_recurring_date)
  ),
  
  -- Daily attributed revenue by channel
  daily_attributed AS (
    SELECT 
      DATE(t.transaction_date) as day,
      SUM(CASE 
        WHEN rm.platform = 'meta' 
          OR (t.refcode2 IS NOT NULL AND t.refcode2 != '') 
        THEN t.net_amount ELSE 0 
      END) as meta_attributed_revenue,
      SUM(CASE 
        WHEN rm.platform = 'sms' 
          OR t.refcode ILIKE '%sms%' 
          OR LOWER(t.contribution_form) LIKE '%sms%'
        THEN t.net_amount ELSE 0 
      END) as sms_attributed_revenue
    FROM actblue_transactions t
    LEFT JOIN refcode_mappings rm 
      ON t.organization_id = rm.organization_id 
      AND t.refcode = rm.refcode
    WHERE t.organization_id = p_organization_id
      AND DATE(t.transaction_date) BETWEEN p_start_date AND p_end_date
      AND t.transaction_type = 'donation'
    GROUP BY DATE(t.transaction_date)
  ),
  
  -- Daily Meta spend
  daily_meta_spend AS (
    SELECT date as day, SUM(spend) as meta_spend
    FROM meta_ad_metrics
    WHERE organization_id = p_organization_id
      AND date BETWEEN p_start_date AND p_end_date
    GROUP BY date
  ),
  
  -- Daily SMS spend
  daily_sms_spend AS (
    SELECT DATE(send_date) as day, SUM(cost) as sms_spend
    FROM sms_campaigns
    WHERE organization_id = p_organization_id
      AND DATE(send_date) BETWEEN p_start_date AND p_end_date
      AND status != 'draft'
    GROUP BY DATE(send_date)
  ),
  
  -- Combine daily ROI
  daily_roi AS (
    SELECT 
      COALESCE(da.day, dms.day, dss.day) as day,
      COALESCE(da.meta_attributed_revenue, 0) + COALESCE(da.sms_attributed_revenue, 0) as attributed_revenue,
      COALESCE(dms.meta_spend, 0) + COALESCE(dss.sms_spend, 0) as total_spend,
      CASE 
        WHEN COALESCE(dms.meta_spend, 0) + COALESCE(dss.sms_spend, 0) > 0 
        THEN (COALESCE(da.meta_attributed_revenue, 0) + COALESCE(da.sms_attributed_revenue, 0)) / 
             (COALESCE(dms.meta_spend, 0) + COALESCE(dss.sms_spend, 0))
        ELSE 0 
      END as roi
    FROM daily_attributed da
    FULL OUTER JOIN daily_meta_spend dms ON da.day = dms.day
    FULL OUTER JOIN daily_sms_spend dss ON COALESCE(da.day, dms.day) = dss.day
  ),
  
  -- Aggregate totals for new/returning
  donor_totals AS (
    SELECT 
      SUM(new_donors) as total_new_donors,
      SUM(returning_donors) as total_returning_donors
    FROM daily_donors
  )
  
  SELECT json_build_object(
    'dailyRoi', (
      SELECT COALESCE(json_agg(
        json_build_object('date', day, 'value', ROUND(roi::numeric, 2))
        ORDER BY day
      ), '[]'::json)
      FROM daily_roi WHERE day IS NOT NULL
    ),
    'dailyNewMrr', (
      SELECT COALESCE(json_agg(
        json_build_object('date', day, 'value', new_mrr_added)
        ORDER BY day
      ), '[]'::json)
      FROM daily_new_mrr WHERE day IS NOT NULL
    ),
    'newDonors', (SELECT COALESCE(total_new_donors, 0) FROM donor_totals),
    'returningDonors', (SELECT COALESCE(total_returning_donors, 0) FROM donor_totals)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;
```

### Phase 2: Create New React Query Hook

Create `src/hooks/useDailySparklineQuery.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDateRange } from "@/stores/dashboardStore";
import type { SparklineDataPoint } from "@/types/dashboard";

interface DailySparklineData {
  dailyRoi: SparklineDataPoint[];
  dailyNewMrr: SparklineDataPoint[];
  newDonors: number;
  returningDonors: number;
}

export function useDailySparklineQuery(organizationId: string | undefined) {
  const { startDate, endDate } = useDateRange();
  
  return useQuery({
    queryKey: ['daily-sparkline', organizationId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_sparkline_data', {
        p_organization_id: organizationId!,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      
      if (error) throw error;
      return data as DailySparklineData;
    },
    enabled: !!organizationId && !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000,
  });
}
```

### Phase 3: Update `useDashboardMetricsV2.ts`

Merge the new sparkline data into the legacy format:

```typescript
// In transformToLegacyFormat, accept sparklineExtras parameter
const legacySparklines: SparklineData = {
  netRevenue: dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.net })),
  roi: sparklineExtras?.dailyRoi || [], // From new hook
  refundRate: [], 
  recurringHealth: dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.recurring_amount })),
  uniqueDonors: dailyRollup.slice(-7).map(d => ({ date: d.date, value: d.donors })),
  attributionQuality: [],
  newMrr: sparklineExtras?.dailyNewMrr || [], // From new hook
};

// Update kpis
newDonors: sparklineExtras?.newDonors || 0,
returningDonors: sparklineExtras?.returningDonors || 0,
```

### Phase 4: Update `ClientDashboard.tsx`

Add the new hook and pass data through:

```typescript
const { data: sparklineExtras } = useDailySparklineQuery(organizationId);

const heroKpis = useMemo(() => {
  if (!data?.kpis) return [];
  return buildHeroKpis({
    kpis: {
      ...data.kpis,
      newDonors: sparklineExtras?.newDonors || 0,
      returningDonors: sparklineExtras?.returningDonors || 0,
    },
    // ... rest of props
    sparklines: {
      ...data.sparklines,
      roi: sparklineExtras?.dailyRoi || [],
      newMrr: sparklineExtras?.dailyNewMrr || [],
    },
  });
}, [data, recurringHealthData, sparklineExtras]);
```

---

## Active MRR Sparkline - Special Consideration

The "Current Active MRR" sparkline requires a **running total** of active recurring donors, which is expensive to calculate historically. Two options:

**Option A (Simpler)**: Show `recurring_amount` raised per day (current behavior), but relabel the card's sparkline context.

**Option B (Accurate)**: Pre-compute a daily snapshot table via a scheduled edge function that tracks cumulative MRR.

**Recommendation**: Start with Option A for now (keep existing sparkline showing daily recurring revenue) and mark this as a future enhancement. The card already correctly shows the **current** active MRR as the headline value from `recurringHealth.current_active_mrr`.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDD_*.sql` | Create `get_dashboard_sparkline_data` RPC |
| `src/hooks/useDailySparklineQuery.ts` | **NEW** - Hook to fetch sparkline extras |
| `src/hooks/useDashboardMetricsV2.ts` | Accept sparkline extras, populate newDonors/returningDonors |
| `src/pages/ClientDashboard.tsx` | Call new hook, merge data into buildHeroKpis |

---

## Expected Results After Fix

| Card | Before | After |
|------|--------|-------|
| **Attributed ROI** | No sparkline | Line graph showing daily ROI (attributed revenue / spend) |
| **Current Active MRR** | Shows daily recurring raised | Unchanged (shows daily recurring, accurate current MRR in headline) |
| **New MRR Added** | No sparkline | Line graph showing new MRR added each day |
| **Unique Donors** | "New 0 / Returning 0" | Correct counts like "New 384 / Returning 41" |

---

## Testing Checklist

After implementation:

1. Verify "Unique Donors" card shows non-zero new/returning counts
2. Verify "Attributed ROI" sparkline renders when there's spend data
3. Verify "New MRR Added" sparkline shows new recurring donor MRR per day
4. Verify sparklines match the selected date range (14D, 30D, etc.)
5. Verify no performance regression on dashboard load
