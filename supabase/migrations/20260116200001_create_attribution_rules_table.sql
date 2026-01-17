-- Migration: Create attribution_rules table for configurable pattern-based attribution
-- Purpose: Admin-configurable rules for mapping refcode patterns to platforms
-- Part of the Attribution Waterfall system upgrade

-- Create enum for rule types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attribution_rule_type') THEN
    CREATE TYPE public.attribution_rule_type AS ENUM (
      'regex',      -- Regular expression pattern (e.g., '^jp\d+.*')
      'prefix',     -- Simple prefix match (e.g., 'fb_')
      'suffix',     -- Simple suffix match
      'contains',   -- Contains substring
      'exact',      -- Exact match
      'fuzzy'       -- Fuzzy match with similarity threshold
    );
  END IF;
END $$;

-- Create enum for attribution confidence levels
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attribution_confidence_level') THEN
    CREATE TYPE public.attribution_confidence_level AS ENUM (
      'deterministic',    -- 100% confidence (click_id, exact refcode match)
      'high',             -- 85%+ confidence (pattern rules, explicit mappings)
      'medium',           -- 60-85% confidence (fuzzy match, temporal correlation)
      'low',              -- 40-60% confidence (weak signals)
      'none'              -- 0% - unattributed
    );
  END IF;
END $$;

-- Create the attribution_rules table
CREATE TABLE IF NOT EXISTS public.attribution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Rule definition
  name TEXT NOT NULL,                           -- Human-readable name (e.g., "JP Meta Campaign Refcodes")
  description TEXT,                              -- Optional description for admins
  pattern TEXT NOT NULL,                         -- The pattern to match (regex, prefix, etc.)
  rule_type public.attribution_rule_type NOT NULL DEFAULT 'prefix',

  -- Attribution output
  platform TEXT NOT NULL,                        -- Target platform: 'meta', 'sms', 'email', 'other'
  confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.85,  -- 0.00-1.00

  -- Rule ordering (lower = higher priority)
  priority INT NOT NULL DEFAULT 100,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT valid_platform CHECK (platform IN ('meta', 'sms', 'email', 'other')),
  CONSTRAINT unique_org_pattern UNIQUE (organization_id, pattern, rule_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_attribution_rules_org_active
ON public.attribution_rules(organization_id, is_active, priority);

CREATE INDEX IF NOT EXISTS idx_attribution_rules_platform
ON public.attribution_rules(organization_id, platform);

-- Enable RLS
ALTER TABLE public.attribution_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their org's attribution rules"
ON public.attribution_rules FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_organizations
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage their org's attribution rules"
ON public.attribution_rules FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_organizations
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_attribution_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attribution_rules_updated_at ON public.attribution_rules;
CREATE TRIGGER trg_attribution_rules_updated_at
  BEFORE UPDATE ON public.attribution_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_attribution_rules_updated_at();

-- Insert default rules for common patterns
-- These apply to all organizations (organization_id will be filled by the app)
-- We create a function to seed rules for new organizations

CREATE OR REPLACE FUNCTION public.seed_default_attribution_rules(p_organization_id UUID)
RETURNS void AS $$
BEGIN
  -- Meta patterns (high confidence - 90%)
  INSERT INTO public.attribution_rules (organization_id, name, pattern, rule_type, platform, confidence_score, priority)
  VALUES
    (p_organization_id, 'Meta: JP Campaign Prefix', '^jp', 'regex', 'meta', 0.90, 10),
    (p_organization_id, 'Meta: TH Campaign Prefix', '^th', 'regex', 'meta', 0.90, 10),
    (p_organization_id, 'Meta: meta_ Prefix', 'meta_', 'prefix', 'meta', 0.90, 10),
    (p_organization_id, 'Meta: fb_ Prefix', 'fb_', 'prefix', 'meta', 0.90, 10),
    (p_organization_id, 'Meta: ig_ Prefix', 'ig_', 'prefix', 'meta', 0.90, 10),
    (p_organization_id, 'Meta: facebook_ Prefix', 'facebook_', 'prefix', 'meta', 0.90, 10)
  ON CONFLICT (organization_id, pattern, rule_type) DO NOTHING;

  -- SMS patterns (high confidence - 90%)
  INSERT INTO public.attribution_rules (organization_id, name, pattern, rule_type, platform, confidence_score, priority)
  VALUES
    (p_organization_id, 'SMS: txt Prefix', 'txt', 'prefix', 'sms', 0.90, 10),
    (p_organization_id, 'SMS: sms Prefix', 'sms', 'prefix', 'sms', 0.90, 10)
  ON CONFLICT (organization_id, pattern, rule_type) DO NOTHING;

  -- Email patterns (high confidence - 90%)
  INSERT INTO public.attribution_rules (organization_id, name, pattern, rule_type, platform, confidence_score, priority)
  VALUES
    (p_organization_id, 'Email: em Prefix', 'em', 'prefix', 'email', 0.90, 10),
    (p_organization_id, 'Email: email Prefix', 'email', 'prefix', 'email', 0.90, 10)
  ON CONFLICT (organization_id, pattern, rule_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON TABLE public.attribution_rules IS 'Admin-configurable rules for pattern-based refcode attribution. Part of the Attribution Waterfall system.';
COMMENT ON COLUMN public.attribution_rules.priority IS 'Lower values = higher priority. Rules are evaluated in priority order.';
COMMENT ON COLUMN public.attribution_rules.confidence_score IS 'Confidence score 0.00-1.00. Deterministic=1.0, Pattern=0.85-0.95, Fuzzy=0.60-0.80';
