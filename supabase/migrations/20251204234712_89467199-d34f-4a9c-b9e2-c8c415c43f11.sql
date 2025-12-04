-- Phase 5: Advanced Analytics (Fixed - no unique index on view)

-- 5.1 Create unified trends materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_unified_trends;
CREATE MATERIALIZED VIEW mv_unified_trends AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY COALESCE(tc.total_mentions, 0) + COALESCE(bt.mentions_last_24_hours, 0) DESC) as row_id,
  COALESCE(tc.cluster_title, bt.topic) as topic,
  tc.cluster_title as news_topic,
  bt.topic as social_topic,
  tc.velocity_score as news_velocity,
  bt.velocity as social_velocity,
  COALESCE(tc.velocity_score, 0) + COALESCE(bt.velocity, 0) as combined_velocity,
  tc.sentiment_score as news_sentiment,
  bt.sentiment_avg as social_sentiment,
  (COALESCE(tc.sentiment_score, 0) + COALESCE(bt.sentiment_avg, 0)) / 
    NULLIF((CASE WHEN tc.sentiment_score IS NOT NULL THEN 1 ELSE 0 END + 
            CASE WHEN bt.sentiment_avg IS NOT NULL THEN 1 ELSE 0 END), 0) as combined_sentiment,
  COALESCE(tc.total_mentions, 0) as news_mentions,
  COALESCE(bt.mentions_last_24_hours, 0) as social_mentions,
  COALESCE(tc.total_mentions, 0) + COALESCE(bt.mentions_last_24_hours, 0) as total_mentions,
  tc.entity_type,
  tc.is_trending as news_trending,
  bt.is_trending as social_trending,
  (tc.is_trending = true OR bt.is_trending = true) as is_trending,
  GREATEST(tc.updated_at, bt.updated_at) as last_updated
FROM trend_clusters tc
FULL OUTER JOIN bluesky_trends bt 
  ON LOWER(tc.cluster_title) = LOWER(bt.topic)
WHERE (tc.updated_at > NOW() - INTERVAL '24 hours' OR bt.updated_at > NOW() - INTERVAL '24 hours');

CREATE UNIQUE INDEX idx_mv_unified_trends_rowid ON mv_unified_trends (row_id);
CREATE INDEX idx_mv_unified_trends_topic ON mv_unified_trends (topic);
CREATE INDEX idx_mv_unified_trends_trending ON mv_unified_trends (is_trending DESC, total_mentions DESC);

-- 5.2 Add sentiment columns
ALTER TABLE daily_group_sentiment ADD COLUMN IF NOT EXISTS social_sentiment NUMERIC;
ALTER TABLE daily_group_sentiment ADD COLUMN IF NOT EXISTS combined_sentiment NUMERIC;

-- 5.3 Anomaly detection table
CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  topic TEXT NOT NULL,
  entity_type TEXT,
  current_value NUMERIC NOT NULL,
  baseline_value NUMERIC,
  z_score NUMERIC,
  deviation_percentage NUMERIC,
  severity TEXT DEFAULT 'medium',
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_type ON anomaly_alerts (alert_type, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_unresolved ON anomaly_alerts (detected_at DESC) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view anomaly alerts" ON anomaly_alerts;
CREATE POLICY "Admins can view anomaly alerts" ON anomaly_alerts
  FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage anomaly alerts" ON anomaly_alerts;
CREATE POLICY "Admins can manage anomaly alerts" ON anomaly_alerts
  FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 5.4 Anomaly detection function
CREATE OR REPLACE FUNCTION detect_velocity_anomalies(
  lookback_hours INTEGER DEFAULT 24,
  z_threshold NUMERIC DEFAULT 2.0
)
RETURNS TABLE (
  topic TEXT,
  entity_type TEXT,
  current_velocity NUMERIC,
  avg_velocity NUMERIC,
  std_velocity NUMERIC,
  z_score NUMERIC,
  is_anomaly BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH velocity_stats AS (
    SELECT 
      cluster_title,
      tc.entity_type,
      velocity_score,
      AVG(velocity_score) OVER () as avg_vel,
      STDDEV(velocity_score) OVER () as std_vel
    FROM trend_clusters tc
    WHERE updated_at > NOW() - (lookback_hours || ' hours')::INTERVAL
      AND velocity_score IS NOT NULL
  )
  SELECT 
    vs.cluster_title,
    vs.entity_type,
    vs.velocity_score,
    vs.avg_vel,
    vs.std_vel,
    CASE WHEN vs.std_vel > 0 THEN (vs.velocity_score - vs.avg_vel) / vs.std_vel ELSE 0 END,
    CASE WHEN vs.std_vel > 0 AND ABS((vs.velocity_score - vs.avg_vel) / vs.std_vel) > z_threshold THEN true ELSE false END
  FROM velocity_stats vs
  WHERE vs.std_vel > 0
  ORDER BY (vs.velocity_score - vs.avg_vel) / NULLIF(vs.std_vel, 0) DESC;
END;
$$;

-- 5.5 Refresh analytics function
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_unified_trends;
END;
$$;