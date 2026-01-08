-- Add label_source column to trend_events for audit trail
ALTER TABLE trend_events ADD COLUMN IF NOT EXISTS label_source text;

-- Add comment for documentation
COMMENT ON COLUMN trend_events.label_source IS 'Source of the label: event_phrase, fallback_generated, or entity_only';