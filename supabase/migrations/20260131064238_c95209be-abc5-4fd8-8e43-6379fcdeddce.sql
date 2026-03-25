-- Allow anonymous users to also read voter impact data (it's public electoral data)
CREATE POLICY "Anyone can view voter impact states"
ON public.voter_impact_states
FOR SELECT
USING (true);

CREATE POLICY "Anyone can view voter impact districts"
ON public.voter_impact_districts
FOR SELECT
USING (true);

-- Drop the more restrictive authenticated-only policies since we now allow public access
DROP POLICY IF EXISTS "Authenticated users can view voter impact states" ON public.voter_impact_states;
DROP POLICY IF EXISTS "Authenticated users can view voter impact districts" ON public.voter_impact_districts;