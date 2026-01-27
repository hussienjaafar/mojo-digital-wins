-- Drop the old 6-parameter overload that uses NUMERIC type
-- This resolves PGRST203 ambiguity error
DROP FUNCTION IF EXISTS get_creative_intelligence(UUID, DATE, DATE, INT, INT, NUMERIC);