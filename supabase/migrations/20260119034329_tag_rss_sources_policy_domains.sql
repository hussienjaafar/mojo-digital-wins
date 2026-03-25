-- ============================================================================
-- Tag RSS Sources with Policy Domains
-- Maps each source to its relevant policy domains for per-org filtering
-- ============================================================================

-- Civil Rights / Human Rights Sources
UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Criminal Justice', 'Immigration']
WHERE name ILIKE '%aclu%';

UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Criminal Justice']
WHERE name ILIKE '%splc%' OR name ILIKE '%southern poverty%';

UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Foreign Policy']
WHERE name ILIKE '%human rights watch%' OR name ILIKE '%hrw%';

UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Foreign Policy']
WHERE name ILIKE '%amnesty international%';

UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Voting Rights']
WHERE name ILIKE '%naacp%';

UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights']
WHERE name ILIKE '%lambda legal%' OR name ILIKE '%lgbtq%';

UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Immigration']
WHERE name ILIKE '%nilc%' OR name ILIKE '%national immigration law%';

UPDATE rss_sources SET policy_domains = ARRAY['Voting Rights', 'Criminal Justice', 'Civil Rights']
WHERE name ILIKE '%brennan center%';

UPDATE rss_sources SET policy_domains = ARRAY['Technology', 'Civil Rights']
WHERE name ILIKE '%eff%' OR name ILIKE '%electronic frontier%';

UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Immigration']
WHERE name ILIKE '%arab%' OR name ILIKE '%muslim%' OR name ILIKE '%cair%' OR name ILIKE '%mpac%';

UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights']
WHERE name ILIKE '%asian%' AND (name ILIKE '%justice%' OR name ILIKE '%advancing%');

-- Environment Sources
UPDATE rss_sources SET policy_domains = ARRAY['Environment']
WHERE name ILIKE '%sierra club%' OR name ILIKE '%grist%' OR name ILIKE '%carbon brief%'
   OR name ILIKE '%e&e news%' OR name ILIKE '%inside climate%' OR name ILIKE '%climate%';

-- Healthcare Sources
UPDATE rss_sources SET policy_domains = ARRAY['Healthcare']
WHERE name ILIKE '%kff%' OR name ILIKE '%kaiser%' OR name ILIKE '%health affairs%'
   OR name ILIKE '%stat news%' OR name ILIKE '%modern healthcare%';

-- Labor Sources
UPDATE rss_sources SET policy_domains = ARRAY['Labor & Workers Rights']
WHERE name ILIKE '%labor%' OR name ILIKE '%payday%' OR name ILIKE '%union%' OR name ILIKE '%worker%';

-- Education Sources
UPDATE rss_sources SET policy_domains = ARRAY['Education']
WHERE name ILIKE '%education%' OR name ILIKE '%chalkbeat%' OR name ILIKE '%higher ed%'
   OR name ILIKE '%the 74%' OR name ILIKE '%ed week%';

-- Housing Sources
UPDATE rss_sources SET policy_domains = ARRAY['Housing', 'Economic Justice']
WHERE name ILIKE '%shelterforce%' OR name ILIKE '%next city%' OR name ILIKE '%housing%';

-- Criminal Justice Sources
UPDATE rss_sources SET policy_domains = ARRAY['Criminal Justice']
WHERE name ILIKE '%marshall project%' OR name ILIKE '%the appeal%' OR name ILIKE '%prison%';

-- Immigration Sources
UPDATE rss_sources SET policy_domains = ARRAY['Immigration']
WHERE name ILIKE '%migration policy%' OR name ILIKE '%american immigration%'
   OR name ILIKE '%immigration forum%' OR name ILIKE '%refugee%';

-- Economic Justice Sources
UPDATE rss_sources SET policy_domains = ARRAY['Economic Justice']
WHERE name ILIKE '%economic policy%' OR name ILIKE '%center on budget%' OR name ILIKE '%cbpp%';

