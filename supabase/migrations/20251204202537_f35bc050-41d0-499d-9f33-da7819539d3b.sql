-- Google News articles table
CREATE TABLE public.google_news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  description TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  url TEXT UNIQUE NOT NULL,
  url_hash TEXT GENERATED ALWAYS AS (md5(url)) STORED,
  
  -- AI processing fields
  ai_processed BOOLEAN DEFAULT false,
  ai_topics TEXT[],
  ai_sentiment NUMERIC,
  ai_sentiment_label TEXT,
  relevance_score NUMERIC DEFAULT 0,
  
  -- Deduplication
  title_hash TEXT GENERATED ALWAYS AS (md5(lower(trim(title)))) STORED,
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of UUID REFERENCES public.google_news_articles(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reddit posts table
CREATE TABLE public.reddit_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reddit_id TEXT UNIQUE NOT NULL,
  subreddit TEXT NOT NULL,
  title TEXT NOT NULL,
  selftext TEXT,
  author TEXT,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  created_utc TIMESTAMPTZ NOT NULL,
  url TEXT,
  permalink TEXT,
  
  -- AI processing fields
  ai_processed BOOLEAN DEFAULT false,
  ai_topics TEXT[],
  ai_sentiment NUMERIC,
  ai_sentiment_label TEXT,
  relevance_score NUMERIC DEFAULT 0,
  
  -- Deduplication
  title_hash TEXT GENERATED ALWAYS AS (md5(lower(trim(title)))) STORED,
  is_duplicate BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unified trend clusters (cross-source)
CREATE TABLE public.trend_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_title TEXT NOT NULL,
  cluster_summary TEXT,
  dominant_sentiment TEXT,
  sentiment_score NUMERIC,
  
  -- Volume and velocity
  total_mentions INTEGER DEFAULT 0,
  mentions_last_hour INTEGER DEFAULT 0,
  mentions_last_6h INTEGER DEFAULT 0,
  mentions_last_24h INTEGER DEFAULT 0,
  velocity_score NUMERIC DEFAULT 0,
  momentum TEXT DEFAULT 'stable', -- up, down, stable
  
  -- Cross-source tracking
  source_distribution JSONB DEFAULT '{}',
  google_news_count INTEGER DEFAULT 0,
  reddit_count INTEGER DEFAULT 0,
  bluesky_count INTEGER DEFAULT 0,
  rss_count INTEGER DEFAULT 0,
  cross_source_score NUMERIC DEFAULT 0,
  
  -- Entity context
  key_entities TEXT[],
  entity_co_occurrences JSONB DEFAULT '{}',
  
  -- Related content IDs
  google_news_ids UUID[],
  reddit_ids UUID[],
  bluesky_ids UUID[],
  article_ids UUID[],
  
  -- Timestamps
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  peak_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  is_trending BOOLEAN DEFAULT false,
  trending_since TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Processing batches table (for cost tracking)
CREATE TABLE public.processing_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_type TEXT NOT NULL, -- 'google_news', 'reddit', 'bluesky', 'rss', 'unified'
  items_count INTEGER DEFAULT 0,
  unique_items INTEGER DEFAULT 0,
  duplicates_removed INTEGER DEFAULT 0,
  clusters_created INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
);

-- Indexes for performance
CREATE INDEX idx_google_news_published ON public.google_news_articles(published_at DESC);
CREATE INDEX idx_google_news_ai_processed ON public.google_news_articles(ai_processed) WHERE ai_processed = false;
CREATE INDEX idx_google_news_title_hash ON public.google_news_articles(title_hash);
CREATE INDEX idx_google_news_topics ON public.google_news_articles USING GIN(ai_topics);

CREATE INDEX idx_reddit_created ON public.reddit_posts(created_utc DESC);
CREATE INDEX idx_reddit_subreddit ON public.reddit_posts(subreddit);
CREATE INDEX idx_reddit_ai_processed ON public.reddit_posts(ai_processed) WHERE ai_processed = false;
CREATE INDEX idx_reddit_score ON public.reddit_posts(score DESC);
CREATE INDEX idx_reddit_topics ON public.reddit_posts USING GIN(ai_topics);

