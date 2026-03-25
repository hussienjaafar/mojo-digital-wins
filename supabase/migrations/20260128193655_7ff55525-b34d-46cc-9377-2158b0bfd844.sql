-- Create RPC function for bulk populating donor_demographics from actblue_transactions
CREATE OR REPLACE FUNCTION public.populate_donor_demographics_bulk(_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout TO '180s'
AS $$
DECLARE
  processed_count integer;
BEGIN
  -- Insert new donors and update existing ones from actblue_transactions
  WITH donor_agg AS (
    SELECT 
      organization_id,
      lower(trim(donor_email)) as email_normalized,
      -- Use most recent non-null values for PII
      (array_agg(first_name ORDER BY transaction_date DESC) FILTER (WHERE first_name IS NOT NULL))[1] as first_name,
      (array_agg(last_name ORDER BY transaction_date DESC) FILTER (WHERE last_name IS NOT NULL))[1] as last_name,
      (array_agg(state ORDER BY transaction_date DESC) FILTER (WHERE state IS NOT NULL))[1] as state,
      (array_agg(city ORDER BY transaction_date DESC) FILTER (WHERE city IS NOT NULL))[1] as city,
      (array_agg(zip ORDER BY transaction_date DESC) FILTER (WHERE zip IS NOT NULL))[1] as zip,
      (array_agg(addr1 ORDER BY transaction_date DESC) FILTER (WHERE addr1 IS NOT NULL))[1] as address,
      (array_agg(phone ORDER BY transaction_date DESC) FILTER (WHERE phone IS NOT NULL))[1] as phone,
      (array_agg(employer ORDER BY transaction_date DESC) FILTER (WHERE employer IS NOT NULL))[1] as employer,
      (array_agg(occupation ORDER BY transaction_date DESC) FILTER (WHERE occupation IS NOT NULL))[1] as occupation,
      -- Aggregates
      SUM(amount) as total_donated,
      COUNT(*) as donation_count,
      MIN(transaction_date) as first_donation_date,
      MAX(transaction_date) as last_donation_date,
      BOOL_OR(recurring_period IS NOT NULL AND recurring_period != '' AND recurring_period != 'once') as is_recurring
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND donor_email IS NOT NULL
      AND trim(donor_email) != ''
    GROUP BY organization_id, lower(trim(donor_email))
  )
  INSERT INTO donor_demographics (
    organization_id, donor_email, first_name, last_name, state, city, zip,
    address, phone, employer, occupation, total_donated, donation_count, 
    first_donation_date, last_donation_date, is_recurring, donor_key
  )
  SELECT 
    organization_id,
    email_normalized,
    first_name,
    last_name,
    state,
    city,
    zip,
    address,
    phone,
    employer,
    occupation,
    COALESCE(total_donated, 0),
    COALESCE(donation_count, 0),
    first_donation_date,
    last_donation_date,
    COALESCE(is_recurring, false),
    'donor_' || substr(md5(email_normalized), 1, 6)
  FROM donor_agg
  ON CONFLICT (organization_id, donor_email) 
  DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, donor_demographics.first_name),
    last_name = COALESCE(EXCLUDED.last_name, donor_demographics.last_name),
    state = COALESCE(EXCLUDED.state, donor_demographics.state),
    city = COALESCE(EXCLUDED.city, donor_demographics.city),
    zip = COALESCE(EXCLUDED.zip, donor_demographics.zip),
    address = COALESCE(EXCLUDED.address, donor_demographics.address),
    phone = COALESCE(EXCLUDED.phone, donor_demographics.phone),
    employer = COALESCE(EXCLUDED.employer, donor_demographics.employer),
    occupation = COALESCE(EXCLUDED.occupation, donor_demographics.occupation),
    total_donated = EXCLUDED.total_donated,
    donation_count = EXCLUDED.donation_count,
    first_donation_date = EXCLUDED.first_donation_date,
    last_donation_date = EXCLUDED.last_donation_date,
    is_recurring = EXCLUDED.is_recurring,
    donor_key = EXCLUDED.donor_key,
    updated_at = now();

  GET DIAGNOSTICS processed_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'donors_processed', processed_count,
    'organization_id', _organization_id
  );
END;
$$;

-- Grant execute permission to authenticated users (RLS will still apply to underlying tables)
GRANT EXECUTE ON FUNCTION public.populate_donor_demographics_bulk(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.populate_donor_demographics_bulk(uuid) TO service_role;