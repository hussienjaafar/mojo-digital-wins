DROP FUNCTION IF EXISTS public.get_actblue_daily_rollup(uuid, date, date, boolean);
DROP FUNCTION IF EXISTS public.get_actblue_period_summary(uuid, date, date, boolean);
DROP FUNCTION IF EXISTS public.get_actblue_filtered_rollup(uuid, date, date, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.get_actblue_filtered_rollup(uuid, date, date, uuid, uuid, text, boolean);
DROP FUNCTION IF EXISTS public.get_actblue_true_unique_donors(uuid, date, date, text);