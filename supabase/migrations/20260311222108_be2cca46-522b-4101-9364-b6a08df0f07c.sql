
-- Step 1: Rewrite get_donor_universe RPC to fix double-counting bug
-- Step 2: Add sync trigger on actblue_transactions

CREATE OR REPLACE FUNCTION get_donor_universe(
  _page INT DEFAULT 1,
  _page_size INT DEFAULT 100,
  _org_filter UUID[] DEFAULT NULL,
  _state_filter TEXT DEFAULT NULL,
  _min_amount NUMERIC DEFAULT NULL,
  _max_amount NUMERIC DEFAULT NULL,
  _recurring_filter BOOLEAN DEFAULT NULL,
  _crossover_only BOOLEAN DEFAULT FALSE,
  _search TEXT DEFAULT NULL,
  _channel_filter TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _offset INT;
  _result JSON;
BEGIN
  -- Admin-only guard
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('donors', '[]'::json, 'total_count', 0, 'crossover_count', 0);
  END IF;

  _offset := (_page - 1) * _page_size;

  WITH tx_stats AS (
    -- Pre-aggregate transactions per donor_email + org BEFORE joining demographics
    SELECT
      at.donor_email,
      at.organization_id,
      SUM(at.amount) FILTER (WHERE at.transaction_type = 'donation') AS total_donated,
      COUNT(*) FILTER (WHERE at.transaction_type = 'donation') AS donation_count,
      MIN(at.transaction_date) FILTER (WHERE at.transaction_type = 'donation') AS first_donation_date,
      MAX(at.transaction_date) FILTER (WHERE at.transaction_type = 'donation') AS last_donation_date,
      bool_or(COALESCE(at.is_recurring, false)) AS is_recurring,
      -- Channel detection: pick the most specific channel found across transactions
      CASE
        WHEN bool_or(rm.platform IS NOT NULL) THEN MAX(rm.platform) FILTER (WHERE rm.platform IS NOT NULL)
        WHEN bool_or(at.refcode2 LIKE 'fb_%') THEN 'meta'
        WHEN bool_or(at.contribution_form ILIKE '%sms%') THEN 'sms'
        WHEN bool_or(at.refcode LIKE 'text-%' OR at.refcode LIKE 'sms-%') THEN 'sms'
        WHEN bool_or(at.refcode LIKE 'ads_%' OR at.refcode LIKE 'fb-%') THEN 'meta'
        ELSE 'organic'
      END AS primary_channel,
      -- Collect all distinct channels
      array_agg(DISTINCT
        CASE
          WHEN rm.platform IS NOT NULL THEN rm.platform
          WHEN at.refcode2 LIKE 'fb_%' THEN 'meta'
          WHEN at.contribution_form ILIKE '%sms%' THEN 'sms'
          WHEN at.refcode LIKE 'text-%' OR at.refcode LIKE 'sms-%' THEN 'sms'
          WHEN at.refcode LIKE 'ads_%' OR at.refcode LIKE 'fb-%' THEN 'meta'
          ELSE 'organic'
        END
      ) AS channels
    FROM actblue_transactions at
    LEFT JOIN refcode_mappings rm ON rm.refcode = at.refcode
      AND rm.organization_id = at.organization_id
    WHERE at.donor_email IS NOT NULL AND at.donor_email != ''
    GROUP BY at.donor_email, at.organization_id
  ),
  donor_base AS (
    -- Join demographics for PII/voter fields, use tx_stats for financials
    SELECT
      dd.donor_email,
      dd.first_name,
      dd.last_name,
      dd.phone,
      dd.address,
      dd.city,
      dd.state,
      dd.zip,
      dd.employer,
      dd.occupation,
      dd.age,
      dd.gender,
      dd.party_affiliation,
      dd.voter_score,
      dd.voter_file_matched,
      COALESCE(ts.total_donated, 0) AS total_donated,
      COALESCE(ts.donation_count, 0) AS donation_count,
      COALESCE(ts.is_recurring, dd.is_recurring, false) AS is_recurring,
      COALESCE(ts.first_donation_date, dd.first_donation_date::text) AS first_donation_date,
      COALESCE(ts.last_donation_date, dd.last_donation_date::text) AS last_donation_date,
      dd.organization_id,
      co.name AS org_name,
      COALESCE(ts.channels, ARRAY['organic']) AS channels
    FROM donor_demographics dd
    JOIN client_organizations co ON co.id = dd.organization_id
    LEFT JOIN tx_stats ts ON ts.donor_email = dd.donor_email
      AND ts.organization_id = dd.organization_id
    WHERE dd.donor_email IS NOT NULL AND dd.donor_email != ''
  ),
  unified AS (
    SELECT
      lower(trim(donor_email)) AS identity_key,
      MAX(first_name) AS first_name,
      MAX(last_name) AS last_name,
      MAX(phone) AS phone,
      MAX(address) AS address,
      MAX(city) AS city,
      MAX(state) AS state,
      MAX(zip) AS zip,
      MAX(employer) AS employer,
      MAX(occupation) AS occupation,
      MAX(age) AS age,
      MAX(gender) AS gender,
      MAX(party_affiliation) AS party_affiliation,
      MAX(voter_score) AS voter_score,
      bool_or(voter_file_matched) AS voter_file_matched,
      SUM(total_donated) AS total_donated,
      SUM(donation_count) AS donation_count,
      bool_or(is_recurring) AS is_recurring,
      MIN(first_donation_date) AS first_donation_date,
      MAX(last_donation_date) AS last_donation_date,
      array_agg(DISTINCT org_name ORDER BY org_name) AS all_orgs,
      array_agg(DISTINCT organization_id) AS all_org_ids,
      COUNT(DISTINCT organization_id) AS crossover_count,
      -- Flatten all channels across orgs
      (SELECT array_agg(DISTINCT ch) FROM unnest(array_agg(channels)) AS flattened(ch_arr), unnest(ch_arr) AS ch) AS channels,
      MAX(donor_email) AS donor_email
    FROM donor_base
    GROUP BY lower(trim(donor_email))
  ),
  filtered AS (
    SELECT *
    FROM unified u
    WHERE (_org_filter IS NULL OR u.all_org_ids && _org_filter)
    AND (_state_filter IS NULL OR u.state ILIKE _state_filter)
    AND (_min_amount IS NULL OR u.total_donated >= _min_amount)
    AND (_max_amount IS NULL OR u.total_donated <= _max_amount)
    AND (_recurring_filter IS NULL OR u.is_recurring = _recurring_filter)
    AND (_crossover_only = FALSE OR u.crossover_count > 1)
    AND (
      _search IS NULL
      OR u.first_name ILIKE '%' || _search || '%'
      OR u.last_name ILIKE '%' || _search || '%'
      OR u.donor_email ILIKE '%' || _search || '%'
    )
    AND (
      _channel_filter IS NULL
      OR _channel_filter = ANY(u.channels)
    )
  ),
  counts AS (
    SELECT
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE crossover_count > 1) AS crossover_count
    FROM filtered
  )
  SELECT json_build_object(
    'donors', COALESCE((
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT
          f.identity_key,
          f.donor_email,
          f.first_name,
          f.last_name,
          f.phone,
          f.address,
          f.city,
          f.state,
          f.zip,
          f.employer,
          f.occupation,
          f.age,
          f.gender,
          f.party_affiliation,
          f.voter_score,
          f.voter_file_matched,
          f.total_donated,
          f.donation_count,
          f.is_recurring,
          f.first_donation_date,
          f.last_donation_date,
          f.all_orgs,
          f.crossover_count,
          f.channels
        FROM filtered f
        ORDER BY f.total_donated DESC NULLS LAST
        LIMIT _page_size
        OFFSET _offset
      ) d
    ), '[]'::json),
    'total_count', (SELECT total_count FROM counts),
    'crossover_count', (SELECT crossover_count FROM counts)
  ) INTO _result;

  RETURN _result;
END;
$$;

-- Step 3: Sync trigger to keep donor_demographics totals accurate
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
  -- Determine the affected donor_email and organization_id
  IF TG_OP = 'DELETE' THEN
    _email := OLD.donor_email;
    _org_id := OLD.organization_id;
  ELSE
    _email := NEW.donor_email;
    _org_id := NEW.organization_id;
  END IF;

  -- Skip if no email
  IF _email IS NULL OR _email = '' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recompute totals from actual transactions
  UPDATE donor_demographics SET
    total_donated = sub.actual_total,
    donation_count = sub.actual_count,
    first_donation_date = sub.first_date::date,
    last_donation_date = sub.last_date::date,
    is_recurring = sub.has_recurring
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
  WHERE donor_demographics.donor_email = _email
    AND donor_demographics.organization_id = _org_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_sync_donor_totals ON actblue_transactions;
CREATE TRIGGER trg_sync_donor_totals
AFTER INSERT OR UPDATE OR DELETE ON actblue_transactions
FOR EACH ROW EXECUTE FUNCTION sync_donor_demographics_totals();