CREATE INDEX idx_trend_clusters_trending ON public.trend_clusters(is_trending) WHERE is_trending = true;
CREATE INDEX idx_trend_clusters_velocity ON public.trend_clusters(velocity_score DESC);
CREATE INDEX idx_trend_clusters_updated ON public.trend_clusters(updated_at DESC);
CREATE INDEX idx_trend_clusters_entities ON public.trend_clusters USING GIN(key_entities);

-- Enable RLS
ALTER TABLE public.google_news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reddit_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_batches ENABLE ROW LEVEL SECURITY;

-- Public read policies (news data is public)
CREATE POLICY "Anyone can read google news" ON public.google_news_articles FOR SELECT USING (true);
CREATE POLICY "Anyone can read reddit posts" ON public.reddit_posts FOR SELECT USING (true);
CREATE POLICY "Anyone can read trend clusters" ON public.trend_clusters FOR SELECT USING (true);
CREATE POLICY "Admins can read processing batches" ON public.processing_batches FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Service role policies for edge functions
CREATE POLICY "Service can insert google news" ON public.google_news_articles FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update google news" ON public.google_news_articles FOR UPDATE USING (true);
CREATE POLICY "Service can insert reddit posts" ON public.reddit_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update reddit posts" ON public.reddit_posts FOR UPDATE USING (true);
CREATE POLICY "Service can manage trend clusters" ON public.trend_clusters FOR ALL USING (true);
CREATE POLICY "Service can manage processing batches" ON public.processing_batches FOR ALL USING (true);

-- Function to calculate cross-source score
CREATE OR REPLACE FUNCTION public.calculate_cross_source_score(
  google_count INTEGER,
  reddit_count INTEGER,
  bluesky_count INTEGER,
  rss_count INTEGER
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sources_present INTEGER := 0;
  total_volume INTEGER;
  diversity_bonus NUMERIC;
BEGIN
  IF google_count > 0 THEN sources_present := sources_present + 1; END IF;
  IF reddit_count > 0 THEN sources_present := sources_present + 1; END IF;
  IF bluesky_count > 0 THEN sources_present := sources_present + 1; END IF;
  IF rss_count > 0 THEN sources_present := sources_present + 1; END IF;
  
  total_volume := COALESCE(google_count, 0) + COALESCE(reddit_count, 0) + 
                  COALESCE(bluesky_count, 0) + COALESCE(rss_count, 0);
  
  -- Diversity bonus: more sources = higher score
  diversity_bonus := CASE sources_present
    WHEN 4 THEN 2.0
    WHEN 3 THEN 1.5
    WHEN 2 THEN 1.2
    ELSE 1.0
  END;
  
  RETURN ROUND((total_volume * diversity_bonus)::NUMERIC, 2);
END;
$$;

-- Function to detect velocity spikes
CREATE OR REPLACE FUNCTION public.calculate_trend_velocity_v2(
  mentions_1h INTEGER,
  mentions_6h INTEGER,
  mentions_24h INTEGER
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  hourly_rate NUMERIC;
  six_hour_rate NUMERIC;
  daily_rate NUMERIC;
  velocity NUMERIC;
BEGIN
  hourly_rate := COALESCE(mentions_1h, 0);
  six_hour_rate := COALESCE(mentions_6h, 0) / 6.0;
  daily_rate := COALESCE(mentions_24h, 0) / 24.0;
  
  IF daily_rate = 0 THEN
    IF hourly_rate > 0 THEN
      RETURN 1000; -- New topic spike
    END IF;
    RETURN 0;
  END IF;
  
  -- Compare current hour to daily average
  velocity := ((hourly_rate - daily_rate) / daily_rate) * 100;
  
  RETURN ROUND(velocity, 2);
END;
$$;