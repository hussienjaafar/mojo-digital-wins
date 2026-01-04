-- TASK 4: Mark attribution_touchpoints as legacy table
-- This table contains 1,265 legacy records with type='other'
-- It should NOT be used for attribution - campaign_attribution is the source of truth

COMMENT ON TABLE public.attribution_touchpoints IS 
'LEGACY TABLE - DO NOT USE FOR ATTRIBUTION. Contains legacy records with type="other". 
No new writes should occur. campaign_attribution is the canonical source of truth.
This table may be archived in a future migration. Created before deterministic URL-based attribution was implemented.';

-- Also add comment to the campaign_attribution table marking it as source of truth
COMMENT ON TABLE public.campaign_attribution IS 
'SOURCE OF TRUTH for refcode→campaign attribution. 
is_deterministic=true means URL-based exact match (confidence=1.0, never overwritten).
is_deterministic=false means heuristic match (suggestions only, excluded from default KPIs).
attribution_type values: deterministic_url_refcode, manual_confirmed, heuristic_partial_url, heuristic_pattern, heuristic_fuzzy.
IMMUTABILITY RULE: Deterministic records can only be modified via admin/manual flows.';