

# Fix Demographics Page Timeout with Pre-Aggregated Cache

## Problem Summary

The `get_donor_demographics_v2` RPC is timing out (30-second limit) for "Abdul for Senate" because:

1. **82,225 transactions** need processing on every page load
2. **Occupation matching uses a correlated subquery** that runs 82K times against 166 patterns
3. **COUNT(DISTINCT donor_email)** across multiple CTEs is expensive
4. **No caching layer** - every page view re-runs the full aggregation

The current error shows `57014: canceling statement due to statement timeout` even after adding indexes.

## Your Requirement

You want **All-Time Demographics** with data cached/backfilled so it loads instantly and new donations are appended incrementally over time.

---

## Solution: Pre-Aggregated Demographics Cache Table

We'll create a persistent `donor_demographics_cache` table that stores the pre-computed summary for each organization. A scheduled job will refresh it daily, and new transactions will trigger incremental updates.

```text
+---------------------+       +---------------------------+       +---------------------+
| actblue_transactions|  -->  | donor_demographics_cache  |  -->  | Demographics Page   |
| (82K+ rows)         |       | (1 row per org)           |       | (instant load)      |
+---------------------+       +---------------------------+       +---------------------+
         ^                              ^
         |                              |
+---------------------+       +---------------------------+
| Daily Cron Job      |       | refresh_demographics_cache|
| (full rebuild)      |       | RPC function              |
+---------------------+       +---------------------------+
```

---

## Implementation Plan

### Phase 1: Create Cache Infrastructure

**1. Create `donor_demographics_cache` table**
- One row per organization containing the full JSONB result
- Columns: `organization_id`, `summary_data` (JSONB), `calculated_at`, `transaction_count`, `version`

**2. Create `refresh_demographics_cache` RPC**
- Same logic as `get_donor_demographics_v2` but writes to cache table instead of returning directly
- Runs as SECURITY DEFINER with service role to bypass RLS during background jobs

**3. Create `get_donor_demographics_cached` RPC**
- Fast lookup from cache table (< 10ms)
- Falls back to live query if cache is stale/missing (with timeout protection)

### Phase 2: Optimize Occupation Matching

**4. Pre-compute occupation categories**
- Create a trigger or batch job that sets `occupation_category` column on `actblue_transactions` when records are inserted
- Eliminates the expensive correlated subquery during aggregation

**5. Add occupation_category column to actblue_transactions**
- New column: `occupation_category TEXT`
- Backfill existing records in batches

### Phase 3: Scheduled Refresh + Incremental Updates

**6. Add scheduled job for daily cache refresh**
- Run `refresh_demographics_cache` for all orgs nightly (low-traffic period)
- Stagger execution to avoid overwhelming the database

**7. Add webhook trigger for incremental updates**
- When new transactions arrive via webhook, mark cache as "stale" or increment counts
- Full refresh runs in background, UI shows cached data immediately

### Phase 4: Frontend Changes

**8. Update ClientDemographics.tsx**
- Call `get_donor_demographics_cached` instead of `get_donor_demographics_v2`
- Add proper error state with Retry button (per your preference)
- Show "Data as of [timestamp]" indicator

**9. Add V3ErrorState wrapper for failed queries**
- Display clear error message with Retry button
- Prevent blank page when query fails

---

## Technical Details

### New Table Schema

```sql
CREATE TABLE public.donor_demographics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES client_organizations(id) ON DELETE CASCADE,
  summary_data jsonb NOT NULL,
  transaction_count integer NOT NULL DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  is_stale boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_demographics_cache_org ON donor_demographics_cache(organization_id);
```

### Occupation Pre-Computation

```sql
-- Add column to transactions table
ALTER TABLE actblue_transactions ADD COLUMN IF NOT EXISTS occupation_category text;

-- Create function to compute category
CREATE OR REPLACE FUNCTION compute_occupation_category(raw_occ text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT category FROM occupation_categories 
     WHERE lower(trim(raw_occ)) LIKE '%' || pattern || '%'
     ORDER BY sort_order LIMIT 1),
    'Other'
  );
$$;

-- Backfill in batches (run separately, not blocking)
UPDATE actblue_transactions t
SET occupation_category = compute_occupation_category(t.occupation)
WHERE occupation_category IS NULL AND occupation IS NOT NULL;
```

### Fast Cached Lookup

```sql
CREATE OR REPLACE FUNCTION get_donor_demographics_cached(_organization_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  cached_result jsonb;
BEGIN
  -- Access check
  IF NOT (user_belongs_to_organization(_organization_id) OR has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Return cached data if available
  SELECT summary_data INTO cached_result
  FROM donor_demographics_cache
  WHERE organization_id = _organization_id
    AND calculated_at > now() - interval '24 hours';
    
  IF cached_result IS NOT NULL THEN
    RETURN cached_result;
  END IF;
  
  -- Fallback: trigger async refresh and return empty
  PERFORM pg_notify('demographics_refresh', _organization_id::text);
  RETURN '{"status": "refreshing", "message": "Data is being calculated. Please refresh in a few minutes."}'::jsonb;
END;
$$;
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| Database Migration | CREATE `donor_demographics_cache` table |
| Database Migration | ALTER `actblue_transactions` add `occupation_category` |
| Database Migration | CREATE `refresh_demographics_cache` RPC |
| Database Migration | CREATE `get_donor_demographics_cached` RPC |
| `supabase/functions/refresh-demographics-cache/index.ts` | New edge function for batch refresh |
| `src/pages/ClientDemographics.tsx` | Use cached RPC, add error state |
| Scheduled Jobs | Add nightly refresh job |

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Page load time | 30s+ timeout | < 500ms |
| Query complexity | 7 CTEs, correlated subqueries | Single row lookup |
| Data freshness | Real-time (but broken) | Cached (< 24h old), updated nightly |
| Error handling | Blank page | Clear error with Retry |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Cache becomes stale | Scheduled daily refresh + "stale" flag for manual refresh |
| Large orgs overwhelm refresh job | Batch processing with chunking |
| Occupation backfill takes long | Run async, UI still works with partial data |

