-- First, alter the platform check constraint to allow new platforms
ALTER TABLE refcode_attribution_rules DROP CONSTRAINT IF EXISTS refcode_attribution_rules_platform_check;

ALTER TABLE refcode_attribution_rules ADD CONSTRAINT refcode_attribution_rules_platform_check 
  CHECK (platform = ANY (ARRAY['meta'::text, 'google'::text, 'sms'::text, 'email'::text, 'direct'::text, 'organic'::text, 'other'::text, 'direct_mail'::text, 'website'::text, 'organic_social'::text, 'volunteer'::text]));

-- Add missing attribution rules (avoiding duplicates via unique constraint)
INSERT INTO refcode_attribution_rules (pattern, platform, priority, is_active, is_global, match_type, description)
VALUES
  -- Direct mail patterns  
  ('dm', 'direct_mail', 100, true, true, 'prefix', 'Direct mail refcodes starting with dm'),
  
  -- Website/organic patterns
  ('popup', 'website', 90, true, true, 'prefix', 'Website popup donation forms'),
  ('social', 'organic_social', 90, true, true, 'prefix', 'Organic social media traffic'),
  ('volunteer', 'volunteer', 90, true, true, 'prefix', 'Volunteer-driven donations'),
  
  -- SendGrid/email variant
  ('sg', 'email', 100, true, true, 'prefix', 'SendGrid email campaign refcodes'),
  
  -- Campaign-specific patterns
  ('ice', 'email', 100, true, true, 'prefix', 'ICE response email campaigns'),
  ('intro', 'meta', 80, true, true, 'prefix', 'Intro/awareness Meta ads'),
  
  -- Additional Meta patterns for Michael Blake
  ('gaza', 'meta', 100, true, true, 'prefix', 'Gaza-related Meta ads'),
  ('spint', 'meta', 100, true, true, 'prefix', 'Spin/targeted Meta ads'),
  ('img', 'meta', 100, true, true, 'prefix', 'Image Meta ads')
  
ON CONFLICT ON CONSTRAINT unique_org_pattern DO UPDATE SET
  platform = EXCLUDED.platform,
  priority = EXCLUDED.priority,
  is_active = true,
  updated_at = now();