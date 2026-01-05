-- ============================================================================
-- Suggested Actions System Overhaul
-- Decision-grade scoring, compliance, multi-variant support
-- ============================================================================

-- 1. Add decision scoring columns to suggested_actions
ALTER TABLE suggested_actions 
ADD COLUMN IF NOT EXISTS decision_score INTEGER,
ADD COLUMN IF NOT EXISTS opportunity_score INTEGER,
ADD COLUMN IF NOT EXISTS fit_score INTEGER,
ADD COLUMN IF NOT EXISTS risk_score INTEGER,
ADD COLUMN IF NOT EXISTS confidence_score INTEGER;

-- 2. Add compliance columns
ALTER TABLE suggested_actions 
ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS compliance_checks JSONB DEFAULT '{}';

-- 3. Add multi-variant support
ALTER TABLE suggested_actions 
ADD COLUMN IF NOT EXISTS variant_type TEXT,
ADD COLUMN IF NOT EXISTS variant_group_id UUID;

-- 4. Add rationale and deduplication
ALTER TABLE suggested_actions 
ADD COLUMN IF NOT EXISTS generation_rationale JSONB,
ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- 5. Add edit tracking
ALTER TABLE suggested_actions 
ADD COLUMN IF NOT EXISTS original_copy TEXT,
ADD COLUMN IF NOT EXISTS edited_copy TEXT,
ADD COLUMN IF NOT EXISTS was_edited BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS was_sent BOOLEAN DEFAULT false;

-- 6. Create unique index on dedupe_key (allowing nulls for existing records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_suggested_actions_dedupe_key 
ON suggested_actions (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 7. Add index for variant grouping
CREATE INDEX IF NOT EXISTS idx_suggested_actions_variant_group 
ON suggested_actions (variant_group_id) WHERE variant_group_id IS NOT NULL;

-- 8. Add index for decision score queries
CREATE INDEX IF NOT EXISTS idx_suggested_actions_decision_score 
ON suggested_actions (decision_score DESC) WHERE decision_score IS NOT NULL;

-- 9. Enhance org_feedback_events with reason codes
ALTER TABLE org_feedback_events 
ADD COLUMN IF NOT EXISTS reason_code TEXT,
ADD COLUMN IF NOT EXISTS reason_detail TEXT,
ADD COLUMN IF NOT EXISTS edited_final_copy TEXT,
ADD COLUMN IF NOT EXISTS copy_diff TEXT;

-- 10. Create pipeline_health_snapshots table
CREATE TABLE IF NOT EXISTS pipeline_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ DEFAULT now(),
  match_watchlist_status TEXT NOT NULL DEFAULT 'unknown',
  match_watchlist_last_run TIMESTAMPTZ,
  match_watchlist_last_error TEXT,
  match_watchlist_alerts_created INTEGER DEFAULT 0,
  generate_actions_status TEXT NOT NULL DEFAULT 'unknown',
  generate_actions_last_run TIMESTAMPTZ,
  generate_actions_last_error TEXT,
  generate_actions_count INTEGER DEFAULT 0,
  actionable_alerts_24h INTEGER DEFAULT 0,
  actions_generated_24h INTEGER DEFAULT 0,
  ai_generated_count INTEGER DEFAULT 0,
  template_generated_count INTEGER DEFAULT 0,
  organization_id UUID REFERENCES client_organizations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Enable RLS on pipeline_health_snapshots
ALTER TABLE pipeline_health_snapshots ENABLE ROW LEVEL SECURITY;

-- 12. RLS policies for pipeline_health_snapshots
CREATE POLICY "Users can view their org's pipeline health" 
ON pipeline_health_snapshots 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM client_users WHERE id = auth.uid()
  )
);

-- 13. Fix stalled scheduled jobs - reset next_run_at to now
UPDATE scheduled_jobs 
SET next_run_at = NOW()
WHERE job_type IN ('match_entity_watchlist', 'generate_suggested_actions');

-- 14. Add configurable thresholds to org_alert_preferences
ALTER TABLE org_alert_preferences 
ADD COLUMN IF NOT EXISTS min_decision_score INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS always_generate_safe_variant BOOLEAN DEFAULT true;

-- 15. Add last_error column to action_generator_runs if not exists
ALTER TABLE action_generator_runs 
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- 16. Enable realtime for pipeline_health_snapshots
ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_health_snapshots;