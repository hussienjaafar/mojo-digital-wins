-- Add trend_score column for velocity-based ranking
ALTER TABLE trend_events 
ADD COLUMN IF NOT EXISTS trend_score numeric DEFAULT 0;

-- Add z_score_velocity for statistical ranking
ALTER TABLE trend_events 
ADD COLUMN IF NOT EXISTS z_score_velocity numeric DEFAULT 0;

-- Add index for trend_score ordering
CREATE INDEX IF NOT EXISTS idx_trend_events_trend_score 
ON trend_events (trend_score DESC) 
WHERE is_trending = true;

-- Update the active view to include new fields
DROP VIEW IF EXISTS trend_events_active;

CREATE VIEW trend_events_active AS
SELECT 
  te.*,
  -- Calculate baseline delta percentage
  CASE 
    WHEN te.baseline_7d > 0 
    THEN ROUND(((te.current_1h::numeric - te.baseline_7d) / te.baseline_7d * 100)::numeric, 1)
    ELSE te.current_1h * 100
  END as baseline_delta_pct,
  -- Calculate freshness
  CASE
    WHEN te.last_seen_at > NOW() - INTERVAL '30 minutes' THEN 'fresh'
    WHEN te.last_seen_at > NOW() - INTERVAL '2 hours' THEN 'recent'
    WHEN te.last_seen_at > NOW() - INTERVAL '6 hours' THEN 'aging'
    ELSE 'stale'
  END as freshness,
  -- Evidence breakdown
  COALESCE(te.news_source_count, 0) as news_evidence_count,
  COALESCE(te.social_source_count, 0) as social_evidence_count
FROM trend_events te
WHERE te.last_seen_at > NOW() - INTERVAL '24 hours'
  AND te.current_24h >= 3
ORDER BY 
  te.is_breaking DESC,
  te.trend_score DESC NULLS LAST,
  te.velocity DESC;