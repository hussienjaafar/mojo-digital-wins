-- ============================================================================
-- Opportunities & Suggested Actions System Fix
-- ============================================================================

-- 1. Add missing columns to fundraising_opportunities
ALTER TABLE public.fundraising_opportunities 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS opportunity_type text DEFAULT 'trending',
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

-- Add index on status for filtering
CREATE INDEX IF NOT EXISTS idx_fundraising_opp_status ON public.fundraising_opportunities(status);

-- 2. Add missing columns to suggested_actions
ALTER TABLE public.suggested_actions
ADD COLUMN IF NOT EXISTS is_used boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_dismissed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS generation_method text DEFAULT 'template',
ADD COLUMN IF NOT EXISTS character_count integer,
ADD COLUMN IF NOT EXISTS estimated_impact text;

-- Add unique constraint for deduplication (organization_id + alert_id)
CREATE UNIQUE INDEX IF NOT EXISTS suggested_actions_org_alert_unique 
ON public.suggested_actions(organization_id, alert_id) 
WHERE alert_id IS NOT NULL;

-- Add index on status for filtering
CREATE INDEX IF NOT EXISTS idx_suggested_actions_status ON public.suggested_actions(status);
CREATE INDEX IF NOT EXISTS idx_suggested_actions_org_created ON public.suggested_actions(organization_id, created_at DESC);

-- 3. Create audit table for opportunity detector runs
CREATE TABLE IF NOT EXISTS public.opportunity_detector_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.client_organizations(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trends_processed integer DEFAULT 0,
  created_count integer DEFAULT 0,
  updated_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  expired_count integer DEFAULT 0,
  high_priority_count integer DEFAULT 0,
  medium_priority_count integer DEFAULT 0,
  low_priority_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  errors jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on opportunity_detector_runs
ALTER TABLE public.opportunity_detector_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for opportunity_detector_runs (service role only writes, org users can read their data)
CREATE POLICY "Users can view their org detector runs" 
ON public.opportunity_detector_runs 
FOR SELECT 
USING (
  organization_id IS NULL OR 
  organization_id = public.get_user_organization_id() OR 
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Create audit table for action generator runs
CREATE TABLE IF NOT EXISTS public.action_generator_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.client_organizations(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  alerts_processed integer DEFAULT 0,
  actions_created integer DEFAULT 0,
  ai_generated_count integer DEFAULT 0,
  template_generated_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  errors jsonb,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on action_generator_runs
ALTER TABLE public.action_generator_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for action_generator_runs
CREATE POLICY "Users can view their org generator runs" 
ON public.action_generator_runs 
FOR SELECT 
USING (
  organization_id IS NULL OR 
  organization_id = public.get_user_organization_id() OR 
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- 5. Add indexes for audit tables
CREATE INDEX IF NOT EXISTS idx_opp_detector_runs_org ON public.opportunity_detector_runs(organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_generator_runs_org ON public.action_generator_runs(organization_id, started_at DESC);