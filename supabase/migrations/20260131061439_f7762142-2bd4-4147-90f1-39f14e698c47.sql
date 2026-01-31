-- Create voter_impact_states table
CREATE TABLE IF NOT EXISTS public.voter_impact_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_code VARCHAR(2) NOT NULL UNIQUE,
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create voter_impact_districts table
CREATE TABLE IF NOT EXISTS public.voter_impact_districts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_code VARCHAR(10) NOT NULL UNIQUE,
  state_code VARCHAR(2) NOT NULL REFERENCES public.voter_impact_states(state_code),
  district_num INT NOT NULL,
  winner VARCHAR(100),
  winner_party VARCHAR(20),
  winner_votes INT,
  runner_up VARCHAR(100),
  runner_up_party VARCHAR(20),
  runner_up_votes INT,
  margin_votes INT,
  margin_pct DECIMAL(10,8),
  total_votes INT,
  muslim_voters INT NOT NULL DEFAULT 0,
  muslim_registered INT NOT NULL DEFAULT 0,
  muslim_unregistered INT NOT NULL DEFAULT 0,
  voted_2024 INT NOT NULL DEFAULT 0,
  didnt_vote_2024 INT NOT NULL DEFAULT 0,
  turnout_pct DECIMAL(8,6) NOT NULL DEFAULT 0,
  can_impact BOOLEAN NOT NULL DEFAULT false,
  votes_needed INT,
  cost_estimate DECIMAL(12,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_voter_impact_states_state_code ON public.voter_impact_states(state_code);
CREATE INDEX idx_voter_impact_districts_state_code ON public.voter_impact_districts(state_code);
CREATE INDEX idx_voter_impact_districts_can_impact ON public.voter_impact_districts(can_impact);

-- Enable RLS
ALTER TABLE public.voter_impact_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voter_impact_districts ENABLE ROW LEVEL SECURITY;

-- Create read policies (public read for authenticated users)
CREATE POLICY "Authenticated users can view voter impact states"
ON public.voter_impact_states
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view voter impact districts"
ON public.voter_impact_districts
FOR SELECT
TO authenticated
USING (true);

-- Create admin insert/update/delete policies
CREATE POLICY "Admins can insert voter impact states"
ON public.voter_impact_states
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update voter impact states"
ON public.voter_impact_states
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete voter impact states"
ON public.voter_impact_states
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert voter impact districts"
ON public.voter_impact_districts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update voter impact districts"
ON public.voter_impact_districts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete voter impact districts"
ON public.voter_impact_districts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create update trigger for timestamps
CREATE OR REPLACE FUNCTION public.update_voter_impact_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_voter_impact_states_updated_at
BEFORE UPDATE ON public.voter_impact_states
FOR EACH ROW
EXECUTE FUNCTION public.update_voter_impact_updated_at();

CREATE TRIGGER update_voter_impact_districts_updated_at
BEFORE UPDATE ON public.voter_impact_districts
FOR EACH ROW
EXECUTE FUNCTION public.update_voter_impact_updated_at();