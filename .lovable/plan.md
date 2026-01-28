

# Fix Creative Intelligence V2 Console Errors

## Problem Summary

Two persistent console errors on the `/client/creative-intelligence-v2` page:

| Error | Root Cause |
|-------|------------|
| `Refused to apply style from .../src/index.css (MIME type text/html)` | Preview environment quirk - benign warning caused by SPA fallback routing when browser requests the raw source path. Styles actually load via Vite's JS-injected CSS. |
| `POST get_creative_intelligence 400 - cannot cast type text[] to jsonb` | The PostgreSQL RPC attempts `political_stances::jsonb` and `targets_attacked::jsonb`, but those columns are native `TEXT[]` arrays. PostgreSQL cannot directly cast `TEXT[]` to `JSONB`. |

The RPC error is the critical issue preventing the dashboard from loading.

---

## Solution

### 1. Fix the Database RPC (Required)

Update the `get_creative_intelligence` function to convert native arrays properly:

**Current (broken):**
```sql
jsonb_array_elements_text(political_stances::jsonb)
jsonb_array_elements_text(targets_attacked::jsonb)
```

**Fixed:**
```sql
unnest(political_stances)
unnest(targets_attacked)
```

Since these are already native PostgreSQL arrays, `unnest()` is the correct approach - simpler and more efficient than converting to JSONB.

**Locations to fix:**
- Line 223: `stance_performance` CTE - SELECT clause
- Line 231: `stance_performance` CTE - GROUP BY clause  
- Line 236: `target_performance` CTE - SELECT clause
- Line 242: `target_performance` CTE - GROUP BY clause
- Line 280: `recommendations` CTE - subquery for `target_attacked`

**Changes to `WHERE` clauses:**
- `political_stances != '[]'` becomes `array_length(political_stances, 1) > 0`
- `targets_attacked != '[]'` becomes `array_length(targets_attacked, 1) > 0`

### 2. CSS MIME Error (No Code Change Needed)

This is a harmless preview environment artifact:
- The browser sometimes requests `/src/index.css` directly (bypassing Vite's bundler)
- The SPA fallback returns `index.html` instead (with MIME `text/html`)
- The CSS is actually loaded correctly via Vite's JS injection (confirmed by network logs showing successful style loading)
- **No action required** - it does not affect functionality or production

---

## Implementation Steps

1. **Create database migration** to update the `get_creative_intelligence` function with:
   - Replace all `jsonb_array_elements_text(column::jsonb)` with `unnest(column)`
   - Update WHERE clauses to use `array_length(column, 1) > 0` instead of `column != '[]'`
   - Re-grant EXECUTE permissions to `authenticated` and `service_role`

2. **Verify fix** by refreshing the Creative Intelligence V2 page - the dashboard should load with real data

---

## Technical Details

### Modified SQL (Key Sections)

```text
stance_performance CTE:
```
```sql
SELECT unnest(political_stances) as stance,
       COUNT(*) as creative_count,
       ...
FROM creative_performance
WHERE political_stances IS NOT NULL 
  AND array_length(political_stances, 1) > 0
GROUP BY unnest(political_stances)
HAVING COUNT(*) >= 2
```

```text
target_performance CTE:
```
```sql
SELECT unnest(targets_attacked) as target,
       COUNT(*) as creative_count,
       ...
FROM creative_performance
WHERE targets_attacked IS NOT NULL 
  AND array_length(targets_attacked, 1) > 0
GROUP BY unnest(targets_attacked)
HAVING COUNT(*) >= 2
```

```text
recommendations CTE (subquery):
```
```sql
(SELECT unnest(targets_attacked) LIMIT 1) as target_attacked
```

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/<new>.sql` | Updated `get_creative_intelligence` function |
| `src/integrations/supabase/types.ts` | Auto-regenerated after migration |

---

## Outcome

- RPC returns valid JSON with issue rankings, recommendations, and fatigue alerts
- Creative Intelligence V2 dashboard loads properly with real data
- CSS MIME warning remains in preview (harmless) but disappears in production

