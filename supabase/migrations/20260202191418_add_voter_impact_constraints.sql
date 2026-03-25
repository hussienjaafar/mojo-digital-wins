-- Migration: Add database integrity constraints for voter_impact_districts
-- These constraints ensure data consistency in voter impact calculations

-- Ensure registered voters don't exceed total voters
ALTER TABLE public.voter_impact_districts
ADD CONSTRAINT chk_registration
CHECK (muslim_registered <= muslim_voters);

-- Ensure vote accounting is consistent (with tolerance for rounding)
ALTER TABLE public.voter_impact_districts
ADD CONSTRAINT chk_vote_accounting
CHECK (ABS(voted_2024 + didnt_vote_2024 - muslim_registered) <= 10);

-- Ensure unregistered calculation is consistent
ALTER TABLE public.voter_impact_districts
ADD CONSTRAINT chk_unregistered
CHECK (ABS(muslim_unregistered - (muslim_voters - muslim_registered)) <= 10);
