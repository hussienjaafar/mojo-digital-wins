-- Fix function search_path mutable security issue
-- Add SET search_path to all functions missing it

-- Fix update_bills_updated_at function
CREATE OR REPLACE FUNCTION public.update_bills_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Ensure get_export_data has search_path set
CREATE OR REPLACE FUNCTION public.get_export_data(p_export_type text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  CASE p_export_type
    WHEN 'critical_alerts' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', created_at,
          'type', alert_type,
          'title', title,
          'threat_level', severity,
          'source', data->>'source',
          'message', message
        )
      ) INTO v_result
      FROM alert_queue
      WHERE (p_start_date IS NULL OR created_at::date >= p_start_date)
        AND (p_end_date IS NULL OR created_at::date <= p_end_date)
        AND severity IN ('critical', 'high')
      ORDER BY created_at DESC;

    WHEN 'executive_orders' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'order_number', order_number,
          'title', title,
          'issued_date', issued_date,
          'issuing_authority', issuing_authority,
          'jurisdiction', jurisdiction,
          'summary', summary,
          'source_url', source_url,
          'relevance_score', relevance_score
        )
      ) INTO v_result
      FROM executive_orders
      WHERE (p_start_date IS NULL OR issued_date >= p_start_date)
        AND (p_end_date IS NULL OR issued_date <= p_end_date)
      ORDER BY issued_date DESC;

    WHEN 'state_actions' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'state', state,
          'action_date', introduced_date,
          'title', title,
          'action_type', action_type,
          'status', status,
          'summary', summary,
          'source_url', source_url
        )
      ) INTO v_result
      FROM state_actions
      WHERE (p_start_date IS NULL OR introduced_date >= p_start_date)
        AND (p_end_date IS NULL OR introduced_date <= p_end_date)
      ORDER BY introduced_date DESC;

    WHEN 'organization_mentions' THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'organization', organization_name,
          'date', mentioned_at,
          'source_type', source_type,
          'context', mention_context,
          'sentiment', sentiment,
          'relevance_score', relevance_score
        )
      ) INTO v_result
      FROM organization_mentions
      WHERE (p_start_date IS NULL OR mentioned_at::date >= p_start_date)
        AND (p_end_date IS NULL OR mentioned_at::date <= p_end_date)
      ORDER BY mentioned_at DESC;

    WHEN 'daily_briefing' THEN
      SELECT jsonb_agg(row_to_json(db))
      INTO v_result
      FROM daily_briefings db
      WHERE (p_start_date IS NULL OR briefing_date >= p_start_date)
        AND (p_end_date IS NULL OR briefing_date <= p_end_date)
      ORDER BY briefing_date DESC;

    ELSE
      v_result := '[]'::jsonb;
  END CASE;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;