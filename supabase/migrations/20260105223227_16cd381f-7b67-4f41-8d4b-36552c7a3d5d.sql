-- =============================================================================
-- FIX: Add missing columns to entity_watchlist for personalization
-- =============================================================================

-- Add missing columns to entity_watchlist
ALTER TABLE public.entity_watchlist
  ADD COLUMN IF NOT EXISTS geo_focus text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS context_keywords text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS disambiguation_hint text;

-- Add missing columns to organization_profiles for full personalization support
ALTER TABLE public.organization_profiles
  ADD COLUMN IF NOT EXISTS interest_topics text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stakeholders text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allies text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS opponents text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS priority_lanes text[] DEFAULT '{}';

-- Add index for entity alias matching
CREATE INDEX IF NOT EXISTS idx_entity_watchlist_org_active 
  ON entity_watchlist (organization_id, is_active) 
  WHERE is_active = true;

-- Create index for org_trend_scores lookup
CREATE INDEX IF NOT EXISTS idx_org_trend_scores_org_trend 
  ON org_trend_scores (organization_id, trend_event_id);

CREATE INDEX IF NOT EXISTS idx_org_trend_scores_computed 
  ON org_trend_scores (computed_at DESC);

-- Add trigger to auto-update updated_at on entity_watchlist
CREATE OR REPLACE FUNCTION update_entity_watchlist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_entity_watchlist_timestamp ON entity_watchlist;
CREATE TRIGGER update_entity_watchlist_timestamp
  BEFORE UPDATE ON entity_watchlist
  FOR EACH ROW
  EXECUTE FUNCTION update_entity_watchlist_timestamp();