-- Phase 3: Statehouse/local coverage audit and gap fill
-- Complete migration with all changes

-- 1. Add state_code column to rss_sources for proper state tracking
ALTER TABLE public.rss_sources ADD COLUMN IF NOT EXISTS state_code VARCHAR(2);

-- 2. Create state coverage summary view
CREATE OR REPLACE VIEW public.state_coverage_summary AS
WITH state_sources AS (
  SELECT 
    COALESCE(
      state_code,
      CASE 
        WHEN name ILIKE 'Alabama%' THEN 'AL'
        WHEN name ILIKE 'Alaska%' THEN 'AK'
        WHEN name ILIKE 'Arizona%' THEN 'AZ'
        WHEN name ILIKE 'Arkansas%' THEN 'AR'
        WHEN name ILIKE 'California%' OR name = 'CalMatters' THEN 'CA'
        WHEN name ILIKE 'Colorado%' THEN 'CO'
        WHEN name ILIKE 'Connecticut%' THEN 'CT'
        WHEN name ILIKE 'Delaware%' THEN 'DE'
        WHEN name ILIKE 'Florida%' THEN 'FL'
        WHEN name ILIKE 'Georgia%' THEN 'GA'
        WHEN name ILIKE 'Hawaii%' THEN 'HI'
        WHEN name ILIKE 'Idaho%' THEN 'ID'
        WHEN name ILIKE 'Illinois%' THEN 'IL'
        WHEN name ILIKE 'Indiana%' THEN 'IN'
        WHEN name ILIKE 'Iowa%' THEN 'IA'
        WHEN name ILIKE 'Kansas%' THEN 'KS'
        WHEN name ILIKE 'Kentucky%' THEN 'KY'
        WHEN name ILIKE 'Louisiana%' THEN 'LA'
        WHEN name ILIKE 'Maine%' THEN 'ME'
        WHEN name ILIKE 'Maryland%' THEN 'MD'
        WHEN name ILIKE 'Massachusetts%' THEN 'MA'
        WHEN name ILIKE 'Michigan%' THEN 'MI'
        WHEN name ILIKE 'Minnesota%' THEN 'MN'
        WHEN name ILIKE 'Mississippi%' THEN 'MS'
        WHEN name ILIKE 'Missouri%' THEN 'MO'
        WHEN name ILIKE 'Montana%' OR name ILIKE 'Daily Montanan%' THEN 'MT'
        WHEN name ILIKE 'Nebraska%' THEN 'NE'
        WHEN name ILIKE 'Nevada%' THEN 'NV'
        WHEN name ILIKE 'New Hampshire%' THEN 'NH'
        WHEN name ILIKE 'New Jersey%' THEN 'NJ'
        WHEN name ILIKE 'New Mexico%' OR name = 'Source New Mexico' THEN 'NM'
        WHEN name ILIKE 'New York%' OR name = 'Gothamist' THEN 'NY'
        WHEN name ILIKE 'North Carolina%' OR name ILIKE 'NC Newsline%' THEN 'NC'
        WHEN name ILIKE 'North Dakota%' THEN 'ND'
        WHEN name ILIKE 'Ohio%' THEN 'OH'
        WHEN name ILIKE 'Oklahoma%' THEN 'OK'
        WHEN name ILIKE 'Oregon%' THEN 'OR'
        WHEN name ILIKE 'Pennsylvania%' OR name ILIKE 'Penn%' THEN 'PA'
        WHEN name ILIKE 'Rhode Island%' THEN 'RI'
        WHEN name ILIKE 'South Carolina%' THEN 'SC'
        WHEN name ILIKE 'South Dakota%' THEN 'SD'
        WHEN name ILIKE 'Tennessee%' THEN 'TN'
        WHEN name ILIKE 'Texas%' THEN 'TX'
        WHEN name ILIKE 'Utah%' THEN 'UT'
        WHEN name ILIKE 'Vermont%' THEN 'VT'
        WHEN name ILIKE 'Virginia%' AND name NOT ILIKE 'West Virginia%' THEN 'VA'
        WHEN name ILIKE 'Washington%' THEN 'WA'
        WHEN name ILIKE 'West Virginia%' THEN 'WV'
        WHEN name ILIKE 'Wisconsin%' THEN 'WI'
        WHEN name ILIKE 'Wyoming%' THEN 'WY'
        ELSE NULL
      END
    ) as derived_state_code,
    id,
    name,
    is_active,
    last_fetched_at,
    last_success_at,
    consecutive_errors
  FROM rss_sources 
  WHERE geographic_scope = 'state'
),
all_states AS (
  SELECT state_code, state_name FROM (VALUES
    ('AL', 'Alabama'), ('AK', 'Alaska'), ('AZ', 'Arizona'), ('AR', 'Arkansas'),
    ('CA', 'California'), ('CO', 'Colorado'), ('CT', 'Connecticut'), ('DE', 'Delaware'),
    ('FL', 'Florida'), ('GA', 'Georgia'), ('HI', 'Hawaii'), ('ID', 'Idaho'),
    ('IL', 'Illinois'), ('IN', 'Indiana'), ('IA', 'Iowa'), ('KS', 'Kansas'),
    ('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'), ('MD', 'Maryland'),
    ('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'), ('MS', 'Mississippi'),
    ('MO', 'Missouri'), ('MT', 'Montana'), ('NE', 'Nebraska'), ('NV', 'Nevada'),
    ('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NM', 'New Mexico'), ('NY', 'New York'),
    ('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'), ('OK', 'Oklahoma'),
    ('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('RI', 'Rhode Island'), ('SC', 'South Carolina'),
    ('SD', 'South Dakota'), ('TN', 'Tennessee'), ('TX', 'Texas'), ('UT', 'Utah'),
    ('VT', 'Vermont'), ('VA', 'Virginia'), ('WA', 'Washington'), ('WV', 'West Virginia'),
    ('WI', 'Wisconsin'), ('WY', 'Wyoming')
  ) AS t(state_code, state_name)
)
SELECT 
  a.state_code,
  a.state_name,
  COALESCE(COUNT(s.id) FILTER (WHERE s.derived_state_code IS NOT NULL), 0)::INTEGER as active_source_count,
  COALESCE(COUNT(s.id) FILTER (WHERE s.is_active = true AND COALESCE(s.consecutive_errors, 0) < 3), 0)::INTEGER as healthy_source_count,
  COALESCE(COUNT(s.id) FILTER (WHERE s.last_success_at < NOW() - INTERVAL '24 hours'), 0)::INTEGER as stale_source_count
FROM all_states a
LEFT JOIN state_sources s ON a.state_code = s.derived_state_code
GROUP BY a.state_code, a.state_name
ORDER BY active_source_count ASC, a.state_code;

-- 3. Insert new statehouse feeds for bottom 10 states with required category field
-- States with 0 coverage: CT, DE, HI, IL, MA, MS, VT, WY
-- States with 1 coverage: AK, TX

-- Connecticut
INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, is_active, state_code)
VALUES 
  ('CT Mirror', 'https://ctmirror.org/feed/', 'statehouse', 'tier2', ARRAY['statehouse', 'policy', 'politics'], 'state', 30, true, 'CT'),
  ('CT News Junkie', 'https://ctnewsjunkie.com/feed/', 'statehouse', 'tier2', ARRAY['statehouse', 'politics'], 'state', 60, true, 'CT')
