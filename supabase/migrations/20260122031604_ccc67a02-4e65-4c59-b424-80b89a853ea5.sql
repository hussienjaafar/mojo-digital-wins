-- Add is_estimated column to track estimated vs actual metrics
ALTER TABLE public.meta_creative_variations
ADD COLUMN IF NOT EXISTS is_estimated boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.meta_creative_variations.is_estimated IS 'True if metrics are estimated from parent ad data (Meta API returned no asset-level breakdown)';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_meta_creative_variations_is_estimated 
ON public.meta_creative_variations(organization_id, is_estimated) 
WHERE is_estimated = true;