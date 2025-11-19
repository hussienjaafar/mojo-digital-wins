-- Add more news sources for comprehensive coverage
-- Includes Muslim American orgs, legal advocacy, investigative journalism

INSERT INTO public.rss_sources (name, url, category, logo_url) VALUES
  -- Muslim American Organizations
  ('Islamic Relief USA', 'https://irusa.org/feed/', 'specialized', null),
  ('Muslim Advocates', 'https://muslimadvocates.org/feed/', 'specialized', null),
  ('Yaqeen Institute', 'https://yaqeeninstitute.org/feed/', 'specialized', null),
  ('ISPU', 'https://www.ispu.org/feed/', 'specialized', null),

  -- Arab American Organizations
  ('ACCESS', 'https://www.accesscommunity.org/feed', 'specialized', null),

  -- Legal/Civil Rights
  ('Center for Constitutional Rights', 'https://ccrjustice.org/home/blog/feed', 'civil_rights', null),
  ('National Immigration Law Center', 'https://www.nilc.org/feed/', 'civil_rights', null),
  ('Human Rights Watch', 'https://www.hrw.org/rss/news', 'civil_rights', null),
  ('Amnesty International USA', 'https://www.amnestyusa.org/feed/', 'civil_rights', null),

  -- Investigative Journalism
  ('ProPublica', 'https://www.propublica.org/feeds/propublica/main', 'independent', null),
  ('The Marshall Project', 'https://www.themarshallproject.org/rss/all', 'independent', null),
  ('Reveal News', 'https://revealnews.org/feed/', 'independent', null),
  ('Mother Jones', 'https://www.motherjones.com/feed/', 'independent', null),
  ('The Nation', 'https://www.thenation.com/feed/', 'independent', null),

  -- Major Newspapers - Middle East Coverage
  ('Washington Post World', 'https://feeds.washingtonpost.com/rss/world', 'mainstream', null),
  ('NY Times Middle East', 'https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', 'mainstream', null),
  ('Guardian World', 'https://www.theguardian.com/world/rss', 'mainstream', null),
  ('PBS NewsHour', 'https://www.pbs.org/newshour/feeds/rss/headlines', 'mainstream', null),

  -- Regional/Community News
  ('Arab American News', 'https://www.arabamericannews.com/feed/', 'specialized', null),
  ('Muslim Observer', 'https://muslimobserver.com/feed/', 'specialized', null),

  -- Think Tanks & Policy
  ('Brookings', 'https://www.brookings.edu/feed/', 'mainstream', null),
  ('Carnegie Endowment', 'https://carnegieendowment.org/rss/solr/?fa=articles', 'mainstream', null),
  ('Council on Foreign Relations', 'https://www.cfr.org/rss.xml', 'mainstream', null),

  -- Additional Conservative Sources (for monitoring)
  ('Washington Examiner', 'https://www.washingtonexaminer.com/feed', 'conservative', null),
  ('Breitbart', 'https://feeds.feedburner.com/breitbart', 'conservative', null),

  -- International
  ('Haaretz', 'https://www.haaretz.com/cmlink/1.4614868', 'mainstream', null),
  ('+972 Magazine', 'https://www.972mag.com/feed/', 'independent', null),
  ('Times of Israel', 'https://www.timesofisrael.com/feed/', 'mainstream', null)

ON CONFLICT (url) DO NOTHING;

-- Update categories to include new ones
-- Note: You may want to update the NewsFeed categories array to include these
