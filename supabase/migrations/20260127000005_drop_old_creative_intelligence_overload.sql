-- Fix PGRST203: Drop old 6-parameter overload of get_creative_intelligence
--
-- Two function signatures exist:
--   1. get_creative_intelligence(uuid, date, date, int, int, float) ← OLD (6 params)
--   2. get_creative_intelligence(uuid, date, date, int, int, float, float, int, int) ← NEW (9 params)
--
-- PostgREST cannot disambiguate when the client passes 6 parameters
-- because they match the first 6 params of BOTH functions.
-- Drop the old one so only the 9-parameter version (with defaults) remains.

DROP FUNCTION IF EXISTS get_creative_intelligence(UUID, DATE, DATE, INT, INT, FLOAT);
