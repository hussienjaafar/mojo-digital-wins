-- ============================================================================
-- ActBlue Canonical Daily Rollup Migration
-- Purpose: Create single source of truth for ActBlue daily metrics
-- ============================================================================

-- PHASE 1: Add timezone column to client_organizations
-- Default to America/New_York (Eastern Time) for ActBlue-focused orgs
-- ActBlue timestamps are typically in Eastern Time, and most political orgs operate in ET

ALTER TABLE public.client_organizations
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Add comment explaining the column
COMMENT ON COLUMN public.client_organizations.timezone IS
  'IANA timezone identifier for day bucketing. ActBlue transactions use this timezone for daily rollups. Default: America/New_York';

-- ============================================================================
-- PHASE 2: Create canonical view for ActBlue daily metrics
-- This is the SINGLE SOURCE OF TRUTH for all dashboard metrics
-- ============================================================================

-- Drop existing view if it exists (for idempotent migrations)
DROP VIEW IF EXISTS public.actblue_daily_rollup;

-- Create the canonical daily rollup view
-- This view buckets transactions by org timezone and calculates all key metrics
CREATE OR REPLACE VIEW public.actblue_daily_rollup AS
WITH org_timezones AS (
  -- Get timezone for each org, defaulting to America/New_York
  SELECT
    id AS organization_id,
    COALESCE(timezone, 'America/New_York') AS tz
  FROM public.client_organizations
),
bucketed_transactions AS (
  -- Bucket each transaction into its org-local day
  SELECT
    t.organization_id,
    t.id AS transaction_id,
    t.transaction_type,
    t.amount,
    t.net_amount,
    t.fee,
    t.donor_email,
    t.is_recurring,
    -- Bucket by org timezone: transaction_date AT TIME ZONE tz
    DATE(t.transaction_date AT TIME ZONE COALESCE(oz.tz, 'America/New_York')) AS local_day
  FROM public.actblue_transactions t
  LEFT JOIN org_timezones oz ON oz.organization_id = t.organization_id
),
daily_donations AS (
  SELECT
    organization_id,
    local_day,
    -- GROSS RAISED: Sum of amount for donations (before fees)
    SUM(amount) AS gross_raised,
    -- NET RAISED: Sum of net_amount (or amount - fee) for donations
    SUM(COALESCE(net_amount, amount - COALESCE(fee, 0))) AS net_raised,
    -- TOTAL FEES: Sum of fees
    SUM(COALESCE(fee, 0)) AS total_fees,
    -- DONATION COUNT
    COUNT(*) AS donation_count,
    -- UNIQUE DONORS (approximate via email)
    COUNT(DISTINCT donor_email) AS unique_donors,
    -- RECURRING vs ONE-TIME breakdown
    COUNT(*) FILTER (WHERE is_recurring = true) AS recurring_count,
    COUNT(*) FILTER (WHERE is_recurring = false OR is_recurring IS NULL) AS one_time_count,
    SUM(COALESCE(net_amount, amount - COALESCE(fee, 0))) FILTER (WHERE is_recurring = true) AS recurring_revenue,
    SUM(COALESCE(net_amount, amount - COALESCE(fee, 0))) FILTER (WHERE is_recurring = false OR is_recurring IS NULL) AS one_time_revenue
  FROM bucketed_transactions
  WHERE transaction_type = 'donation'
  GROUP BY organization_id, local_day
),
daily_refunds AS (
  SELECT
    organization_id,
    local_day,
    -- REFUNDS: Absolute value of refund/cancellation amounts
    SUM(ABS(COALESCE(net_amount, amount))) AS refund_amount,
    COUNT(*) AS refund_count
  FROM bucketed_transactions
  WHERE transaction_type IN ('refund', 'cancellation')
  GROUP BY organization_id, local_day
)
SELECT
  d.organization_id,
  d.local_day AS day,
  -- Core metrics per contract
  COALESCE(d.gross_raised, 0) AS gross_raised,
  COALESCE(d.net_raised, 0) AS net_raised,
  COALESCE(r.refund_amount, 0) AS refunds,
  COALESCE(d.net_raised, 0) - COALESCE(r.refund_amount, 0) AS net_revenue,
  COALESCE(d.total_fees, 0) AS total_fees,
  -- Counts
  COALESCE(d.donation_count, 0) AS donation_count,
  COALESCE(d.unique_donors, 0) AS unique_donors,
  COALESCE(r.refund_count, 0) AS refund_count,
  -- Recurring breakdown
  COALESCE(d.recurring_count, 0) AS recurring_count,
  COALESCE(d.one_time_count, 0) AS one_time_count,
  COALESCE(d.recurring_revenue, 0) AS recurring_revenue,
  COALESCE(d.one_time_revenue, 0) AS one_time_revenue,
  -- Derived rates
  CASE WHEN d.gross_raised > 0
    THEN (COALESCE(d.total_fees, 0) / d.gross_raised * 100)
    ELSE 0
  END AS fee_percentage,
  CASE WHEN d.gross_raised > 0
    THEN (COALESCE(r.refund_amount, 0) / d.gross_raised * 100)
    ELSE 0
  END AS refund_rate
FROM daily_donations d
LEFT JOIN daily_refunds r ON r.organization_id = d.organization_id AND r.local_day = d.local_day;

