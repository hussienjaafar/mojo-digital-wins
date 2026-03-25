DROP FUNCTION IF EXISTS public.get_actblue_daily_rollup(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_actblue_period_summary(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_actblue_filtered_rollup(UUID, DATE, DATE, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_actblue_true_unique_donors(UUID, DATE, DATE, TEXT);