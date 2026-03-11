

# Fix: COALESCE type mismatch in `get_donor_universe`

## Problem

Lines 90-91 of the RPC:
```sql
COALESCE(ts.first_donation_date, dd.first_donation_date::text) AS first_donation_date,
COALESCE(ts.last_donation_date, dd.last_donation_date::text) AS last_donation_date,
```

`ts.first_donation_date` is `timestamptz` (from `MIN(at.transaction_date)`), but the fallback casts `dd.first_donation_date` to `::text`. PostgreSQL requires all COALESCE arguments to share a compatible type.

## Fix

Replace `::text` casts with `::timestamptz` (or remove the cast entirely if `dd.first_donation_date` is already a date/timestamp type — dates auto-cast to timestamptz):

```sql
COALESCE(ts.first_donation_date, dd.first_donation_date::timestamptz) AS first_donation_date,
COALESCE(ts.last_donation_date, dd.last_donation_date::timestamptz) AS last_donation_date,
```

## Scope

Single migration file to `CREATE OR REPLACE FUNCTION get_donor_universe` with the two-line fix. No frontend changes needed.

