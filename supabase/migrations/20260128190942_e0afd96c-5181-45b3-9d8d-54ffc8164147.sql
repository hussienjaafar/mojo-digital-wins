-- =====================================================
-- Phase 1: Demographics Cache Infrastructure
-- =====================================================

-- 1. Create donor_demographics_cache table
CREATE TABLE IF NOT EXISTS public.donor_demographics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES client_organizations(id) ON DELETE CASCADE,
  summary_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  transaction_count integer NOT NULL DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  is_stale boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_demographics_cache_org ON donor_demographics_cache(organization_id);
CREATE INDEX IF NOT EXISTS idx_demographics_cache_stale ON donor_demographics_cache(is_stale) WHERE is_stale = true;

-- Enable RLS
ALTER TABLE donor_demographics_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies: admins and org members can view cached data
CREATE POLICY "Admins can manage demographics cache"
  ON donor_demographics_cache
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org members can view their cache"
  ON donor_demographics_cache
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_organization(organization_id));

-- =====================================================
-- 2. Create get_donor_demographics_cached RPC
-- Fast lookup from cache, returns status if refreshing
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_donor_demographics_cached(_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cached_result jsonb;
  cache_calculated_at timestamptz;
  cache_transaction_count integer;
BEGIN
  -- Verify user has access to this organization
  IF NOT (
    public.user_belongs_to_organization(_organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;
  
  -- Try to get cached data (valid within 7 days for all-time aggregates)
  SELECT summary_data, calculated_at, transaction_count 
  INTO cached_result, cache_calculated_at, cache_transaction_count
  FROM donor_demographics_cache
  WHERE organization_id = _organization_id
    AND calculated_at > now() - interval '7 days';
    
  IF cached_result IS NOT NULL AND cached_result != '{}'::jsonb THEN
    -- Add metadata about cache freshness
    RETURN jsonb_build_object(
      'status', 'ready',
      'calculated_at', cache_calculated_at,
      'transaction_count', cache_transaction_count,
      'data', cached_result
    );
  END IF;
  
  -- No valid cache - return status indicating refresh needed
  RETURN jsonb_build_object(
    'status', 'needs_refresh',
    'message', 'Demographics data is being calculated. This may take a few minutes for large accounts.',
    'organization_id', _organization_id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_donor_demographics_cached(uuid) TO authenticated;

-- =====================================================
-- 3. Create refresh_demographics_cache RPC
-- Called by edge function to rebuild cache
-- =====================================================
CREATE OR REPLACE FUNCTION public.refresh_demographics_cache(_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $$
DECLARE
  result jsonb;
  tx_count integer;
BEGIN
  -- This function is called by edge functions with service role
  -- No user auth check needed - service role has full access
  
  -- Get transaction count first
  SELECT COUNT(*) INTO tx_count
  FROM actblue_transactions
  WHERE organization_id = _organization_id
    AND transaction_type IS DISTINCT FROM 'refund';

  -- Build the demographics summary (same logic as get_donor_demographics_v2)
  WITH transaction_data AS MATERIALIZED (
    SELECT 
      donor_email,
      amount,
      state,
      occupation,
      employer,
      refcode,
      is_express,
      is_recurring,
      is_mobile,
      transaction_type,
      transaction_date,
      EXTRACT(DOW FROM transaction_date) as day_of_week,
      EXTRACT(HOUR FROM transaction_date) as hour_of_day
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND transaction_type IS DISTINCT FROM 'refund'
  ),
  -- Totals with recurring breakdown
  totals AS (
    SELECT 
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donor_count,
      COUNT(*) as transaction_count,
      COALESCE(SUM(amount), 0) as total_revenue,
      COUNT(*) FILTER (WHERE is_recurring = true) as recurring_count,
      COUNT(DISTINCT donor_email) FILTER (WHERE is_recurring = true AND donor_email IS NOT NULL) as recurring_donors,
      COALESCE(SUM(amount) FILTER (WHERE is_recurring = true), 0) as recurring_revenue,
      COUNT(*) FILTER (WHERE is_mobile = true) as mobile_donations,
      COUNT(*) FILTER (WHERE is_mobile = false OR is_mobile IS NULL) as desktop_donations
    FROM transaction_data
  ),
  -- Repeat donor analysis
  donor_frequency AS (
    SELECT 
      donor_email,
      COUNT(*) as donation_count,
      SUM(amount) as total_amount,
      MIN(transaction_date) as first_donation
    FROM transaction_data
    WHERE donor_email IS NOT NULL
    GROUP BY donor_email
  ),
  repeat_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE donation_count = 1) as single_donors,
      COUNT(*) FILTER (WHERE donation_count >= 2) as repeat_donors,
      SUM(total_amount) FILTER (WHERE donation_count = 1) as single_donor_revenue,
      SUM(total_amount) FILTER (WHERE donation_count >= 2) as repeat_donor_revenue,
      COUNT(*) as new_donors,
      SUM(total_amount) as new_donor_revenue
    FROM donor_frequency
  ),
  -- State stats
  state_stats AS (
    SELECT 
      UPPER(TRIM(state)) as state_abbr,
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donors,
      COUNT(*) as transaction_count,
      COALESCE(SUM(amount), 0) as revenue,
      ROUND(COALESCE(AVG(amount), 0)::numeric, 2) as avg_gift
    FROM transaction_data
    WHERE state IS NOT NULL AND TRIM(state) != ''
    GROUP BY UPPER(TRIM(state))
    ORDER BY revenue DESC
  ),
  -- Simplified occupation stats using direct category lookup
  occupation_stats AS (
    SELECT 
      COALESCE(
        (SELECT oc.category 
         FROM occupation_categories oc 
         WHERE LOWER(TRIM(t.occupation)) LIKE '%' || oc.pattern || '%'
         ORDER BY oc.sort_order ASC
         LIMIT 1),
        'Other'
      ) as occupation_category,
      COUNT(DISTINCT t.donor_email) FILTER (WHERE t.donor_email IS NOT NULL) as unique_donors,
      COUNT(*) as transaction_count,
      COALESCE(SUM(t.amount), 0) as revenue,
      ROUND(COALESCE(AVG(t.amount), 0)::numeric, 2) as avg_gift
    FROM transaction_data t
    WHERE t.occupation IS NOT NULL AND TRIM(t.occupation) != ''
    GROUP BY 1
    ORDER BY revenue DESC
    LIMIT 20
  ),
  -- Channel stats
  channel_stats AS (
    SELECT 
      CASE 
        WHEN refcode IS NOT NULL AND TRIM(refcode) != '' THEN 'Campaign'
        WHEN is_express = true THEN 'Express'
        ELSE 'Direct'
      END as channel,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as revenue,
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donors,
      ROUND(COALESCE(AVG(amount), 0)::numeric, 2) as avg_gift
    FROM transaction_data
    GROUP BY 1
    ORDER BY revenue DESC
  ),
  -- Time heatmap
  time_heatmap AS (
    SELECT 
      day_of_week::integer as day_of_week,
      hour_of_day::integer as hour,
      COUNT(*) as donation_count,
      COALESCE(SUM(amount), 0) as revenue,
      ROUND(COALESCE(AVG(amount), 0)::numeric, 2) as avg_donation
    FROM transaction_data
    GROUP BY day_of_week, hour_of_day
  ),
  -- Top refcodes
  top_refcodes AS (
    SELECT 
      refcode,
      COUNT(*) as transaction_count,
      COALESCE(SUM(amount), 0) as revenue,
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donors,
      ROUND(COALESCE(AVG(amount), 0)::numeric, 2) as avg_gift
    FROM transaction_data
    WHERE refcode IS NOT NULL AND TRIM(refcode) != ''
    GROUP BY refcode
    ORDER BY revenue DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'totals', (SELECT row_to_json(t)::jsonb FROM totals t),
    'repeat_stats', (SELECT row_to_json(r)::jsonb FROM repeat_stats r),
    'state_stats', COALESCE((SELECT jsonb_agg(row_to_json(s)) FROM state_stats s), '[]'::jsonb),
    'occupation_stats', COALESCE((SELECT jsonb_agg(row_to_json(o)) FROM occupation_stats o), '[]'::jsonb),
    'channel_stats', COALESCE((SELECT jsonb_agg(row_to_json(c)) FROM channel_stats c), '[]'::jsonb),
    'time_heatmap', COALESCE((SELECT jsonb_agg(row_to_json(h)) FROM time_heatmap h), '[]'::jsonb),
    'top_refcodes', COALESCE((SELECT jsonb_agg(row_to_json(rc)) FROM top_refcodes rc), '[]'::jsonb)
  ) INTO result;

  -- Upsert into cache table
  INSERT INTO donor_demographics_cache (
    organization_id, 
    summary_data, 
    transaction_count, 
    calculated_at, 
    is_stale,
    updated_at
  )
  VALUES (
    _organization_id, 
    result, 
    tx_count, 
    now(), 
    false,
    now()
  )
  ON CONFLICT (organization_id) 
  DO UPDATE SET 
    summary_data = EXCLUDED.summary_data,
    transaction_count = EXCLUDED.transaction_count,
    calculated_at = EXCLUDED.calculated_at,
    is_stale = false,
    updated_at = now(),
    version = donor_demographics_cache.version + 1;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', _organization_id,
    'transaction_count', tx_count,
    'calculated_at', now()
  );
END;
$$;

-- Grant execute to service role (for edge functions)
GRANT EXECUTE ON FUNCTION public.refresh_demographics_cache(uuid) TO service_role;

-- =====================================================
-- 4. Create trigger to mark cache as stale on new transactions
-- =====================================================
CREATE OR REPLACE FUNCTION public.mark_demographics_cache_stale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE donor_demographics_cache
  SET is_stale = true, updated_at = now()
  WHERE organization_id = NEW.organization_id;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS trg_mark_demographics_stale ON actblue_transactions;

CREATE TRIGGER trg_mark_demographics_stale
  AFTER INSERT ON actblue_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_demographics_cache_stale();