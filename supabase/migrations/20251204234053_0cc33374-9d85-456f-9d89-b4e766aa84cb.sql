-- Phase 3: Add more comprehensive topic mappings to entity_aliases table
INSERT INTO entity_aliases (raw_name, canonical_name, entity_type, confidence_score, source)
VALUES 
  -- Political figures
  ('potus', 'Donald Trump', 'person', 1.0, 'phase3_mapping'),
  ('trump administration', 'Donald Trump', 'person', 0.9, 'phase3_mapping'),
  ('biden administration', 'Joe Biden', 'person', 0.9, 'phase3_mapping'),
  ('vp harris', 'Kamala Harris', 'person', 1.0, 'phase3_mapping'),
  ('speaker johnson', 'Mike Johnson', 'person', 1.0, 'phase3_mapping'),
  ('aoc', 'Alexandria Ocasio-Cortez', 'person', 1.0, 'phase3_mapping'),
  ('mtg', 'Marjorie Taylor Greene', 'person', 1.0, 'phase3_mapping'),
  ('bernie', 'Bernie Sanders', 'person', 1.0, 'phase3_mapping'),
  ('bibi', 'Benjamin Netanyahu', 'person', 1.0, 'phase3_mapping'),
  ('vivek', 'Vivek Ramaswamy', 'person', 1.0, 'phase3_mapping'),
  ('ramaswamy', 'Vivek Ramaswamy', 'person', 1.0, 'phase3_mapping'),
  ('jd vance', 'JD Vance', 'person', 1.0, 'phase3_mapping'),
  ('hakeem jeffries', 'Hakeem Jeffries', 'person', 1.0, 'phase3_mapping'),
  ('john thune', 'John Thune', 'person', 1.0, 'phase3_mapping'),
  
  -- Government agencies
  ('justice department', 'DOJ', 'organization', 1.0, 'phase3_mapping'),
  ('homeland security', 'DHS', 'organization', 1.0, 'phase3_mapping'),
  ('border patrol', 'CBP', 'organization', 1.0, 'phase3_mapping'),
  ('department of government efficiency', 'DOGE', 'organization', 1.0, 'phase3_mapping'),
  ('federal bureau of investigation', 'FBI', 'organization', 1.0, 'phase3_mapping'),
  ('central intelligence agency', 'CIA', 'organization', 1.0, 'phase3_mapping'),
  ('immigration and customs enforcement', 'ICE', 'organization', 1.0, 'phase3_mapping'),
  ('internal revenue service', 'IRS', 'organization', 1.0, 'phase3_mapping'),
  
  -- Locations
  ('dc', 'Washington DC', 'location', 1.0, 'phase3_mapping'),
  ('nyc', 'New York City', 'location', 1.0, 'phase3_mapping'),
  ('la', 'Los Angeles', 'location', 1.0, 'phase3_mapping'),
  ('sf', 'San Francisco', 'location', 1.0, 'phase3_mapping'),
  ('west bank', 'West Bank', 'location', 1.0, 'phase3_mapping'),
  
  -- Organizations
  ('blm', 'Black Lives Matter', 'organization', 1.0, 'phase3_mapping'),
  ('council on american-islamic relations', 'CAIR', 'organization', 1.0, 'phase3_mapping'),
  ('american civil liberties union', 'ACLU', 'organization', 1.0, 'phase3_mapping'),
  ('southern poverty law center', 'SPLC', 'organization', 1.0, 'phase3_mapping'),
  ('anti-defamation league', 'ADL', 'organization', 1.0, 'phase3_mapping'),
  ('human rights campaign', 'HRC', 'organization', 1.0, 'phase3_mapping'),
  ('national rifle association', 'NRA', 'organization', 1.0, 'phase3_mapping'),
  
  -- Events
  ('capitol riot', 'January 6th', 'event', 1.0, 'phase3_mapping'),
  ('capitol attack', 'January 6th', 'event', 1.0, 'phase3_mapping'),
  ('jan 6', 'January 6th', 'event', 1.0, 'phase3_mapping'),
  ('january 6', 'January 6th', 'event', 1.0, 'phase3_mapping'),
  
  -- Legislation
  ('obamacare', 'Affordable Care Act', 'legislation', 1.0, 'phase3_mapping'),
  ('title 9', 'Title IX', 'legislation', 1.0, 'phase3_mapping'),
  ('patriot act', 'USA PATRIOT Act', 'legislation', 1.0, 'phase3_mapping'),
  
  -- Tech
  ('chatgpt', 'OpenAI', 'organization', 0.9, 'phase3_mapping'),
  ('x.com', 'X/Twitter', 'organization', 1.0, 'phase3_mapping'),
  ('facebook', 'Meta', 'organization', 1.0, 'phase3_mapping'),
  
  -- Media
  ('nyt', 'New York Times', 'organization', 1.0, 'phase3_mapping'),
  ('wapo', 'Washington Post', 'organization', 1.0, 'phase3_mapping'),
  ('wsj', 'Wall Street Journal', 'organization', 1.0, 'phase3_mapping')
ON CONFLICT (raw_name) DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  entity_type = EXCLUDED.entity_type,
  confidence_score = EXCLUDED.confidence_score,
  updated_at = NOW();