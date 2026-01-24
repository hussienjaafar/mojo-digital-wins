-- Clean up duplicate CAPI events created by resend-capi-with-full-fbclid
-- These duplicates have '_corrected' suffix in dedupe_key where original still exists

-- Mark duplicate _corrected events where original also exists and was already delivered
-- This prevents double-counting in Meta's conversion API
UPDATE meta_conversion_events
SET 
  status = 'duplicate_cleaned',
  last_error = 'Marked as duplicate - original event was already delivered to Meta'
WHERE dedupe_key LIKE '%_corrected'
  AND status IN ('pending', 'sent', 'delivered')
  AND EXISTS (
    SELECT 1 FROM meta_conversion_events orig
    WHERE orig.dedupe_key = REPLACE(meta_conversion_events.dedupe_key, '_corrected', '')
      AND orig.status IN ('sent', 'delivered')
      AND orig.organization_id = meta_conversion_events.organization_id
  );

-- Create a unique partial index to prevent future duplicates
-- Only applies to non-cleaned events
CREATE INDEX IF NOT EXISTS idx_meta_conversion_events_dedupe_active 
ON meta_conversion_events (organization_id, dedupe_key) 
WHERE status NOT IN ('duplicate_cleaned', 'superseded', 'failed');

-- Add a comment explaining the cleanup
COMMENT ON TABLE meta_conversion_events IS 'Meta Conversions API events. Duplicate events with _corrected suffix have been cleaned up to prevent double-counting. Use status=duplicate_cleaned to identify these.';