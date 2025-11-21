-- Add reliable independent sources, think tanks, state newsrooms
-- AND add geographic scope filtering (National/State/Local)

-- =============================================================================
-- 1. ADD GEOGRAPHIC SCOPE FIELD TO RSS SOURCES
-- =============================================================================

ALTER TABLE public.rss_sources
ADD COLUMN IF NOT EXISTS geographic_scope TEXT DEFAULT 'national';

COMMENT ON COLUMN public.rss_sources.geographic_scope IS
'Geographic coverage level: national, state, local, international';

-- =============================================================================
-- 2. ADD GEOGRAPHIC SCOPE TO ARTICLES (inherited from source)
-- =============================================================================

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS geographic_scope TEXT;

CREATE INDEX IF NOT EXISTS idx_articles_geographic_scope ON public.articles(geographic_scope);

COMMENT ON COLUMN public.articles.geographic_scope IS
'Geographic coverage level inherited from RSS source: national, state, local, international';

-- =============================================================================
-- 3. UPDATE EXISTING SOURCES WITH GEOGRAPHIC SCOPE
-- =============================================================================

-- Set existing sources to appropriate scopes
UPDATE public.rss_sources
SET geographic_scope = 'national'
WHERE category IN ('mainstream', 'independent', 'conservative', 'specialized', 'civil_rights')
  AND geographic_scope IS NULL;

UPDATE public.rss_sources
SET geographic_scope = 'state'
WHERE category = 'state_government'
  AND geographic_scope IS NULL;

UPDATE public.rss_sources
SET geographic_scope = 'national'
WHERE category = 'government'
  AND geographic_scope IS NULL;

-- =============================================================================
-- 4. ADD STATES NEWSROOM (39 STATE NEWSROOMS - ALL RELIABLE RSS)
-- =============================================================================

