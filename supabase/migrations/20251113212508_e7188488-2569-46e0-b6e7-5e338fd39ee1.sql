-- Force types file regeneration by making a real schema change
-- Add and immediately remove a temporary column to trigger the sync system

-- Add temporary column
ALTER TABLE public.contact_submissions 
ADD COLUMN IF NOT EXISTS _force_types_sync_temp BOOLEAN DEFAULT false;

-- Remove it immediately  
ALTER TABLE public.contact_submissions 
DROP COLUMN IF EXISTS _force_types_sync_temp;

-- This should trigger the Lovable Cloud type generation system
-- because it detects an actual schema modification transaction