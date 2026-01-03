
-- Gate B Fix: Add UNIQUE constraint on (organization_id, refcode) to prevent duplicates
-- This ensures idempotency: matcher upserts won't create duplicate rows

-- First, ensure no duplicates exist (they don't based on our check)
-- Then add the constraint
ALTER TABLE public.campaign_attribution 
ADD CONSTRAINT campaign_attribution_org_refcode_unique 
UNIQUE (organization_id, refcode);

-- Gate A Fix: Clean up legacy probabilistic_timing records
-- Either delete them or update them to proper heuristic type
UPDATE public.campaign_attribution
SET attribution_type = 'heuristic_fuzzy'
WHERE attribution_type = 'probabilistic_timing'
  AND is_deterministic = false;

-- Add a comment explaining table purpose
COMMENT ON TABLE public.campaign_attribution IS 
'Canonical mapping table: refcode → campaign attribution. 
- is_deterministic=true: Verified URL-based match, authoritative for reporting
- is_deterministic=false: Heuristic/inferred, use for directional insights only
- Unique on (organization_id, refcode) to prevent duplicates';
