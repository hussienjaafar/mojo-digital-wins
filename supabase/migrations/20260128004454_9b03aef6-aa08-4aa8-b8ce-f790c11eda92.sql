-- Drop ALL overloads of the function (using CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS public.get_creative_intelligence(UUID, DATE, DATE, INT, INT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.get_creative_intelligence(UUID, DATE, DATE, INTEGER, INTEGER, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.get_creative_intelligence CASCADE;