INSERT INTO public.rss_sources (name, url, category, geographic_scope, logo_url) VALUES
  -- States Newsroom - Nonprofit newsrooms in 39 states
  ('Alabama Reflector', 'https://alabamareflector.com/feed/localFeed', 'state_government', 'state', null),
  ('Alaska Beacon', 'https://alaskabeacon.com/feed/localFeed', 'state_government', 'state', null),
  ('Arizona Mirror', 'https://azmirror.com/feed/localFeed', 'state_government', 'state', null),
  ('Arkansas Advocate', 'https://arkansasadvocate.com/feed/localFeed', 'state_government', 'state', null),
  ('Colorado Newsline', 'https://coloradonewsline.com/feed/localFeed', 'state_government', 'state', null),
  ('Florida Phoenix', 'https://floridaphoenix.com/feed/localFeed', 'state_government', 'state', null),
  ('Georgia Recorder', 'https://georgiarecorder.com/feed/localFeed', 'state_government', 'state', null),
  ('Idaho Capital Sun', 'https://idahocapitalsun.com/feed/localFeed', 'state_government', 'state', null),
  ('Indiana Capital Chronicle', 'https://indianacapitalchronicle.com/feed/localFeed', 'state_government', 'state', null),
  ('Iowa Capital Dispatch', 'https://iowacapitaldispatch.com/feed/localFeed', 'state_government', 'state', null),
  ('Kansas Reflector', 'https://kansasreflector.com/feed/localFeed', 'state_government', 'state', null),
  ('Kentucky Lantern', 'https://kentuckylantern.com/feed/localFeed', 'state_government', 'state', null),
  ('Louisiana Illuminator', 'https://lailluminator.com/feed/localFeed', 'state_government', 'state', null),
  ('Maine Morning Star', 'https://mainemorningstar.com/feed/localFeed', 'state_government', 'state', null),
  ('Maryland Matters', 'https://marylandmatters.org/feed/localFeed', 'state_government', 'state', null),
  ('Michigan Advance', 'https://michiganadvance.com/feed/localFeed', 'state_government', 'state', null),
  ('Minnesota Reformer', 'https://minnesotareformer.com/feed/localFeed', 'state_government', 'state', null),
  ('Missouri Independent', 'https://missouriindependent.com/feed/localFeed', 'state_government', 'state', null),
  ('Daily Montanan', 'https://dailymontanan.com/feed/localFeed', 'state_government', 'state', null),
  ('Nebraska Examiner', 'https://nebraskaexaminer.com/feed/localFeed', 'state_government', 'state', null),
  ('Nevada Current', 'https://nevadacurrent.com/feed/localFeed', 'state_government', 'state', null),
  ('New Hampshire Bulletin', 'https://newhampshirebulletin.com/feed/localFeed', 'state_government', 'state', null),
  ('New Jersey Monitor', 'https://newjerseymonitor.com/feed/localFeed', 'state_government', 'state', null),
  ('Source New Mexico', 'https://sourcenm.com/feed/localFeed', 'state_government', 'state', null),
  ('North Carolina Newsline', 'https://ncnewsline.com/feed/localFeed', 'state_government', 'state', null),
  ('North Dakota Monitor', 'https://northdakotamonitor.com/feed/localFeed', 'state_government', 'state', null),
  ('Ohio Capital Journal', 'https://ohiocapitaljournal.com/feed/localFeed', 'state_government', 'state', null),
  ('Oklahoma Voice', 'https://oklahomavoice.com/feed/localFeed', 'state_government', 'state', null),
  ('Oregon Capital Chronicle', 'https://oregoncapitalchronicle.com/feed/localFeed', 'state_government', 'state', null),
  ('Pennsylvania Capital-Star', 'https://penncapital-star.com/feed/localFeed', 'state_government', 'state', null),
  ('Rhode Island Current', 'https://rhodeislandcurrent.com/feed/localFeed', 'state_government', 'state', null),
  ('South Carolina Daily Gazette', 'https://scdailygazette.com/feed/localFeed', 'state_government', 'state', null),
  ('South Dakota Searchlight', 'https://southdakotasearchlight.com/feed/localFeed', 'state_government', 'state', null),
  ('Tennessee Lookout', 'https://tennesseelookout.com/feed/localFeed', 'state_government', 'state', null),
  ('Utah News Dispatch', 'https://utahnewsdispatch.com/feed/localFeed', 'state_government', 'state', null),
  ('Virginia Mercury', 'https://virginiamercury.com/feed/localFeed', 'state_government', 'state', null),
  ('Washington State Standard', 'https://washingtonstatestandard.com/feed/localFeed', 'state_government', 'state', null),
  ('West Virginia Watch', 'https://westvirginiawatch.com/feed/localFeed', 'state_government', 'state', null),
  ('Wisconsin Examiner', 'https://wisconsinexaminer.com/feed/localFeed', 'state_government', 'state', null),

  -- =============================================================================
  -- 5. NONPROFIT INVESTIGATIVE NEWSROOMS (NATIONAL)
  -- =============================================================================

  ('Type Investigations', 'https://www.typeinvestigations.org/feed/', 'independent', 'national', null),
  ('Wisconsin Watch', 'https://wisconsinwatch.org/feed/', 'independent', 'national', null),
  ('Investigate Midwest', 'https://investigatemidwest.org/feed/', 'independent', 'national', null),
  ('Capital & Main', 'https://capitalandmain.com/feed', 'independent', 'national', null),
  ('The American Independent', 'https://americanindependent.com/feed/', 'independent', 'national', null),
  ('In The Public Interest', 'https://inthepublicinterest.org/feed/', 'independent', 'national', null),
  ('Better Government Association', 'https://www.bettergov.org/feed/', 'independent', 'national', null),
  ('Documented', 'https://documentedny.com/feed/', 'independent', 'national', null),
  ('FairWarning', 'https://www.fairwarning.org/feed/', 'independent', 'national', null),
  ('The Fuller Project', 'https://fullerproject.org/feed/', 'independent', 'national', null),
  ('Outlier Media', 'https://outliermedia.org/feed/', 'independent', 'national', null),
  ('Sludge', 'https://readsludge.com/feed/', 'independent', 'national', null),

  -- =============================================================================
  -- 6. ADDITIONAL THINK TANKS & POLICY INSTITUTES (NATIONAL)
  -- =============================================================================

  ('Urban Institute', 'https://www.urban.org/rss.xml', 'specialized', 'national', null),
  ('RAND Corporation', 'https://www.rand.org/pubs.xml', 'specialized', 'national', null),
  ('Third Way', 'https://www.thirdway.org/feed', 'specialized', 'national', null),
  ('Center for Budget and Policy Priorities', 'https://www.cbpp.org/rss', 'specialized', 'national', null),
  ('Economic Policy Institute', 'https://www.epi.org/feed/', 'specialized', 'national', null),
  ('New America', 'https://www.newamerica.org/rss/', 'specialized', 'national', null),
  ('Roosevelt Institute', 'https://rooseveltinstitute.org/feed/', 'specialized', 'national', null),
  ('Center on Budget and Policy Priorities', 'https://www.cbpp.org/rss.xml', 'specialized', 'national', null),
  ('Tax Policy Center', 'https://www.taxpolicycenter.org/rss.xml', 'specialized', 'national', null),
  ('Manhattan Institute', 'https://www.manhattan-institute.org/feeds/all.rss', 'conservative', 'national', null),
  ('Hoover Institution', 'https://www.hoover.org/rss.xml', 'conservative', 'national', null),
  ('R Street Institute', 'https://www.rstreet.org/feed/', 'specialized', 'national', null),
  ('Niskanen Center', 'https://www.niskanencenter.org/feed/', 'specialized', 'national', null),

  -- =============================================================================
  -- 7. CRIMINAL JUSTICE & REFORM (NATIONAL)
  -- =============================================================================

  ('The Sentencing Project', 'https://www.sentencingproject.org/feed/', 'civil_rights', 'national', null),
  ('Equal Justice Initiative', 'https://eji.org/news/feed/', 'civil_rights', 'national', null),
  ('The Innocence Project', 'https://innocenceproject.org/feed/', 'civil_rights', 'national', null),
  ('Prison Policy Initiative', 'https://www.prisonpolicy.org/rss.xml', 'civil_rights', 'national', null),
  ('Vera Institute of Justice', 'https://www.vera.org/rss.xml', 'civil_rights', 'national', null),

  -- =============================================================================
  -- 8. LABOR & WORKERS' RIGHTS (NATIONAL)
  -- =============================================================================

  ('Labor Notes', 'https://labornotes.org/feed', 'independent', 'national', null),
  ('In These Times Labor', 'https://inthesetimes.com/feeds/labor/rss/', 'independent', 'national', null),
  ('Working In These Times', 'https://inthesetimes.com/working/feed', 'independent', 'national', null),

  -- =============================================================================
  -- 9. EDUCATION POLICY (NATIONAL)
  -- =============================================================================

  ('The Hechinger Report', 'https://hechingerreport.org/feed/', 'independent', 'national', null),
  ('Chalkbeat', 'https://www.chalkbeat.org/feeds/all', 'independent', 'national', null),
  ('Education Week', 'https://www.edweek.org/feeds/latest.rss', 'specialized', 'national', null),

  -- =============================================================================
  -- 10. HEALTHCARE POLICY (NATIONAL)
  -- =============================================================================

  ('Kaiser Health News', 'https://khn.org/feed/', 'specialized', 'national', null),
  ('STAT News', 'https://www.statnews.com/feed/', 'specialized', 'national', null),
  ('Health Affairs', 'https://www.healthaffairs.org/do/rss/recent', 'specialized', 'national', null),

  -- =============================================================================
  -- 11. ENVIRONMENTAL & CLIMATE (NATIONAL)
  -- =============================================================================

  ('Grist', 'https://grist.org/feed/', 'independent', 'national', null),
  ('Inside Climate News', 'https://insideclimatenews.org/feed/', 'independent', 'national', null),
  ('DeSmog', 'https://www.desmog.com/feed/', 'independent', 'national', null),
  ('Yale Environment 360', 'https://e360.yale.edu/feeds/latest', 'specialized', 'national', null),

  -- =============================================================================
  -- 12. NATIVE AMERICAN NEWS (NATIONAL)
  -- =============================================================================

  ('Indian Country Today', 'https://indiancountrytoday.com/feed', 'specialized', 'national', null),
  ('Native News Online', 'https://nativenewsonline.net/feed', 'specialized', 'national', null),
  ('High Country News', 'https://www.hcn.org/rss.xml', 'independent', 'national', null)

