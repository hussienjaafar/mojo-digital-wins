-- Migration: Add org-specific attribution rules for Michael Blake
-- Purpose: Recover ~$9.5K in Meta ad revenue with campaign-specific refcodes
--
-- These are NOT global patterns - they are specific to Michael Blake's campaign naming
-- Organization ID: a2b47f29-51ea-47da-b45e-f9f539c6811b

-- Michael Blake Meta ad refcodes (campaign-specific)
INSERT INTO public.attribution_rules (
  organization_id,
  name,
  description,
  pattern,
  rule_type,
  platform,
  confidence_score,
  priority,
  is_active
)
VALUES
  -- Gaza campaign refcodes
  (
    'a2b47f29-51ea-47da-b45e-f9f539c6811b',
    'Blake: Gaza Campaign',
    'Gaza-related Meta ad campaign refcodes (e.g., gaza0108)',
    'gaza',
    'prefix',
    'meta',
    0.95,
    5,  -- Higher priority than global rules
    true
  ),
  -- Image ad refcodes
  (
    'a2b47f29-51ea-47da-b45e-f9f539c6811b',
    'Blake: Image Ads',
    'Image-based Meta ad refcodes (e.g., img0108)',
    'img',
    'prefix',
    'meta',
    0.95,
    5,
    true
  ),
  -- Sponsored/Sprint ad refcodes
  (
    'a2b47f29-51ea-47da-b45e-f9f539c6811b',
    'Blake: Sponsored Ads',
    'Sponsored/sprint Meta ad refcodes (e.g., spint0108)',
    'spint',
    'prefix',
    'meta',
    0.95,
    5,
    true
  ),
  -- Intro campaign refcodes
  (
    'a2b47f29-51ea-47da-b45e-f9f539c6811b',
    'Blake: Intro Campaign',
    'Introductory campaign Meta ad refcodes (e.g., intro1217)',
    'intro',
    'prefix',
    'meta',
    0.95,
    5,
    true
  ),
  -- WeDeserve campaign
  (
    'a2b47f29-51ea-47da-b45e-f9f539c6811b',
    'Blake: WeDeserve Campaign',
    'WeDeserve campaign Meta ad refcodes',
    'wedeserve',
    'prefix',
    'meta',
    0.95,
    5,
    true
  ),
  -- Social campaign
  (
    'a2b47f29-51ea-47da-b45e-f9f539c6811b',
    'Blake: Social Ads',
    'Social media Meta ad refcodes',
    'social',
    'prefix',
    'meta',
    0.90,
    5,
    true
  )
ON CONFLICT DO NOTHING;

-- Verify the rules were added
-- SELECT * FROM attribution_rules WHERE organization_id = 'a2b47f29-51ea-47da-b45e-f9f539c6811b';
