
-- First create the deduplication function
CREATE OR REPLACE FUNCTION public.deduplicate_topic_name(topic_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
BEGIN
  normalized := lower(trim(topic_name));
  normalized := regexp_replace(normalized, '^(the|a|an)\s+', '', 'i');
  normalized := regexp_replace(normalized, '\s+(party|administration|government)$', '', 'i');
  RETURN normalized;
END;
$$;
