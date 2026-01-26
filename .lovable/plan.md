
# Fix Attributed ROI - System-Wide Channel Detection Bug

## Problem Summary

The Attributed ROI is not working for **A New Policy** and several other organizations because the `get_actblue_dashboard_metrics` RPC function **does NOT use the `refcode_mappings` table** for channel detection.

### Impact Assessment

| Organization | Total Donations (30d) | Incorrectly Categorized as "Other" |
|-------------|----------------------|-----------------------------------|
| Michael Blake For Congress | 793 | **444 (56%)** |
| A New Policy | 234 | **215 (92%)** |
| Rashid For Illinois | 334 | **32 (10%)** |

**This is a SYSTEM-WIDE BUG affecting all organizations using custom refcodes.**

---

## Root Cause

The `get_actblue_dashboard_metrics` RPC function (created in migration `20260126001754`) uses this channel detection logic:

```sql
channel_data AS (
  SELECT
    COALESCE(
      CASE
        -- Priority 1: Meta click ID (refcode2)
        WHEN refcode2 IS NOT NULL AND refcode2 != '' THEN 'meta'
        -- Priority 2: Form contains 'sms'
        WHEN LOWER(contribution_form) LIKE '%sms%' THEN 'sms'
        -- Priority 3: Refcode patterns
        WHEN refcode ILIKE '%fb%' OR refcode ILIKE '%meta%' THEN 'meta'
        -- ... more patterns ...
        ELSE 'other'  -- PROBLEM: Falls here for custom refcodes!
      END,
      'other'
    ) as channel
  FROM filtered_transactions
)
```

**The problem**: Custom refcodes like `thpgtr`, `jp421`, `thaama` (used by A New Policy) don't match any pattern, so they're categorized as `'other'` even though they ARE correctly mapped to `platform='meta'` in the `refcode_mappings` table.

### Why This Happened

The `refcode_mappings` table contains proper mappings:

| refcode | platform | ad_id |
|---------|----------|-------|
| thpgtr | meta | 120237583841680651 |
| jp421 | meta | 120237582673480651 |
| thaama | meta | 120235738682380651 |
| jpmn | meta | 120235738682390651 |

But the RPC function never joins to this table!

---

## Solution

Update `get_actblue_dashboard_metrics` to **join to `refcode_mappings`** and use the mapped platform as the highest priority source.

### Updated Channel Detection Logic

```sql
-- Add LEFT JOIN to refcode_mappings in filtered_transactions CTE
filtered_transactions AS (
  SELECT t.*, rm.platform as mapped_platform
  FROM actblue_transactions t
  LEFT JOIN refcode_mappings rm 
    ON t.organization_id = rm.organization_id 
    AND t.refcode = rm.refcode
  -- ... existing WHERE clauses ...
),

channel_data AS (
  SELECT
    COALESCE(
      CASE
        -- Priority 0: Use refcode_mappings if available (NEW!)
        WHEN mapped_platform IS NOT NULL THEN mapped_platform
        -- Priority 1: Meta click ID (refcode2)
        WHEN refcode2 IS NOT NULL AND refcode2 != '' THEN 'meta'
        -- Priority 2: Contribution form contains 'sms'
        WHEN LOWER(contribution_form) LIKE '%sms%' THEN 'sms'
        -- Priority 3: Refcode pattern matching (fallback)
        WHEN refcode ILIKE '%sms%' OR refcode ILIKE '%text%' OR refcode ILIKE 'txt%' THEN 'sms'
        WHEN refcode ILIKE '%fb%' OR refcode ILIKE '%facebook%' OR refcode ILIKE '%meta%' THEN 'meta'
        WHEN refcode ILIKE '%email%' OR refcode ILIKE '%em_%' THEN 'email'
        WHEN refcode ILIKE '%organic%' OR refcode ILIKE '%direct%' THEN 'organic'
        -- Priority 4: Contribution form contains 'meta'
        WHEN LOWER(contribution_form) LIKE '%meta%' THEN 'meta'
        -- Fallback
        ELSE 'other'
      END,
      'other'
    ) as channel,
    -- ... rest of aggregation
  FROM filtered_transactions
  GROUP BY ...
)
```

---

## Database Migration

Create a new migration to replace the `get_actblue_dashboard_metrics` function:

