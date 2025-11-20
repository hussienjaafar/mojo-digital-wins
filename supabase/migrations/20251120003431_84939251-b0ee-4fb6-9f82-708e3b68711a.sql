-- Remove duplicate "Anyone can view" policies that are conflicting
-- We only need the "Authenticated users can view" policies

DROP POLICY IF EXISTS "Anyone can view daily briefings" ON public.daily_briefings;
DROP POLICY IF EXISTS "Anyone can view breaking news clusters" ON public.breaking_news_clusters;
DROP POLICY IF EXISTS "Anyone can view organization mentions" ON public.organization_mentions;

-- Also remove the old admin policies that use has_role
DROP POLICY IF EXISTS "Admins can manage daily briefings" ON public.daily_briefings;
DROP POLICY IF EXISTS "Admins can manage breaking news clusters" ON public.breaking_news_clusters;
DROP POLICY IF EXISTS "Admins can manage organization mentions" ON public.organization_mentions;