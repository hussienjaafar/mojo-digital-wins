-- Add missing columns for token expiration tracking
ALTER TABLE public.client_api_credentials
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refresh_status TEXT;