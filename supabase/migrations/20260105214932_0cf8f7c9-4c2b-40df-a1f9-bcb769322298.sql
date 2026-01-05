-- ============================================================
-- TASK 1: Pipeline Scheduling & Freshness Reliability  
-- ============================================================

-- 1. REMOVE DUPLICATE SCHEDULED JOBS
DELETE FROM scheduled_jobs a
USING scheduled_jobs b
WHERE a.job_type = b.job_type 
  AND a.id > b.id
  AND a.job_type IN ('sync_meta_ads', 'edge_function');

-- 2. ADD UNIQUE CONSTRAINT ON job_type
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_jobs_job_type_key ON scheduled_jobs(job_type);

-- 3. RE-ENABLE DISABLED NEWS & TRENDS JOBS
UPDATE scheduled_jobs
SET 
  is_active = true,
  consecutive_failures = 0,
  next_run_at = NOW()
WHERE job_type IN (
  'fetch_rss',
  'collect_bluesky', 
  'calculate_news_trends',
  'correlate_social_news',
  'detect_anomalies'
) AND is_active = false;

-- 4. UPSERT NEWS & TRENDS JOBS (include required 'endpoint' column)
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, next_run_at)
VALUES 
  ('RSS Feed Sync', 'fetch_rss', '*/10 * * * *', 'fetch-rss-feeds', true, NOW()),
  ('Fetch Google News', 'fetch_google_news', '*/20 * * * *', 'fetch-google-news', true, NOW()),
  ('Collect Bluesky Posts', 'collect_bluesky', '*/5 * * * *', 'bluesky-stream', true, NOW()),
  ('Analyze Articles', 'analyze_articles', '*/20 * * * *', 'analyze-articles', true, NOW()),
  ('Analyze Bluesky Posts', 'analyze_bluesky', '*/15 * * * *', 'analyze-bluesky-posts', true, NOW()),
  ('Calculate News Trends', 'calculate_news_trends', '*/15 * * * *', 'calculate-news-trends', true, NOW()),
  ('Calculate Bluesky Trends', 'calculate_bluesky_trends', '*/15 * * * *', 'calculate-bluesky-trends', true, NOW()),
  ('Correlate Social & News', 'correlate_social_news', '*/20 * * * *', 'correlate-social-news', true, NOW()),
  ('Detect Anomalies', 'detect_anomalies', '*/30 * * * *', 'detect-anomalies', true, NOW()),
  ('Smart Alerting', 'smart_alerting', '*/30 * * * *', 'smart-alerting', true, NOW())
ON CONFLICT (job_type) DO UPDATE SET is_active = true, consecutive_failures = 0;

-- 5. CREATE PIPELINE_HEARTBEAT TABLE
CREATE TABLE IF NOT EXISTS public.pipeline_heartbeat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL UNIQUE,
  job_name TEXT,
  last_started_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_status TEXT CHECK (last_status IN ('running', 'success', 'failed', 'skipped')),
  last_error TEXT,
  last_duration_ms INTEGER,
  sla_minutes INTEGER DEFAULT 60,
  is_critical BOOLEAN DEFAULT false,
  consecutive_failures INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_job_type ON pipeline_heartbeat(job_type);
CREATE INDEX IF NOT EXISTS idx_heartbeat_critical ON pipeline_heartbeat(is_critical, last_success_at);

-- 6. INITIALIZE HEARTBEAT RECORDS
INSERT INTO pipeline_heartbeat (job_type, job_name, sla_minutes, is_critical)
VALUES
  ('fetch_rss', 'RSS Feed Sync', 30, true),
  ('fetch_google_news', 'Google News Sync', 60, true),
  ('collect_bluesky', 'Bluesky Collection', 15, true),
  ('analyze_articles', 'Article Analysis', 60, false),
  ('analyze_bluesky', 'Bluesky Analysis', 60, false),
  ('calculate_news_trends', 'News Trends', 60, true),
  ('calculate_bluesky_trends', 'Bluesky Trends', 60, false),
  ('correlate_social_news', 'Social Correlation', 120, false),
  ('detect_anomalies', 'Anomaly Detection', 120, false),
  ('smart_alerting', 'Smart Alerting', 120, false)
ON CONFLICT (job_type) DO NOTHING;

