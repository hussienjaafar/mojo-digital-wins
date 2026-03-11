CREATE OR REPLACE FUNCTION get_donor_universe(
  _org_id uuid DEFAULT NULL,
  _search text DEFAULT NULL,
  _min_donated numeric DEFAULT NULL,
  _max_donated numeric DEFAULT NULL,
  _is_recurring boolean DEFAULT NULL,
  _channels text[] DEFAULT NULL,
  _party text DEFAULT NULL,
  _state text DEFAULT NULL,
  _sort_by text DEFAULT 'total_donated',
  _sort_dir text DEFAULT 'desc',
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 50
)
RETURNS TABLE (
  identity_key text,
  donor_name text,
  donor_email text,
  city text,
  state text,
  zip text,
  employer text,
  occupation text,
  age integer,
  gender text,
  party_affiliation text,
  voter_score numeric,
  voter_file_matched boolean,
  total_donated numeric,
  donation_count bigint,
  is_recurring boolean,
  first_donation_date text,
  last_donation_date text,
  organization_id uuid,
  org_name text,
  channels text[],
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _offset integer;
BEGIN
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
      COALESCE(dd.donor_email, '') AS identity_key,
      dd.donor_name,
      dd.donor_email,
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
      COALESCE(ts.first_donation_date, dd.first_donation_date)::text AS first_donation_date,
      COALESCE(ts.last_donation_date, dd.last_donation_date)::text AS last_donation_date,
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
      db.identity_key,
      MAX(db.donor_name) AS donor_name,
      db.identity_key AS donor_email,
      MAX(db.city) AS city,
      MAX(db.state) AS state,
      MAX(db.zip) AS zip,
      MAX(db.employer) AS employer,
      MAX(db.occupation) AS occupation,
      MAX(db.age) AS age,
      MAX(db.gender) AS gender,
      MAX(db.party_affiliation) AS party_affiliation,
      MAX(db.voter_score) AS voter_score,
      bool_or(db.voter_file_matched) AS voter_file_matched,
      SUM(db.total_donated) AS total_donated,
      SUM(db.donation_count) AS donation_count,
      bool_or(db.is_recurring) AS is_recurring,
      MIN(db.first_donation_date) AS first_donation_date,
      MAX(db.last_donation_date) AS last_donation_date,
      MAX(db.organization_id) AS organization_id,
      MAX(db.org_name) AS org_name,
      array_agg(DISTINCT ch) AS channels
    FROM donor_base db,
    LATERAL unnest(db.channels) AS ch
    WHERE (_org_id IS NULL OR db.organization_id = _org_id)
    GROUP BY db.identity_key
  ),
  filtered AS (
    SELECT u.*,
      COUNT(*) OVER () AS total_count
    FROM unified u
    WHERE
      (_search IS NULL OR (
        u.donor_name ILIKE '%' || _search || '%'
        OR u.donor_email ILIKE '%' || _search || '%'
        OR u.city ILIKE '%' || _search || '%'
        OR u.employer ILIKE '%' || _search || '%'
      ))
      AND (_min_donated IS NULL OR u.total_donated >= _min_donated)
      AND (_max_donated IS NULL OR u.total_donated <= _max_donated)
      AND (_is_recurring IS NULL OR u.is_recurring = _is_recurring)
      AND (_channels IS NULL OR u.channels && _channels)
      AND (_party IS NULL OR u.party_affiliation = _party)
      AND (_state IS NULL OR u.state = _state)
  )
  SELECT
    f.identity_key,
    f.donor_name,
    f.donor_email,
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
    f.organization_id,
    f.org_name,
    f.channels,
    f.total_count
  FROM filtered f
  ORDER BY
    CASE WHEN _sort_dir = 'asc' THEN
      CASE _sort_by
        WHEN 'total_donated' THEN f.total_donated::text
        WHEN 'donation_count' THEN lpad(f.donation_count::text, 10, '0')
        WHEN 'donor_name' THEN f.donor_name
        WHEN 'last_donation_date' THEN f.last_donation_date
        ELSE f.total_donated::text
      END
    END ASC NULLS LAST,
    CASE WHEN _sort_dir = 'desc' THEN
      CASE _sort_by
        WHEN 'total_donated' THEN f.total_donated::text
        WHEN 'donation_count' THEN lpad(f.donation_count::text, 10, '0')
        WHEN 'donor_name' THEN f.donor_name
        WHEN 'last_donation_date' THEN f.last_donation_date
        ELSE f.total_donated::text
      END
    END DESC NULLS LAST
  LIMIT _page_size
  OFFSET _offset;

END;
$$;