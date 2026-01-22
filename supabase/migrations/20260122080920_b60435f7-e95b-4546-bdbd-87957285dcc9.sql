-- Add new columns to meta_creative_variations for enhanced ranking
-- Based on Gemini Pro's Meta API best practices

ALTER TABLE meta_creative_variations 
ADD COLUMN IF NOT EXISTS cpa numeric,
ADD COLUMN IF NOT EXISTS purchases integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reach integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ranking_method text,
ADD COLUMN IF NOT EXISTS inline_link_clicks integer DEFAULT 0;

-- Add index for performance ranking queries
CREATE INDEX IF NOT EXISTS idx_meta_creative_variations_ranking 
ON meta_creative_variations (organization_id, ad_id, asset_type, performance_rank);

COMMENT ON COLUMN meta_creative_variations.cpa IS 'Cost Per Acquisition (spend / purchases) - primary ranking metric';
COMMENT ON COLUMN meta_creative_variations.purchases IS 'Number of purchase conversions for this variation';
COMMENT ON COLUMN meta_creative_variations.reach IS 'Unique users reached by this variation';
COMMENT ON COLUMN meta_creative_variations.ranking_method IS 'Which metric was used for ranking: cpa or ctr';
COMMENT ON COLUMN meta_creative_variations.inline_link_clicks IS 'Link clicks for this variation (fallback for CTR calculation)';