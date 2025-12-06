
-- Add columns for hybrid attribution matching system
ALTER TABLE public.campaign_attribution 
ADD COLUMN IF NOT EXISTS match_confidence numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_auto_matched boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS match_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_matched_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS attributed_revenue numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS attributed_transactions integer DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_campaign_attribution_refcode ON public.campaign_attribution(refcode);
CREATE INDEX IF NOT EXISTS idx_campaign_attribution_meta_campaign ON public.campaign_attribution(meta_campaign_id);

-- Create a view for unmatched refcodes that have revenue
CREATE OR REPLACE VIEW public.unmatched_refcodes AS
SELECT 
  at.refcode,
  at.organization_id,
  COUNT(*) as transaction_count,
  SUM(at.amount) as total_revenue,
  MIN(at.transaction_date) as first_seen,
  MAX(at.transaction_date) as last_seen
FROM actblue_transactions at
WHERE at.refcode IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campaign_attribution ca 
    WHERE ca.refcode = at.refcode 
    AND ca.organization_id = at.organization_id
  )
GROUP BY at.refcode, at.organization_id
ORDER BY total_revenue DESC;

-- Add comment explaining the view
COMMENT ON VIEW public.unmatched_refcodes IS 'Shows ActBlue refcodes that have revenue but no campaign attribution mapping';
