-- Apply Bluesky Social Intelligence migrations in order

-- Migration 1: Add Bluesky Social Intelligence System
-- AI-powered trend analysis with correlation to news articles

-- =============================================================================
-- 1. BLUESKY POSTS TABLE (Raw social data)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bluesky_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_uri TEXT UNIQUE NOT NULL,
  post_cid TEXT,
  author_did TEXT NOT NULL,
  author_handle TEXT,
  text TEXT,
  hashtags TEXT[] DEFAULT '{}',
  mentions TEXT[] DEFAULT '{}',
  urls TEXT[] DEFAULT '{}',
  reply_to TEXT,
  quote_of TEXT,
  embed_type TEXT,
  langs TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ DEFAULT now(),
  -- AI Analysis fields
  ai_topics TEXT[] DEFAULT '{}',
  ai_sentiment NUMERIC,
  ai_sentiment_label TEXT,
  ai_relevance_score NUMERIC,
  ai_processed BOOLEAN DEFAULT false,
  ai_processed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_created ON public.bluesky_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_author ON public.bluesky_posts(author_handle);
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_hashtags ON public.bluesky_posts USING GIN(hashtags);
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_topics ON public.bluesky_posts USING GIN(ai_topics);
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_ai_processed ON public.bluesky_posts(ai_processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_relevance ON public.bluesky_posts(ai_relevance_score DESC) WHERE ai_relevance_score > 0.5;

-- =============================================================================
-- 2. BLUESKY TRENDS TABLE (Aggregated trending topics)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bluesky_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  keyword_variations TEXT[] DEFAULT '{}',
  mentions_last_hour INTEGER DEFAULT 0,
  mentions_last_6_hours INTEGER DEFAULT 0,
  mentions_last_24_hours INTEGER DEFAULT 0,
  mentions_last_week INTEGER DEFAULT 0,
  velocity NUMERIC,
  sentiment_avg NUMERIC,
  sentiment_positive INTEGER DEFAULT 0,
  sentiment_neutral INTEGER DEFAULT 0,
  sentiment_negative INTEGER DEFAULT 0,
  is_trending BOOLEAN DEFAULT false,
  trending_since TIMESTAMPTZ,
  peak_velocity NUMERIC,
  peak_at TIMESTAMPTZ,
  -- Correlation with news
  related_articles UUID[],
  related_bills UUID[],
  related_executive_orders UUID[],
  correlation_score NUMERIC,
  -- Metadata
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  calculated_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bluesky_trends_velocity ON public.bluesky_trends(velocity DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_bluesky_trends_trending ON public.bluesky_trends(is_trending, velocity DESC);
CREATE INDEX IF NOT EXISTS idx_bluesky_trends_topic ON public.bluesky_trends(topic);
CREATE INDEX IF NOT EXISTS idx_bluesky_trends_updated ON public.bluesky_trends(updated_at DESC);

-- =============================================================================
-- 3. BLUESKY TOPIC CLUSTERS (Network analysis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bluesky_topic_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_name TEXT NOT NULL,
  topics TEXT[] NOT NULL,
  central_topic TEXT,
  post_count INTEGER DEFAULT 0,
  author_count INTEGER DEFAULT 0,
  engagement_score NUMERIC,
  cluster_sentiment NUMERIC,
  cluster_velocity NUMERIC,
  is_breaking BOOLEAN DEFAULT false,
  density NUMERIC,
  centrality NUMERIC,
  related_news_cluster_id UUID,
  detected_at TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bluesky_clusters_breaking ON public.bluesky_topic_clusters(is_breaking, cluster_velocity DESC);
CREATE INDEX IF NOT EXISTS idx_bluesky_clusters_updated ON public.bluesky_topic_clusters(last_updated DESC);

-- =============================================================================
-- 4. BLUESKY KEYWORD TRACKING (Monitored keywords/orgs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bluesky_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  is_active BOOLEAN DEFAULT true,
  total_mentions INTEGER DEFAULT 0,
  last_mention_at TIMESTAMPTZ,
  alert_threshold INTEGER,
  alert_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default tracked keywords
INSERT INTO public.bluesky_keywords (keyword, category, priority) VALUES
  ('CAIR', 'organization', 'critical'),
  ('Council on American-Islamic Relations', 'organization', 'critical'),
  ('Muslim Public Affairs Council', 'organization', 'high'),
  ('MPAC', 'organization', 'high'),
  ('Arab American Institute', 'organization', 'high'),
  ('ADC', 'organization', 'high'),
  ('American-Arab Anti-Discrimination Committee', 'organization', 'high'),
  ('ACLU', 'organization', 'high'),
  ('Muslim American', 'community', 'critical'),
  ('Arab American', 'community', 'critical'),
  ('Muslim Americans', 'community', 'critical'),
  ('Arab Americans', 'community', 'critical'),
  ('Islamophobia', 'issue', 'critical'),
  ('anti-Muslim', 'issue', 'critical'),
  ('civil liberties', 'issue', 'high'),
  ('religious freedom', 'issue', 'high'),
  ('surveillance', 'issue', 'high'),
  ('profiling', 'issue', 'high'),
  ('discrimination', 'issue', 'high'),
  ('hate crime', 'issue', 'critical'),
  ('Palestine', 'location', 'high'),
  ('Gaza', 'location', 'high'),
  ('West Bank', 'location', 'high'),
  ('Middle East', 'location', 'medium'),
  ('Israel', 'location', 'medium'),
  ('Syria', 'location', 'medium'),
  ('Iraq', 'location', 'medium'),
  ('Yemen', 'location', 'medium')
ON CONFLICT (keyword) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_bluesky_keywords_active ON public.bluesky_keywords(is_active, priority);

-- =============================================================================
-- 5. SOCIAL VELOCITY SNAPSHOTS (Time-series data for charting)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.social_velocity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_time TIMESTAMPTZ NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  topic TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_velocity_snapshots_time ON public.social_velocity_snapshots(snapshot_time DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_snapshots_topic ON public.social_velocity_snapshots(topic, snapshot_time DESC);

-- =============================================================================
-- 6. BLUESKY ARTICLE CORRELATIONS (Social → News linking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bluesky_article_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  social_mentions INTEGER DEFAULT 0,
  social_sentiment NUMERIC,
  correlation_strength NUMERIC,
  peak_social_time TIMESTAMPTZ,
  article_published TIMESTAMPTZ,
  time_lag_minutes INTEGER,
  is_predictive BOOLEAN DEFAULT false,
  detected_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_article_correlations_article ON public.bluesky_article_correlations(article_id);
CREATE INDEX IF NOT EXISTS idx_article_correlations_strength ON public.bluesky_article_correlations(correlation_strength DESC);
CREATE INDEX IF NOT EXISTS idx_article_correlations_predictive ON public.bluesky_article_correlations(is_predictive) WHERE is_predictive = true;

-- =============================================================================
-- 7. RLS POLICIES
-- =============================================================================

ALTER TABLE public.bluesky_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bluesky_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bluesky_topic_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bluesky_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_velocity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bluesky_article_correlations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view Bluesky posts" ON public.bluesky_posts;
DROP POLICY IF EXISTS "Anyone can view Bluesky trends" ON public.bluesky_trends;
DROP POLICY IF EXISTS "Anyone can view topic clusters" ON public.bluesky_topic_clusters;
DROP POLICY IF EXISTS "Anyone can view keywords" ON public.bluesky_keywords;
DROP POLICY IF EXISTS "Anyone can view velocity snapshots" ON public.social_velocity_snapshots;
DROP POLICY IF EXISTS "Anyone can view article correlations" ON public.bluesky_article_correlations;
DROP POLICY IF EXISTS "Admins can manage Bluesky data" ON public.bluesky_posts;
DROP POLICY IF EXISTS "Admins can manage trends" ON public.bluesky_trends;
DROP POLICY IF EXISTS "Admins can manage clusters" ON public.bluesky_topic_clusters;
DROP POLICY IF EXISTS "Admins can manage keywords" ON public.bluesky_keywords;
DROP POLICY IF EXISTS "Admins can manage bluesky posts" ON public.bluesky_posts;

CREATE POLICY "Anyone can view Bluesky posts" ON public.bluesky_posts FOR SELECT USING (true);
CREATE POLICY "Anyone can view Bluesky trends" ON public.bluesky_trends FOR SELECT USING (true);
CREATE POLICY "Anyone can view topic clusters" ON public.bluesky_topic_clusters FOR SELECT USING (true);
CREATE POLICY "Anyone can view keywords" ON public.bluesky_keywords FOR SELECT USING (true);
CREATE POLICY "Anyone can view velocity snapshots" ON public.social_velocity_snapshots FOR SELECT USING (true);
CREATE POLICY "Anyone can view article correlations" ON public.bluesky_article_correlations FOR SELECT USING (true);

CREATE POLICY "Admins can manage Bluesky data" ON public.bluesky_posts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage trends" ON public.bluesky_trends FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage clusters" ON public.bluesky_topic_clusters FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage keywords" ON public.bluesky_keywords FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================================================
-- 8. FUNCTIONS FOR TREND CALCULATION
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_bluesky_trend_velocity(topic_name TEXT)
RETURNS NUMERIC AS $$
DECLARE
  hourly_count INTEGER;
  daily_avg NUMERIC;
  velocity NUMERIC;
BEGIN
  SELECT COUNT(*) INTO hourly_count
  FROM public.bluesky_posts
  WHERE topic_name = ANY(ai_topics)
    AND created_at > (now() - interval '1 hour');

  SELECT COUNT(*)::NUMERIC / 24 INTO daily_avg
  FROM public.bluesky_posts
  WHERE topic_name = ANY(ai_topics)
    AND created_at > (now() - interval '24 hours');

  IF daily_avg = 0 THEN
    IF hourly_count > 0 THEN
      RETURN 1000;
    ELSE
      RETURN 0;
    END IF;
  END IF;

  velocity := (hourly_count / daily_avg) * 100;

  RETURN velocity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- 9. CURSOR STORAGE FOR JETSTREAM
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bluesky_stream_cursor (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_cursor BIGINT NOT NULL,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  posts_collected INTEGER DEFAULT 0,
  last_error TEXT,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.bluesky_stream_cursor (id, last_cursor, posts_collected)
VALUES (1, EXTRACT(EPOCH FROM NOW()) * 1000000, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.bluesky_stream_cursor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage cursor" ON public.bluesky_stream_cursor;
DROP POLICY IF EXISTS "Admins can view cursor" ON public.bluesky_stream_cursor;

CREATE POLICY "Service can manage cursor"
ON public.bluesky_stream_cursor
FOR ALL
USING (true);

CREATE POLICY "Admins can view cursor"
ON public.bluesky_stream_cursor
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));