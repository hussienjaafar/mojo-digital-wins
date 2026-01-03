-- Add is_deterministic flag to campaign_attribution table
-- This explicitly marks whether attribution was determined by a hard match (refcode, click_id, fbclid)
-- vs probabilistic/timing correlation

ALTER TABLE public.campaign_attribution 
ADD COLUMN IF NOT EXISTS is_deterministic boolean DEFAULT false;

-- Add attribution_type enum-like column for clarity
ALTER TABLE public.campaign_attribution 
ADD COLUMN IF NOT EXISTS attribution_type text DEFAULT 'unknown';

-- Add comment for documentation
COMMENT ON COLUMN public.campaign_attribution.is_deterministic IS 'True if attribution was via hard match (refcode, click_id, fbclid). False for probabilistic/timing correlation.';
COMMENT ON COLUMN public.campaign_attribution.attribution_type IS 'Type of attribution: deterministic_refcode, deterministic_clickid, probabilistic_touchpoint, probabilistic_timing, channel_correlation, unknown';

-- Update existing records: mark refcode-based as deterministic
UPDATE public.campaign_attribution 
SET is_deterministic = true, 
    attribution_type = 'deterministic_refcode'
WHERE refcode IS NOT NULL 
  AND refcode NOT LIKE 'prob_%';

-- Mark probabilistic records appropriately  
UPDATE public.campaign_attribution 
SET is_deterministic = false,
    attribution_type = CASE 
      WHEN match_reason ILIKE '%touchpoint%' THEN 'probabilistic_touchpoint'
      WHEN match_reason ILIKE '%timing%' THEN 'probabilistic_timing'
      ELSE 'probabilistic_timing'
    END
WHERE refcode LIKE 'prob_%' 
   OR is_auto_matched = true;

-- Add index for filtering by attribution type
CREATE INDEX IF NOT EXISTS idx_campaign_attribution_deterministic 
ON public.campaign_attribution(organization_id, is_deterministic);

-- Also add is_deterministic to attribution_model_log if not exists
ALTER TABLE public.attribution_model_log 
ADD COLUMN IF NOT EXISTS attribution_type text;