-- Phase 6: Add missing columns and create remaining tables

-- 6.1 Add missing columns to job_failures
ALTER TABLE job_failures ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE job_failures ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE job_failures ADD COLUMN IF NOT EXISTS context JSONB;

-- 6.2 Processing checkpoints for incremental processing
CREATE TABLE IF NOT EXISTS public.processing_checkpoints (
  function_name TEXT PRIMARY KEY,
  last_processed_at TIMESTAMPTZ,
  last_processed_id TEXT,
  records_processed BIGINT DEFAULT 0,
  checkpoint_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6.3 System health metrics
CREATE TABLE IF NOT EXISTS public.system_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC,
  metric_unit TEXT,
  component TEXT,
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- 6.4 Create indexes
CREATE INDEX IF NOT EXISTS idx_job_failures_unresolved ON job_failures(is_resolved, created_at DESC) WHERE is_resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_job_failures_function ON job_failures(function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_name ON system_health_metrics(metric_name, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_ai_topics ON bluesky_posts USING GIN(ai_topics) WHERE ai_topics IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_affected_groups ON articles USING GIN(affected_groups) WHERE affected_groups IS NOT NULL;

-- 6.5 Functions for job failure management
CREATE OR REPLACE FUNCTION log_job_failure(
  p_function_name TEXT,
  p_error_message TEXT,
  p_error_stack TEXT DEFAULT NULL,
  p_context JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_failure_id UUID;
BEGIN
  INSERT INTO job_failures (function_name, error_message, error_stack, context, next_retry_at, is_resolved)
  VALUES (p_function_name, p_error_message, p_error_stack, p_context, NOW() + INTERVAL '1 minute', FALSE)
  RETURNING id INTO v_failure_id;
  RETURN v_failure_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION resolve_job_failure(p_failure_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE job_failures SET is_resolved = TRUE, resolved_at = NOW() WHERE id = p_failure_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION update_processing_checkpoint(
  p_function_name TEXT,
  p_last_processed_id TEXT DEFAULT NULL,
  p_records_processed BIGINT DEFAULT 0,
  p_checkpoint_data JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO processing_checkpoints (function_name, last_processed_at, last_processed_id, records_processed, checkpoint_data, updated_at)
  VALUES (p_function_name, NOW(), p_last_processed_id, p_records_processed, p_checkpoint_data, NOW())
  ON CONFLICT (function_name) DO UPDATE SET
    last_processed_at = NOW(),
    last_processed_id = COALESCE(p_last_processed_id, processing_checkpoints.last_processed_id),
    records_processed = processing_checkpoints.records_processed + p_records_processed,
    checkpoint_data = COALESCE(p_checkpoint_data, processing_checkpoints.checkpoint_data),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6.6 RLS policies
ALTER TABLE processing_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read processing_checkpoints"
  ON processing_checkpoints FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read system_health_metrics"
  ON system_health_metrics FOR SELECT TO authenticated USING (true);