-- 7. CREATE UPDATE HEARTBEAT FUNCTION
CREATE OR REPLACE FUNCTION public.update_pipeline_heartbeat(
  p_job_type TEXT,
  p_status TEXT,
  p_duration_ms INTEGER DEFAULT NULL,
  p_error TEXT DEFAULT NULL,
  p_records_processed INTEGER DEFAULT 0,
  p_records_created INTEGER DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_heartbeat_id UUID;
BEGIN
  INSERT INTO pipeline_heartbeat (job_type, last_started_at, last_status, last_duration_ms, last_error, updated_at)
  VALUES (p_job_type, NOW(), p_status, p_duration_ms, p_error, NOW())
  ON CONFLICT (job_type) DO UPDATE SET
    last_started_at = CASE WHEN p_status = 'running' THEN NOW() ELSE pipeline_heartbeat.last_started_at END,
    last_success_at = CASE WHEN p_status = 'success' THEN NOW() ELSE pipeline_heartbeat.last_success_at END,
    last_failure_at = CASE WHEN p_status = 'failed' THEN NOW() ELSE pipeline_heartbeat.last_failure_at END,
    last_status = p_status,
    last_duration_ms = COALESCE(p_duration_ms, pipeline_heartbeat.last_duration_ms),
    last_error = CASE WHEN p_status = 'failed' THEN p_error ELSE NULL END,
    consecutive_failures = CASE 
      WHEN p_status = 'success' THEN 0 
      WHEN p_status = 'failed' THEN pipeline_heartbeat.consecutive_failures + 1 
      ELSE pipeline_heartbeat.consecutive_failures 
    END,
    updated_at = NOW()
  RETURNING id INTO v_heartbeat_id;

  -- Log to pipeline_runs for history
  INSERT INTO pipeline_runs (job_type, status, duration_ms, error_summary, records_processed, records_created, completed_at)
  VALUES (
    p_job_type, 
    p_status, 
    p_duration_ms, 
    p_error,
    p_records_processed,
    p_records_created,
    CASE WHEN p_status IN ('success', 'failed', 'skipped') THEN NOW() ELSE NULL END
  );

  RETURN v_heartbeat_id;
END;
$$;

-- 8. CREATE PIPELINE FRESHNESS VIEW
CREATE OR REPLACE VIEW public.pipeline_freshness AS
SELECT
  h.job_type,
  h.job_name,
  h.last_started_at,
  h.last_success_at,
  h.last_failure_at,
  h.last_status,
  h.last_error,
  h.last_duration_ms,
  h.sla_minutes,
  h.is_critical,
  h.consecutive_failures,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(h.last_success_at, h.last_started_at))) / 60 AS age_minutes,
  CASE
    WHEN h.last_status = 'failed' AND h.consecutive_failures >= 3 THEN 'critical'
    WHEN h.last_success_at IS NULL THEN 'unknown'
    WHEN EXTRACT(EPOCH FROM (NOW() - h.last_success_at)) / 60 > h.sla_minutes * 3 THEN 'critical'
    WHEN EXTRACT(EPOCH FROM (NOW() - h.last_success_at)) / 60 > h.sla_minutes THEN 'stale'
    ELSE 'live'
  END AS freshness_status,
  GREATEST(0, h.sla_minutes - EXTRACT(EPOCH FROM (NOW() - COALESCE(h.last_success_at, h.last_started_at))) / 60) AS minutes_until_sla_breach,
  h.updated_at
FROM pipeline_heartbeat h;

-- 9. CREATE DEADMAN ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.pipeline_deadman_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  job_name TEXT,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('stale', 'critical', 'failure_streak')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  sla_minutes INTEGER,
  actual_age_minutes NUMERIC,
  consecutive_failures INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deadman_alerts_active ON pipeline_deadman_alerts(is_active, created_at DESC);

-- 10. CREATE DEADMAN CHECK FUNCTION
CREATE OR REPLACE FUNCTION public.check_pipeline_deadman()
RETURNS TABLE (
  job_type TEXT,
  job_name TEXT,
  freshness_status TEXT,
  age_minutes NUMERIC,
  sla_minutes INTEGER,
  is_critical BOOLEAN,
  alert_needed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pf.job_type,
    pf.job_name,
    pf.freshness_status::TEXT,
    pf.age_minutes,
    pf.sla_minutes,
    pf.is_critical,
    (pf.freshness_status IN ('stale', 'critical') AND pf.is_critical) AS alert_needed
  FROM pipeline_freshness pf
  WHERE pf.freshness_status IN ('stale', 'critical', 'unknown');
END;
$$;

-- 11. CREATE TRIGGER FOR AUTO-ALERTS
CREATE OR REPLACE FUNCTION public.create_deadman_alert_if_needed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freshness RECORD;
  v_existing_alert UUID;
BEGIN
  SELECT * INTO v_freshness
  FROM pipeline_freshness
  WHERE job_type = NEW.job_type;

  IF v_freshness.freshness_status IN ('stale', 'critical') AND v_freshness.is_critical THEN
    SELECT id INTO v_existing_alert
    FROM pipeline_deadman_alerts
    WHERE job_type = NEW.job_type AND is_active = true
    LIMIT 1;

    IF v_existing_alert IS NULL THEN
      INSERT INTO pipeline_deadman_alerts (
        job_type, job_name, alert_type, severity, message,
        sla_minutes, actual_age_minutes, consecutive_failures
      ) VALUES (
        NEW.job_type,
        v_freshness.job_name,
        CASE WHEN v_freshness.freshness_status = 'critical' THEN 'critical' ELSE 'stale' END,
        CASE WHEN v_freshness.freshness_status = 'critical' THEN 'critical' ELSE 'warning' END,
        format('Pipeline %s is %s: %s minutes since last success (SLA: %s minutes)',
          v_freshness.job_name, v_freshness.freshness_status,
          round(v_freshness.age_minutes::numeric, 1), v_freshness.sla_minutes),
        v_freshness.sla_minutes,
        v_freshness.age_minutes,
        v_freshness.consecutive_failures
      );
    END IF;
  ELSE
    UPDATE pipeline_deadman_alerts
    SET is_active = false, resolved_at = NOW()
    WHERE job_type = NEW.job_type AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deadman_alert ON pipeline_heartbeat;
CREATE TRIGGER trg_deadman_alert
AFTER INSERT OR UPDATE ON pipeline_heartbeat
FOR EACH ROW
EXECUTE FUNCTION create_deadman_alert_if_needed();

-- 12. GRANT PERMISSIONS
GRANT SELECT ON pipeline_heartbeat TO authenticated, anon;
GRANT SELECT ON pipeline_freshness TO authenticated, anon;
GRANT SELECT ON pipeline_deadman_alerts TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_pipeline_heartbeat TO service_role;
GRANT EXECUTE ON FUNCTION check_pipeline_deadman TO authenticated, anon;