-- Foreign Policy Sources
UPDATE rss_sources SET policy_domains = ARRAY['Foreign Policy']
WHERE name ILIKE '%foreign policy%' OR name ILIKE '%carnegie%' OR name ILIKE '%cfr%'
   OR name ILIKE '%council on foreign%' OR name ILIKE '%crisis group%';

-- Technology Sources
UPDATE rss_sources SET policy_domains = ARRAY['Technology']
WHERE name ILIKE '%ars technica%' OR name ILIKE '%verge%' OR name ILIKE '%wired%'
   OR name ILIKE '%privacy%' OR name ILIKE '%access now%' OR name ILIKE '%cdt%';

-- Broad Political Sources (mainstream news - multiple domains)
UPDATE rss_sources SET policy_domains = ARRAY['Healthcare', 'Economic Justice', 'Foreign Policy', 'Voting Rights', 'Immigration', 'Civil Rights']
WHERE name ILIKE '%politico%';

UPDATE rss_sources SET policy_domains = ARRAY['Healthcare', 'Economic Justice', 'Foreign Policy', 'Voting Rights', 'Immigration']
WHERE name ILIKE '%the hill%';

UPDATE rss_sources SET policy_domains = ARRAY['Healthcare', 'Economic Justice', 'Foreign Policy', 'Voting Rights']
WHERE name ILIKE '%npr%' AND (name ILIKE '%politics%' OR name ILIKE '%news%');

UPDATE rss_sources SET policy_domains = ARRAY['Foreign Policy', 'Economic Justice']
WHERE name ILIKE '%reuters%';

UPDATE rss_sources SET policy_domains = ARRAY['Foreign Policy', 'Economic Justice', 'Healthcare']
WHERE name ILIKE '%associated press%' OR name ILIKE '%ap news%';

UPDATE rss_sources SET policy_domains = ARRAY['Economic Justice', 'Healthcare', 'Foreign Policy', 'Civil Rights']
WHERE name ILIKE '%pbs%' OR name ILIKE '%newshour%';

UPDATE rss_sources SET policy_domains = ARRAY['Economic Justice', 'Healthcare', 'Voting Rights']
WHERE name ILIKE '%usa today%';

-- Independent/Progressive Sources
UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Labor & Workers Rights', 'Economic Justice', 'Foreign Policy']
WHERE name ILIKE '%the nation%';

UPDATE rss_sources SET policy_domains = ARRAY['Foreign Policy', 'Civil Rights', 'Economic Justice']
WHERE name ILIKE '%democracy now%';

UPDATE rss_sources SET policy_domains = ARRAY['Economic Justice', 'Civil Rights', 'Environment']
WHERE name ILIKE '%common dreams%';

UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Criminal Justice', 'Environment', 'Economic Justice']
WHERE name ILIKE '%mother jones%';

UPDATE rss_sources SET policy_domains = ARRAY['Criminal Justice', 'Civil Rights', 'Technology', 'Healthcare']
WHERE name ILIKE '%propublica%';

UPDATE rss_sources SET policy_domains = ARRAY['Foreign Policy', 'Civil Rights', 'Technology']
WHERE name ILIKE '%intercept%';

UPDATE rss_sources SET policy_domains = ARRAY['Labor & Workers Rights', 'Economic Justice']
WHERE name ILIKE '%in these times%';

-- Think Tanks
UPDATE rss_sources SET policy_domains = ARRAY['Foreign Policy', 'Economic Justice', 'Healthcare']
WHERE name ILIKE '%brookings%';

UPDATE rss_sources SET policy_domains = ARRAY['Economic Justice', 'Healthcare', 'Civil Rights', 'Environment']
WHERE name ILIKE '%center for american progress%';

UPDATE rss_sources SET policy_domains = ARRAY['Economic Justice', 'Foreign Policy', 'Immigration']
WHERE name ILIKE '%heritage%';

UPDATE rss_sources SET policy_domains = ARRAY['Economic Justice', 'Civil Rights', 'Immigration']
WHERE name ILIKE '%cato%';

