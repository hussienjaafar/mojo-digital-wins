-- Expand news coverage with additional RSS sources and update refresh schedule to every 5 minutes

-- =============================================================================
-- 1. UPDATE RSS FEED SYNC SCHEDULE (from every 4 hours to every 5 minutes)
-- =============================================================================
UPDATE public.scheduled_jobs
SET
  schedule = '*/5 * * * *',
  next_run_at = now() + interval '5 minutes',
  updated_at = now()
WHERE job_name = 'RSS Feed Sync';

-- =============================================================================
-- 2. ADD ADDITIONAL RSS SOURCES FOR EXPANDED COVERAGE
-- =============================================================================
INSERT INTO public.rss_sources (name, url, category, logo_url) VALUES
  -- === ADDITIONAL MAINSTREAM NEWS ===
  ('CNN Politics', 'http://rss.cnn.com/rss/cnn_allpolitics.rss', 'mainstream', null),
  ('Fox News Politics', 'https://moxie.foxnews.com/google-publisher/politics.xml', 'conservative', null),
  ('MSNBC', 'http://www.msnbc.com/feeds/latest', 'mainstream', null),
  ('CBS News Politics', 'https://www.cbsnews.com/latest/rss/politics', 'mainstream', null),
  ('ABC News Politics', 'https://abcnews.go.com/abcnews/politicsheadlines', 'mainstream', null),
  ('Bloomberg Politics', 'https://www.bloomberg.com/politics/feeds/site.xml', 'mainstream', null),
  ('Financial Times', 'https://www.ft.com/rss/world', 'mainstream', null),

  -- === MORE INDEPENDENT/PROGRESSIVE OUTLETS ===
  ('Truthout', 'https://truthout.org/feed/', 'independent', null),
  ('The American Prospect', 'https://prospect.org/feed/', 'independent', null),
  ('Jacobin', 'https://jacobin.com/feed/', 'independent', null),
  ('The Progressive', 'https://progressive.org/feeds/all/', 'independent', null),
  ('Salon', 'https://www.salon.com/feed/', 'independent', null),
  ('Raw Story', 'https://www.rawstory.com/feed/', 'independent', null),
  ('AlterNet', 'https://www.alternet.org/feed/', 'independent', null),

  -- === MORE CONSERVATIVE OUTLETS ===
  ('The American Conservative', 'https://www.theamericanconservative.com/feed/', 'conservative', null),
  ('The Daily Wire', 'https://www.dailywire.com/feeds/rss.xml', 'conservative', null),
  ('Newsmax', 'https://www.newsmax.com/rss/', 'conservative', null),
  ('The Blaze', 'https://www.theblaze.com/feeds/feed.rss', 'conservative', null),
  ('Townhall', 'https://townhall.com/rss/', 'conservative', null),

  -- === ADDITIONAL STATE NEWS (More coverage areas) ===
  -- Florida
  ('Miami Herald', 'https://www.miamiherald.com/rss/', 'state_government', null),
  ('Tampa Bay Times', 'https://www.tampabay.com/rss/', 'state_government', null),
  ('Florida Phoenix', 'https://floridaphoenix.com/feed/', 'state_government', null),

  -- Pennsylvania
  ('Philadelphia Inquirer', 'https://www.inquirer.com/rss/', 'state_government', null),
  ('Pittsburgh Post-Gazette', 'https://www.post-gazette.com/rss/', 'state_government', null),
  ('Pennsylvania Capital-Star', 'https://www.penncapital-star.com/feed/', 'state_government', null),

  -- Minnesota (Minneapolis area)
  ('Star Tribune', 'https://www.startribune.com/rss/', 'state_government', null),
  ('MinnPost', 'https://www.minnpost.com/feed/', 'state_government', null),

  -- Ohio
  ('Cleveland.com', 'https://www.cleveland.com/rss/', 'state_government', null),
  ('Columbus Dispatch', 'https://www.dispatch.com/rss/', 'state_government', null),

  -- Georgia
  ('Atlanta Journal-Constitution', 'https://www.ajc.com/rss/', 'state_government', null),
  ('Georgia Recorder', 'https://georgiarecorder.com/feed/', 'state_government', null),

  -- North Carolina
  ('Charlotte Observer', 'https://www.charlotteobserver.com/rss/', 'state_government', null),
  ('NC Policy Watch', 'https://ncpolicywatch.com/feed/', 'state_government', null),

  -- Arizona
  ('Arizona Republic', 'https://www.azcentral.com/rss/', 'state_government', null),
  ('Arizona Mirror', 'https://www.azmirror.com/feed/', 'state_government', null),

  -- Massachusetts
  ('Boston Globe', 'https://www.bostonglobe.com/rss/', 'state_government', null),
  ('Boston Herald', 'https://www.bostonherald.com/feed/', 'state_government', null),

  -- Washington State
  ('Seattle Times', 'https://www.seattletimes.com/feed/', 'state_government', null),
  ('Crosscut', 'https://crosscut.com/rss.xml', 'state_government', null),

  -- === ADDITIONAL CIVIL RIGHTS & ADVOCACY ===
  ('Leadership Conference on Civil and Human Rights', 'https://civilrights.org/feed/', 'civil_rights', null),
  ('National Council of La Raza (UnidosUS)', 'https://www.unidosus.org/feed/', 'civil_rights', null),
  ('Anti-Defamation League', 'https://www.adl.org/rss.xml', 'civil_rights', null),
  ('Sikh Coalition', 'https://www.sikhcoalition.org/feed/', 'civil_rights', null),
  ('South Asian Americans Leading Together', 'https://saalt.org/feed/', 'civil_rights', null),

  -- === LEGAL & POLICY NEWS ===
  ('SCOTUSblog', 'https://www.scotusblog.com/feed/', 'specialized', null),
  ('Lawfare', 'https://www.lawfareblog.com/feed', 'specialized', null),
  ('Just Security', 'https://www.justsecurity.org/feed/', 'specialized', null),
  ('The National Law Journal', 'https://www.law.com/nationallawjournal/rss/', 'specialized', null),

  -- === INVESTIGATIVE JOURNALISM ===
  ('The Marshall Project', 'https://www.themarshallproject.org/rss', 'independent', null),
  ('The Markup', 'https://themarkup.org/feed/', 'independent', null),
  ('Center for Investigative Reporting', 'https://revealnews.org/feed/', 'independent', null),
  ('The Bureau of Investigative Journalism', 'https://www.thebureauinvestigates.com/feed', 'independent', null),

  -- === INTERNATIONAL MIDDLE EAST COVERAGE ===
  ('Al Jazeera English', 'https://www.aljazeera.com/xml/rss/all.xml', 'specialized', null),
  ('Middle East Eye', 'https://www.middleeasteye.net/rss', 'specialized', null),
  ('Middle East Monitor', 'https://www.middleeastmonitor.com/feed/', 'specialized', null),
  ('Al-Monitor', 'https://www.al-monitor.com/rss', 'specialized', null),
  ('The New Arab', 'https://www.newarab.com/rss', 'specialized', null),

  -- === FACT-CHECKING & MEDIA ANALYSIS ===
  ('FactCheck.org', 'https://www.factcheck.org/feed/', 'specialized', null),
  ('PolitiFact', 'https://www.politifact.com/rss/all/', 'specialized', null),
  ('Media Matters', 'https://www.mediamatters.org/rss.xml', 'independent', null),
  ('FAIR (Fairness & Accuracy in Reporting)', 'https://fair.org/feed/', 'independent', null),

  -- === MORE THINK TANKS & POLICY INSTITUTES ===
  ('American Enterprise Institute', 'https://www.aei.org/feed/', 'conservative', null),
  ('Center for Strategic and International Studies', 'https://www.csis.org/rss', 'specialized', null),
  ('Council on Foreign Relations', 'https://www.cfr.org/rss', 'specialized', null),
  ('New America Foundation', 'https://www.newamerica.org/rss/', 'specialized', null),

  -- === FAITH & INTERFAITH NEWS ===
  ('Religion News Service', 'https://religionnews.com/feed/', 'specialized', null),
  ('Interfaith Alliance', 'https://interfaithalliance.org/feed/', 'civil_rights', null),
  ('Shoulder to Shoulder', 'https://www.shouldertoshouldercampaign.org/feed/', 'civil_rights', null),

  -- === COMMUNITY & GRASSROOTS ORGANIZING ===
  ('Grassroots Policy Project', 'https://www.grassrootspolicy.org/feed/', 'independent', null),
  ('Movement for Black Lives', 'https://m4bl.org/feed/', 'civil_rights', null),
  ('United We Dream', 'https://unitedwedream.org/feed/', 'civil_rights', null)

ON CONFLICT (url) DO UPDATE SET
  is_active = true,
  category = EXCLUDED.category,
  updated_at = now();