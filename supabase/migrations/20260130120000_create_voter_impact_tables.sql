-- Migration: Create voter impact tables for Muslim voter data visualization
-- This creates tables to store state-level and district-level voter impact data

-- ============================================================================
-- Table: voter_impact_states
-- Stores state-level Muslim voter statistics
-- ============================================================================
CREATE TABLE public.voter_impact_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code VARCHAR(2) UNIQUE NOT NULL,
  state_name VARCHAR(50) NOT NULL,
  muslim_voters INT NOT NULL DEFAULT 0,
  households INT NOT NULL DEFAULT 0,
  cell_phones INT NOT NULL DEFAULT 0,
  registered INT NOT NULL DEFAULT 0,
  registered_pct DECIMAL(8,6) NOT NULL DEFAULT 0,
  vote_2024 INT NOT NULL DEFAULT 0,
  vote_2024_pct DECIMAL(8,6) NOT NULL DEFAULT 0,
  vote_2022 INT NOT NULL DEFAULT 0,
  vote_2022_pct DECIMAL(8,6) NOT NULL DEFAULT 0,
  political_donors INT NOT NULL DEFAULT 0,
  political_activists INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE public.voter_impact_states IS 'State-level Muslim voter statistics for the voter impact map visualization';

-- ============================================================================
-- Table: voter_impact_districts
-- Stores congressional district-level Muslim voter statistics and election results
-- ============================================================================
CREATE TABLE public.voter_impact_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cd_code VARCHAR(10) UNIQUE NOT NULL, -- e.g., "CA-13"
  state_code VARCHAR(2) NOT NULL REFERENCES public.voter_impact_states(state_code),
  district_num INT NOT NULL,

  -- Election results
  winner VARCHAR(100),
  winner_party VARCHAR(20),
  winner_votes INT,
  runner_up VARCHAR(100),
  runner_up_party VARCHAR(20),
  runner_up_votes INT,
  margin_votes INT,
  margin_pct DECIMAL(10,8),
  total_votes INT,

  -- Muslim voter statistics
  muslim_voters INT NOT NULL DEFAULT 0,
  muslim_registered INT NOT NULL DEFAULT 0,
  muslim_unregistered INT NOT NULL DEFAULT 0,
  voted_2024 INT NOT NULL DEFAULT 0,
  didnt_vote_2024 INT NOT NULL DEFAULT 0,
  turnout_pct DECIMAL(8,6) NOT NULL DEFAULT 0,

  -- Impact potential
  can_impact BOOLEAN NOT NULL DEFAULT FALSE,
  votes_needed INT,
  cost_estimate DECIMAL(12,2),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE public.voter_impact_districts IS 'Congressional district-level Muslim voter statistics and election impact analysis';

-- ============================================================================
-- Indexes for voter_impact_districts
-- ============================================================================
CREATE INDEX idx_voter_impact_districts_state_code ON public.voter_impact_districts(state_code);
CREATE INDEX idx_voter_impact_districts_can_impact ON public.voter_impact_districts(can_impact);
CREATE INDEX idx_voter_impact_districts_margin_pct ON public.voter_impact_districts(margin_pct);

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================
ALTER TABLE public.voter_impact_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voter_impact_districts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies: Admin-only access
-- Uses existing has_role function and app_role enum from user_roles system
-- ============================================================================

-- Policies for voter_impact_states
CREATE POLICY "admin_read_voter_impact_states" ON public.voter_impact_states
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_insert_voter_impact_states" ON public.voter_impact_states
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_update_voter_impact_states" ON public.voter_impact_states
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_delete_voter_impact_states" ON public.voter_impact_states
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Policies for voter_impact_districts
CREATE POLICY "admin_read_voter_impact_districts" ON public.voter_impact_districts
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_insert_voter_impact_districts" ON public.voter_impact_districts
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_update_voter_impact_districts" ON public.voter_impact_districts
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_delete_voter_impact_districts" ON public.voter_impact_districts
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================================
-- Triggers for updated_at timestamps
-- Uses existing public.update_updated_at_column() function
-- ============================================================================
CREATE TRIGGER trigger_voter_impact_states_updated_at
  BEFORE UPDATE ON public.voter_impact_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_voter_impact_districts_updated_at
  BEFORE UPDATE ON public.voter_impact_districts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
