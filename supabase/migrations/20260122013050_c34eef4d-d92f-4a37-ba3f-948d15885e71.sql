-- Password reset rate limiting table
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT false
);

-- Index for rate limit queries
CREATE INDEX idx_password_reset_email_time 
ON password_reset_requests(email_hash, requested_at);

-- Enable RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- No policies needed - this table is only accessed by edge functions with service role key

-- Cleanup function for old requests (called by trigger)
CREATE OR REPLACE FUNCTION cleanup_old_password_requests()
RETURNS TRIGGER AS $$
BEGIN
  -- Clean up requests older than 24 hours
  DELETE FROM public.password_reset_requests 
  WHERE requested_at < now() - INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to cleanup on each insert (self-cleaning table)
CREATE TRIGGER cleanup_password_requests_trigger
AFTER INSERT ON public.password_reset_requests
FOR EACH STATEMENT
EXECUTE FUNCTION cleanup_old_password_requests();

-- Add comment
COMMENT ON TABLE public.password_reset_requests IS 'Rate limiting table for password reset requests. Self-cleans entries older than 24 hours.';