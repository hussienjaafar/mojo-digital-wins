-- Add is_enrichment_only column to track enrichment vs primary conversion events
ALTER TABLE public.meta_conversion_events 
ADD COLUMN IF NOT EXISTS is_enrichment_only boolean NOT NULL DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.meta_conversion_events.is_enrichment_only IS 
'When true, this event is sent to provide additional matching data (phone, name, address) 
while ActBlue handles the primary conversion tracking. Meta will use external_id/fbp/fbc 
to deduplicate and merge user data from both sources.';

-- Add index for monitoring enrichment events
CREATE INDEX IF NOT EXISTS idx_meta_conversion_events_enrichment 
ON public.meta_conversion_events (organization_id, is_enrichment_only, status) 
WHERE is_enrichment_only = true;