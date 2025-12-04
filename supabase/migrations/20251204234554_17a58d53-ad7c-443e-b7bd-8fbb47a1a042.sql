-- Phase 4: Performance Indexes (Fixed column names)

-- Articles indexes
CREATE INDEX IF NOT EXISTS idx_articles_groups ON articles USING GIN (affected_groups);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (relevance_category, published_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_threat_date ON articles (threat_level, published_date DESC) WHERE threat_level IS NOT NULL;

-- Bluesky indexes
CREATE INDEX IF NOT EXISTS idx_bluesky_analysis_queue ON bluesky_posts (ai_processed, created_at DESC) WHERE ai_processed = false;
CREATE INDEX IF NOT EXISTS idx_bluesky_topics_date ON bluesky_posts USING GIN (ai_topics) WHERE ai_processed = true;

-- Trend clusters indexes (using correct column names)
CREATE INDEX IF NOT EXISTS idx_trend_clusters_active ON trend_clusters (is_trending DESC, velocity_score DESC) WHERE is_trending = true;
CREATE INDEX IF NOT EXISTS idx_trend_clusters_entity ON trend_clusters (entity_type, total_mentions DESC);
CREATE INDEX IF NOT EXISTS idx_trend_clusters_updated ON trend_clusters (updated_at DESC);

-- Scheduled jobs index
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run ON scheduled_jobs (next_run_at ASC) WHERE is_active = true;

-- Cache cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_analysis_cache
  WHERE last_used_at < NOW() - INTERVAL '7 days'
    OR (created_at < NOW() - INTERVAL '30 days');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;