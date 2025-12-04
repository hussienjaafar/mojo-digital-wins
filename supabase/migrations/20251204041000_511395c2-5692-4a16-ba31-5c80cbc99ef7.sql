
-- Add missing blocklist terms
INSERT INTO evergreen_topics (topic) VALUES
  ('democrats'), ('republicans'), ('congress'), ('america'), ('senate'), ('dems'),
  ('gop'), ('libs'), ('conservatives'), ('liberals'), ('progressives'),
  ('hakeem jeffries'), ('jesus'), ('god'), ('bible'), ('christian'), ('muslim'),
  ('bill kochman'), ('republican'), ('democrat')
ON CONFLICT (topic) DO NOTHING;

-- Refresh view
REFRESH MATERIALIZED VIEW mv_unified_trends;