```sql
-- Drop and recreate the function with refcode_mappings join
CREATE OR REPLACE FUNCTION public.get_actblue_dashboard_metrics(
  p_organization_id uuid, 
  p_start_date date, 
  p_end_date date, 
  p_campaign_id text DEFAULT NULL, 
  p_creative_id text DEFAULT NULL, 
  p_use_utc boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_timezone TEXT;
  v_result JSON;
BEGIN
  -- Get org timezone
  SELECT COALESCE(org_timezone, 'America/New_York')
  INTO v_timezone
  FROM client_organizations
  WHERE id = p_organization_id;

  WITH filtered_transactions AS (
    SELECT t.*, rm.platform as mapped_platform
    FROM actblue_transactions t
    LEFT JOIN refcode_mappings rm 
      ON t.organization_id = rm.organization_id 
      AND t.refcode = rm.refcode
    LEFT JOIN campaign_attribution ca 
      ON ca.refcode = t.refcode 
      AND ca.organization_id = t.organization_id
    WHERE t.organization_id = p_organization_id
      AND CASE 
        WHEN p_use_utc THEN DATE(t.transaction_date)
        ELSE DATE(t.transaction_date AT TIME ZONE v_timezone)
      END BETWEEN p_start_date AND p_end_date
      AND (p_campaign_id IS NULL OR ca.switchboard_campaign_id = p_campaign_id)
  ),
  summary AS (
    -- ... existing summary aggregation (unchanged)
  ),
  daily_data AS (
    -- ... existing daily aggregation (unchanged)
  ),
  channel_data AS (
    SELECT
      COALESCE(
        CASE
          -- NEW: Priority 0 - Use refcode_mappings platform if available
          WHEN mapped_platform IS NOT NULL THEN mapped_platform
          -- Priority 1: Meta click ID present (refcode2)
          WHEN refcode2 IS NOT NULL AND refcode2 != '' THEN 'meta'
          -- Priority 2: Contribution form indicates SMS
          WHEN contribution_form IS NOT NULL AND LOWER(contribution_form) LIKE '%sms%' THEN 'sms'
          -- Priority 3: Refcode patterns (fallback)
          WHEN refcode ILIKE '%sms%' OR refcode ILIKE '%text%' OR refcode ILIKE 'txt%' THEN 'sms'
          WHEN refcode ILIKE '%fb%' OR refcode ILIKE '%facebook%' OR refcode ILIKE '%ig%' 
               OR refcode ILIKE '%instagram%' OR refcode ILIKE '%meta%' THEN 'meta'
          WHEN refcode ILIKE '%email%' OR refcode ILIKE '%em_%' OR refcode ILIKE 'em%' THEN 'email'
          WHEN refcode ILIKE '%organic%' OR refcode ILIKE '%direct%' THEN 'organic'
          -- Priority 4: Contribution form indicates Meta
          WHEN contribution_form IS NOT NULL AND LOWER(contribution_form) LIKE '%meta%' THEN 'meta'
          ELSE 'other'
        END,
        'other'
      ) as channel,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'donation'), 0) as revenue,
      COALESCE(SUM(net_amount) FILTER (WHERE transaction_type = 'donation'), 0) as net_revenue,
      COUNT(*) FILTER (WHERE transaction_type = 'donation') as count,
      COUNT(DISTINCT donor_email) FILTER (WHERE transaction_type = 'donation') as donors
    FROM filtered_transactions
    GROUP BY 
      CASE
        WHEN mapped_platform IS NOT NULL THEN mapped_platform
        WHEN refcode2 IS NOT NULL AND refcode2 != '' THEN 'meta'
        WHEN contribution_form IS NOT NULL AND LOWER(contribution_form) LIKE '%sms%' THEN 'sms'
        WHEN refcode ILIKE '%sms%' OR refcode ILIKE '%text%' OR refcode ILIKE 'txt%' THEN 'sms'
        WHEN refcode ILIKE '%fb%' OR refcode ILIKE '%facebook%' OR refcode ILIKE '%ig%' 
             OR refcode ILIKE '%instagram%' OR refcode ILIKE '%meta%' THEN 'meta'
        WHEN refcode ILIKE '%email%' OR refcode ILIKE '%em_%' OR refcode ILIKE 'em%' THEN 'email'
        WHEN refcode ILIKE '%organic%' OR refcode ILIKE '%direct%' THEN 'organic'
        WHEN contribution_form IS NOT NULL AND LOWER(contribution_form) LIKE '%meta%' THEN 'meta'
        ELSE 'other'
      END
  )
  SELECT json_build_object(
    'summary', (SELECT row_to_json(s) FROM summary s),
    'daily', (SELECT COALESCE(json_agg(d ORDER BY d.day), '[]'::json) FROM daily_data d),
    'channels', (SELECT COALESCE(json_agg(c), '[]'::json) FROM channel_data c),
    'timezone', v_timezone
  ) INTO v_result;

  RETURN v_result;
END;
$$;
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/NEW_migration.sql` | Create new migration with updated RPC function |

**No frontend changes required** - the hook already consumes the channel breakdown correctly.

---

## Expected Results After Fix

For A New Policy (current 30 days):

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| Meta Attributed Revenue | ~$0 | ~$18,000+ |
| SMS Attributed Revenue | $0 | $0 |
| Attributed ROI | 0% | Calculated correctly |
| Attribution Rate | ~8% | ~92%+ |

---

## Testing Plan

1. After migration, verify channel breakdown:
```sql
SELECT channel, COUNT(*), SUM(revenue) 
FROM (SELECT ... channel_data logic ...) 
WHERE organization_id = '346d6aaf-34b3-435c-8cd1-3420d6a068d6'
GROUP BY channel;
```

2. Refresh dashboard for A New Policy and verify:
   - Meta Attributed Revenue shows ~$18K+
   - Attributed ROI is calculated
   - Attribution Rate is ~92%+

3. Verify no regression for other organizations

---

## Risk Assessment

**Low risk** - This is an additive change:
- Adds a LEFT JOIN (won't break if no mappings exist)
- Pattern matching still works as fallback
- No frontend changes needed
- Easy to verify results match expected values
