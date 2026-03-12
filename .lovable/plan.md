

# Auto-Add New Donors on First Transaction

## Problem
The `sync_donor_demographics_totals` trigger only runs `UPDATE` on `donor_demographics`. If a brand-new donor's email doesn't already exist in that table, nothing happens — they're invisible until a manual backfill is run.

## Plan

### 1. Enhance the trigger function (migration)

Replace the `UPDATE`-only logic with an `INSERT ... ON CONFLICT UPDATE` (upsert) pattern. When a new transaction arrives:

- **If donor exists** → update totals (same as today)
- **If donor is new** → insert a row with email, name, city, state, zip, and computed totals from their transactions

The upsert will populate PII fields (`first_name`, `last_name`, `city`, `state`, `zip`, `employer`, `occupation`) from the transaction row itself (available in `NEW`), so the donor record is useful immediately.

```sql
INSERT INTO donor_demographics (
  organization_id, donor_email, first_name, last_name,
  city, state, zip, employer, occupation,
  total_donated, donation_count, first_donation_date, last_donation_date, is_recurring
)
SELECT
  _org_id, _email, NEW.donor_first_name, NEW.donor_last_name,
  NEW.donor_city, NEW.donor_state, NEW.donor_zip,
  NEW.donor_employer, NEW.donor_occupation,
  sub.actual_total, sub.actual_count, sub.first_date, sub.last_date, sub.has_recurring
FROM ( /* same aggregation subquery */ ) sub
ON CONFLICT (organization_id, donor_email) DO UPDATE SET
  total_donated = EXCLUDED.total_donated,
  donation_count = EXCLUDED.donation_count,
  first_donation_date = EXCLUDED.first_donation_date,
  last_donation_date = EXCLUDED.last_donation_date,
  is_recurring = EXCLUDED.is_recurring,
  updated_at = now();
```

### Files changed

| File | Change |
|------|--------|
| New migration SQL | `CREATE OR REPLACE FUNCTION sync_donor_demographics_totals()` with upsert logic |

No frontend changes needed — the Donor Universe RPC already reads from `donor_demographics`.

