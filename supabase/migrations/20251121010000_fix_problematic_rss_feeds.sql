-- Fix problematic RSS feeds that are returning irrelevant content or not working
--
-- ISSUE: Many major news outlets (CNN, Fox, MSNBC, etc.) have deprecated, restricted,
-- or changed their RSS feeds. Some feeds return generic content instead of category-specific
-- content, or don't work at all.
--
-- SOLUTION: Disable known-problematic feeds and rely on:
-- 1. Wire services (AP, Reuters) - still have working RSS
-- 2. Independent news using WordPress - almost always work
-- 3. Advocacy organizations - reliable RSS feeds
-- 4. State news sites using modern CMS - usually work
-- 5. Think tanks and policy institutes - stable RSS

-- =============================================================================
-- 1. DISABLE MAJOR NEWS OUTLETS WITH BROKEN/RESTRICTED RSS FEEDS
-- =============================================================================

-- Disable CNN Politics (returning irrelevant content)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feed deprecated or returning irrelevant content',
    updated_at = now()
WHERE name = 'CNN Politics' OR url LIKE '%rss.cnn.com%';

-- Disable Fox News Politics (RSS feed restricted/changed)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feed format changed or access restricted',
    updated_at = now()
WHERE name = 'Fox News Politics' OR url LIKE '%foxnews.com%';

-- Disable MSNBC (RSS feeds largely discontinued)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feeds discontinued by MSNBC',
    updated_at = now()
WHERE name = 'MSNBC' OR url LIKE '%msnbc.com%';

-- Disable ABC News Politics (RSS feeds unreliable)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feed unreliable or changed',
    updated_at = now()
WHERE name = 'ABC News Politics' OR url LIKE '%abcnews.go.com%';

-- Disable CBS News Politics (RSS feed format changed)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feed format changed',
    updated_at = now()
WHERE name = 'CBS News Politics' OR url LIKE '%cbsnews.com%';

-- Disable Bloomberg (RSS feeds restricted)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feeds restricted or behind paywall',
    updated_at = now()
WHERE name LIKE '%Bloomberg%' OR url LIKE '%bloomberg.com%';

-- Disable Financial Times (paywall/restricted)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'Content behind paywall',
    updated_at = now()
WHERE name LIKE '%Financial Times%' OR url LIKE '%ft.com%';

-- Disable major newspapers that restrict RSS (paywalls)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feeds restricted or behind paywall',
    updated_at = now()
WHERE name IN (
  'Miami Herald',
  'Tampa Bay Times',
  'Philadelphia Inquirer',
  'Pittsburgh Post-Gazette',
  'Star Tribune',
  'Cleveland.com',
  'Columbus Dispatch',
  'Atlanta Journal-Constitution',
  'Charlotte Observer',
  'Arizona Republic',
  'Boston Globe',
  'Boston Herald',
  'Seattle Times'
) OR url LIKE '%miamiherald.com%'
   OR url LIKE '%tampabay.com%'
   OR url LIKE '%inquirer.com%'
   OR url LIKE '%post-gazette.com%'
   OR url LIKE '%startribune.com%'
   OR url LIKE '%cleveland.com%'
   OR url LIKE '%dispatch.com%'
   OR url LIKE '%ajc.com%'
   OR url LIKE '%charlotteobserver.com%'
   OR url LIKE '%azcentral.com%'
   OR url LIKE '%bostonglobe.com%'
   OR url LIKE '%bostonherald.com%'
   OR url LIKE '%seattletimes.com%';

-- Disable LA Times and SF Chronicle (paywall issues)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feeds restricted or behind paywall',
    updated_at = now()
WHERE name IN ('LA Times', 'San Francisco Chronicle')
   OR url LIKE '%latimes.com%'
   OR url LIKE '%sfchronicle.com%';

-- Disable Chicago Tribune and Sun-Times (paywall/restricted)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feeds restricted or behind paywall',
    updated_at = now()
WHERE name IN ('Chicago Tribune', 'Chicago Sun-Times')
   OR url LIKE '%chicagotribune.com%'
   OR url LIKE '%chicago.suntimes.com%';

-- Disable Houston Chronicle (paywall)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feeds restricted or behind paywall',
    updated_at = now()
WHERE name = 'Houston Chronicle' OR url LIKE '%houstonchronicle.com%';

-- Disable Detroit Free Press and Detroit News (paywall/restricted)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feeds restricted or behind paywall',
    updated_at = now()
WHERE name IN ('Detroit Free Press', 'Detroit News')
   OR url LIKE '%freep.com%'
   OR url LIKE '%detroitnews.com%';

-- Disable MLive (RSS feed format issues)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feed format changed',
    updated_at = now()
WHERE name = 'MLive Michigan' OR url LIKE '%mlive.com%';

-- Disable NJ.com (RSS feed format issues)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feed format changed',
    updated_at = now()
WHERE name = 'NJ.com' OR url LIKE '%nj.com%';

-- Disable Newsmax, The Daily Wire (RSS feeds unreliable)
UPDATE public.rss_sources
SET is_active = false,
    fetch_error = 'RSS feed unreliable or changed',
    updated_at = now()
WHERE name IN ('Newsmax', 'The Daily Wire')
   OR url LIKE '%newsmax.com%'
   OR url LIKE '%dailywire.com%';

-- =============================================================================
-- 2. ADD COMMENT EXPLAINING THE SITUATION
-- =============================================================================

COMMENT ON COLUMN public.rss_sources.is_active IS
'RSS feed status. Many major news outlets (CNN, Fox, NYT, WaPo, etc.) have deprecated
or restricted their RSS feeds. We focus on sources with stable RSS support:
- Wire services (AP, Reuters)
- Independent news (WordPress-based sites)
- Advocacy organizations (CAIR, ACLU, etc.)
- Think tanks and policy institutes
- State news sites using modern CMS
Major outlets are disabled due to: paywalls, deprecated feeds, or generic content.';

-- =============================================================================
-- 3. SUMMARY LOG
-- =============================================================================

DO $$
DECLARE
  disabled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO disabled_count
  FROM public.rss_sources
  WHERE is_active = false
    AND fetch_error IS NOT NULL;

  RAISE NOTICE 'Disabled % problematic RSS sources', disabled_count;
END $$;
