-- Drop redundant ActBlue RPC functions that have been consolidated
-- into the unified get_actblue_dashboard_metrics function.
--
-- get_actblue_daily_rollup: subset of dashboard_metrics.daily
-- get_actblue_period_summary: subset of dashboard_metrics.summary
-- get_actblue_filtered_rollup: dashboard_metrics already accepts campaign_id/creative_id
-- get_actblue_true_unique_donors: zero frontend callers

DROP FUNCTION IF EXISTS public.get_actblue_daily_rollup(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_actblue_period_summary(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_actblue_filtered_rollup(UUID, DATE, DATE, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_actblue_true_unique_donors(UUID, DATE, DATE, TEXT);
