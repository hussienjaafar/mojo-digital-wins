-- Enable RLS on trend_phrase_clusters
ALTER TABLE public.trend_phrase_clusters ENABLE ROW LEVEL SECURITY;

-- Allow public read access (trends are public data)
CREATE POLICY "Trend phrase clusters are publicly readable"
ON public.trend_phrase_clusters
FOR SELECT
USING (true);

-- Only service role can modify
CREATE POLICY "Only service role can modify trend phrase clusters"
ON public.trend_phrase_clusters
FOR ALL
USING (false)
WITH CHECK (false);

-- Add unique constraint for upsert
ALTER TABLE public.trend_phrase_clusters
ADD CONSTRAINT trend_phrase_clusters_canonical_phrase_key UNIQUE (canonical_phrase);