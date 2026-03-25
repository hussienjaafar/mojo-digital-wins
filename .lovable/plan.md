

# Apply Migration: Drop Redundant ActBlue RPCs

## Critical Blocker Found

**Two edge functions still call `get_actblue_period_summary`** and will break if we drop it now:

1. **`supabase/functions/backfill-daily-metrics/index.ts`** (line 107) — reads `total_net_donations`, `total_donation_count`, `total_unique_donors`
2. **`supabase/functions/calculate-roi/index.ts`** (line 133) — reads `net_raised`, `total_donations`, `unique_donors`

These are server-side edge functions (not frontend), so your frontend consolidation didn't cover them. Dropping the function will cause runtime errors in both.

## Plan

### Step 1: Update edge functions to use `get_actblue_dashboard_metrics`

Both edge functions need to switch from `get_actblue_period_summary` to `get_actblue_dashboard_metrics` and map the returned fields accordingly.

| File | Change |
|------|--------|
| `supabase/functions/backfill-daily-metrics/index.ts` | Replace `.rpc('get_actblue_period_summary', ...)` with `.rpc('get_actblue_dashboard_metrics', ...)` and update field reads (`total_net_donations` → whatever the unified RPC returns) |
| `supabase/functions/calculate-roi/index.ts` | Same RPC swap and field mapping |

### Step 2: Deploy updated edge functions

Deploy both `backfill-daily-metrics` and `calculate-roi` so the new code is live before dropping the old RPC.

### Step 3: Apply the SQL migration

Run the 4 `DROP FUNCTION IF EXISTS` statements from `supabase/migrations/20260325180000_drop_redundant_actblue_rpcs.sql`.

### Step 4: Verify

Query `information_schema.routines` to confirm all 4 functions are gone.

## Technical Details

The unified `get_actblue_dashboard_metrics` RPC signature and return fields need to be checked to write the correct mapping. The two edge functions currently expect different field names from each other (one reads `total_net_donations`, the other reads `net_raised`), suggesting they were written against different versions of the same RPC — further evidence that consolidation is the right move.

