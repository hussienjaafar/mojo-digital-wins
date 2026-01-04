-- Add unique constraint for sms_events upsert to work correctly
-- The sync function uses onConflict: 'organization_id,message_id' but no constraint exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_events_org_message_id 
ON public.sms_events (organization_id, message_id);

-- Add comment explaining the constraint
COMMENT ON INDEX public.idx_sms_events_org_message_id IS 
'Required for UPSERT in sync-switchboard-sms. Ensures idempotent message event ingestion.';