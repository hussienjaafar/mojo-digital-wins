
CREATE OR REPLACE FUNCTION sync_donor_demographics_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email TEXT;
  _org_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _email := OLD.donor_email;
    _org_id := OLD.organization_id;
  ELSE
    _email := NEW.donor_email;
    _org_id := NEW.organization_id;
  END IF;

  IF _email IS NULL OR _email = '' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Upsert: insert new donors or update existing ones
  INSERT INTO donor_demographics (
    organization_id, donor_email,
    first_name, last_name, city, state, zip, employer, occupation,
    total_donated, donation_count, first_donation_date, last_donation_date, is_recurring
  )
  SELECT
    _org_id,
    _email,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.first_name END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.last_name END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.city END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.state END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.zip END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.employer END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.occupation END,
    sub.actual_total,
    sub.actual_count,
    sub.first_date,
    sub.last_date,
    sub.has_recurring
  FROM (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'donation'), 0) AS actual_total,
      COALESCE(COUNT(*) FILTER (WHERE transaction_type = 'donation'), 0) AS actual_count,
      MIN(transaction_date) FILTER (WHERE transaction_type = 'donation') AS first_date,
      MAX(transaction_date) FILTER (WHERE transaction_type = 'donation') AS last_date,
      bool_or(COALESCE(is_recurring, false)) AS has_recurring
    FROM actblue_transactions
    WHERE donor_email = _email AND organization_id = _org_id
  ) sub
  ON CONFLICT (organization_id, donor_email) DO UPDATE SET
    total_donated = EXCLUDED.total_donated,
    donation_count = EXCLUDED.donation_count,
    first_donation_date = EXCLUDED.first_donation_date,
    last_donation_date = EXCLUDED.last_donation_date,
    is_recurring = EXCLUDED.is_recurring,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;
