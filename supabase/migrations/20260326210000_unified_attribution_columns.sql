-- Add unified attribution columns to actblue_transactions
-- These columns store the result of a single attribution pass at webhook ingestion time.
-- All RPCs and frontend queries read from these columns instead of recalculating.

ALTER TABLE actblue_transactions
  ADD COLUMN IF NOT EXISTS attributed_channel TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS sms_campaign_id UUID;

-- Index for channel breakdown queries on the dashboard
CREATE INDEX IF NOT EXISTS idx_actblue_tx_attributed_channel
  ON actblue_transactions(organization_id, attributed_channel);

-- Partial index for SMS campaign join queries (only rows that have a campaign)
CREATE INDEX IF NOT EXISTS idx_actblue_tx_sms_campaign_id
  ON actblue_transactions(sms_campaign_id)
  WHERE sms_campaign_id IS NOT NULL;
