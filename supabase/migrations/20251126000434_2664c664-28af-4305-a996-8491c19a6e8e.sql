
-- Drop existing policies on breaking_news_clusters to avoid conflicts
DROP POLICY IF EXISTS "Service role can manage breaking news" ON public.breaking_news_clusters;
DROP POLICY IF EXISTS "Users can view breaking news" ON public.breaking_news_clusters;

-- Recreate policies
CREATE POLICY "Service role can manage breaking news"
ON public.breaking_news_clusters FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view breaking news"
ON public.breaking_news_clusters FOR SELECT
TO authenticated
USING (true);