ON CONFLICT (url) DO NOTHING;

-- Delaware
INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, is_active, state_code)
VALUES 
  ('Delaware Online Politics', 'https://www.delawareonline.com/news/politics/', 'statehouse', 'tier2', ARRAY['statehouse', 'politics'], 'state', 60, true, 'DE'),
  ('Delaware State News', 'https://delawarestatenews.net/feed/', 'statehouse', 'tier2', ARRAY['statehouse', 'local'], 'state', 60, true, 'DE')
ON CONFLICT (url) DO NOTHING;

-- Hawaii
INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, is_active, state_code)
VALUES 
  ('Honolulu Civil Beat', 'https://www.civilbeat.org/feed/', 'statehouse', 'tier2', ARRAY['statehouse', 'policy', 'politics'], 'state', 30, true, 'HI'),
  ('Hawaii News Now', 'https://www.hawaiinewsnow.com/search/?f=rss&t=article&c=news/local&l=50&s=start_time&sd=desc', 'statehouse', 'tier2', ARRAY['statehouse', 'local'], 'state', 60, true, 'HI')
ON CONFLICT (url) DO NOTHING;

-- Illinois
INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, is_active, state_code)
VALUES 
  ('Capitol News Illinois', 'https://capitolnewsillinois.com/feed/', 'statehouse', 'tier2', ARRAY['statehouse', 'policy', 'politics'], 'state', 30, true, 'IL'),
  ('Chicago Sun-Times Politics', 'https://chicago.suntimes.com/rss/index.xml', 'statehouse', 'tier2', ARRAY['statehouse', 'politics', 'local'], 'state', 30, true, 'IL')
ON CONFLICT (url) DO NOTHING;

-- Massachusetts
INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, is_active, state_code)
VALUES 
  ('Commonwealth Magazine', 'https://commonwealthmagazine.org/feed/', 'statehouse', 'tier2', ARRAY['statehouse', 'policy', 'politics'], 'state', 30, true, 'MA'),
  ('State House News Service', 'https://www.statehousenews.com/rss/', 'statehouse', 'tier2', ARRAY['statehouse', 'politics'], 'state', 30, true, 'MA')
ON CONFLICT (url) DO NOTHING;

-- Mississippi
INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, is_active, state_code)
VALUES 
  ('Mississippi Today', 'https://mississippitoday.org/feed/', 'statehouse', 'tier2', ARRAY['statehouse', 'policy', 'politics'], 'state', 30, true, 'MS'),
  ('Mississippi Free Press', 'https://www.mississippifreepress.org/feed/', 'statehouse', 'tier2', ARRAY['statehouse', 'politics', 'local'], 'state', 60, true, 'MS')
