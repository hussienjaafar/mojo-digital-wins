-- Analytics view for tracking attribution quality over time
-- Shows ratio of full fbclid (deterministic) vs truncated (probabilistic) matches

CREATE OR REPLACE VIEW attribution_quality_metrics AS
SELECT
  organization_id,
  date_trunc('day', transaction_date::timestamptz) as date,
  COUNT(*) FILTER (WHERE refcode2 LIKE 'fb_%') as total_fb_donations,
  COUNT(*) FILTER (WHERE refcode2 LIKE 'fb_%' AND fbclid IS NOT NULL AND length(fbclid) > 50) as full_clickid_count,
  COUNT(*) FILTER (WHERE refcode2 LIKE 'fb_%' AND (fbclid IS NULL OR length(fbclid) <= 50)) as truncated_clickid_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE refcode2 LIKE 'fb_%' AND fbclid IS NOT NULL AND length(fbclid) > 50) 
    / NULLIF(COUNT(*) FILTER (WHERE refcode2 LIKE 'fb_%'), 0),
    2
  ) as full_clickid_pct,
  SUM(amount) FILTER (WHERE refcode2 LIKE 'fb_%') as total_fb_revenue,
  SUM(amount) FILTER (WHERE refcode2 LIKE 'fb_%' AND fbclid IS NOT NULL AND length(fbclid) > 50) as deterministic_revenue,
  SUM(amount) FILTER (WHERE refcode2 LIKE 'fb_%' AND (fbclid IS NULL OR length(fbclid) <= 50)) as probabilistic_revenue
FROM actblue_transactions
GROUP BY organization_id, date_trunc('day', transaction_date::timestamptz)
ORDER BY organization_id, date_trunc('day', transaction_date::timestamptz) DESC;

-- Grant access
GRANT SELECT ON attribution_quality_metrics TO authenticated;

-- Add index to improve query performance on fbclid length checks
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_fbclid_length 
ON actblue_transactions (organization_id, (length(fbclid)))
WHERE refcode2 LIKE 'fb_%';