-- Add comprehensive news sources covering civil rights, human rights, political news,
-- and state/local news affecting Muslim and Arab Americans

INSERT INTO public.rss_sources (name, url, category, logo_url) VALUES
  -- === CIVIL RIGHTS ORGANIZATIONS ===
  ('ACLU News', 'https://www.aclu.org/rss.xml', 'civil_rights', null),
  ('Southern Poverty Law Center', 'https://www.splcenter.org/rss.xml', 'civil_rights', null),
  ('Human Rights Watch', 'https://www.hrw.org/rss', 'civil_rights', null),
  ('Amnesty International USA', 'https://www.amnesty.org/en/rss/', 'civil_rights', null),
  ('National Immigration Law Center', 'https://www.nilc.org/feed/', 'civil_rights', null),
  ('Brennan Center for Justice', 'https://www.brennancenter.org/rss.xml', 'civil_rights', null),
  ('Electronic Frontier Foundation', 'https://www.eff.org/rss/updates.xml', 'civil_rights', null),
  ('American-Arab Anti-Discrimination Committee', 'https://www.adc.org/feed/', 'civil_rights', null),
  ('Asian Americans Advancing Justice', 'https://www.advancingjustice-aajc.org/feed', 'civil_rights', null),
  ('NAACP', 'https://naacp.org/rss.xml', 'civil_rights', null),
  ('Lambda Legal', 'https://www.lambdalegal.org/rss.xml', 'civil_rights', null),

  -- === MUSLIM/ARAB AMERICAN ADVOCACY ===
  ('CAIR National', 'https://www.cair.com/feed/', 'specialized', null),
  ('Muslim Public Affairs Council', 'https://www.mpac.org/feed/', 'specialized', null),
  ('Arab American Institute', 'https://www.aaiusa.org/rss', 'specialized', null),
  ('Muslim Advocates', 'https://muslimadvocates.org/feed/', 'civil_rights', null),
  ('Emgage', 'https://www.emgageusa.org/feed/', 'specialized', null),
  ('Islamic Networks Group', 'https://ing.org/feed/', 'specialized', null),

  -- === MAINSTREAM POLITICAL NEWS ===
  ('Politico', 'https://www.politico.com/rss/politics08.xml', 'mainstream', null),
  ('The Hill', 'https://thehill.com/rss/syndicator/19109', 'mainstream', null),
  ('Roll Call', 'https://www.rollcall.com/feed/', 'mainstream', null),
  ('Reuters Politics', 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best', 'mainstream', null),
  ('Associated Press Politics', 'https://apnews.com/apf-politics', 'mainstream', null),
  ('NPR Politics', 'https://feeds.npr.org/1014/rss.xml', 'mainstream', null),
  ('PBS NewsHour', 'https://www.pbs.org/newshour/feeds/rss/headlines', 'mainstream', null),
  ('USA Today', 'https://rssfeeds.usatoday.com/usatoday-newstopstories', 'mainstream', null),

  -- === PROGRESSIVE/LEFT POLITICAL NEWS ===
  ('The Nation', 'https://www.thenation.com/feed/', 'independent', null),
  ('Democracy Now', 'https://www.democracynow.org/democracynow.rss', 'independent', null),
  ('Common Dreams', 'https://www.commondreams.org/feed', 'independent', null),
  ('Mother Jones', 'https://www.motherjones.com/feed/', 'independent', null),
  ('ProPublica', 'https://www.propublica.org/feeds/propublica/main', 'independent', null),
  ('The Intercept', 'https://theintercept.com/feed/?rss', 'independent', null),
  ('In These Times', 'https://inthesetimes.com/feeds/rss/', 'independent', null),

  -- === CONSERVATIVE POLITICAL NEWS ===
  ('National Review', 'https://www.nationalreview.com/feed/', 'conservative', null),
  ('The Federalist', 'https://thefederalist.com/feed/', 'conservative', null),
  ('Washington Examiner', 'https://www.washingtonexaminer.com/feed', 'conservative', null),
  ('Breitbart', 'https://www.breitbart.com/feed/', 'conservative', null),
  ('The Daily Caller', 'https://dailycaller.com/feed/', 'conservative', null),

  -- === HUMAN RIGHTS & INTERNATIONAL ===
  ('Refugees International', 'https://www.refugeesinternational.org/feed', 'civil_rights', null),
  ('International Crisis Group', 'https://www.crisisgroup.org/rss.xml', 'specialized', null),
  ('Center for Constitutional Rights', 'https://ccrjustice.org/rss.xml', 'civil_rights', null),
  ('Physicians for Human Rights', 'https://phr.org/feed/', 'civil_rights', null),

  -- === STATE & LOCAL NEWS (Major Arab/Muslim American Communities) ===
  -- Michigan (Dearborn area)
  ('Detroit Free Press', 'https://www.freep.com/rss/', 'state_government', null),
  ('Detroit News', 'https://www.detroitnews.com/rss/', 'state_government', null),
  ('MLive Michigan', 'https://www.mlive.com/feed/', 'state_government', null),
  ('Arab American News', 'https://www.arabamericannews.com/feed/', 'specialized', null),

  -- New York Metro
  ('NYC.gov News', 'https://www1.nyc.gov/rss.page', 'state_government', null),
  ('Gothamist', 'https://gothamist.com/feeds/rss', 'state_government', null),

  -- California
  ('LA Times', 'https://www.latimes.com/rss2.0.xml', 'state_government', null),
  ('San Francisco Chronicle', 'https://www.sfchronicle.com/rss/', 'state_government', null),
  ('CalMatters', 'https://calmatters.org/feed/', 'state_government', null),

  -- Illinois (Chicago area)
  ('Chicago Tribune', 'https://www.chicagotribune.com/rss/', 'state_government', null),
  ('Chicago Sun-Times', 'https://chicago.suntimes.com/rss/index.xml', 'state_government', null),

  -- New Jersey
  ('NJ.com', 'https://www.nj.com/rss/', 'state_government', null),

  -- Texas
  ('Texas Tribune', 'https://www.texastribune.org/rss/', 'state_government', null),
  ('Houston Chronicle', 'https://www.houstonchronicle.com/rss/', 'state_government', null),

  -- Virginia
  ('Virginia Mercury', 'https://www.virginiamercury.com/feed/', 'state_government', null),

  -- === RELIGIOUS FREEDOM & FIRST AMENDMENT ===
  ('Freedom Forum', 'https://www.freedomforum.org/feed/', 'civil_rights', null),
  ('Pew Research Religion', 'https://www.pewresearch.org/religion/feed/', 'specialized', null),
  ('Religious Freedom Institute', 'https://www.religiousfreedominstitute.org/feed', 'civil_rights', null),

  -- === IMMIGRATION & REFUGEE NEWS ===
  ('Migration Policy Institute', 'https://www.migrationpolicy.org/rss.xml', 'specialized', null),
  ('American Immigration Council', 'https://www.americanimmigrationcouncil.org/rss.xml', 'civil_rights', null),
  ('National Immigration Forum', 'https://immigrationforum.org/feed/', 'civil_rights', null),

  -- === POLICY & THINK TANKS ===
  ('Brookings Institution', 'https://www.brookings.edu/feed/', 'specialized', null),
  ('Center for American Progress', 'https://www.americanprogress.org/feed/', 'specialized', null),
  ('Heritage Foundation', 'https://www.heritage.org/rss/commentary', 'conservative', null),
  ('Cato Institute', 'https://www.cato.org/rss/recent_opeds', 'specialized', null),

  -- === SURVEILLANCE & PRIVACY (relevant to Muslim American profiling) ===
  ('Access Now', 'https://www.accessnow.org/feed/', 'civil_rights', null),
  ('Center for Democracy & Technology', 'https://cdt.org/feed/', 'civil_rights', null),
  ('Privacy International', 'https://privacyinternational.org/rss.xml', 'civil_rights', null)

ON CONFLICT (url) DO UPDATE SET
  is_active = true,
  category = EXCLUDED.category;

-- Update category descriptions
COMMENT ON TABLE public.rss_sources IS
'RSS feed sources categorized by type:
- civil_rights: ACLU, SPLC, HRW, civil rights orgs
- specialized: Muslim/Arab American advocacy groups, think tanks
- mainstream: Major news outlets, wire services
- independent: Alternative/progressive news
- conservative: Right-leaning news outlets
- government: Federal agencies, Congress
- state_government: State/local government and news';
