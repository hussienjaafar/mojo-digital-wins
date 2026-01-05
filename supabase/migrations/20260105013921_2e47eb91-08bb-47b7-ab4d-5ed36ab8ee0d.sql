-- ============================================================
-- NEWS & TRENDS V3: Pipeline Infrastructure & Reliability
-- ============================================================

-- 1. PIPELINE_RUNS TABLE - Granular job execution logging
CREATE TABLE IF NOT EXISTS public.pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  job_name TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'skipped')),
  duration_ms INTEGER,
  
  -- Counts
  records_ingested INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  
  -- Error tracking
  error_summary TEXT,
  error_details JSONB,
  
  -- Idempotency & source tracking
  idempotency_key TEXT,
  triggered_by TEXT DEFAULT 'cron',
  triggered_by_user UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_job_type ON pipeline_runs(job_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at ON pipeline_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_runs_idempotency ON pipeline_runs(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. PIPELINE_HEALTH VIEW - Real-time pipeline health status
CREATE OR REPLACE VIEW public.pipeline_health AS
WITH latest_runs AS (
  SELECT DISTINCT ON (job_type)
    job_type,
    job_name,
    status,
    started_at,
    completed_at,
    duration_ms,
    records_processed,
    records_created,
    records_failed,
    error_summary
  FROM pipeline_runs
  ORDER BY job_type, started_at DESC
),
run_stats AS (
  SELECT
    job_type,
    COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS runs_24h,
    COUNT(*) FILTER (WHERE status = 'success' AND started_at > NOW() - INTERVAL '24 hours') AS successes_24h,
    COUNT(*) FILTER (WHERE status = 'failed' AND started_at > NOW() - INTERVAL '24 hours') AS failures_24h,
    SUM(records_created) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS records_created_24h,
    AVG(duration_ms) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') AS avg_duration_ms_24h
  FROM pipeline_runs
  GROUP BY job_type
)
SELECT
  lr.job_type,
  lr.job_name,
  lr.status AS last_status,
  lr.started_at AS last_run_at,
  lr.completed_at AS last_completed_at,
  lr.duration_ms AS last_duration_ms,
  lr.records_processed AS last_records_processed,
  lr.records_created AS last_records_created,
  lr.error_summary AS last_error,
  rs.runs_24h,
  rs.successes_24h,
  rs.failures_24h,
  rs.records_created_24h,
  rs.avg_duration_ms_24h,
  CASE
    WHEN lr.status = 'failed' THEN 'error'
    WHEN lr.started_at < NOW() - INTERVAL '2 hours' THEN 'stale'
    WHEN lr.started_at < NOW() - INTERVAL '30 minutes' THEN 'warning'
    ELSE 'ok'
  END AS freshness_status,
  EXTRACT(EPOCH FROM (NOW() - lr.started_at)) / 60 AS minutes_since_last_run
FROM latest_runs lr
LEFT JOIN run_stats rs ON lr.job_type = rs.job_type;

-- 3. TREND_DETECTION_CONFIG TABLE - Configurable thresholds
CREATE TABLE IF NOT EXISTS public.trend_detection_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  is_global_default BOOLEAN DEFAULT false,
  
  -- Volume thresholds
  min_mentions_to_trend INTEGER DEFAULT 5,
  min_mentions_breakthrough INTEGER DEFAULT 10,
  
  -- Velocity thresholds
  min_velocity_score NUMERIC DEFAULT 50,
  min_spike_ratio NUMERIC DEFAULT 2.0,
  
  -- Cross-source requirements
  min_source_count INTEGER DEFAULT 2,
  
  -- Source authority weights
  source_weights JSONB DEFAULT '{
    "google_news": 15,
    "rss": 12,
    "reddit": 10,
    "bluesky": 8
  }',
  
  -- Evergreen suppression
  suppress_evergreen BOOLEAN DEFAULT true,
  evergreen_volume_override INTEGER DEFAULT 20,
  
  -- Time windows
  spike_window_hours INTEGER DEFAULT 6,
  trend_window_hours INTEGER DEFAULT 24,
  
  -- Baseline calculation
  baseline_window_days INTEGER DEFAULT 7,
  baseline_min_deviation_pct NUMERIC DEFAULT 50,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert global defaults
INSERT INTO trend_detection_config (is_global_default) VALUES (true)
ON CONFLICT DO NOTHING;

-- 4. ARTICLE PROCESSING STATE - Add state machine columns if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'articles' AND column_name = 'processing_state'
  ) THEN
    ALTER TABLE articles ADD COLUMN processing_state TEXT DEFAULT 'raw';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'articles' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE articles ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'articles' AND column_name = 'last_processing_error'
  ) THEN
    ALTER TABLE articles ADD COLUMN last_processing_error TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'articles' AND column_name = 'last_processing_error_at'
  ) THEN
    ALTER TABLE articles ADD COLUMN last_processing_error_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'articles' AND column_name = 'dedupe_key'
  ) THEN
    ALTER TABLE articles ADD COLUMN dedupe_key TEXT;
  END IF;
