-- Phase 1: Add token expiry tracking to client_api_credentials
-- This enables proactive token refresh before expiration

-- Add expiry and refresh tracking columns
ALTER TABLE public.client_api_credentials
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refresh_attempted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refresh_status TEXT CHECK (refresh_status IN ('success', 'failed', 'pending', NULL));

-- Add index for finding expiring tokens efficiently
CREATE INDEX IF NOT EXISTS idx_credentials_expiring
ON public.client_api_credentials(token_expires_at)
WHERE platform = 'meta' AND is_active = true AND token_expires_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.client_api_credentials.token_expires_at IS 'UTC timestamp when the access token expires (60 days for Meta long-lived tokens)';
COMMENT ON COLUMN public.client_api_credentials.refresh_attempted_at IS 'Last time a refresh was attempted';
COMMENT ON COLUMN public.client_api_credentials.refresh_status IS 'Status of last refresh attempt: success, failed, or pending';
