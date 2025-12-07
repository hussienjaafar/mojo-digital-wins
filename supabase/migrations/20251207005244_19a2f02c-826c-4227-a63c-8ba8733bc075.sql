-- Add destination URL and extracted refcode columns to meta_creative_insights
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS destination_url text;
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS extracted_refcode text;
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS refcode_source text;

-- Create index for faster refcode matching
CREATE INDEX IF NOT EXISTS idx_meta_creative_refcode ON meta_creative_insights(extracted_refcode) WHERE extracted_refcode IS NOT NULL;

-- Create index for destination URL lookups
CREATE INDEX IF NOT EXISTS idx_meta_creative_destination_url ON meta_creative_insights(destination_url) WHERE destination_url IS NOT NULL;