ON CONFLICT (url) DO UPDATE SET
  is_active = true,
  category = EXCLUDED.category,
  geographic_scope = EXCLUDED.geographic_scope,
  updated_at = now();

-- =============================================================================
-- 13. CREATE FUNCTION TO AUTO-SET GEOGRAPHIC SCOPE ON ARTICLES
-- =============================================================================

CREATE OR REPLACE FUNCTION set_article_geographic_scope()
RETURNS TRIGGER AS $$
BEGIN
  -- Inherit geographic_scope from the RSS source
  SELECT geographic_scope INTO NEW.geographic_scope
  FROM public.rss_sources
  WHERE id = NEW.source_id;

  -- Default to 'national' if not set
  IF NEW.geographic_scope IS NULL THEN
    NEW.geographic_scope := 'national';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set geographic scope
DROP TRIGGER IF EXISTS trigger_set_article_geographic_scope ON public.articles;

CREATE TRIGGER trigger_set_article_geographic_scope
  BEFORE INSERT ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION set_article_geographic_scope();

-- =============================================================================
-- 14. UPDATE EXISTING ARTICLES WITH GEOGRAPHIC SCOPE
-- =============================================================================

UPDATE public.articles a
SET geographic_scope = s.geographic_scope
FROM public.rss_sources s
WHERE a.source_id = s.id
  AND a.geographic_scope IS NULL;

-- =============================================================================
-- 15. SUMMARY
-- =============================================================================

DO $$
DECLARE
  total_sources INTEGER;
  state_sources INTEGER;
  national_sources INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_sources FROM public.rss_sources WHERE is_active = true;
  SELECT COUNT(*) INTO state_sources FROM public.rss_sources WHERE is_active = true AND geographic_scope = 'state';
  SELECT COUNT(*) INTO national_sources FROM public.rss_sources WHERE is_active = true AND geographic_scope = 'national';

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'RSS Sources Summary:';
  RAISE NOTICE 'Total Active Sources: %', total_sources;
  RAISE NOTICE 'National Sources: %', national_sources;
  RAISE NOTICE 'State Sources: %', state_sources;
  RAISE NOTICE '===========================================';
END $$;
