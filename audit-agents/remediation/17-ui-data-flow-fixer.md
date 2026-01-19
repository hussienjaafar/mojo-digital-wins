# UI Data Flow Fixer

**Role:** Frontend Engineer / Full-Stack Developer
**Focus:** Database views, UI queries, actionability filters
**Priority:** HIGH
**Estimated Time:** 2-3 hours
**Dependencies:** `15-pipeline-activator.md` complete, data flowing

---

## Overview

This agent fixes issues that prevent data from displaying in the UI, even when the database has valid data. The audit found that despite having 655 trend_events, the UI shows "No actionable signals."

---

## Root Cause Analysis

The UI empty state can be caused by:

1. **Missing database view** - `trend_events_active` view doesn't exist
2. **Strict actionability filters** - Filtering out all data
3. **is_trending flag not set** - Base query returns 0 rows
4. **Schema mismatch** - Queries using wrong column names

---

## Step-by-Step Remediation

### Step 1: Verify Database View Exists

```sql
-- Check if trend_events_active view exists
SELECT viewname, definition
FROM pg_views
WHERE schemaname = 'public'
AND viewname = 'trend_events_active';
```

**If missing, create it:**

```sql
CREATE OR REPLACE VIEW public.trend_events_active AS
SELECT
  te.id,
  te.event_key,
  te.event_title,
  te.canonical_label,
  te.first_seen_at,
  te.last_seen_at,
  te.peak_at,
  te.baseline_7d,
  te.baseline_30d,
  te.current_1h,
  te.current_6h,
  te.current_24h,
  te.velocity,
  te.velocity_1h,
  te.velocity_6h,
  te.acceleration,
  te.trend_score,
  te.z_score_velocity,
  te.confidence_score,
  te.confidence_factors,
  te.is_trending,
  te.is_breaking,
  te.is_event_phrase,
  te.trend_stage,
  te.source_count,
  te.news_source_count,
  te.social_source_count,
  te.corroboration_score,
  te.evidence_count,
  te.top_headline,
  te.sentiment_score,
  te.sentiment_label,
  te.context_terms,
  te.context_phrases,
  te.context_summary,
  te.label_quality,
  te.label_source,
  te.related_phrases,
  te.cluster_id,
  te.policy_domains,
  te.geographies,
  te.geo_level,
  te.politicians_mentioned,
  te.organizations_mentioned,
  te.legislation_mentioned,
  -- Computed fields
  CASE
    WHEN te.last_seen_at > NOW() - INTERVAL '1 hour' THEN 'fresh'
    WHEN te.last_seen_at > NOW() - INTERVAL '6 hours' THEN 'recent'
    WHEN te.last_seen_at > NOW() - INTERVAL '24 hours' THEN 'aging'
    ELSE 'stale'
  END as freshness,
  COALESCE(te.baseline_7d, 0) as safe_baseline,
  CASE
    WHEN te.baseline_7d > 0 THEN
      ROUND(((te.current_24h / 24.0 - te.baseline_7d) / te.baseline_7d * 100)::numeric, 1)
    ELSE 0
  END as baseline_delta_pct,
  -- Rank score for sorting (Twitter-like)
  COALESCE(te.trend_score, 0) +
    CASE WHEN te.is_breaking THEN 50 ELSE 0 END +
    COALESCE(te.z_score_velocity, 0) * 10 as rank_score
FROM trend_events te
WHERE te.last_seen_at > NOW() - INTERVAL '48 hours';

-- Grant access
GRANT SELECT ON public.trend_events_active TO authenticated;
GRANT SELECT ON public.trend_events_active TO anon;
```

**Verify view works:**

```sql
SELECT COUNT(*) as rows,
       COUNT(*) FILTER (WHERE is_trending = true) as trending
FROM trend_events_active;
```

---

### Step 2: Diagnose is_trending Status

```sql
-- Check is_trending distribution
SELECT
  is_trending,
  COUNT(*) as count,
  MAX(last_seen_at) as latest
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY is_trending;
```

**If is_trending is all FALSE:**

The `detect-trend-events` function hasn't run properly. Go back to `15-pipeline-activator.md`.

---

### Step 3: Analyze Actionability Filter Impact

The UI applies actionability filters. Let's see the impact:

