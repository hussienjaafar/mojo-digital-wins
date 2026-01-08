-- Add context bundle fields to trend_events for Twitter-grade context
-- These store co-occurring terms and phrases for entity-only trends

-- context_terms: Top 3-5 co-occurring entities (e.g., for "Minneapolis": ["Renee Nicole", "Frey", "ICE"])
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS context_terms text[] DEFAULT '{}';

-- context_phrases: Top 2-3 verb-centered event phrases that provide context
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS context_phrases text[] DEFAULT '{}';

-- context_summary: One-line summary derived from top headlines explaining why trending
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS context_summary text DEFAULT NULL;

-- burst_score: Co-occurrence strength score for entity-only trends
-- Higher score means the entity is bursting with strong contextual evidence
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS burst_score numeric DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.trend_events.context_terms IS 'Top 3-5 co-occurring entities that appear with this trend (e.g., for Minneapolis: Renee Nicole, Frey, ICE)';
COMMENT ON COLUMN public.trend_events.context_phrases IS 'Top 2-3 verb-centered event phrases providing context for entity-only trends';
COMMENT ON COLUMN public.trend_events.context_summary IS 'One-line summary derived from headlines explaining why this entity is trending';
COMMENT ON COLUMN public.trend_events.burst_score IS 'Co-occurrence strength score: P(term|trend) × burst_factor, used to validate entity-only trends';

-- Create index for efficient context queries
CREATE INDEX IF NOT EXISTS idx_trend_events_context_terms ON public.trend_events USING GIN (context_terms);
CREATE INDEX IF NOT EXISTS idx_trend_events_burst_score ON public.trend_events (burst_score DESC) WHERE burst_score > 0;