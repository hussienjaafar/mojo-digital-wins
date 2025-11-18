-- Phase 4: Enhanced Reporting & Export System
-- Implements PDF reports, CSV export, and report history

-- =============================================================================
-- 1. GENERATED REPORTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL, -- daily_briefing, weekly_summary, custom_export, threat_analysis
  report_name TEXT NOT NULL,
  report_format TEXT NOT NULL, -- pdf, csv, xlsx, json
  date_range_start DATE,
  date_range_end DATE,
  filters JSONB DEFAULT '{}'::jsonb, -- Applied filters
  file_url TEXT, -- Storage URL
  file_size_bytes INTEGER,
  page_count INTEGER,
  generated_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending', -- pending, generating, completed, failed
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
  template_type TEXT NOT NULL, -- pdf, csv
  description TEXT,
  columns JSONB NOT NULL, -- Column definitions for CSV or sections for PDF
  filters JSONB DEFAULT '{}'::jsonb, -- Default filters
  is_system BOOLEAN DEFAULT false, -- System templates vs user-created
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
  schedule TEXT NOT NULL, -- daily, weekly, monthly
  schedule_day INTEGER, -- Day of week (0-6) or day of month (1-31)
  schedule_time TIME DEFAULT '08:00:00',
  recipients TEXT[] DEFAULT '{}', -- Email addresses
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
  'Weekly Summary PDF',
  'pdf',
  'Weekly trend analysis and summary',
  '{"sections": ["week_overview", "threat_trends", "top_stories", "legislative_activity", "organization_impact", "next_week_outlook"]}',
  true
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 5. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_generated_reports_user ON public.generated_reports(generated_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_reports_type ON public.generated_reports(report_type, status);
CREATE INDEX IF NOT EXISTS idx_export_templates_active ON public.export_templates(is_active, template_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user ON public.scheduled_reports(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next ON public.scheduled_reports(next_generation_at) WHERE is_active = true;

-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON public.generated_reports
  FOR SELECT USING (auth.uid() = generated_by);

-- Users can create reports
CREATE POLICY "Users can create reports" ON public.generated_reports
  FOR INSERT WITH CHECK (auth.uid() = generated_by);

-- Templates are viewable by all authenticated users
CREATE POLICY "Anyone can view active templates" ON public.export_templates
  FOR SELECT USING (is_active = true);

-- Only admins can manage templates
CREATE POLICY "Admins can manage templates" ON public.export_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can manage their own scheduled reports
CREATE POLICY "Users can view own scheduled reports" ON public.scheduled_reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create scheduled reports" ON public.scheduled_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scheduled reports" ON public.scheduled_reports
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scheduled reports" ON public.scheduled_reports
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 7. FUNCTION: Get export data for various report types
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_export_data(
  p_export_type TEXT,
  p_start_date DATE DEFAULT CURRENT_DATE - 7,
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  CASE p_export_type
    WHEN 'critical_alerts' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT
          published_date as date,
          'article' as type,
          title,
          threat_level,
          source_name as source,
          affected_organizations,
          url
        FROM public.articles
        WHERE threat_level IN ('critical', 'high')
          AND DATE(published_date) BETWEEN p_start_date AND p_end_date
        ORDER BY published_date DESC
      ) t;

    WHEN 'executive_orders' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT
          order_number,
          title,
          issued_date as signing_date,
          relevance_score as threat_level,
          summary,
          tags as affected_organizations,
          source_url as url
        FROM public.executive_orders
        WHERE DATE(issued_date) BETWEEN p_start_date AND p_end_date
        ORDER BY issued_date DESC
      ) t;

    WHEN 'state_actions' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT
          state,
          introduced_date as action_date,
          title,
          action_type,
          relevance_score as threat_level,
          status,
          source_url as url
        FROM public.state_actions
        WHERE DATE(introduced_date) BETWEEN p_start_date AND p_end_date
        ORDER BY introduced_date DESC
      ) t;

    WHEN 'organization_mentions' THEN
      SELECT jsonb_agg(row_to_json(t)) INTO result
      FROM (
        SELECT
          organization_name as organization,
          DATE(mentioned_at) as date,
          source_type,
          source_title,
          threat_level,
          mention_context as context
        FROM public.organization_mentions
        WHERE DATE(mentioned_at) BETWEEN p_start_date AND p_end_date
        ORDER BY mentioned_at DESC
      ) t;

    ELSE
      result := '[]'::jsonb;
  END CASE;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
