-- Recalculate donor aggregates for all organizations from actblue_transactions
-- This fixes donors with incorrect total_donated, donation_count, and is_recurring values

UPDATE donor_demographics dd
SET 
  total_donated = COALESCE(agg.total_donated, 0),
  donation_count = COALESCE(agg.donation_count, 0),
  first_donation_date = COALESCE(agg.first_donation_date, dd.first_donation_date),
  last_donation_date = COALESCE(agg.last_donation_date, dd.last_donation_date),
  -- Fixed logic: recurring if ANY transaction has recurring_period that indicates recurring
  is_recurring = COALESCE(agg.is_recurring, false),
  updated_at = NOW()
FROM (
  SELECT 
    organization_id,
    lower(trim(donor_email)) as donor_email_normalized,
    SUM(CASE WHEN transaction_type = 'donation' THEN amount ELSE 0 END) as total_donated,
    COUNT(CASE WHEN transaction_type = 'donation' THEN 1 END) as donation_count,
    MIN(CASE WHEN transaction_type = 'donation' THEN transaction_date END) as first_donation_date,
    MAX(CASE WHEN transaction_type = 'donation' THEN transaction_date END) as last_donation_date,
    -- Fixed recurring logic: true if ANY transaction has recurring_period != 'once' and not empty
    BOOL_OR(
      recurring_period IS NOT NULL 
      AND recurring_period != '' 
      AND recurring_period != 'once'
    ) as is_recurring
  FROM actblue_transactions
  WHERE donor_email IS NOT NULL
  GROUP BY organization_id, lower(trim(donor_email))
) agg
WHERE dd.organization_id = agg.organization_id
  AND lower(trim(dd.donor_email)) = agg.donor_email_normalized;