

# Donor Universe Data Accuracy Audit — Findings and Fix Plan

## Issues Found

### Issue 1: RPC Double-Counting Bug (CRITICAL)

The `get_donor_universe` RPC LEFT JOINs `donor_demographics` to `actblue_transactions` (one row per transaction), then SUMs `total_donated` across all joined rows. A donor with 112 transactions has their `$2,220` total summed 112 times, showing **$248,657** in the dashboard.

This affects every donor with more than one transaction — essentially the entire dataset.

### Issue 2: Stale `total_donated` in `donor_demographics` (MODERATE)

There is no trigger syncing `total_donated` from actual transactions. The stored values are only set at initial ingestion/backfill time. Out of 47,457 donors:
- **2,348 donors** have discrepancies > $1 vs actual transaction sums
- **353 donors** are off by $100+
- Average discrepancy: $7.33

## Fix Plan

### Step 1: Fix the RPC — Compute totals from transactions directly

Rewrite `get_donor_universe` to compute donation totals from `actblue_transactions` instead of using the stale `donor_demographics.total_donated`. Structure:

```text
CTE 1: tx_stats — aggregate actblue_transactions per donor_email+org
        (SUM amount, COUNT, MIN/MAX dates, channel detection)
CTE 2: donor_base — donor_demographics fields joined to tx_stats
        (use tx_stats totals, not dd.total_donated)
CTE 3: unified — group by identity_key across orgs
CTE 4: filtered — apply all filters
```

This eliminates the multiplication bug entirely since transactions are pre-aggregated before joining to demographics.

### Step 2: Backfill `donor_demographics.total_donated`

Create a one-time migration that recomputes and updates `total_donated`, `donation_count`, `first_donation_date`, and `last_donation_date` from actual `actblue_transactions` data. This fixes the stale values for other parts of the app that read from `donor_demographics` directly.

```sql
UPDATE donor_demographics dd SET
  total_donated = sub.actual_total,
  donation_count = sub.actual_count,
  first_donation_date = sub.first_date,
  last_donation_date = sub.last_date
FROM (
  SELECT donor_email, organization_id,
    SUM(amount) FILTER (WHERE transaction_type='donation') as actual_total,
    COUNT(*) FILTER (WHERE transaction_type='donation') as actual_count,
    MIN(transaction_date) FILTER (WHERE transaction_type='donation') as first_date,
    MAX(transaction_date) FILTER (WHERE transaction_type='donation') as last_date
  FROM actblue_transactions
  GROUP BY donor_email, organization_id
) sub
WHERE dd.donor_email = sub.donor_email
  AND dd.organization_id = sub.organization_id;
```

### Step 3: Add a trigger to keep totals in sync going forward

Create a trigger on `actblue_transactions` that updates the corresponding `donor_demographics` row whenever a transaction is inserted, updated, or deleted — preventing future staleness.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Rewrite `get_donor_universe` RPC, backfill totals, add sync trigger |

No frontend changes needed — the component already reads from the RPC correctly.

