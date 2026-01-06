-- Add related_phrases array for storing alternate phrasings/aliases for clustered trends
ALTER TABLE public.trend_events
ADD COLUMN IF NOT EXISTS related_phrases text[] DEFAULT '{}';

-- Add cluster_id to link similar events (optional - for future grouping UI)
ALTER TABLE public.trend_events
ADD COLUMN IF NOT EXISTS cluster_id uuid;

-- Add canonical_label to store the "best" label chosen for display
ALTER TABLE public.trend_events
ADD COLUMN IF NOT EXISTS canonical_label text;

-- Create trend_phrase_clusters table for storing phrase clusters
CREATE TABLE IF NOT EXISTS public.trend_phrase_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_phrase text NOT NULL,
  canonical_event_id uuid REFERENCES public.trend_events(id) ON DELETE SET NULL,
  member_phrases text[] DEFAULT '{}',
  member_event_keys text[] DEFAULT '{}',
  similarity_threshold numeric DEFAULT 0.85,
  total_mentions integer DEFAULT 0,
  top_authority_score numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for canonical phrase lookup
CREATE INDEX IF NOT EXISTS idx_trend_phrase_clusters_canonical 
ON public.trend_phrase_clusters(canonical_phrase);

-- Index for finding cluster by member phrase
CREATE INDEX IF NOT EXISTS idx_trend_phrase_clusters_members 
ON public.trend_phrase_clusters USING GIN(member_phrases);

-- Comment explaining purpose
COMMENT ON TABLE public.trend_phrase_clusters IS 'Clusters similar trend phrases into single canonical labels';