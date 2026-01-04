-- ==========================================
-- Org-Specific Personalization Schema
-- ==========================================

-- 1. Extend organization_profiles with personalization fields
ALTER TABLE organization_profiles 
  ADD COLUMN IF NOT EXISTS org_type text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS primary_goals text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS geographies text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audiences text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS channels_enabled text[] DEFAULT ARRAY['sms'],
  ADD COLUMN IF NOT EXISTS sensitivity_redlines jsonb DEFAULT '{}';

-- Add check constraint for org_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_profiles_org_type_check'
  ) THEN
    ALTER TABLE organization_profiles 
      ADD CONSTRAINT organization_profiles_org_type_check 
      CHECK (org_type IS NULL OR org_type IN ('foreign_policy', 'human_rights', 'candidate', 'labor', 'climate', 'civil_rights', 'other'));
  END IF;
END $$;

-- 2. Create org_interest_topics table (weighted topics per org)
CREATE TABLE IF NOT EXISTS org_interest_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  topic text NOT NULL,
  weight numeric DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),
  source text DEFAULT 'self_declared' CHECK (source IN ('self_declared', 'learned_implicit', 'learned_outcome', 'admin_override')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, topic)
);

-- 3. Create org_interest_entities table (allow/deny lists)
CREATE TABLE IF NOT EXISTS org_interest_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  entity_name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('allow', 'deny')),
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, entity_name)
);

-- 4. Create org_alert_preferences table
CREATE TABLE IF NOT EXISTS org_alert_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE UNIQUE,
  min_relevance_score integer DEFAULT 60 CHECK (min_relevance_score >= 0 AND min_relevance_score <= 100),
  min_urgency_score integer DEFAULT 50 CHECK (min_urgency_score >= 0 AND min_urgency_score <= 100),
  max_alerts_per_day integer DEFAULT 6 CHECK (max_alerts_per_day >= 1 AND max_alerts_per_day <= 100),
  digest_mode text DEFAULT 'realtime' CHECK (digest_mode IN ('realtime', 'hourly_digest', 'daily_digest')),
  quiet_hours jsonb DEFAULT '{"enabled": false}',
  notify_channels text[] DEFAULT ARRAY['in_app'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Create org_feedback_events table (learning signals)
CREATE TABLE IF NOT EXISTS org_feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('viewed', 'copied', 'used', 'dismissed', 'completed', 'relevant_feedback', 'irrelevant_feedback', 'muted_topic', 'muted_entity')),
  object_type text NOT NULL CHECK (object_type IN ('opportunity', 'suggested_action')),
  object_id uuid NOT NULL,
  entity_name text,
  topic_tags text[] DEFAULT '{}',
  relevance_score_at_time integer,
  urgency_score_at_time integer,
  created_at timestamptz DEFAULT now()
);

-- Indexes for org_feedback_events
CREATE INDEX IF NOT EXISTS idx_feedback_org_created ON org_feedback_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_entity ON org_feedback_events(organization_id, entity_name);
CREATE INDEX IF NOT EXISTS idx_feedback_topics ON org_feedback_events USING GIN(topic_tags);

-- 6. Add personalization columns to fundraising_opportunities
ALTER TABLE fundraising_opportunities 
  ADD COLUMN IF NOT EXISTS org_relevance_score integer,
  ADD COLUMN IF NOT EXISTS org_relevance_reasons text[] DEFAULT '{}';

-- 7. Add personalization columns to suggested_actions
ALTER TABLE suggested_actions 
  ADD COLUMN IF NOT EXISTS org_relevance_score integer,
  ADD COLUMN IF NOT EXISTS org_relevance_reasons text[] DEFAULT '{}';

-- 8. Add last_seen_at to entity_trends for better time decay
ALTER TABLE entity_trends 
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Update existing rows to set last_seen_at if null
UPDATE entity_trends SET last_seen_at = first_seen_at WHERE last_seen_at IS NULL;

-- ==========================================
-- RLS Policies
-- ==========================================

-- Enable RLS on new tables
ALTER TABLE org_interest_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_interest_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_feedback_events ENABLE ROW LEVEL SECURITY;

-- org_interest_topics policies
CREATE POLICY "org_interest_topics_select" ON org_interest_topics 
  FOR SELECT TO authenticated 
  USING (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "org_interest_topics_insert" ON org_interest_topics 
  FOR INSERT TO authenticated 
  WITH CHECK (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "org_interest_topics_update" ON org_interest_topics 
  FOR UPDATE TO authenticated 
  USING (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "org_interest_topics_delete" ON org_interest_topics 
  FOR DELETE TO authenticated 
  USING (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

-- org_interest_entities policies
CREATE POLICY "org_interest_entities_select" ON org_interest_entities 
  FOR SELECT TO authenticated 
  USING (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "org_interest_entities_insert" ON org_interest_entities 
  FOR INSERT TO authenticated 
  WITH CHECK (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "org_interest_entities_update" ON org_interest_entities 
  FOR UPDATE TO authenticated 
  USING (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "org_interest_entities_delete" ON org_interest_entities 
  FOR DELETE TO authenticated 
  USING (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

-- org_alert_preferences policies
CREATE POLICY "org_alert_preferences_select" ON org_alert_preferences 
  FOR SELECT TO authenticated 
  USING (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "org_alert_preferences_insert" ON org_alert_preferences 
  FOR INSERT TO authenticated 
  WITH CHECK (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "org_alert_preferences_update" ON org_alert_preferences 
  FOR UPDATE TO authenticated 
  USING (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "org_alert_preferences_delete" ON org_alert_preferences 
  FOR DELETE TO authenticated 
  USING (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

-- org_feedback_events policies
CREATE POLICY "org_feedback_events_select" ON org_feedback_events 
  FOR SELECT TO authenticated 
  USING (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "org_feedback_events_insert" ON org_feedback_events 
  FOR INSERT TO authenticated 
  WITH CHECK (user_belongs_to_organization(organization_id) OR has_role(auth.uid(), 'admin'));

-- Feedback events are immutable (no update/delete for users)
CREATE POLICY "org_feedback_events_admin_manage" ON org_feedback_events 
  FOR ALL TO authenticated 
  USING (has_role(auth.uid(), 'admin'));

-- ==========================================
-- Audit table for learning algorithm runs
-- ==========================================
CREATE TABLE IF NOT EXISTS org_interest_model_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  orgs_processed integer DEFAULT 0,
  topics_updated integer DEFAULT 0,
  feedback_events_processed integer DEFAULT 0,
  error_count integer DEFAULT 0,
  errors jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE org_interest_model_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_interest_model_runs_admin" ON org_interest_model_runs 
  FOR ALL TO authenticated 
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "org_interest_model_runs_view" ON org_interest_model_runs 
  FOR SELECT TO authenticated 
  USING (true);

-- ==========================================
-- Updated timestamp triggers
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_org_interest_topics_updated_at ON org_interest_topics;
CREATE TRIGGER update_org_interest_topics_updated_at
  BEFORE UPDATE ON org_interest_topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_org_alert_preferences_updated_at ON org_alert_preferences;
CREATE TRIGGER update_org_alert_preferences_updated_at
  BEFORE UPDATE ON org_alert_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();