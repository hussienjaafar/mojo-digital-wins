
CREATE OR REPLACE FUNCTION public.get_donor_universe(
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 100,
  _org_filter uuid[] DEFAULT NULL,
  _state_filter text DEFAULT NULL,
  _min_amount numeric DEFAULT NULL,
  _max_amount numeric DEFAULT NULL,
  _recurring_filter boolean DEFAULT NULL,
  _crossover_only boolean DEFAULT false,
  _search text DEFAULT NULL,
  _channel_filter text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _offset INT;
  _result JSON;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('donors', '[]'::json, 'total_count', 0, 'crossover_count', 0);
  END IF;

  _offset := (_page - 1) * _page_size;

  WITH tx_stats AS (
    SELECT
      at.donor_email,
      at.organization_id,
      SUM(at.amount) FILTER (WHERE at.transaction_type = 'donation') AS total_donated,
      COUNT(*) FILTER (WHERE at.transaction_type = 'donation') AS donation_count,
      MIN(at.transaction_date) FILTER (WHERE at.transaction_type = 'donation') AS first_donation_date,
      MAX(at.transaction_date) FILTER (WHERE at.transaction_type = 'donation') AS last_donation_date,
      bool_or(COALESCE(at.is_recurring, false)) AS is_recurring,
      CASE
        WHEN bool_or(rm.platform IS NOT NULL) THEN MAX(rm.platform) FILTER (WHERE rm.platform IS NOT NULL)
        WHEN bool_or(at.refcode2 LIKE 'fb_%') THEN 'meta'
        WHEN bool_or(at.contribution_form ILIKE '%sms%') THEN 'sms'
        WHEN bool_or(at.refcode LIKE 'text-%' OR at.refcode LIKE 'sms-%') THEN 'sms'
        WHEN bool_or(at.refcode LIKE 'ads_%' OR at.refcode LIKE 'fb-%') THEN 'meta'
        ELSE 'organic'
      END AS primary_channel,
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
    SELECT
      dd.donor_email, dd.first_name, dd.last_name, dd.phone, dd.address,
      dd.city, dd.state, dd.zip, dd.employer, dd.occupation,
      dd.age, dd.gender, dd.party_affiliation, dd.voter_score, dd.voter_file_matched,
      COALESCE(ts.total_donated, 0) AS total_donated,
      COALESCE(ts.donation_count, 0) AS donation_count,
      COALESCE(ts.is_recurring, dd.is_recurring, false) AS is_recurring,
      COALESCE(ts.first_donation_date, dd.first_donation_date) AS first_donation_date,
      COALESCE(ts.last_donation_date, dd.last_donation_date) AS last_donation_date,
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
      MAX(first_name) AS first_name, MAX(last_name) AS last_name,
      MAX(phone) AS phone, MAX(address) AS address, MAX(city) AS city,
      MAX(state) AS state, MAX(zip) AS zip, MAX(employer) AS employer,
      MAX(occupation) AS occupation, MAX(age) AS age, MAX(gender) AS gender,
      MAX(party_affiliation) AS party_affiliation, MAX(voter_score) AS voter_score,
      bool_or(voter_file_matched) AS voter_file_matched,
      SUM(total_donated) AS total_donated, SUM(donation_count) AS donation_count,
      bool_or(is_recurring) AS is_recurring,
      MIN(first_donation_date) AS first_donation_date,
      MAX(last_donation_date) AS last_donation_date,
      array_agg(DISTINCT org_name ORDER BY org_name) AS all_orgs,
      array_agg(DISTINCT organization_id) AS all_org_ids,
      COUNT(DISTINCT organization_id) AS crossover_count,
      (SELECT array_agg(DISTINCT ch) FROM unnest(array_agg(channels)) AS flattened(ch_arr), unnest(ch_arr) AS ch) AS channels,
      MAX(donor_email) AS donor_email
    FROM donor_base
    GROUP BY lower(trim(donor_email))
  ),
  filtered AS (
    SELECT * FROM unified u
    WHERE (_org_filter IS NULL OR u.all_org_ids && _org_filter)
    AND (_state_filter IS NULL OR u.state ILIKE _state_filter)
    AND (_min_amount IS NULL OR u.total_donated >= _min_amount)
    AND (_max_amount IS NULL OR u.total_donated <= _max_amount)
    AND (_recurring_filter IS NULL OR u.is_recurring = _recurring_filter)
    AND (_crossover_only = FALSE OR u.crossover_count > 1)
    AND (_search IS NULL OR u.first_name ILIKE '%' || _search || '%' OR u.last_name ILIKE '%' || _search || '%' OR u.donor_email ILIKE '%' || _search || '%')
    AND (_channel_filter IS NULL OR _channel_filter = ANY(u.channels))
  ),
  counts AS (
    SELECT COUNT(*) AS total_count, COUNT(*) FILTER (WHERE crossover_count > 1) AS crossover_count FROM filtered
  )
  SELECT json_build_object(
    'donors', COALESCE((
      SELECT json_agg(row_to_json(d))
      FROM (
        SELECT f.identity_key, f.donor_email, f.first_name, f.last_name, f.phone,
          f.address, f.city, f.state, f.zip, f.employer, f.occupation,
          f.age, f.gender, f.party_affiliation, f.voter_score, f.voter_file_matched,
          f.total_donated, f.donation_count, f.is_recurring,
          f.first_donation_date, f.last_donation_date, f.all_orgs, f.crossover_count, f.channels
        FROM filtered f ORDER BY f.total_donated DESC NULLS LAST LIMIT _page_size OFFSET _offset
      ) d
    ), '[]'::json),
    'total_count', (SELECT total_count FROM counts),
    'crossover_count', (SELECT crossover_count FROM counts)
  ) INTO _result;

  RETURN _result;
END;
$$;