-- State/Local News - Tag by geography and broad domains
UPDATE rss_sources SET policy_domains = ARRAY['Voting Rights', 'Economic Justice', 'Healthcare', 'Education']
WHERE name ILIKE '%detroit%' OR name ILIKE '%michigan%' OR name ILIKE '%mlive%';

UPDATE rss_sources SET policy_domains = ARRAY['Housing', 'Economic Justice', 'Immigration', 'Healthcare']
WHERE name ILIKE '%nyc%' OR name ILIKE '%gotham%' OR name ILIKE '%new york%';

UPDATE rss_sources SET policy_domains = ARRAY['Immigration', 'Housing', 'Environment', 'Healthcare']
WHERE name ILIKE '%la times%' OR name ILIKE '%los angeles%' OR name ILIKE '%san francisco%'
   OR name ILIKE '%calmatters%' OR name ILIKE '%california%';

UPDATE rss_sources SET policy_domains = ARRAY['Criminal Justice', 'Housing', 'Economic Justice']
WHERE name ILIKE '%chicago%';

UPDATE rss_sources SET policy_domains = ARRAY['Immigration', 'Voting Rights', 'Economic Justice']
WHERE name ILIKE '%texas%' OR name ILIKE '%houston%';

UPDATE rss_sources SET policy_domains = ARRAY['Voting Rights', 'Civil Rights']
WHERE name ILIKE '%virginia%';

UPDATE rss_sources SET policy_domains = ARRAY['Economic Justice', 'Healthcare', 'Immigration']
WHERE name ILIKE '%nj.com%' OR name ILIKE '%new jersey%';

-- Roll Call & Congress news
UPDATE rss_sources SET policy_domains = ARRAY['Voting Rights', 'Economic Justice', 'Foreign Policy', 'Healthcare']
WHERE name ILIKE '%roll call%';

-- Conservative sources
UPDATE rss_sources SET policy_domains = ARRAY['Economic Justice', 'Immigration', 'Foreign Policy']
WHERE name ILIKE '%national review%' OR name ILIKE '%federalist%'
   OR name ILIKE '%washington examiner%' OR name ILIKE '%breitbart%' OR name ILIKE '%daily caller%';

-- Religious Freedom sources
UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights']
WHERE name ILIKE '%freedom forum%' OR name ILIKE '%religious freedom%';

UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Immigration']
WHERE name ILIKE '%pew%' AND name ILIKE '%religion%';

-- Physicians/Health Human Rights
UPDATE rss_sources SET policy_domains = ARRAY['Healthcare', 'Civil Rights', 'Foreign Policy']
WHERE name ILIKE '%physicians for human%';

-- Center for Constitutional Rights
UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Criminal Justice', 'Immigration']
WHERE name ILIKE '%constitutional rights%' OR name ILIKE '%ccr%';

-- Default: Sources without policy_domains get tagged based on category
UPDATE rss_sources
SET policy_domains = CASE
  WHEN category = 'civil_rights' THEN ARRAY['Civil Rights']
  WHEN category = 'conservative' THEN ARRAY['Economic Justice', 'Immigration']
  WHEN category = 'mainstream' THEN ARRAY['Economic Justice', 'Healthcare', 'Foreign Policy']
  WHEN category = 'independent' THEN ARRAY['Civil Rights', 'Economic Justice']
  WHEN category = 'specialized' THEN ARRAY['Civil Rights']
  WHEN category = 'state_government' THEN ARRAY['Voting Rights', 'Economic Justice', 'Healthcare']
  WHEN category = 'government' THEN ARRAY['Foreign Policy', 'Economic Justice']
  ELSE ARRAY['Economic Justice', 'Civil Rights']
END
WHERE policy_domains = '{}' OR policy_domains IS NULL;

-- Log the results
DO $$
DECLARE
  source_count INTEGER;
  tagged_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO source_count FROM rss_sources WHERE is_active = true;
  SELECT COUNT(*) INTO tagged_count FROM rss_sources WHERE is_active = true AND array_length(policy_domains, 1) > 0;

  RAISE NOTICE 'RSS Sources tagging complete: % total active, % tagged with policy domains', source_count, tagged_count;
END $$;
