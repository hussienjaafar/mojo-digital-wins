-- Add missing organization_abbrev column to organization_mentions table
ALTER TABLE public.organization_mentions 
ADD COLUMN IF NOT EXISTS organization_abbrev TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_organization_mentions_abbrev 
ON public.organization_mentions(organization_abbrev);

-- Update existing records to extract abbreviations (best effort)
UPDATE public.organization_mentions
SET organization_abbrev = CASE
  WHEN organization_name ILIKE '%CAIR%' THEN 'CAIR'
  WHEN organization_name ILIKE '%MPAC%' THEN 'MPAC'
  WHEN organization_name ILIKE '%ISNA%' THEN 'ISNA'
  WHEN organization_name ILIKE '%ADC%' THEN 'ADC'
  WHEN organization_name ILIKE '%AAI%' THEN 'AAI'
  WHEN organization_name ILIKE '%MAS%' THEN 'MAS'
  WHEN organization_name ILIKE '%ICNA%' THEN 'ICNA'
  WHEN organization_name ILIKE '%ACLU%' THEN 'ACLU'
  WHEN organization_name ILIKE '%NAIT%' THEN 'NAIT'
  ELSE NULL
END
WHERE organization_abbrev IS NULL;