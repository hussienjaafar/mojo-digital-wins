
-- =============================================================
-- Donor Universe Accuracy Fix: Case-sensitivity & Reconciliation
-- =============================================================

-- STEP 1: Replace sync trigger to normalize emails with lower(trim())
CREATE OR REPLACE FUNCTION public.sync_donor_demographics_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email TEXT;
  _org_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _email := lower(trim(OLD.donor_email));
    _org_id := OLD.organization_id;
  ELSE
    _email := lower(trim(NEW.donor_email));
    _org_id := NEW.organization_id;
  END IF;

  IF _email IS NULL OR _email = '' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

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
    WHERE lower(trim(donor_email)) = _email AND organization_id = _org_id
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
$function$;

-- STEP 2: Deduplicate existing donor_demographics rows
-- For each set of case-variant duplicates, keep the one with the most PII data,
-- normalize its email, and delete the rest.
WITH ranked AS (
  SELECT
    id,
    organization_id,
    donor_email,
    lower(trim(donor_email)) AS norm_email,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, lower(trim(donor_email))
      ORDER BY
        (CASE WHEN first_name IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN last_name IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN city IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN state IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN zip IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN employer IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN occupation IS NOT NULL THEN 1 ELSE 0 END) DESC,
        total_donated DESC NULLS LAST,
        created_at ASC
    ) AS rn
  FROM donor_demographics
),
keepers AS (
  SELECT id, norm_email FROM ranked WHERE rn = 1
)
-- Delete all non-keeper duplicates
DELETE FROM donor_demographics
WHERE id IN (
  SELECT r.id FROM ranked r
  LEFT JOIN keepers k ON r.id = k.id
  WHERE k.id IS NULL
    AND r.norm_email IN (
      SELECT norm_email FROM ranked GROUP BY organization_id, norm_email HAVING COUNT(*) > 1
    )
);

-- Normalize email on remaining rows
UPDATE donor_demographics
SET donor_email = lower(trim(donor_email))
WHERE donor_email <> lower(trim(donor_email));

-- STEP 3: Full reconciliation of aggregate fields
UPDATE donor_demographics dd
SET
  total_donated = sub.actual_total,
  donation_count = sub.actual_count,
  first_donation_date = sub.first_date,
  last_donation_date = sub.last_date,
  is_recurring = sub.has_recurring,
  updated_at = now()
FROM (
  SELECT
    organization_id,
    lower(trim(donor_email)) AS norm_email,
    COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'donation'), 0) AS actual_total,
    COALESCE(COUNT(*) FILTER (WHERE transaction_type = 'donation'), 0) AS actual_count,
    MIN(transaction_date) FILTER (WHERE transaction_type = 'donation') AS first_date,
    MAX(transaction_date) FILTER (WHERE transaction_type = 'donation') AS last_date,
    bool_or(COALESCE(is_recurring, false)) AS has_recurring
  FROM actblue_transactions
  GROUP BY organization_id, lower(trim(donor_email))
) sub
WHERE dd.organization_id = sub.organization_id
  AND dd.donor_email = sub.norm_email
  AND (
    dd.total_donated IS DISTINCT FROM sub.actual_total
    OR dd.donation_count IS DISTINCT FROM sub.actual_count
    OR dd.first_donation_date IS DISTINCT FROM sub.first_date
    OR dd.last_donation_date IS DISTINCT FROM sub.last_date
    OR dd.is_recurring IS DISTINCT FROM sub.has_recurring
  );

-- STEP 4: Replace case-sensitive unique constraint with case-insensitive one
ALTER TABLE donor_demographics
  DROP CONSTRAINT donor_demographics_organization_id_donor_email_key;

CREATE UNIQUE INDEX donor_demographics_org_email_lower_unique
  ON donor_demographics (organization_id, lower(trim(donor_email)));

-- STEP 5: Drop old RPC overload (the TABLE-returning version)
DROP FUNCTION IF EXISTS public.get_donor_universe(
  _org_id uuid,
  _search text,
  _min_donated numeric,
  _max_donated numeric,
  _is_recurring boolean,
  _channels text[],
  _party text,
  _state text,
  _sort_by text,
  _sort_dir text,
  _page integer,
  _page_size integer
);
