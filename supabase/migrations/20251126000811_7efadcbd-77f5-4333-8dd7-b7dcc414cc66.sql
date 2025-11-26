
-- Create real-time trending topics tracking for news articles
CREATE TABLE IF NOT EXISTS public.trending_news_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL UNIQUE,
  mentions_last_hour INTEGER DEFAULT 0,
  mentions_last_6_hours INTEGER DEFAULT 0,
  mentions_last_24_hours INTEGER DEFAULT 0,
  mentions_last_week INTEGER DEFAULT 0,
  velocity NUMERIC DEFAULT 0,
  peak_velocity NUMERIC DEFAULT 0,
  peak_at TIMESTAMPTZ,
  is_trending BOOLEAN DEFAULT false,
  trending_since TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  sentiment_avg NUMERIC DEFAULT 0,
  sentiment_positive INTEGER DEFAULT 0,
  sentiment_neutral INTEGER DEFAULT 0,
  sentiment_negative INTEGER DEFAULT 0,
  related_articles TEXT[] DEFAULT '{}',
  related_bluesky_trends TEXT[] DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create spike alerts table
CREATE TABLE IF NOT EXISTS public.spike_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  previous_mentions INTEGER NOT NULL,
  current_mentions INTEGER NOT NULL,
  velocity_increase NUMERIC NOT NULL,
  time_window TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  context_summary TEXT,
  related_articles TEXT[] DEFAULT '{}',
  related_posts TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  notification_channels TEXT[] DEFAULT '{}',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trending_news_topics_trending ON public.trending_news_topics(is_trending, velocity DESC) WHERE is_trending = true;
CREATE INDEX IF NOT EXISTS idx_spike_alerts_status ON public.spike_alerts(status, detected_at DESC);

-- RLS
ALTER TABLE public.trending_news_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spike_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage trending topics" ON public.trending_news_topics FOR ALL TO service_role USING (true);
CREATE POLICY "Users can view trending topics" ON public.trending_news_topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage spike alerts" ON public.spike_alerts FOR ALL TO service_role USING (true);
CREATE POLICY "Users can view spike alerts" ON public.spike_alerts FOR SELECT TO authenticated USING (true);
