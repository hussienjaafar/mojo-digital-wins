-- Remediation Fixes Migration
-- Based on Audit Report AUDIT-REPORT-2026-01-19.md
-- Created: 2026-01-19

-- ============================================================================
-- 1. Add trend_filter_log User SELECT Policy (MEDIUM)
-- ============================================================================

-- First ensure RLS is enabled
ALTER TABLE IF EXISTS trend_filter_log ENABLE ROW LEVEL SECURITY;

-- Add user SELECT policy (users can view filter logs for their own org)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trend_filter_log'
    AND policyname = 'Users can view own org filter logs'
  ) THEN
    CREATE POLICY "Users can view own org filter logs"
    ON trend_filter_log FOR SELECT
    USING (
      organization_id IN (
        SELECT co.id
        FROM client_organizations co
        WHERE co.user_id = auth.uid()
      )
    );
  END IF;
END
$$;

-- ============================================================================
-- 2. Add NOT NULL Constraint on priority_bucket (LOW)
-- ============================================================================

-- First set default value for any existing NULLs
UPDATE trend_events
SET priority_bucket = 'MEDIUM'
WHERE priority_bucket IS NULL;

-- Add NOT NULL constraint (only if column exists and is nullable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trend_events'
    AND column_name = 'priority_bucket'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE trend_events
    ALTER COLUMN priority_bucket SET NOT NULL;
  END IF;
END
$$;

-- Add default value for future inserts
ALTER TABLE trend_events
ALTER COLUMN priority_bucket SET DEFAULT 'MEDIUM';

-- ============================================================================
-- 3. Add Performance Indexes (LOW)
-- ============================================================================

-- Index on campaign_type for faster filtering (if table exists)
CREATE INDEX IF NOT EXISTS idx_campaign_topic_extractions_campaign_type
ON campaign_topic_extractions (campaign_type);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_campaign_topic_extractions_org_type
ON campaign_topic_extractions (organization_id, campaign_type);

-- Index for baseline performance queries on campaign_analytics
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_type_created
ON campaign_analytics (campaign_type, created_at DESC)
WHERE campaign_type IS NOT NULL;

-- Index for system_baselines lookup (used by new performance calculation)
CREATE INDEX IF NOT EXISTS idx_system_baselines_metric_name
ON system_baselines (metric_name);

-- ============================================================================
-- 4. Create system_baselines table if not exists (for performance calculation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL UNIQUE,
  baseline_value NUMERIC NOT NULL DEFAULT 0.05,
  calculation_method TEXT DEFAULT 'rolling_30_day',
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on system_baselines
ALTER TABLE system_baselines ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to system_baselines"
ON system_baselines FOR ALL
USING (auth.role() = 'service_role');

-- Insert default baselines
INSERT INTO system_baselines (metric_name, baseline_value, calculation_method)
VALUES
  ('campaign_performance', 0.05, 'rolling_30_day'),
  ('sms_performance', 0.08, 'rolling_30_day'),
  ('email_performance', 0.05, 'rolling_30_day'),
  ('push_performance', 0.03, 'rolling_30_day'),
  ('social_performance', 0.02, 'rolling_30_day')
ON CONFLICT (metric_name) DO NOTHING;

-- ============================================================================
-- 5. Add campaign_analytics table if not exists (for performance calculation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  campaign_type TEXT,
  opens INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  sends INTEGER DEFAULT 0,
  unsubscribes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;

-- Users can view their own org's analytics
CREATE POLICY "Users can view own org campaign analytics"
ON campaign_analytics FOR SELECT
USING (
  organization_id IN (
    SELECT co.id FROM client_organizations co WHERE co.user_id = auth.uid()
  )
);

-- Service role has full access
CREATE POLICY "Service role full access to campaign_analytics"
ON campaign_analytics FOR ALL
USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign_id
ON campaign_analytics (campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_analytics_org_created
ON campaign_analytics (organization_id, created_at DESC);

-- ============================================================================
-- 6. Add sms_campaign_stats table if not exists (fallback for SMS campaigns)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sms_campaign_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  sent INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  clicked INTEGER DEFAULT 0,
  responded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sms_campaign_stats ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to sms_campaign_stats"
ON sms_campaign_stats FOR ALL
USING (auth.role() = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_sms_campaign_stats_campaign_id
ON sms_campaign_stats (campaign_id);

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Add comment for documentation
COMMENT ON TABLE system_baselines IS 'Stores baseline performance metrics for trend-campaign correlation';
COMMENT ON TABLE campaign_analytics IS 'Stores campaign performance analytics for affinity learning';
COMMENT ON TABLE sms_campaign_stats IS 'Stores SMS campaign delivery and engagement stats';