END $$;

-- Index for processing state queries
CREATE INDEX IF NOT EXISTS idx_articles_processing_state ON articles(processing_state, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_dedupe_key ON articles(dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 5. PIPELINE_BACKLOG VIEW - Current queue depths
CREATE OR REPLACE VIEW public.pipeline_backlog AS
SELECT
  'articles' AS pipeline,
  (SELECT COUNT(*) FROM articles WHERE processing_status = 'pending' OR processing_status IS NULL) AS pending_count,
  (SELECT COUNT(*) FROM articles WHERE processing_status = 'processed') AS processed_count,
  (SELECT COUNT(*) FROM articles WHERE topics_extracted = false OR topics_extracted IS NULL) AS needs_extraction,
  (SELECT COUNT(*) FROM articles WHERE created_at > NOW() - INTERVAL '24 hours') AS ingested_24h,
  (SELECT COUNT(*) FROM articles WHERE processing_status = 'processed' AND updated_at > NOW() - INTERVAL '24 hours') AS processed_24h
UNION ALL
SELECT
  'bluesky' AS pipeline,
  (SELECT COUNT(*) FROM bluesky_posts WHERE ai_processed = false OR ai_processed IS NULL) AS pending_count,
  (SELECT COUNT(*) FROM bluesky_posts WHERE ai_processed = true) AS processed_count,
  0 AS needs_extraction,
  (SELECT COUNT(*) FROM bluesky_posts WHERE created_at > NOW() - INTERVAL '24 hours') AS ingested_24h,
  (SELECT COUNT(*) FROM bluesky_posts WHERE ai_processed = true AND ai_processed_at > NOW() - INTERVAL '24 hours') AS processed_24h
UNION ALL
SELECT
  'trend_clusters' AS pipeline,
  0 AS pending_count,
  (SELECT COUNT(*) FROM trend_clusters) AS processed_count,
  0 AS needs_extraction,
  0 AS ingested_24h,
  (SELECT COUNT(*) FROM trend_clusters WHERE updated_at > NOW() - INTERVAL '24 hours') AS processed_24h;

-- 6. RLS Policies for pipeline tables
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_detection_config ENABLE ROW LEVEL SECURITY;

-- Pipeline runs: admins can view all (using has_role function)
CREATE POLICY "Admins can view pipeline runs"
  ON pipeline_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "System can insert pipeline runs"
  ON pipeline_runs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trend config: admins can manage all, org users can view their org config
CREATE POLICY "Admins can view all trend configs"
  ON trend_detection_config FOR SELECT
  TO authenticated
  USING (
    is_global_default = true
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR organization_id IN (
      SELECT organization_id FROM client_users 
      WHERE client_users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage trend configs"
  ON trend_detection_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 7. Function to log pipeline runs
CREATE OR REPLACE FUNCTION public.log_pipeline_run(
  p_job_type TEXT,
  p_job_name TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'running',
  p_records_processed INTEGER DEFAULT 0,
  p_records_created INTEGER DEFAULT 0,
  p_records_failed INTEGER DEFAULT 0,
  p_error_summary TEXT DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_triggered_by TEXT DEFAULT 'cron'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id UUID;
BEGIN
  INSERT INTO pipeline_runs (
    job_type,
    job_name,
    status,
    records_processed,
    records_created,
    records_failed,
    error_summary,
    error_details,
    idempotency_key,
    triggered_by,
    completed_at,
    duration_ms
  ) VALUES (
    p_job_type,
    p_job_name,
    p_status,
    p_records_processed,
    p_records_created,
    p_records_failed,
    p_error_summary,
    p_error_details,
    p_idempotency_key,
    p_triggered_by,
    CASE WHEN p_status IN ('success', 'failed', 'skipped') THEN NOW() ELSE NULL END,
    NULL
  )
  RETURNING id INTO v_run_id;
  
  RETURN v_run_id;
END;
$$;

-- 8. Function to complete a pipeline run
CREATE OR REPLACE FUNCTION public.complete_pipeline_run(
  p_run_id UUID,
  p_status TEXT,
  p_records_processed INTEGER DEFAULT NULL,
  p_records_created INTEGER DEFAULT NULL,
  p_records_failed INTEGER DEFAULT NULL,
  p_error_summary TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE pipeline_runs
  SET
    status = p_status,
    completed_at = NOW(),
    duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
    records_processed = COALESCE(p_records_processed, records_processed),
    records_created = COALESCE(p_records_created, records_created),
    records_failed = COALESCE(p_records_failed, records_failed),
    error_summary = COALESCE(p_error_summary, error_summary)
  WHERE id = p_run_id;
END;
$$;