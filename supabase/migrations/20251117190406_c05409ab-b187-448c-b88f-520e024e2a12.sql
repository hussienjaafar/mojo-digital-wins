-- Create RSS sources table
CREATE TABLE IF NOT EXISTS public.rss_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'independent', 'mainstream', 'conservative', 'specialized'
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  fetch_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create articles table
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  source_id UUID REFERENCES public.rss_sources(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_date TIMESTAMP WITH TIME ZONE NOT NULL,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  sentiment_score NUMERIC,
  category TEXT,
  hash_signature TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user article preferences table for future use
CREATE TABLE IF NOT EXISTS public.user_article_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email_frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'none'
  sms_enabled BOOLEAN DEFAULT false,
  tracked_keywords TEXT[] DEFAULT '{}',
  tracked_sources UUID[] DEFAULT '{}',
  notification_settings JSONB DEFAULT '{"breaking_news": true, "bill_updates": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_articles_published_date ON public.articles(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON public.articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_tags ON public.articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_articles_hash ON public.articles(hash_signature);
CREATE INDEX IF NOT EXISTS idx_rss_sources_category ON public.rss_sources(category);

-- Enable RLS
ALTER TABLE public.rss_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_article_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rss_sources (public read, admin write)
CREATE POLICY "Anyone can view RSS sources"
  ON public.rss_sources FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage RSS sources"
  ON public.rss_sources FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for articles (public read, system write)
CREATE POLICY "Anyone can view articles"
  ON public.articles FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage articles"
  ON public.articles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for user preferences
CREATE POLICY "Users can view own preferences"
  ON public.user_article_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_article_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_article_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for articles
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_articles_updated_at();

-- Trigger for rss_sources
CREATE TRIGGER update_rss_sources_updated_at
  BEFORE UPDATE ON public.rss_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_articles_updated_at();

-- Insert initial RSS sources
INSERT INTO public.rss_sources (name, url, category, logo_url) VALUES
  -- Independent Media
  ('The Intercept', 'https://theintercept.com/feed/', 'independent', null),
  ('Dropsite News', 'https://www.dropsitenews.com/feed', 'independent', null),
  ('Democracy Now', 'https://www.democracynow.org/democracynow.rss', 'independent', null),
  ('Middle East Eye', 'https://www.middleeasteye.net/rss', 'independent', null),
  ('Mondoweiss', 'https://mondoweiss.net/feed/', 'independent', null),
  ('The Electronic Intifada', 'https://electronicintifada.net/rss.xml', 'independent', null),
  
  -- Mainstream Sources
  ('NPR', 'https://feeds.npr.org/1001/rss.xml', 'mainstream', null),
  ('BBC', 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', 'mainstream', null),
  ('Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 'mainstream', null),
  ('Reuters', 'https://www.reuters.com/rssFeed/topNews', 'mainstream', null),
  ('AP News', 'https://apnews.com/index.rss', 'mainstream', null),
  ('The Hill', 'https://thehill.com/feed/', 'mainstream', null),
  ('Politico', 'https://www.politico.com/rss/politicopicks.xml', 'mainstream', null),
  
  -- Conservative Sources
  ('Fox News', 'https://moxie.foxnews.com/google-publisher/politics.xml', 'conservative', null),
  ('National Review', 'https://www.nationalreview.com/feed/', 'conservative', null),
  ('The Daily Wire', 'https://www.dailywire.com/feeds/rss.xml', 'conservative', null),
  
  -- Specialized Sources
  ('CAIR', 'https://www.cair.com/feed/', 'specialized', null),
  ('Arab American Institute', 'https://www.aaiusa.org/feed', 'specialized', null),
  ('MPAC', 'https://www.mpac.org/feed/', 'specialized', null)
ON CONFLICT (url) DO NOTHING;