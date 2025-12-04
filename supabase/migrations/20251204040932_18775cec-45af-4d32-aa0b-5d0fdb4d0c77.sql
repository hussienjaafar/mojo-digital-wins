
-- Add more blocklist terms (fixed syntax)
INSERT INTO evergreen_topics (topic) VALUES
  ('donald trump'), ('joe biden'), ('barack obama'), ('hillary clinton'),
  ('kamala harris'), ('mike pence'), ('nancy pelosi'), ('mitch mcconnell'),
  ('chuck schumer'), ('kevin mccarthy'), ('vladimir putin'), ('xi jinping'),
  ('benjamin netanyahu'), ('volodymyr zelenskyy'), ('zelensky'),
  ('hegseth'), ('pete hegseth'),
  ('the white house'), ('the pentagon'), ('the senate'), ('the house'),
  ('washington'), ('washington dc'), ('new york'), ('california'), ('texas'), ('florida'),
  ('minnesota'), ('michigan'), ('pennsylvania'), ('arizona'), ('georgia'), ('wisconsin'),
  ('breaking news'), ('just in'), ('update'), ('developing'),
  ('cnn'), ('fox news'), ('msnbc'), ('nbc'), ('abc'), ('cbs'), ('npr'),
  ('ap news'), ('reuters'), ('associated press'),
  ('twitter'), ('x'), ('facebook'), ('instagram'), ('tiktok'), ('bluesky')
ON CONFLICT (topic) DO NOTHING;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW mv_unified_trends;
