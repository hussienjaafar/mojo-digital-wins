-- Add more government department sources
-- Critical for tracking policy changes affecting Arab/Muslim Americans

INSERT INTO public.rss_sources (name, url, category, logo_url) VALUES
  -- Treasury / Sanctions (OFAC)
  ('Treasury Press Releases', 'https://home.treasury.gov/system/files/126/ofac_rss.xml', 'government', null),
  ('Treasury News', 'https://home.treasury.gov/news/press-releases/rss.xml', 'government', null),

  -- Immigration Agencies
  ('USCIS News', 'https://www.uscis.gov/rss/news', 'government', null),
  ('ICE News Releases', 'https://www.ice.gov/rss/news-releases.xml', 'government', null),
  ('CBP Newsroom', 'https://www.cbp.gov/newsroom/rss-feeds/speeches-statements', 'government', null),

  -- Congress
  ('Congress.gov Bills', 'https://www.congress.gov/rss/most-viewed-bills.xml', 'government', null),
  ('House Judiciary Committee', 'https://judiciary.house.gov/rss.xml', 'government', null),
  ('Senate Judiciary Committee', 'https://www.judiciary.senate.gov/rss/feeds/committee-news', 'government', null),
  ('House Foreign Affairs', 'https://foreignaffairs.house.gov/rss.xml', 'government', null),
  ('Senate Foreign Relations', 'https://www.foreign.senate.gov/rss/feeds/all-activity', 'government', null),

  -- Additional Federal Agencies
  ('EEOC News', 'https://www.eeoc.gov/rss/newsroom.xml', 'government', null),
  ('Civil Rights Division DOJ', 'https://www.justice.gov/feeds/crt/opa/justice-news.xml', 'government', null),
  ('Office of Inspector General', 'https://oig.justice.gov/rss.xml', 'government', null),

  -- Federal Register (Executive Orders, Rules)
  ('Federal Register', 'https://www.federalregister.gov/documents/current.rss', 'government', null),
  ('Federal Register - Executive Orders', 'https://www.federalregister.gov/documents/search.rss?conditions%5Bpresidential_document_type%5D=executive_order', 'government', null),

  -- Additional State Governments (key states with large Arab/Muslim populations)
  ('Michigan Governor', 'https://www.michigan.gov/whitmer/news/rss', 'state_government', null),
  ('California Governor', 'https://www.gov.ca.gov/feed/', 'state_government', null),
  ('New York Governor', 'https://www.governor.ny.gov/rss.xml', 'state_government', null),
  ('New Jersey Governor', 'https://www.nj.gov/governor/news/rss.xml', 'state_government', null),
  ('Illinois Governor', 'https://www.illinois.gov/news/rss', 'state_government', null),
  ('Virginia Governor', 'https://www.governor.virginia.gov/newsroom/news-releases/rss.xml', 'state_government', null)

ON CONFLICT (url) DO NOTHING;
