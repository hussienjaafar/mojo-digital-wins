-- Fix RLS policies for daily briefing access
-- The 406 error means RLS is blocking access even though policies exist

-- Drop and recreate policies to ensure they work
DROP POLICY IF EXISTS "Anyone can view briefings" ON public.daily_briefings;
DROP POLICY IF EXISTS "Admins can manage briefings" ON public.daily_briefings;
DROP POLICY IF EXISTS "Authenticated users can view briefings" ON public.daily_briefings;

-- Create clear, simple policies
CREATE POLICY "Authenticated users can view briefings"
  ON public.daily_briefings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage briefings"
  ON public.daily_briefings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Same for breaking news clusters
DROP POLICY IF EXISTS "Anyone can view breaking news" ON public.breaking_news_clusters;
DROP POLICY IF EXISTS "Admins can manage breaking news" ON public.breaking_news_clusters;
DROP POLICY IF EXISTS "Authenticated users can view breaking news" ON public.breaking_news_clusters;

CREATE POLICY "Authenticated users can view breaking news"
  ON public.breaking_news_clusters
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage breaking news"
  ON public.breaking_news_clusters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Same for organization mentions
DROP POLICY IF EXISTS "Anyone can view org mentions" ON public.organization_mentions;
DROP POLICY IF EXISTS "Admins can manage org mentions" ON public.organization_mentions;
DROP POLICY IF EXISTS "Authenticated users can view org mentions" ON public.organization_mentions;

CREATE POLICY "Authenticated users can view org mentions"
  ON public.organization_mentions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage org mentions"
  ON public.organization_mentions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.daily_briefings IS
'Daily intelligence briefings with RLS policies allowing authenticated users to read.';
