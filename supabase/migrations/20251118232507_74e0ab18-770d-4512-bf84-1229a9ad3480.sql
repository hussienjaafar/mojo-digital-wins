-- Phase 4: Enhanced Reporting & Export System
-- Implements PDF reports, CSV export, and report history

-- =============================================================================
-- 1. GENERATED REPORTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  report_name TEXT NOT NULL,
  report_format TEXT NOT NULL,
  date_range_start DATE,
  date_range_end DATE,
  filters JSONB DEFAULT '{}'::jsonb,
  file_url TEXT,
  file_size_bytes INTEGER,
  page_count INTEGER,
  generated_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- =============================================================================
-- 2. EXPORT TEMPLATES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.export_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  description TEXT,
  columns JSONB NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 3. SCHEDULED REPORTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  template_id UUID REFERENCES public.export_templates(id),
  schedule TEXT NOT NULL,
  schedule_day INTEGER,
  schedule_time TIME DEFAULT '08:00:00',
  recipients TEXT[] DEFAULT '{}',
  filters JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  next_generation_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 4. INSERT DEFAULT EXPORT TEMPLATES
-- =============================================================================
INSERT INTO public.export_templates (template_name, template_type, description, columns, is_system) VALUES
(
  'Critical Alerts Export',
  'csv',
  'Export all critical and high priority alerts',
  '{"columns": ["date", "type", "title", "threat_level", "source", "affected_organizations", "url"]}',
  true
),
(
  'Executive Orders Export',
  'csv',
  'Export executive orders with threat analysis',
  '{"columns": ["order_number", "title", "signing_date", "threat_level", "summary", "affected_organizations", "url"]}',
  true
),
(
  'State Actions Export',
  'csv',
  'Export state-level actions by state',
  '{"columns": ["state", "action_date", "title", "action_type", "threat_level", "status", "url"]}',
  true
),
(
  'Organization Mentions Export',
  'csv',
  'Export organization mentions with context',
  '{"columns": ["organization", "date", "source_type", "source_title", "threat_level", "context"]}',
  true
),
(
  'Daily Briefing PDF',
  'pdf',
  'Comprehensive daily intelligence briefing',
  '{"sections": ["threat_overview", "critical_alerts", "executive_orders", "state_actions", "breaking_news", "organization_mentions", "recommendations"]}',
  true
),
(
  'Weekly Intelligence Summary',
  'pdf',
  'Weekly rollup of intelligence with trends',
  '{"sections": ["executive_summary", "threat_trends", "critical_developments", "organization_impact", "recommendations", "upcoming_events"]}',
  true
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 5. DATABASE FUNCTION FOR EXPORT DATA
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_export_data(
  p_export_type TEXT,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Generated Reports Policies
CREATE POLICY "Admins can manage all reports" ON public.generated_reports
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own reports" ON public.generated_reports
  FOR SELECT USING (generated_by = auth.uid());

-- Export Templates Policies
CREATE POLICY "Admins can manage templates" ON public.export_templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active templates" ON public.export_templates
  FOR SELECT USING (is_active = true);

-- Scheduled Reports Policies
CREATE POLICY "Admins can manage all scheduled reports" ON public.scheduled_reports
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage own scheduled reports" ON public.scheduled_reports
  FOR ALL USING (user_id = auth.uid());

-- =============================================================================
-- 7. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_generated_reports_generated_by ON public.generated_reports(generated_by);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created_at ON public.generated_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON public.generated_reports(status);
CREATE INDEX IF NOT EXISTS idx_export_templates_is_active ON public.export_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user_id ON public.scheduled_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_generation ON public.scheduled_reports(next_generation_at) WHERE is_active = true;