

# Donor Demographics Table — Deep Audit Results and Fix Plan

## Audit Findings

### Summary

| Issue | Count | Severity |
|-------|-------|----------|
| Missing donors (in transactions, not in demographics) | **1,870** | HIGH |
| Orphan demographics (no matching transactions) | **1,439** | HIGH |
| Total/count mismatches (all orphans, $128,910 discrepancy) | **1,442** | HIGH |
| Date mismatches — time truncation only | 45,990 | LOW |
| Date mismatches — actually wrong day | **2** | MEDIUM |
| Recurring flag mismatches | **77** | MEDIUM |
| Missing PII (fillable from transactions) | 70 of ~691 | LOW |
| Duplicate demographics rows | 0 | None |

### Detail

**1. 1,870 missing donors** — These donors have transactions but were never added to `donor_demographics`. The new upsert trigger will prevent this going forward, but existing gaps need a one-time backfill.

**2. 1,439 orphan records** — Demographics rows (all in org `8ba98ab9`) that have totals cached but zero matching transactions. These are stale records from deleted/moved transactions and inflate donor counts.

**3. 45,990 date "mismatches"** — Almost all are just timestamp precision differences (`2025-09-04 00:00:00` vs `2025-09-04 21:49:56`). The original backfill stored date-only values. Only 2 records have genuinely wrong dates.

**4. 77 recurring flag mismatches** — Minor, will be corrected in the reconciliation.

---

## Fix Plan

### Single migration that runs a full reconciliation

One SQL migration with three steps:

**Step 1: Insert missing donors** — `INSERT INTO donor_demographics ... SELECT` from `actblue_transactions` for the 1,870 donors not yet in the table, aggregating their totals.

**Step 2: Reconcile all existing rows** — Update every row's `total_donated`, `donation_count`, `first_donation_date`, `last_donation_date`, and `is_recurring` from actual transaction data. This fixes the 1,442 total mismatches, 2 wrong dates, 77 recurring mismatches, and normalizes all timestamps.

**Step 3: Clean orphans** — Delete the 1,439 demographics rows that have zero matching transactions (stale data from deleted transactions).

**Step 4: Fill missing PII** — Update the ~70 rows where name/address is null but available in their transactions.

### Files changed

| File | Change |
|------|--------|
| New migration SQL | Full reconciliation: insert missing, update all totals/dates, delete orphans, fill PII |

No frontend changes needed.

