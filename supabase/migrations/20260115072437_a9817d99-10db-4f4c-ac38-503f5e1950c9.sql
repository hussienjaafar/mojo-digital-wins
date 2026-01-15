-- Drop old versions with incorrect signatures (p_org_id instead of p_organization_id, and text types for campaign/creative)
DROP FUNCTION IF EXISTS public.get_actblue_dashboard_metrics(uuid, date, date, text, text);
DROP FUNCTION IF EXISTS public.get_actblue_filtered_rollup(uuid, date, date, text, text, text);