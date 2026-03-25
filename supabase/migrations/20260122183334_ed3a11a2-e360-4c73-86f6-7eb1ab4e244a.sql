-- Add columns for token security hardening if they don't exist
DO $$
BEGIN
  -- Add used_at column to track single-use tokens
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_invitations' 
    AND column_name = 'used_at') THEN
    ALTER TABLE public.user_invitations ADD COLUMN used_at timestamptz;
  END IF;

  -- Add failed_attempts column for rate limiting
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_invitations' 
    AND column_name = 'failed_attempts') THEN
    ALTER TABLE public.user_invitations ADD COLUMN failed_attempts integer DEFAULT 0;
  END IF;
END $$;

-- Create function to increment failed attempts
CREATE OR REPLACE FUNCTION public.increment_invitation_failed_attempts(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_invitations
  SET failed_attempts = COALESCE(failed_attempts, 0) + 1
  WHERE id = p_invitation_id;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.increment_invitation_failed_attempts(uuid) TO service_role;