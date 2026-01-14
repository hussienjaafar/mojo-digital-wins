# How to Validate ActBlue Metrics on a Real Org

This checklist helps validate that ActBlue metrics are correct and consistent after the metrics correctness fix.

## Prerequisites

1. Access to Supabase dashboard for the target environment
2. Access to the ActBlue UI for the same organization
3. Organization ID of the org to validate

## Quick Validation Steps

### Step 1: Enable Debug Panel

Add `?debug=actblue` to any dashboard URL to show the debug panel:
```
https://your-app.com/dashboard?debug=actblue
```

The debug panel shows:
- Raw transaction sums (Gross, Net, Refunds, Net Revenue)
- Dashboard computed values for comparison
- Any discrepancies highlighted in red
- Timezone shift warnings
- Duplicate transaction warnings

### Step 2: Run SQL Verification Script

Open Supabase SQL Editor and run `scripts/verify-actblue-rollup.sql` with these parameters:

```sql
-- Replace these values
:org_id = 'your-organization-uuid'
:start_date = '2025-01-01'
:end_date = '2025-01-14'
:org_timezone = 'America/New_York'
```

The script produces 6 result sets:
1. **Raw Daily UTC** - Transactions bucketed by UTC day
2. **Raw Daily Org TZ** - Transactions bucketed by org timezone (should match dashboard)
3. **daily_aggregated_metrics** - What calculate-roi stored
4. **Timezone Shifts** - Transactions that move between days due to timezone
5. **Duplicates** - Any duplicate transaction_ids
6. **Period Summary** - Totals for comparison with dashboard KPIs

### Step 3: Compare with ActBlue UI

1. Log into ActBlue admin for the organization
2. Navigate to Reports > Contributions
3. Set the same date range as your test
4. Note the "Raised" amount (this is GROSS raised)

**Expected Results:**
- Our "Gross Raised" should match ActBlue's "Raised"
- If they differ, check:
  - Timezone differences (ActBlue uses Eastern Time)
  - Recent transactions not yet synced
  - Webhook vs CSV sync timing

### Step 4: Verify Metric Labels

Check these pages for correct labeling:

| Page | Metric | Expected Label |
|------|--------|----------------|
| Dashboard Overview | KPI Card | "Net Revenue" (with Gross shown as subtitle) |
| Dashboard Charts | Chart series | "Net Donations" |
| Donation Metrics | KPI Card | "Gross Raised" (with "Before fees" subtitle) |
| Ad Performance | Summary | "Net Raised" |
| Client Overview | KPI Card | "Net Revenue" |

### Step 5: Check for Duplicates

Run this query to check for any duplicates:

```sql
SELECT * FROM find_actblue_duplicates('your-org-id');
```

If duplicates exist, you can preview the merge:
```sql
SELECT * FROM merge_actblue_duplicates('your-org-id', TRUE); -- dry run
```

And execute if needed (admin only):
```sql
SELECT * FROM merge_actblue_duplicates('your-org-id', FALSE); -- actual merge
```

## Common Issues and Solutions

### Issue: Dashboard shows different amount than ActBlue

**Causes:**
1. Timezone mismatch - Check if transactions near midnight are bucketing differently
2. Sync delay - Recent transactions may not be synced yet
3. Refund handling - Our "Net Revenue" includes refunds, ActBlue "Raised" doesn't

**Solution:**
- Use the debug panel to see exact breakdown
- Compare "Gross Raised" (not Net Revenue) with ActBlue's "Raised"
- Check the timezone shift transactions in SQL results

### Issue: Numbers differ between dashboard pages

**Causes:**
1. Different date range selections
2. One page using gross, another using net
3. Cached data from before the fix

**Solution:**
- Clear browser cache and React Query cache
- Verify date ranges match exactly
- Check the metric labels - "Gross Raised" vs "Net Revenue"

### Issue: Duplicates detected

**Causes:**
1. Same transaction ingested via webhook AND CSV with different IDs
2. CSV using receipt_id when lineitem_id was unavailable

**Solution:**
- Run the merge function to dedupe
- Check if receipt_id transactions need to be mapped to lineitem_id

## Verification Checklist

- [ ] Debug panel shows matching Raw TX vs Dashboard values
- [ ] SQL verification shows no timezone shift discrepancies
- [ ] SQL verification shows no duplicates
- [ ] Gross Raised matches ActBlue UI (within $1 tolerance for timing)
- [ ] All dashboard pages use consistent labels
- [ ] Tests pass: `npx vitest run`
- [ ] Build succeeds: `npm run build`

## Support

If validation fails, check:
1. Supabase Edge Function logs for sync errors
2. Browser console for query errors
3. The webhook_logs table for failed webhook deliveries
