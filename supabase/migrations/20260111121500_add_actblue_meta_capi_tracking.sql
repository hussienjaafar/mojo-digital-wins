-- Track Meta CAPI sync status for ActBlue transactions
ALTER TABLE public.actblue_transactions
  ADD COLUMN IF NOT EXISTS meta_capi_status TEXT,
  ADD COLUMN IF NOT EXISTS meta_capi_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_capi_event_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_capi_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_capi_last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_actblue_transactions_meta_capi
  ON public.actblue_transactions(organization_id, meta_capi_status, meta_capi_synced_at);
