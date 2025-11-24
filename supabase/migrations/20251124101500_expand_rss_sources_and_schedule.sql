-- Expand RSS coverage with additional high-quality national and state feeds
-- and tighten the fetch cadence to improve freshness.

-- Upsert additional sources
INSERT INTO public.rss_sources (name, url, category, geographic_scope, is_active)
VALUES
  -- National / Politics
  ('AP Politics', 'https://apnews.com/hub/politics?output=rss', 'politics', 'national', true),
  ('Reuters Politics', 'https://feeds.reuters.com/Reuters/PoliticsNews', 'politics', 'national', true),
  ('BBC Politics', 'http://feeds.bbci.co.uk/news/politics/rss.xml', 'politics', 'international', true),
  ('Guardian US Politics', 'https://www.theguardian.com/us-news/us-politics/rss', 'politics', 'national', true),
  ('NPR Politics', 'https://feeds.npr.org/1014/rss.xml', 'politics', 'national', true),
  ('ProPublica', 'https://www.propublica.org/feeds/propublica/main', 'investigations', 'national', true),
  ('CNN Politics', 'http://rss.cnn.com/rss/cnn_allpolitics.rss', 'politics', 'national', true),
  ('NBC Politics', 'https://feeds.nbcnews.com/nbcnews/public/politics', 'politics', 'national', true),

  -- State / Regional outlets (redundant coverage)
  ('Texas Tribune', 'https://www.texastribune.org/feeds/main/', 'state', 'state', true),
  ('CalMatters', 'https://calmatters.org/feed/', 'state', 'state', true),
  ('Colorado Sun', 'https://coloradosun.com/feed/', 'state', 'state', true),
  ('Georgia Recorder', 'https://georgiarecorder.com/feed/', 'state', 'state', true),
  ('Michigan Advance', 'https://michiganadvance.com/feed/', 'state', 'state', true),
  ('Arizona Mirror', 'https://azmirror.com/feed/', 'state', 'state', true),
  ('Minnesota Reformer', 'https://minnesotareformer.com/feed/', 'state', 'state', true),
  ('Gothamist', 'https://gothamist.com/feeds/latest.rss', 'state', 'state', true),
  ('Maryland Matters', 'https://www.marylandmatters.org/feed/', 'state', 'state', true),
  ('Nevada Current', 'https://www.nevadacurrent.com/feed/', 'state', 'state', true),
  ('Virginia Mercury', 'https://www.virginiamercury.com/feed/', 'state', 'state', true),
  ('Florida Politics', 'https://floridapolitics.com/feed/', 'state', 'state', true),
  ('North Carolina Newsline', 'https://ncnewsline.com/feed/', 'state', 'state', true)
ON CONFLICT (url) DO UPDATE
SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  geographic_scope = EXCLUDED.geographic_scope,
  is_active = true;

-- Speed up RSS cadence to every 10 minutes (was 30+ in earlier seeds)
UPDATE public.scheduled_jobs
SET schedule = '*/10 * * * *',
    next_run_at = NOW() + INTERVAL '10 minutes'
WHERE job_type = 'fetch_rss';
