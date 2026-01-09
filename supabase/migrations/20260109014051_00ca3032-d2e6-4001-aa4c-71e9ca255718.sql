-- Drop the old check constraint and add new one with expanded org types
ALTER TABLE public.organization_profiles 
DROP CONSTRAINT IF EXISTS organization_profiles_org_type_check;

ALTER TABLE public.organization_profiles 
ADD CONSTRAINT organization_profiles_org_type_check 
CHECK (
  (org_type IS NULL) OR (org_type = ANY (ARRAY[
    -- Legacy types for backwards compatibility
    'foreign_policy'::text, 
    'human_rights'::text, 
    'candidate'::text, 
    'labor'::text, 
    'climate'::text, 
    'civil_rights'::text, 
    'other'::text,
    -- New organization types
    'campaign_federal'::text,
    'campaign_state'::text,
    'campaign_local'::text,
    'c3_national'::text,
    'c3_state'::text,
    'c3_local'::text,
    'c4_national'::text,
    'c4_state'::text,
    'c4_local'::text,
    'pac_federal'::text,
    'pac_state'::text,
    'international'::text
  ]))
);