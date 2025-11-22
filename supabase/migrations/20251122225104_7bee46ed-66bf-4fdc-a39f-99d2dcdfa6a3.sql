-- Add affected_groups array to articles and bluesky_posts for multi-dimensional filtering
-- This enables filtering by community (Muslim/Arab, LGBTQ+, immigrants, etc.)

-- Add affected_groups to articles
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS affected_groups TEXT[] DEFAULT '{}';

-- Add affected_groups to bluesky_posts
ALTER TABLE public.bluesky_posts 
ADD COLUMN IF NOT EXISTS affected_groups TEXT[] DEFAULT '{}';

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_articles_affected_groups 
ON public.articles USING GIN (affected_groups);

CREATE INDEX IF NOT EXISTS idx_bluesky_posts_affected_groups 
ON public.bluesky_posts USING GIN (affected_groups);

-- Add relevance_category to help with filtering (national, civil_rights, immigration, etc.)
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS relevance_category TEXT;

ALTER TABLE public.bluesky_posts 
ADD COLUMN IF NOT EXISTS relevance_category TEXT;

CREATE INDEX IF NOT EXISTS idx_articles_relevance_category 
ON public.articles (relevance_category);

CREATE INDEX IF NOT EXISTS idx_bluesky_posts_relevance_category 
ON public.bluesky_posts (relevance_category);

COMMENT ON COLUMN public.articles.affected_groups IS 'Array of affected communities: muslim_american, arab_american, jewish_american, lgbtq, immigrants, women, black_american, latino_american, asian_american, indigenous, disability, youth, elderly, etc.';
COMMENT ON COLUMN public.articles.relevance_category IS 'Category: civil_rights, immigration, healthcare, education, climate, economy, national_security, foreign_policy, etc.';
COMMENT ON COLUMN public.bluesky_posts.affected_groups IS 'Array of affected communities for multi-dimensional filtering';
COMMENT ON COLUMN public.bluesky_posts.relevance_category IS 'Category for broad political analysis';