-- Add missing alias_variants column for clustering
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS alias_variants text[] DEFAULT '{}';

-- Update trend_events_active view to include all new fields
DROP VIEW IF EXISTS public.trend_events_active;
CREATE VIEW public.trend_events_active AS
SELECT *
FROM public.trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '48 hours'
ORDER BY trend_score DESC NULLS LAST, confidence_score DESC NULLS LAST;

-- Reset trending status for topics that should be blocklisted
-- These will be properly filtered on next detection run
UPDATE public.trend_events
SET is_trending = false,
    trend_score = 0
WHERE LOWER(event_title) IN (
  'politics', 'political', 'government', 'democracy', 'freedom', 'liberty',
  'america', 'american', 'united states', 'usa', 'congress', 'senate', 'house',
  'republican', 'democrat', 'conservative', 'liberal', 'progressive',
  'breaking', 'news', 'update', 'report', 'latest', 'today', 'new',
  'constitution', 'capitol', 'washington'
);

-- Also reset single-word topics with low evidence that shouldn't trend
UPDATE public.trend_events
SET is_trending = false,
    trend_score = 0
WHERE array_length(string_to_array(event_title, ' '), 1) = 1
  AND (source_count < 2 OR evidence_count < 5);

-- Ensure trend_score and z_score_velocity default to 0 for safety
ALTER TABLE public.trend_events 
ALTER COLUMN trend_score SET DEFAULT 0,
ALTER COLUMN z_score_velocity SET DEFAULT 0;