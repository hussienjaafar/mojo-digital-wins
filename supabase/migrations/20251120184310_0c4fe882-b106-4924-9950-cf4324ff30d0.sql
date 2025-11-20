-- Create trending_topics table for AI-extracted trending topics
CREATE TABLE IF NOT EXISTS trending_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  mention_count INTEGER NOT NULL DEFAULT 1,
  hour_timestamp TIMESTAMPTZ NOT NULL,
  day_date DATE NOT NULL,

  -- Velocity metrics (what makes it "trending")
  velocity_score DECIMAL(10, 4) DEFAULT 0, -- Rate of increase
  momentum DECIMAL(10, 4) DEFAULT 0, -- Acceleration
  peak_position INTEGER, -- Highest rank achieved

  -- Sentiment for the topic
  avg_sentiment_score DECIMAL(5, 4),
  positive_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,

  -- Related data
  article_ids TEXT[] DEFAULT '{}',
  sample_titles TEXT[] DEFAULT '{}',
  related_keywords TEXT[] DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Uniqueness: One record per topic per hour
  UNIQUE(topic, hour_timestamp)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_trending_topics_timestamp ON trending_topics(hour_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_date ON trending_topics(day_date DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_velocity ON trending_topics(velocity_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_topic ON trending_topics(topic);

-- Function to calculate trend velocity
CREATE OR REPLACE FUNCTION calculate_trend_velocity()
RETURNS TRIGGER AS $$
DECLARE
  prev_hour_count INTEGER;
  prev_day_count INTEGER;
  current_count INTEGER;
BEGIN
  -- Get mention count from previous hour
  SELECT COALESCE(SUM(mention_count), 0) INTO prev_hour_count
  FROM trending_topics
  WHERE topic = NEW.topic
    AND hour_timestamp = (NEW.hour_timestamp - INTERVAL '1 hour');

  -- Get mention count from same time yesterday
  SELECT COALESCE(SUM(mention_count), 0) INTO prev_day_count
  FROM trending_topics
  WHERE topic = NEW.topic
    AND hour_timestamp = (NEW.hour_timestamp - INTERVAL '24 hours');

  current_count := NEW.mention_count;

  -- Calculate velocity (percentage increase)
  IF prev_hour_count > 0 THEN
    NEW.velocity_score := ((current_count - prev_hour_count)::DECIMAL / prev_hour_count) * 100;
  ELSIF current_count > 0 THEN
    NEW.velocity_score := 100; -- New topic = 100% growth
  ELSE
    NEW.velocity_score := 0;
  END IF;

  -- Calculate momentum (acceleration of growth)
  IF prev_day_count > 0 AND prev_hour_count > 0 THEN
    NEW.momentum := (
      (current_count - prev_hour_count)::DECIMAL / NULLIF(prev_hour_count, 0) -
      (prev_hour_count - prev_day_count)::DECIMAL / NULLIF(prev_day_count, 0)
    );
  ELSE
    NEW.momentum := NEW.velocity_score / 100;
  END IF;

  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate velocity on insert/update
DROP TRIGGER IF EXISTS trigger_calculate_velocity ON trending_topics;
CREATE TRIGGER trigger_calculate_velocity
  BEFORE INSERT OR UPDATE ON trending_topics
  FOR EACH ROW
  EXECUTE FUNCTION calculate_trend_velocity();

-- Enable Row Level Security
ALTER TABLE trending_topics ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access
DROP POLICY IF EXISTS "Allow public read access to trending topics" ON trending_topics;
CREATE POLICY "Allow public read access to trending topics"
  ON trending_topics FOR SELECT
  USING (true);

-- Policy: Allow service role to manage trending topics
DROP POLICY IF EXISTS "Allow service role to manage trending topics" ON trending_topics;
CREATE POLICY "Allow service role to manage trending topics"
  ON trending_topics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);