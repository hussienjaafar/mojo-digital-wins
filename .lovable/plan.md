

# Donor Universe Accuracy Audit — Findings & Fix Plan

## Audit Summary

| Issue | Count | Severity | Impact on RPC Output |
|-------|-------|----------|---------------------|
| **Case-sensitive email duplicates in `donor_demographics`** | **243 donors, 246 extra rows** | **CRITICAL** | Currently masked by `lower(trim())` in unified CTE, but fragile |
| **Case-sensitive email duplicates in `actblue_transactions`** | **265 donors, 269 variants** | HIGH | Causes fragmented demo rows via trigger |
| **Stale demo totals (after case dedup)** | **18 donors, $789 discrepancy** | MEDIUM | Not visible in RPC (tx_stats overrides), but affects other systems |
| **Recurring flag mismatches in demo cache** | **30** | LOW | Not visible in RPC (tx_stats overrides) |
| **Date mismatches in demo cache** | **227 first / 241 last** | LOW | Not visible in RPC (tx_stats overrides) |
| **Missing donors (no demo row)** | **0** | None | Fixed in prior audit |
| **Orphan demo rows (no transactions)** | **0** | None | Fixed in prior audit |
| **Motivation data sparsity** | 5/109 creatives have pain_points | INFO | Correct but sparse — data limitation |
| **`issue_specifics` column always empty** | 0/109 creatives | INFO | RPC references it but no data exists |
| **Two overloaded RPCs with different signatures** | 2 overloads | LOW | Old overload lacks admin check and motivation data |

## Key Finding: Case-Sensitivity Bug

The root cause of most remaining issues is that **email addresses are stored case-sensitively** throughout the system:

- The unique constraint on `donor_demographics` is `UNIQUE (organization_id, donor_email)` — case-sensitive
- The sync trigger (`trg_sync_donor_totals`) uses `NEW.donor_email` as-is without normalizing
- ActBlue sends the same donor with different capitalizations (`glass.m.ashley@gmail.com`, `Glass.M.Ashley@gmail.com`, `Glass.m.ashley@gmail.com`)
- This creates **3 separate rows** for the same person, each with partial totals

The RPC currently produces **correct output** because `unified` groups by `lower(trim())` and sums across case variants. But this is fragile and wastes resources.

## Fix Plan

### Step 1: Normalize the sync trigger

Update `sync_donor_demographics_totals()` to normalize email with `lower(trim())` before the upsert. This prevents future duplicates.

### Step 2: Deduplicate existing `donor_demographics` rows

Merge the 243 duplicate donor sets by:
- Keeping the row with the most data (longest non-null PII)
- Updating its email to `lower(trim())`
- Deleting the duplicate rows

### Step 3: Full reconciliation pass

Re-sync all `total_donated`, `donation_count`, `first_donation_date`, `last_donation_date`, and `is_recurring` from `actblue_transactions` (using `lower(trim())` on the join). This fixes the 18 stale totals, 30 recurring mismatches, and 468 date mismatches in one pass.

### Step 4: Replace case-sensitive unique constraint

Drop the existing `UNIQUE (organization_id, donor_email)` and create a new one on `(organization_id, lower(trim(donor_email)))` to prevent future case-variant duplicates at the database level.

### Step 5: Drop old RPC overload

Remove the old `get_donor_universe` overload (the one returning TABLE with `_org_id`, `_sort_by` params) that lacks the admin check and motivation data. The frontend only uses the JSON-returning version.

### Files changed

| File | Change |
|------|--------|
| New migration SQL | Steps 1-5: normalize trigger, deduplicate, reconcile, replace constraint, drop old RPC |

No frontend changes needed — the RPC signature and output format remain identical.

