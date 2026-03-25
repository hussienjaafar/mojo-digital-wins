-- ============================================
-- STANDARDIZE DONOR_KEY HASHING TO MD5 (6-char)
-- ============================================
-- This migration unifies all donor_key generation to use:
-- 'donor_' || substr(md5(lower(trim(email))), 1, 6)
-- This ensures LTV predictions can join with donor_demographics
-- ============================================

-- 1. Clear old LTV predictions with wrong hash format
-- The JS bitwise hash creates keys like 'donor_h9ipx8' (base36)
-- The correct MD5 format is 'donor_71cc2d' (hex)
DELETE FROM public.donor_ltv_predictions 
WHERE donor_key ~ '^donor_[a-z0-9]+$'  -- Matches base36 format
  AND donor_key !~ '^donor_[0-9a-f]{6}$';  -- Not hex format

-- 2. Clear old journey events with SHA-256 hash format (16+ chars)
DELETE FROM public.donor_journeys
WHERE length(donor_key) > 13;  -- 'donor_' + 6 chars = 13

-- 3. Update donor_demographics to ensure all have correct donor_key format
UPDATE public.donor_demographics 
SET donor_key = 'donor_' || substr(md5(lower(trim(donor_email))), 1, 6)
WHERE donor_email IS NOT NULL
  AND (donor_key IS NULL 
       OR donor_key !~ '^donor_[0-9a-f]{6}$');

-- 4. Create a reusable function for consistent donor_key generation
CREATE OR REPLACE FUNCTION public.compute_donor_key(email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN email IS NOT NULL 
    THEN 'donor_' || substr(md5(lower(trim(email))), 1, 6)
    ELSE NULL
  END;
$$;

-- 5. Grant access to the function
GRANT EXECUTE ON FUNCTION public.compute_donor_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_donor_key(text) TO anon;