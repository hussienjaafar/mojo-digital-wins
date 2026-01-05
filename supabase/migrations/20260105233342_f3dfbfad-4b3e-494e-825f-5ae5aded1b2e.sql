-- Add trend_event_id to client_entity_alerts for linking alerts to trend events
ALTER TABLE public.client_entity_alerts 
ADD COLUMN IF NOT EXISTS trend_event_id uuid REFERENCES trend_events(id);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_client_entity_alerts_trend_event_id 
ON public.client_entity_alerts(trend_event_id) WHERE trend_event_id IS NOT NULL;