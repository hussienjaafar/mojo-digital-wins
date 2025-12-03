-- Phase 5: Advanced Analytics

-- 5.1 Create daily group sentiment tracking table
CREATE TABLE IF NOT EXISTS public.daily_group_sentiment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  affected_group TEXT NOT NULL,
  avg_sentiment NUMERIC,
  sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'declining', 'stable')),
  previous_avg_sentiment NUMERIC,
  change_percentage NUMERIC,
  article_count INT DEFAULT 0,
  social_post_count INT DEFAULT 0,
  top_topics TEXT[],
  top_sources TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, affected_group)
);

-- 5.2 Create anomaly detection alerts table
CREATE TABLE IF NOT EXISTS public.trend_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('velocity_spike', 'sentiment_shift', 'volume_surge', 'sudden_drop')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  current_value NUMERIC NOT NULL,
  expected_value NUMERIC NOT NULL,
  z_score NUMERIC NOT NULL,
  deviation_percentage NUMERIC,
  affected_groups TEXT[],
  source_type TEXT CHECK (source_type IN ('news', 'social', 'combined')),
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.3 Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_group_sentiment_date ON daily_group_sentiment(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_group_sentiment_group ON daily_group_sentiment(affected_group);
CREATE INDEX IF NOT EXISTS idx_trend_anomalies_detected ON trend_anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_anomalies_topic ON trend_anomalies(topic);
CREATE INDEX IF NOT EXISTS idx_trend_anomalies_unacknowledged ON trend_anomalies(is_acknowledged) WHERE is_acknowledged = FALSE;

-- 5.4 Create materialized view for group sentiment aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_group_sentiment_daily AS
SELECT 
  DATE(published_date) as date,
  unnest(affected_groups) as group_name,
  AVG(sentiment_score) as avg_sentiment,
  COUNT(*) as article_count,
  ARRAY_AGG(DISTINCT source_name) FILTER (WHERE source_name IS NOT NULL) as sources,
  ARRAY_AGG(DISTINCT category) FILTER (WHERE category IS NOT NULL) as categories
FROM articles
WHERE published_date >= NOW() - INTERVAL '90 days'
  AND affected_groups IS NOT NULL
  AND sentiment_score IS NOT NULL
GROUP BY DATE(published_date), unnest(affected_groups);

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_group_sentiment_daily_unique 
ON mv_group_sentiment_daily(date, group_name);

-- 5.5 Create function to calculate sentiment trend
CREATE OR REPLACE FUNCTION calculate_sentiment_trend(
  current_sentiment NUMERIC,
  previous_sentiment NUMERIC
) RETURNS TEXT AS $$
BEGIN
  IF previous_sentiment IS NULL THEN
    RETURN 'stable';
  END IF;
  
  IF current_sentiment > previous_sentiment + 0.1 THEN
    RETURN 'improving';
  ELSIF current_sentiment < previous_sentiment - 0.1 THEN
    RETURN 'declining';
  ELSE
    RETURN 'stable';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5.6 Create function to refresh group sentiment
CREATE OR REPLACE FUNCTION refresh_daily_group_sentiment()
RETURNS void AS $$
BEGIN
  -- Refresh the materialized view first
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_group_sentiment_daily;
  
  -- Insert/update daily sentiment records
  INSERT INTO daily_group_sentiment (date, affected_group, avg_sentiment, article_count, top_sources)
  SELECT 
    date,
    group_name,
    avg_sentiment,
    article_count,
    sources[:5] -- Top 5 sources
  FROM mv_group_sentiment_daily
  WHERE date >= NOW() - INTERVAL '7 days'
  ON CONFLICT (date, affected_group) 
  DO UPDATE SET
    avg_sentiment = EXCLUDED.avg_sentiment,
    article_count = EXCLUDED.article_count,
    top_sources = EXCLUDED.top_sources;
  
  -- Update sentiment trends by comparing with previous day
  UPDATE daily_group_sentiment dgs
  SET 
    previous_avg_sentiment = prev.avg_sentiment,
    sentiment_trend = calculate_sentiment_trend(dgs.avg_sentiment, prev.avg_sentiment),
    change_percentage = CASE 
      WHEN prev.avg_sentiment IS NOT NULL AND prev.avg_sentiment != 0 
      THEN ((dgs.avg_sentiment - prev.avg_sentiment) / ABS(prev.avg_sentiment)) * 100
      ELSE NULL
    END
  FROM daily_group_sentiment prev
  WHERE dgs.affected_group = prev.affected_group
    AND dgs.date = prev.date + INTERVAL '1 day'
    AND dgs.date >= NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE daily_group_sentiment ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_anomalies ENABLE ROW LEVEL SECURITY;

-- RLS policies - these are admin/system tables, allow authenticated users to read
CREATE POLICY "Authenticated users can read group sentiment"
  ON daily_group_sentiment FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read anomalies"
  ON trend_anomalies FOR SELECT
  TO authenticated
  USING (true);

-- Service role can insert/update
CREATE POLICY "Service role can manage group sentiment"
  ON daily_group_sentiment FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage anomalies"
  ON trend_anomalies FOR ALL
  USING (true)
  WITH CHECK (true);