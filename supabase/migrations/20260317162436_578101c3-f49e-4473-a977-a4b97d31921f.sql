-- Restore plain unique constraint on donor_demographics for Supabase JS onConflict compatibility
-- The functional index (lower/trim) remains for query optimization
ALTER TABLE public.donor_demographics
  ADD CONSTRAINT donor_demographics_org_donor_email_unique
  UNIQUE (organization_id, donor_email);