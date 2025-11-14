-- Fix security linter warnings

-- 1. Fix Function Search Path Mutable - ensure refresh function has immutable search path
-- (Already set in original function, but let's ensure all security definer functions are safe)

-- 2. Fix Materialized View in API - revoke access to materialized view from API
-- This prevents the materialized view from being exposed via PostgREST
REVOKE ALL ON public.mv_daily_metrics_summary FROM anon, authenticated;

-- Grant access only to specific database roles that need it
GRANT SELECT ON public.mv_daily_metrics_summary TO postgres;

-- Create a secure view function for clients to access the data instead
CREATE OR REPLACE FUNCTION public.get_daily_metrics_summary(
  _organization_id UUID,
  _start_date DATE,
  _end_date DATE
)
RETURNS TABLE(
  date DATE,
  total_ad_spend NUMERIC,
  total_sms_cost NUMERIC,
  total_funds_raised NUMERIC,
  total_donations NUMERIC,
  avg_roi_percentage NUMERIC,
  total_meta_clicks BIGINT,
  total_meta_impressions BIGINT,
  total_sms_sent BIGINT,
  total_sms_conversions BIGINT,
  total_new_donors BIGINT,
  days_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to organization
  IF NOT (
    _organization_id = get_user_organization_id() OR
    has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    mv.date,
    mv.total_ad_spend,
    mv.total_sms_cost,
    mv.total_funds_raised,
    mv.total_donations,
    mv.avg_roi_percentage,
    mv.total_meta_clicks,
    mv.total_meta_impressions,
    mv.total_sms_sent,
    mv.total_sms_conversions,
    mv.total_new_donors,
    mv.days_count
  FROM public.mv_daily_metrics_summary mv
  WHERE mv.organization_id = _organization_id
    AND mv.date >= _start_date
    AND mv.date <= _end_date
  ORDER BY mv.date DESC;
END;
$$;

COMMENT ON FUNCTION public.get_daily_metrics_summary IS 'Secure access to materialized view with organization isolation';