-- Add comment explaining the view
COMMENT ON VIEW public.actblue_daily_rollup IS
  'Canonical daily rollup of ActBlue transactions. Day bucketing uses org timezone (default: America/New_York). '
  'This is the SINGLE SOURCE OF TRUTH for dashboard metrics. '
  'Metric contract: gross_raised=SUM(amount), net_raised=SUM(net_amount), refunds=SUM(ABS(refund amounts)), net_revenue=net_raised-refunds';

-- ============================================================================
-- PHASE 3: Create RPC function for efficient rollup queries
-- This allows the frontend to query the rollup with date range parameters
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_actblue_daily_rollup(
  _organization_id UUID,
  _start_date DATE,
  _end_date DATE
)
RETURNS TABLE (
  day DATE,
  gross_raised NUMERIC,
  net_raised NUMERIC,
  refunds NUMERIC,
  net_revenue NUMERIC,
  total_fees NUMERIC,
  donation_count BIGINT,
  unique_donors BIGINT,
  refund_count BIGINT,
  recurring_count BIGINT,
  one_time_count BIGINT,
  recurring_revenue NUMERIC,
  one_time_revenue NUMERIC,
  fee_percentage NUMERIC,
  refund_rate NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to this organization
  IF NOT (
    public.user_belongs_to_organization(_organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  RETURN QUERY
  SELECT
    r.day,
    r.gross_raised,
    r.net_raised,
    r.refunds,
    r.net_revenue,
    r.total_fees,
    r.donation_count,
    r.unique_donors,
    r.refund_count,
    r.recurring_count,
    r.one_time_count,
    r.recurring_revenue,
    r.one_time_revenue,
    r.fee_percentage,
    r.refund_rate
  FROM public.actblue_daily_rollup r
  WHERE r.organization_id = _organization_id
    AND r.day >= _start_date
    AND r.day <= _end_date
  ORDER BY r.day;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_actblue_daily_rollup(UUID, DATE, DATE) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_actblue_daily_rollup IS
  'Returns canonical ActBlue daily rollup for an organization within a date range. '
  'Enforces RLS - only accessible by org members or admins.';

-- ============================================================================
-- PHASE 4: Create summary function for period totals
-- Returns a single row with totals for the entire period
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_actblue_period_summary(
  _organization_id UUID,
  _start_date DATE,
  _end_date DATE
)
RETURNS TABLE (
  gross_raised NUMERIC,
  net_raised NUMERIC,
  refunds NUMERIC,
  net_revenue NUMERIC,
  total_fees NUMERIC,
  donation_count BIGINT,
  unique_donors_approx BIGINT,
  refund_count BIGINT,
  recurring_count BIGINT,
  one_time_count BIGINT,
  recurring_revenue NUMERIC,
  one_time_revenue NUMERIC,
  avg_fee_percentage NUMERIC,
  refund_rate NUMERIC,
  avg_donation NUMERIC,
  days_with_donations BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to this organization
  IF NOT (
    public.user_belongs_to_organization(_organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(r.gross_raised), 0) AS gross_raised,
    COALESCE(SUM(r.net_raised), 0) AS net_raised,
    COALESCE(SUM(r.refunds), 0) AS refunds,
    COALESCE(SUM(r.net_revenue), 0) AS net_revenue,
    COALESCE(SUM(r.total_fees), 0) AS total_fees,
    COALESCE(SUM(r.donation_count), 0) AS donation_count,
    COALESCE(SUM(r.unique_donors), 0) AS unique_donors_approx, -- Note: sum of daily uniques is approximate
    COALESCE(SUM(r.refund_count), 0) AS refund_count,
    COALESCE(SUM(r.recurring_count), 0) AS recurring_count,
    COALESCE(SUM(r.one_time_count), 0) AS one_time_count,
    COALESCE(SUM(r.recurring_revenue), 0) AS recurring_revenue,
    COALESCE(SUM(r.one_time_revenue), 0) AS one_time_revenue,
    CASE WHEN SUM(r.gross_raised) > 0
      THEN (SUM(r.total_fees) / SUM(r.gross_raised) * 100)
      ELSE 0
    END AS avg_fee_percentage,
    CASE WHEN SUM(r.gross_raised) > 0
      THEN (SUM(r.refunds) / SUM(r.gross_raised) * 100)
      ELSE 0
    END AS refund_rate,
    CASE WHEN SUM(r.donation_count) > 0
      THEN SUM(r.gross_raised) / SUM(r.donation_count)
      ELSE 0
    END AS avg_donation,
    COUNT(*) AS days_with_donations
  FROM public.actblue_daily_rollup r
  WHERE r.organization_id = _organization_id
    AND r.day >= _start_date
    AND r.day <= _end_date;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_actblue_period_summary(UUID, DATE, DATE) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_actblue_period_summary IS
  'Returns period summary totals for ActBlue metrics. '
  'Note: unique_donors_approx is the sum of daily unique donors, which may double-count donors across days.';

-- ============================================================================
-- PHASE 5: Create index on actblue_transactions for timezone-aware queries
-- ============================================================================

-- Index for efficient timezone-aware date bucketing
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_org_date_type
  ON public.actblue_transactions (organization_id, transaction_date, transaction_type);

-- ============================================================================
-- Grant RLS-safe SELECT on the view for authenticated users
-- The view respects org-level access through the join structure
-- ============================================================================

-- Note: Views inherit permissions from underlying tables, so RLS on actblue_transactions applies
