-- Migration: Make attribution_rules system-wide (global by default)
-- Purpose: Standardize attribution across ALL clients with optional per-org overrides
--
-- Design:
--   organization_id = NULL → Global rule (applies to ALL organizations)
--   organization_id = UUID → Org-specific override (rare edge case)
--
-- Priority: Org-specific rules checked first, then global rules

-- ============================================================================
-- Step 1: Make organization_id nullable for global rules
-- ============================================================================
ALTER TABLE public.attribution_rules
  ALTER COLUMN organization_id DROP NOT NULL;

-- ============================================================================
-- Step 2: Update unique constraint to handle NULL organization_id
-- We need a partial unique index for global rules (org_id IS NULL)
-- and keep the existing constraint for org-specific rules
-- ============================================================================
ALTER TABLE public.attribution_rules
  DROP CONSTRAINT IF EXISTS unique_org_pattern;

-- Unique constraint for org-specific rules
CREATE UNIQUE INDEX IF NOT EXISTS idx_attribution_rules_org_pattern
  ON public.attribution_rules (organization_id, pattern, rule_type)
  WHERE organization_id IS NOT NULL;

-- Unique constraint for global rules (organization_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attribution_rules_global_pattern
  ON public.attribution_rules (pattern, rule_type)
  WHERE organization_id IS NULL;

-- ============================================================================
-- Step 3: Update RLS policies to allow reading global rules
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their org's attribution rules" ON public.attribution_rules;
DROP POLICY IF EXISTS "Admins can manage their org's attribution rules" ON public.attribution_rules;

-- All authenticated users can read global rules + their org's rules
CREATE POLICY "Users can view global and their org's attribution rules"
ON public.attribution_rules FOR SELECT
USING (
  -- Global rules (everyone can see)
  organization_id IS NULL
  OR
  -- Org-specific rules (only members can see)
  organization_id IN (
    SELECT organization_id FROM public.user_organizations
    WHERE user_id = auth.uid()
  )
);

-- Only superadmins can manage global rules (via service role)
-- Org admins can only manage their org's rules
CREATE POLICY "Org admins can manage their org's attribution rules"
ON public.attribution_rules FOR ALL
USING (
  organization_id IS NOT NULL
  AND organization_id IN (
    SELECT organization_id FROM public.user_organizations
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- ============================================================================
-- Step 4: Remove any existing org-specific rules (will be replaced with global)
-- ============================================================================
DELETE FROM public.attribution_rules WHERE organization_id IS NOT NULL;

-- ============================================================================
-- Step 5: Insert GLOBAL rules (apply to ALL organizations)
-- These are the standardized patterns for the entire platform
-- ============================================================================

-- Clear any existing global rules first
DELETE FROM public.attribution_rules WHERE organization_id IS NULL;

-- Meta/Facebook patterns (90% confidence - Tier 2 High Probability)
INSERT INTO public.attribution_rules (organization_id, name, description, pattern, rule_type, platform, confidence_score, priority, is_active)
VALUES
  (NULL, 'Meta: JP Campaign Prefix', 'Matches refcodes starting with "jp" (e.g., jp2024_retargeting)', '^jp', 'regex', 'meta', 0.90, 10, true),
  (NULL, 'Meta: TH Campaign Prefix', 'Matches refcodes starting with "th" (e.g., th_awareness)', '^th', 'regex', 'meta', 0.90, 10, true),
  (NULL, 'Meta: meta_ Prefix', 'Matches refcodes starting with "meta_"', 'meta_', 'prefix', 'meta', 0.90, 10, true),
  (NULL, 'Meta: fb_ Prefix', 'Matches refcodes starting with "fb_"', 'fb_', 'prefix', 'meta', 0.90, 10, true),
  (NULL, 'Meta: ig_ Prefix', 'Matches refcodes starting with "ig_" (Instagram)', 'ig_', 'prefix', 'meta', 0.90, 10, true),
  (NULL, 'Meta: facebook_ Prefix', 'Matches refcodes starting with "facebook_"', 'facebook_', 'prefix', 'meta', 0.90, 10, true),
  (NULL, 'Meta: instagram_ Prefix', 'Matches refcodes starting with "instagram_"', 'instagram_', 'prefix', 'meta', 0.90, 10, true);

-- SMS patterns (90% confidence - Tier 2 High Probability)
INSERT INTO public.attribution_rules (organization_id, name, description, pattern, rule_type, platform, confidence_score, priority, is_active)
VALUES
  (NULL, 'SMS: txt Prefix', 'Matches refcodes starting with "txt" (e.g., txt2donate)', 'txt', 'prefix', 'sms', 0.90, 10, true),
  (NULL, 'SMS: sms Prefix', 'Matches refcodes starting with "sms"', 'sms', 'prefix', 'sms', 0.90, 10, true),
  (NULL, 'SMS: text_ Prefix', 'Matches refcodes starting with "text_"', 'text_', 'prefix', 'sms', 0.90, 10, true);

-- Email patterns (90% confidence - Tier 2 High Probability)
INSERT INTO public.attribution_rules (organization_id, name, description, pattern, rule_type, platform, confidence_score, priority, is_active)
VALUES
  (NULL, 'Email: em Prefix', 'Matches refcodes starting with "em" (e.g., em_newsletter)', 'em', 'prefix', 'email', 0.90, 10, true),
  (NULL, 'Email: email Prefix', 'Matches refcodes starting with "email"', 'email', 'prefix', 'email', 0.90, 10, true),
  (NULL, 'Email: mail_ Prefix', 'Matches refcodes starting with "mail_"', 'mail_', 'prefix', 'email', 0.90, 10, true),
  (NULL, 'Email: newsletter Prefix', 'Matches refcodes starting with "newsletter"', 'newsletter', 'prefix', 'email', 0.90, 10, true);

-- ============================================================================
-- Step 6: Drop the per-org seeding function (no longer needed)
-- ============================================================================
DROP FUNCTION IF EXISTS public.seed_default_attribution_rules(UUID);

-- ============================================================================
-- Step 7: Add helpful comments
-- ============================================================================
COMMENT ON TABLE public.attribution_rules IS
'System-wide attribution rules for pattern-based refcode attribution.

organization_id = NULL → Global rule (applies to ALL organizations)
organization_id = UUID → Org-specific override (rare, takes precedence over global)

Rules are evaluated in priority order (lower = higher priority).
The Attribution Waterfall checks org-specific rules first, then global rules.';

COMMENT ON COLUMN public.attribution_rules.organization_id IS
'NULL = Global rule (applies to all orgs). UUID = Org-specific override.';
