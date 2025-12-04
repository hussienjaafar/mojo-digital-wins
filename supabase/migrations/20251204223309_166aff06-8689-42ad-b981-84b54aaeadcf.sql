-- Create entity_aliases table for caching entity resolutions
CREATE TABLE public.entity_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  entity_type TEXT DEFAULT 'unknown',
  resolution_method TEXT NOT NULL DEFAULT 'manual',
  confidence_score NUMERIC DEFAULT 1.0,
  source TEXT,
  metadata JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(raw_name)
);

-- Create index for fast lookups
CREATE INDEX idx_entity_aliases_raw_name ON public.entity_aliases(raw_name);
CREATE INDEX idx_entity_aliases_canonical_name ON public.entity_aliases(canonical_name);
CREATE INDEX idx_entity_aliases_entity_type ON public.entity_aliases(entity_type);

-- Enable RLS
ALTER TABLE public.entity_aliases ENABLE ROW LEVEL SECURITY;

-- Allow public read access (edge functions need this)
CREATE POLICY "Allow public read access" ON public.entity_aliases FOR SELECT USING (true);

-- Allow service role to insert/update
CREATE POLICY "Allow service role to manage" ON public.entity_aliases FOR ALL USING (true);

-- Pre-populate with known political entity aliases
INSERT INTO public.entity_aliases (raw_name, canonical_name, entity_type, resolution_method, confidence_score) VALUES
-- Donald Trump variations
('trump', 'Donald Trump', 'person', 'manual', 1.0),
('#trump', 'Donald Trump', 'person', 'manual', 1.0),
('#donaldtrump', 'Donald Trump', 'person', 'manual', 1.0),
('president trump', 'Donald Trump', 'person', 'manual', 1.0),
('donald j trump', 'Donald Trump', 'person', 'manual', 1.0),
('donald j. trump', 'Donald Trump', 'person', 'manual', 1.0),
('#maga', 'Donald Trump', 'hashtag', 'manual', 0.8),
-- Joe Biden variations
('biden', 'Joe Biden', 'person', 'manual', 1.0),
('#biden', 'Joe Biden', 'person', 'manual', 1.0),
('#joebiden', 'Joe Biden', 'person', 'manual', 1.0),
('president biden', 'Joe Biden', 'person', 'manual', 1.0),
('joseph biden', 'Joe Biden', 'person', 'manual', 1.0),
-- Elon Musk variations
('musk', 'Elon Musk', 'person', 'manual', 1.0),
('#musk', 'Elon Musk', 'person', 'manual', 1.0),
('#elonmusk', 'Elon Musk', 'person', 'manual', 1.0),
-- Government agencies
('scotus', 'Supreme Court', 'organization', 'manual', 1.0),
('#scotus', 'Supreme Court', 'organization', 'manual', 1.0),
('fbi', 'FBI', 'organization', 'manual', 1.0),
('#fbi', 'FBI', 'organization', 'manual', 1.0),
('doj', 'Department of Justice', 'organization', 'manual', 1.0),
('#doj', 'Department of Justice', 'organization', 'manual', 1.0),
('ice', 'ICE', 'organization', 'manual', 1.0),
('#ice', 'ICE', 'organization', 'manual', 1.0),
('cia', 'CIA', 'organization', 'manual', 1.0),
('#cia', 'CIA', 'organization', 'manual', 1.0),
('dhs', 'DHS', 'organization', 'manual', 1.0),
('#dhs', 'DHS', 'organization', 'manual', 1.0),
('gop', 'Republican Party', 'organization', 'manual', 1.0),
('#gop', 'Republican Party', 'organization', 'manual', 1.0),
('republicans', 'Republican Party', 'organization', 'manual', 1.0),
('republican', 'Republican Party', 'organization', 'manual', 1.0),
('democrats', 'Democratic Party', 'organization', 'manual', 1.0),
('democrat', 'Democratic Party', 'organization', 'manual', 1.0),
('#democrats', 'Democratic Party', 'organization', 'manual', 1.0),
-- Other political figures
('putin', 'Vladimir Putin', 'person', 'manual', 1.0),
('#putin', 'Vladimir Putin', 'person', 'manual', 1.0),
('hegseth', 'Pete Hegseth', 'person', 'manual', 1.0),
('#hegseth', 'Pete Hegseth', 'person', 'manual', 1.0),
('desantis', 'Ron DeSantis', 'person', 'manual', 1.0),
('#desantis', 'Ron DeSantis', 'person', 'manual', 1.0),
('ron desantis', 'Ron DeSantis', 'person', 'manual', 1.0),
('newsom', 'Gavin Newsom', 'person', 'manual', 1.0),
('#newsom', 'Gavin Newsom', 'person', 'manual', 1.0),
('gavin newsom', 'Gavin Newsom', 'person', 'manual', 1.0),
('pelosi', 'Nancy Pelosi', 'person', 'manual', 1.0),
('#pelosi', 'Nancy Pelosi', 'person', 'manual', 1.0),
('mcconnell', 'Mitch McConnell', 'person', 'manual', 1.0),
('#mcconnell', 'Mitch McConnell', 'person', 'manual', 1.0),
('aoc', 'Alexandria Ocasio-Cortez', 'person', 'manual', 1.0),
('#aoc', 'Alexandria Ocasio-Cortez', 'person', 'manual', 1.0),
('ocasio-cortez', 'Alexandria Ocasio-Cortez', 'person', 'manual', 1.0)
ON CONFLICT (raw_name) DO NOTHING;