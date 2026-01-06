-- Phase 4: Add source_tier to trend_evidence for explainability
ALTER TABLE public.trend_evidence 
ADD COLUMN IF NOT EXISTS source_tier text CHECK (source_tier IN ('tier1', 'tier2', 'tier3'));

-- Add index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_trend_evidence_source_tier ON public.trend_evidence(source_tier);

-- Comment for documentation
COMMENT ON COLUMN public.trend_evidence.source_tier IS 'Source authority tier (tier1=official/government, tier2=national news, tier3=issue specialists)';