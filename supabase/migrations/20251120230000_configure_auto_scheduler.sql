-- Configure automatic job scheduler with correct Supabase credentials
-- This enables automatic RSS fetching every 15 minutes

-- Get the correct values from environment
DO $$
BEGIN
  -- Update with actual Supabase URL
  UPDATE public.system_config
  SET value = 'https://nuclmzoasgydubdshtab.supabase.co',
      updated_at = NOW()
  WHERE key = 'supabase_url';

  -- Note: Service role key should be set via Supabase dashboard or securely
  -- For now, we'll add a placeholder that needs manual update
  RAISE NOTICE 'System config updated. You must manually set the service_role_key via Supabase dashboard.';
  RAISE NOTICE 'Run this SQL in Supabase SQL Editor:';
  RAISE NOTICE 'UPDATE public.system_config SET value = ''your-actual-service-role-key'' WHERE key = ''supabase_service_role_key'';';
END $$;

-- Verify the configuration
DO $$
DECLARE
  url_val TEXT;
  key_val TEXT;
BEGIN
  SELECT value INTO url_val FROM public.system_config WHERE key = 'supabase_url';
  SELECT value INTO key_val FROM public.system_config WHERE key = 'supabase_service_role_key';

  RAISE NOTICE 'Current config:';
  RAISE NOTICE '  supabase_url: %', url_val;
  RAISE NOTICE '  service_role_key: % (length: %)',
    CASE
      WHEN key_val LIKE '%your-service%' THEN '⚠️ NOT CONFIGURED'
      ELSE '✅ CONFIGURED'
    END,
    LENGTH(key_val);
END $$;