```sql
-- Simulate the exact UI filter chain
WITH step1_base AS (
  -- Base query (from useTrendEvents hook)
  SELECT *
  FROM trend_events
  WHERE is_trending = true
    AND confidence_score >= 30
    AND last_seen_at > NOW() - INTERVAL '24 hours'
),
step2_actionable AS (
  -- Actionability filter (from NewsTrendsPage.tsx)
  SELECT *
  FROM step1_base
  WHERE is_breaking = true
     OR confidence_score >= 70
     OR (z_score_velocity IS NOT NULL AND z_score_velocity >= 2)
)
SELECT
  'Step 1: Base Query' as step,
  (SELECT COUNT(*) FROM step1_base) as count,
  'is_trending=true AND confidence>=30' as filter
UNION ALL
SELECT
  'Step 2: Actionability',
  (SELECT COUNT(*) FROM step2_actionable),
  'breaking OR confidence>=70 OR z_score>=2'
UNION ALL
SELECT
  'Final: Would Display',
  LEAST((SELECT COUNT(*) FROM step2_actionable), 5),
  'Top 5 shown in UI';
```

---

### Step 4: Adjust Actionability Thresholds (If Needed)

**Current thresholds (in `NewsTrendsPage.tsx` lines 108-120):**

```typescript
// CURRENT: Too strict
const actionable = trends.filter(t => {
  return t.is_breaking ||
    t.confidence_score >= 70 ||  // High bar
    (t.z_score_velocity && t.z_score_velocity >= 2);  // High bar
});
```

**Recommended adjustment:**

```typescript
// PROPOSED: More permissive
const actionable = trends.filter(t => {
  const orgScore = orgScores.get(t.id);
  const hasHighRelevance = orgScore && orgScore.relevance_score >= 25;

  return t.is_breaking ||
    t.confidence_score >= 50 ||  // Lowered from 70
    (t.z_score_velocity && t.z_score_velocity >= 1.5) ||  // Lowered from 2
    hasHighRelevance ||  // Personalization path
    t.source_count >= 3;  // Multi-source corroboration
});
```

**File to edit:** `src/pages/admin/NewsTrendsPage.tsx`

---

### Step 5: Fix Empty State Logic

The UI shows "No actionable signals" when `primarySignals.length === 0`. Let's ensure this is the only code path:

```typescript
// In NewsTrendsPage.tsx around line 329
{primarySignals.length === 0 && !trendsLoading && (
  <div className="text-center py-12 text-muted-foreground">
    <p>No actionable signals at this time.</p>
    <p className="text-sm mt-1">Check back soon or explore all trends below.</p>
  </div>
)}
```

**Add debugging info in development:**

```typescript
{primarySignals.length === 0 && !trendsLoading && (
  <div className="text-center py-12 text-muted-foreground">
    <p>No actionable signals at this time.</p>
    <p className="text-sm mt-1">Check back soon or explore all trends below.</p>
    {process.env.NODE_ENV === 'development' && (
      <div className="mt-4 text-xs text-left bg-muted p-4 rounded">
        <p>Debug: Total trends fetched: {trends.length}</p>
        <p>Debug: Trending count: {stats.trendingCount}</p>
        <p>Debug: High confidence: {stats.highConfidenceCount}</p>
      </div>
    )}
  </div>
)}
```

---

### Step 6: Verify useTrendEvents Hook

Check the hook is querying correctly:

**File:** `src/hooks/useTrendEvents.tsx`

```typescript
// Verify the query (around line 231-239)
let query = supabase
  .from('trend_events_active')  // Should use the view
  .select('*')
  .gte('confidence_score', minConfidence)
  .order('is_breaking', { ascending: false })
  .order('rank_score', { ascending: false, nullsFirst: false })
  .order('confidence_score', { ascending: false })
  .limit(limit);
```

**If view doesn't exist, it falls back to direct table query.**

---

### Step 7: Check for Schema Mismatches

The audit mentioned `trend_events.topic does not exist`. Verify correct column names:

```sql
-- Check actual column names in trend_events
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'trend_events'
AND table_schema = 'public'
ORDER BY ordinal_position;
```

**Key columns:**
- `event_title` (NOT `topic`)
- `canonical_label` (display name)
- `is_trending` (boolean)
- `confidence_score` (numeric)
- `z_score_velocity` (numeric)

---

### Step 8: Force Refresh UI Cache

