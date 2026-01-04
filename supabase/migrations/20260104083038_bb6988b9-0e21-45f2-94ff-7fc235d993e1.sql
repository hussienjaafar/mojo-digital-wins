-- ================================================================================
-- TASK 3: Reclassify legacy deterministic_refcode rows
-- ================================================================================
-- 
-- Context: 4 rows have attribution_type='deterministic_refcode' with NULL match_reason
-- These are legacy records that were NOT verified via URL extraction.
-- 
-- Options:
-- A) Reclassify to 'legacy_unverified' and exclude from truth totals
-- B) Keep as-is but mark is_deterministic=false to exclude from truth
-- 
-- Decision: Option B - Keep type but mark as non-deterministic
-- This preserves audit trail while correctly excluding from truth totals.
-- The UI will show these as "Legacy Match" with amber badge.
-- ================================================================================

-- First, let's see what we're dealing with
-- SELECT refcode, organization_id, attribution_type, match_reason, is_deterministic
-- FROM public.campaign_attribution
-- WHERE attribution_type = 'deterministic_refcode';

-- Update legacy deterministic_refcode rows to NOT be treated as truth
-- Keep attribution_type for audit trail, but mark is_deterministic=false
UPDATE public.campaign_attribution
SET 
  is_deterministic = false,
  match_reason = COALESCE(match_reason, 'Legacy deterministic (non-URL, requires verification)')
WHERE attribution_type = 'deterministic_refcode'
  AND match_reason IS NULL;

-- Add a comment to the table explaining truth semantics
COMMENT ON COLUMN public.campaign_attribution.attribution_type IS 
'Truth types (included in KPIs): deterministic_url_refcode, manual_confirmed. Heuristic types (excluded): heuristic_partial_url, heuristic_pattern, heuristic_fuzzy, deterministic_refcode (legacy).';

COMMENT ON COLUMN public.campaign_attribution.is_deterministic IS
'DEPRECATED for truth determination. Use attribution_type instead. Truth = deterministic_url_refcode OR manual_confirmed.';