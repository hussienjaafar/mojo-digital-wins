-- =====================================================
-- PHASE 4: Create user_status enum and add column
-- =====================================================

-- Create user_status enum type (no policies reference this new column)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE public.user_status AS ENUM ('pending', 'active', 'inactive', 'suspended');
  END IF;
END $$;

-- Add status column to client_users if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_users' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.client_users 
      ADD COLUMN status public.user_status DEFAULT 'active'::public.user_status;
  END IF;
END $$;

-- Set all existing users to active
UPDATE public.client_users SET status = 'active' WHERE status IS NULL;

-- Make status column NOT NULL after setting defaults
ALTER TABLE public.client_users 
  ALTER COLUMN status SET NOT NULL;

-- =====================================================
-- Add index for status column for better query performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_client_users_status ON public.client_users(status);

-- =====================================================
-- Create org_role type for reference in code
-- =====================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') THEN
    CREATE TYPE public.org_role AS ENUM ('admin', 'manager', 'editor', 'viewer');
  END IF;
END $$;