If data exists but UI shows empty:

**Option A: Hard refresh browser**
- Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

**Option B: Clear React Query cache**
Add a force refresh button temporarily:

```typescript
const handleForceRefresh = () => {
  queryClient.invalidateQueries(['trend_events']);
  refresh();
};
```

**Option C: Check for maintenance mode**

```typescript
// In useTrendEvents.tsx
if (isMaintenanceMode) {
  setEvents([]);
  setIsLoading(false);
  setError('Maintenance mode - trends temporarily unavailable');
  return;
}
```

Verify maintenance mode is disabled:

```sql
SELECT * FROM system_settings WHERE key = 'maintenance_mode';
```

---

### Step 9: End-to-End Verification

Run this comprehensive check:

```sql
-- Complete UI data flow verification
SELECT
  'trend_events_active view' as checkpoint,
  CASE WHEN EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'trend_events_active') THEN '✅' ELSE '❌' END as status,
  'View should exist' as expected

UNION ALL

SELECT
  'Trending events exist',
  CASE WHEN (SELECT COUNT(*) FROM trend_events WHERE is_trending = true AND last_seen_at > NOW() - INTERVAL '24 hours') > 0 THEN '✅' ELSE '❌' END,
  'Count > 0'

UNION ALL

SELECT
  'High confidence events',
  CASE WHEN (SELECT COUNT(*) FROM trend_events WHERE confidence_score >= 70 AND last_seen_at > NOW() - INTERVAL '24 hours') > 0 THEN '✅' ELSE '❌' END,
  'Count > 0'

UNION ALL

SELECT
  'Actionable events (any path)',
  CASE WHEN (SELECT COUNT(*) FROM trend_events
    WHERE (is_breaking = true OR confidence_score >= 70 OR z_score_velocity >= 2)
    AND is_trending = true
    AND last_seen_at > NOW() - INTERVAL '24 hours') > 0 THEN '✅' ELSE '❌' END,
  'Count > 0'

UNION ALL

SELECT
  'Org scores computed',
  CASE WHEN (SELECT COUNT(*) FROM org_trend_scores WHERE computed_at > NOW() - INTERVAL '24 hours') > 0 THEN '✅' ELSE '❌' END,
  'Count > 0';
```

**Expected:** All checkpoints should show ✅

---

## Quick Fix Summary

If you need to get the UI working IMMEDIATELY:

**Option 1: Lower all thresholds**

```typescript
// In NewsTrendsPage.tsx
const actionable = trends.filter(t => {
  return t.is_breaking ||
    t.confidence_score >= 40 ||  // Very low
    t.source_count >= 2 ||  // Any multi-source
    true;  // TEMPORARY: Show everything
});
```

**Option 2: Bypass actionability filter**

```typescript
// Temporarily use all trends
const primarySignals = useMemo(() => {
  if (!trends) return [];
  // Return top 5 by confidence, ignoring actionability
  return trends
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 5);
}, [trends]);
```

---

## Verification Checklist

- [ ] `trend_events_active` view exists and returns data
- [ ] `is_trending = true` events exist (>10)
- [ ] At least some events pass actionability filter
- [ ] UI displays trends (visual check)
- [ ] For You tab shows personalized content
- [ ] Explore tab shows all trending

---

## Files Modified

| File | Change |
|------|--------|
| `src/pages/admin/NewsTrendsPage.tsx` | Adjust actionability thresholds |
| `src/hooks/useTrendEvents.tsx` | No changes needed if view exists |
| Database | Create `trend_events_active` view |

---

## Post-Fix Monitoring

After fixes are applied, monitor:

```sql
-- Hourly check: Are trends displaying?
SELECT
  DATE_TRUNC('hour', NOW()) as check_time,
  (SELECT COUNT(*) FROM trend_events WHERE is_trending = true AND last_seen_at > NOW() - INTERVAL '1 hour') as trending_1h,
  (SELECT COUNT(*) FROM trend_events WHERE confidence_score >= 70 AND last_seen_at > NOW() - INTERVAL '1 hour') as high_confidence_1h;
```

---

## Next Steps

After completing all remediation agents:

1. Run full audit again: `audit-political-intelligence` function
2. Visual verification: Check News & Trends page in browser
3. Set up monitoring: Create scheduled health checks
4. Document: Update runbook with new procedures
