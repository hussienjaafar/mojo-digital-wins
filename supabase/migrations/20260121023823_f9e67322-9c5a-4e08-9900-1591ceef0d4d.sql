-- Add the scheduled job for hourly CAPI backfill with correct columns
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, payload, is_active)
VALUES (
  'capi-backfill-hourly',
  'edge_function',
  '0 * * * *',
  'backfill-recent-capi',
  '{"hours_back": 2, "limit": 50}'::jsonb,
  true
)
ON CONFLICT (job_name) DO UPDATE SET
  schedule = EXCLUDED.schedule,
  is_active = EXCLUDED.is_active,
  payload = EXCLUDED.payload;

-- Create the RPC function that process-meta-capi-outbox calls to update health stats
CREATE OR REPLACE FUNCTION update_capi_health_stats(
  p_organization_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF p_success THEN
    UPDATE meta_capi_config
    SET 
      last_event_sent_at = now(),
      total_events_sent = COALESCE(total_events_sent, 0) + 1,
      consecutive_failures = 0,
      last_error_message = NULL,
      avg_match_score = COALESCE(avg_match_score, 0)
    WHERE organization_id = p_organization_id;
  ELSE
    UPDATE meta_capi_config
    SET 
      total_events_failed = COALESCE(total_events_failed, 0) + 1,
      consecutive_failures = COALESCE(consecutive_failures, 0) + 1,
      last_error_message = p_error
    WHERE organization_id = p_organization_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;