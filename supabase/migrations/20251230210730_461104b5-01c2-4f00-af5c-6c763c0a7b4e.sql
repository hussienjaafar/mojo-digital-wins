-- Populate donor_demographics from actblue_transactions for org a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d
-- This will make the donor_segments view return data for this organization

INSERT INTO donor_demographics (
  organization_id,
  donor_email,
  first_name,
  last_name,
  city,
  state,
  zip,
  total_donated,
  donation_count,
  first_donation_date,
  last_donation_date,
  is_recurring
)
SELECT 
  organization_id,
  donor_email,
  MAX(first_name) as first_name,
  MAX(last_name) as last_name,
  MAX(city) as city,
  MAX(state) as state,
  MAX(zip) as zip,
  SUM(amount) as total_donated,
  COUNT(*) as donation_count,
  MIN(transaction_date::date) as first_donation_date,
  MAX(transaction_date::date) as last_donation_date,
  BOOL_OR(is_recurring) as is_recurring
FROM actblue_transactions
WHERE organization_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
  AND transaction_type = 'donation'
  AND donor_email IS NOT NULL
  AND donor_email != ''
GROUP BY organization_id, donor_email
ON CONFLICT (organization_id, donor_email) 
DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  zip = EXCLUDED.zip,
  total_donated = EXCLUDED.total_donated,
  donation_count = EXCLUDED.donation_count,
  first_donation_date = EXCLUDED.first_donation_date,
  last_donation_date = EXCLUDED.last_donation_date,
  is_recurring = EXCLUDED.is_recurring,
  updated_at = NOW();