-- Add is_event_phrase column to trend_events for multi-word descriptive phrases
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS is_event_phrase BOOLEAN DEFAULT false;

-- Add index for filtering event phrases (for trend labels preference)
CREATE INDEX IF NOT EXISTS idx_trend_events_is_event_phrase 
ON public.trend_events(is_event_phrase) 
WHERE is_event_phrase = true;

-- Comment explaining the column
COMMENT ON COLUMN public.trend_events.is_event_phrase IS 
  'True for multi-word descriptive trend phrases (e.g., "Trump Tariff Policy") vs single entities (e.g., "Donald Trump")';