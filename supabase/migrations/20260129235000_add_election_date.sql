-- ==========================================================
-- ADD ELECTION DATE COLUMNS TO client_organizations
--
-- Adds election countdown functionality for political campaigns:
-- - election_date: Target election date
-- - election_name: Custom label (e.g., "General Election", "Primary")
--
-- Reference: docs/plans/2026-01-29-creative-intelligence-v2-remediation.md
-- Task 6: Implement Political Campaign Features (Election Countdown)
-- ==========================================================

-- Add election date columns for political campaigns
ALTER TABLE client_organizations
  ADD COLUMN IF NOT EXISTS election_date DATE,
  ADD COLUMN IF NOT EXISTS election_name TEXT DEFAULT 'Election Day';

-- Add documentation comments
COMMENT ON COLUMN client_organizations.election_date IS 'Target election date for political campaign countdown tracking and urgency indicators';
COMMENT ON COLUMN client_organizations.election_name IS 'Name/label for the election (e.g., "General Election", "Primary Election", "Runoff")';
