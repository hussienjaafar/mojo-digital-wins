-- Minimal migration to trigger types file regeneration
-- This adds a harmless comment to the contact_submissions table

COMMENT ON TABLE public.contact_submissions IS 'Stores contact form submissions from the website';