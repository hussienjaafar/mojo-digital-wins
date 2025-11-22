-- Phase 1: Create Analytics Tables

-- Create sentiment_snapshots table
CREATE TABLE IF NOT EXISTS sentiment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  affected_group TEXT NOT NULL,
  article_count INTEGER DEFAULT 0,
  positive_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  avg_sentiment NUMERIC,
  sentiment_trend TEXT, -- 'improving', 'declining', 'stable'
  top_topics JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, affected_group)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sentiment_snapshots_date ON sentiment_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_snapshots_group ON sentiment_snapshots(affected_group);
CREATE INDEX IF NOT EXISTS idx_sentiment_snapshots_date_group ON sentiment_snapshots(snapshot_date, affected_group);

-- Enable RLS
ALTER TABLE sentiment_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view sentiment snapshots" ON sentiment_snapshots;
CREATE POLICY "Anyone can view sentiment snapshots"
  ON sentiment_snapshots FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service can manage sentiment snapshots" ON sentiment_snapshots;
CREATE POLICY "Service can manage sentiment snapshots"
  ON sentiment_snapshots FOR ALL
  USING (true)
  WITH CHECK (true);

-- Fix trending_topics table schema
ALTER TABLE trending_topics
ADD COLUMN IF NOT EXISTS sentiment_avg NUMERIC,
ADD COLUMN IF NOT EXISTS sentiment_positive INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sentiment_negative INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sentiment_neutral INTEGER DEFAULT 0;

-- Add missing indexes to trending_topics
CREATE INDEX IF NOT EXISTS idx_trending_topics_velocity ON trending_topics(velocity_score DESC) WHERE velocity_score > 50;
CREATE INDEX IF NOT EXISTS idx_trending_topics_hour ON trending_topics(hour_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_topic_hour ON trending_topics(topic, hour_timestamp DESC);