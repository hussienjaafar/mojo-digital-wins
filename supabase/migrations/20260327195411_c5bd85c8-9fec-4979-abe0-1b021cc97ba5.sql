-- Migration 1: Add unified attribution columns
ALTER TABLE actblue_transactions
  ADD COLUMN IF NOT EXISTS attributed_channel TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS sms_campaign_id UUID;

CREATE INDEX IF NOT EXISTS idx_actblue_tx_attributed_channel
  ON actblue_transactions(organization_id, attributed_channel);

CREATE INDEX IF NOT EXISTS idx_actblue_tx_sms_campaign_id
  ON actblue_transactions(sms_campaign_id)
  WHERE sms_campaign_id IS NOT NULL;