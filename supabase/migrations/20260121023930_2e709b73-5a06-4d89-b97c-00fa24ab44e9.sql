-- Add CAPI health tracking columns to meta_capi_config
ALTER TABLE meta_capi_config 
ADD COLUMN IF NOT EXISTS last_event_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_events_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_events_failed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_match_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error_message TEXT;