ON CONFLICT (url) DO NOTHING;

-- Vermont
INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, is_active, state_code)
VALUES 
  ('VTDigger', 'https://vtdigger.org/feed/', 'statehouse', 'tier2', ARRAY['statehouse', 'policy', 'politics'], 'state', 30, true, 'VT'),
  ('Seven Days VT', 'https://www.sevendaysvt.com/vermont/Rss.xml', 'statehouse', 'tier2', ARRAY['statehouse', 'politics', 'local'], 'state', 60, true, 'VT')
ON CONFLICT (url) DO NOTHING;

-- Wyoming
INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, is_active, state_code)
VALUES 
  ('WyoFile', 'https://wyofile.com/feed/', 'statehouse', 'tier2', ARRAY['statehouse', 'policy', 'politics'], 'state', 30, true, 'WY'),
  ('Casper Star-Tribune Politics', 'https://trib.com/search/?f=rss&t=article&c=news/state-and-regional/govt-and-politics&l=50&s=start_time&sd=desc', 'statehouse', 'tier2', ARRAY['statehouse', 'politics'], 'state', 60, true, 'WY')
ON CONFLICT (url) DO NOTHING;

-- Alaska (adding second source)
INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, is_active, state_code)
VALUES 
  ('Anchorage Daily News Politics', 'https://www.adn.com/politics/feed/', 'statehouse', 'tier2', ARRAY['statehouse', 'politics'], 'state', 60, true, 'AK')
ON CONFLICT (url) DO NOTHING;

-- Texas (adding second source)
INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, is_active, state_code)
VALUES 
  ('Texas Tribune Politics', 'https://www.texastribune.org/feeds/politics/', 'statehouse', 'tier2', ARRAY['statehouse', 'policy', 'politics'], 'state', 30, true, 'TX')
ON CONFLICT (url) DO NOTHING;

-- 4. Update existing state sources with state_code for consistency
UPDATE public.rss_sources SET state_code = 'AL' WHERE name ILIKE 'Alabama%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'AK' WHERE name ILIKE 'Alaska%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'AZ' WHERE name ILIKE 'Arizona%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'AR' WHERE name ILIKE 'Arkansas%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'CA' WHERE (name ILIKE 'California%' OR name = 'CalMatters') AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'CO' WHERE name ILIKE 'Colorado%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'FL' WHERE name ILIKE 'Florida%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'GA' WHERE name ILIKE 'Georgia%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'ID' WHERE name ILIKE 'Idaho%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'IN' WHERE name ILIKE 'Indiana%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'IA' WHERE name ILIKE 'Iowa%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'KS' WHERE name ILIKE 'Kansas%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'KY' WHERE name ILIKE 'Kentucky%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'LA' WHERE name ILIKE 'Louisiana%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'ME' WHERE name ILIKE 'Maine%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'MD' WHERE name ILIKE 'Maryland%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'MI' WHERE name ILIKE 'Michigan%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'MN' WHERE name ILIKE 'Minnesota%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'MO' WHERE name ILIKE 'Missouri%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'MT' WHERE (name ILIKE 'Montana%' OR name ILIKE 'Daily Montanan%') AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'NE' WHERE name ILIKE 'Nebraska%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'NV' WHERE name ILIKE 'Nevada%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'NH' WHERE name ILIKE 'New Hampshire%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'NJ' WHERE name ILIKE 'New Jersey%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'NM' WHERE (name ILIKE 'New Mexico%' OR name = 'Source New Mexico') AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'NY' WHERE (name ILIKE 'New York%' OR name = 'Gothamist') AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'NC' WHERE (name ILIKE 'North Carolina%' OR name ILIKE 'NC Newsline%') AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'ND' WHERE name ILIKE 'North Dakota%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'OH' WHERE name ILIKE 'Ohio%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'OK' WHERE name ILIKE 'Oklahoma%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'OR' WHERE name ILIKE 'Oregon%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'PA' WHERE (name ILIKE 'Pennsylvania%' OR name ILIKE 'Penn%') AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'RI' WHERE name ILIKE 'Rhode Island%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'SC' WHERE name ILIKE 'South Carolina%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'SD' WHERE name ILIKE 'South Dakota%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'TN' WHERE name ILIKE 'Tennessee%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'TX' WHERE name ILIKE 'Texas%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'UT' WHERE name ILIKE 'Utah%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'VA' WHERE name ILIKE 'Virginia%' AND name NOT ILIKE 'West Virginia%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'WA' WHERE name ILIKE 'Washington%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'WV' WHERE name ILIKE 'West Virginia%' AND state_code IS NULL;
UPDATE public.rss_sources SET state_code = 'WI' WHERE name ILIKE 'Wisconsin%' AND state_code IS NULL;

-- 5. Add statehouse tag to existing state sources that don't have it
UPDATE public.rss_sources 
SET tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'statehouse')
WHERE geographic_scope = 'state' 
  AND NOT ('statehouse' = ANY(COALESCE(tags, ARRAY[]::text[])))
  AND state_code IS NOT NULL;