-- Add Bluesky Social Intelligence System
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
  ai_sentiment NUMERIC, -- -1 to 1 scale
  ai_sentiment_label TEXT, -- positive, neutral, negative
  ai_relevance_score NUMERIC, -- 0 to 1 scale (how relevant to our tracking)
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
  keyword_variations TEXT[] DEFAULT '{}', -- Different ways people mention this topic
  mentions_last_hour INTEGER DEFAULT 0,
  mentions_last_6_hours INTEGER DEFAULT 0,
  mentions_last_24_hours INTEGER DEFAULT 0,
  mentions_last_week INTEGER DEFAULT 0,
  velocity NUMERIC, -- hourly / daily avg * 100 (spike detection)
  sentiment_avg NUMERIC, -- Average sentiment for this topic
  sentiment_positive INTEGER DEFAULT 0,
  sentiment_neutral INTEGER DEFAULT 0,
  sentiment_negative INTEGER DEFAULT 0,
  is_trending BOOLEAN DEFAULT false,
  trending_since TIMESTAMPTZ,
  peak_velocity NUMERIC,
  peak_at TIMESTAMPTZ,
  -- Correlation with news
  related_articles UUID[], -- Array of article IDs
  related_bills UUID[], -- Array of bill IDs
  related_executive_orders UUID[], -- Array of executive order IDs
  correlation_score NUMERIC, -- How strongly correlated with news
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
  topics TEXT[] NOT NULL, -- Topics in this cluster
  central_topic TEXT, -- Most representative topic
  post_count INTEGER DEFAULT 0,
  author_count INTEGER DEFAULT 0, -- Unique authors discussing this
  engagement_score NUMERIC, -- Replies + quotes + likes estimate
  cluster_sentiment NUMERIC,
  cluster_velocity NUMERIC,
  is_breaking BOOLEAN DEFAULT false, -- Rapidly emerging cluster
  -- Network metrics
  density NUMERIC, -- How interconnected the topics are
  centrality NUMERIC, -- How central to overall conversation
  -- Correlation
  related_news_cluster_id UUID, -- Links to article_clusters if exists
  -- Metadata
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
  category TEXT NOT NULL, -- organization, issue, location, person
  priority TEXT DEFAULT 'medium', -- critical, high, medium, low
  is_active BOOLEAN DEFAULT true,
  -- Tracking metrics
  total_mentions INTEGER DEFAULT 0,
  last_mention_at TIMESTAMPTZ,
  alert_threshold INTEGER, -- Alert when mentions spike above this
  alert_sent BOOLEAN DEFAULT false,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default tracked keywords
INSERT INTO public.bluesky_keywords (keyword, category, priority) VALUES
  -- Organizations
  ('CAIR', 'organization', 'critical'),
  ('Council on American-Islamic Relations', 'organization', 'critical'),
  ('Muslim Public Affairs Council', 'organization', 'high'),
  ('MPAC', 'organization', 'high'),
  ('Arab American Institute', 'organization', 'high'),
  ('ADC', 'organization', 'high'),
  ('American-Arab Anti-Discrimination Committee', 'organization', 'high'),
  ('ACLU', 'organization', 'high'),
  -- Communities
  ('Muslim American', 'community', 'critical'),
  ('Arab American', 'community', 'critical'),
  ('Muslim Americans', 'community', 'critical'),
  ('Arab Americans', 'community', 'critical'),
  -- Issues
  ('Islamophobia', 'issue', 'critical'),
  ('anti-Muslim', 'issue', 'critical'),
  ('civil liberties', 'issue', 'high'),
  ('religious freedom', 'issue', 'high'),
  ('surveillance', 'issue', 'high'),
  ('profiling', 'issue', 'high'),
  ('discrimination', 'issue', 'high'),
  ('hate crime', 'issue', 'critical'),
  -- International
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
  metric_type TEXT NOT NULL, -- posts_per_minute, topics_count, trending_topics_count
  metric_value NUMERIC NOT NULL,
  topic TEXT, -- Optional: specific topic this metric relates to
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
  correlation_strength NUMERIC, -- 0-1: how strongly social discussion matches article
  peak_social_time TIMESTAMPTZ,
  article_published TIMESTAMPTZ,
  time_lag_minutes INTEGER, -- Minutes between article publish and social peak
  is_predictive BOOLEAN DEFAULT false, -- Did social chatter predict the article?
  detected_at TIMESTAMPTZ DEFAULT now()
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

-- Allow anyone to view Bluesky data (public social data)
CREATE POLICY "Anyone can view Bluesky posts" ON public.bluesky_posts FOR SELECT USING (true);
CREATE POLICY "Anyone can view Bluesky trends" ON public.bluesky_trends FOR SELECT USING (true);
CREATE POLICY "Anyone can view topic clusters" ON public.bluesky_topic_clusters FOR SELECT USING (true);
CREATE POLICY "Anyone can view keywords" ON public.bluesky_keywords FOR SELECT USING (true);
CREATE POLICY "Anyone can view velocity snapshots" ON public.social_velocity_snapshots FOR SELECT USING (true);
CREATE POLICY "Anyone can view article correlations" ON public.bluesky_article_correlations FOR SELECT USING (true);

-- Only admins can manage
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

-- Function to calculate trend velocity
CREATE OR REPLACE FUNCTION calculate_bluesky_trend_velocity(topic_name TEXT)
RETURNS NUMERIC AS $$
DECLARE
  hourly_count INTEGER;
  daily_avg NUMERIC;
  velocity NUMERIC;
BEGIN
  -- Get mentions in last hour
  SELECT COUNT(*) INTO hourly_count
  FROM public.bluesky_posts
  WHERE topic_name = ANY(ai_topics)
    AND created_at > (now() - interval '1 hour');

  -- Get average mentions per hour over last 24 hours
  SELECT COUNT(*)::NUMERIC / 24 INTO daily_avg
  FROM public.bluesky_posts
  WHERE topic_name = ANY(ai_topics)
    AND created_at > (now() - interval '24 hours');

  -- Avoid division by zero
  IF daily_avg = 0 THEN
    IF hourly_count > 0 THEN
      RETURN 1000; -- Massive spike from zero
    ELSE
      RETURN 0;
    END IF;
  END IF;

  -- Calculate velocity (percentage increase)
  velocity := (hourly_count / daily_avg) * 100;

  RETURN velocity;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. COMMENTS
-- =============================================================================

COMMENT ON TABLE public.bluesky_posts IS
'Raw Bluesky posts collected from JetStream firehose, enriched with AI-extracted topics and sentiment';

COMMENT ON TABLE public.bluesky_trends IS
'Aggregated trending topics from Bluesky with velocity metrics and news correlation';

COMMENT ON TABLE public.bluesky_topic_clusters IS
'Network analysis of related topics forming conversation clusters';

COMMENT ON TABLE public.bluesky_keywords IS
'Monitored keywords and organizations for tracking mentions and alerts';

COMMENT ON TABLE public.social_velocity_snapshots IS
'Time-series data for charting social media activity over time';

COMMENT ON TABLE public.bluesky_article_correlations IS
'Links between social media trends and news articles, detecting predictive signals';
