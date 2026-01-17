-- Migration: Rename user_data_raw to user_data_hashed for security
-- SECURITY HARDENING: Ensures column name reflects that only hashed PII is stored

-- Rename column if old name exists (handles upgrade from previous migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'meta_conversion_events'
      AND column_name = 'user_data_raw'
  ) THEN
    ALTER TABLE public.meta_conversion_events
      RENAME COLUMN user_data_raw TO user_data_hashed;

    RAISE NOTICE 'Renamed user_data_raw to user_data_hashed';
  ELSE
    RAISE NOTICE 'Column user_data_raw does not exist, no rename needed';
  END IF;
END
$$;

-- Update comment to reflect security semantics
COMMENT ON COLUMN public.meta_conversion_events.user_data_hashed IS
  'Pre-hashed user data using SHA-256. NO PLAINTEXT PII is stored.
   Contains Meta CAPI field names with hashed values: em, ph, fn, ln, ct, st, zp, country.
   Hashing is done BEFORE storage for security. Privacy mode filtering happens at send time.';
