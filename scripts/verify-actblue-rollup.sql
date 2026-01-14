-- ============================================================================
-- ActBlue Metrics Verification Script
-- Purpose: Compare raw transaction sums with rollup/dashboard output
-- Usage: Run with Supabase SQL Editor, replacing :org_id and date params
-- ============================================================================

-- Set parameters (replace these in your SQL client)
-- :org_id = 'your-organization-uuid'
-- :start_date = '2025-01-01'
-- :end_date = '2025-01-14'
-- :org_timezone = 'America/New_York'

-- ============================================================================
-- 1. RAW TRANSACTION BREAKDOWN BY DAY (UTC bucketing)
-- Shows how transactions bucket when using UTC dates
-- ============================================================================
WITH raw_daily_utc AS (
  SELECT
    DATE(transaction_date) AS day_utc,
    transaction_type,
    COUNT(*) AS tx_count,
    SUM(amount) AS gross_amount,
    SUM(COALESCE(fee, 0)) AS total_fees,
    SUM(COALESCE(net_amount, amount - COALESCE(fee, 0))) AS net_amount
  FROM actblue_transactions
  WHERE organization_id = :org_id
    AND transaction_date >= :start_date::date
    AND transaction_date < (:end_date::date + INTERVAL '1 day')
  GROUP BY DATE(transaction_date), transaction_type
  ORDER BY day_utc, transaction_type
)
SELECT
  'UTC Bucketing' AS bucket_method,
  day_utc AS day,
  COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN tx_count END), 0) AS donation_count,
  COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN gross_amount END), 0) AS gross_donations,
  COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN net_amount END), 0) AS net_donations,
  COALESCE(SUM(CASE WHEN transaction_type IN ('refund', 'cancellation') THEN ABS(net_amount) END), 0) AS refunds,
  COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN net_amount END), 0)
    - COALESCE(SUM(CASE WHEN transaction_type IN ('refund', 'cancellation') THEN ABS(net_amount) END), 0) AS net_revenue
FROM raw_daily_utc
GROUP BY day_utc
ORDER BY day_utc;

-- ============================================================================
-- 2. RAW TRANSACTION BREAKDOWN BY DAY (Org Timezone bucketing)
-- Shows how transactions bucket when using org timezone
-- ============================================================================
WITH raw_daily_tz AS (
  SELECT
    DATE(transaction_date AT TIME ZONE :org_timezone) AS day_local,
    transaction_type,
    COUNT(*) AS tx_count,
    SUM(amount) AS gross_amount,
    SUM(COALESCE(fee, 0)) AS total_fees,
    SUM(COALESCE(net_amount, amount - COALESCE(fee, 0))) AS net_amount
  FROM actblue_transactions
  WHERE organization_id = :org_id
    AND DATE(transaction_date AT TIME ZONE :org_timezone) >= :start_date::date
    AND DATE(transaction_date AT TIME ZONE :org_timezone) <= :end_date::date
  GROUP BY DATE(transaction_date AT TIME ZONE :org_timezone), transaction_type
  ORDER BY day_local, transaction_type
)
SELECT
  'Org Timezone Bucketing' AS bucket_method,
  day_local AS day,
  COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN tx_count END), 0) AS donation_count,
  COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN gross_amount END), 0) AS gross_donations,
  COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN net_amount END), 0) AS net_donations,
  COALESCE(SUM(CASE WHEN transaction_type IN ('refund', 'cancellation') THEN ABS(net_amount) END), 0) AS refunds,
  COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN net_amount END), 0)
    - COALESCE(SUM(CASE WHEN transaction_type IN ('refund', 'cancellation') THEN ABS(net_amount) END), 0) AS net_revenue
FROM raw_daily_tz
GROUP BY day_local
ORDER BY day_local;

-- ============================================================================
-- 3. DAILY_AGGREGATED_METRICS TABLE VALUES
-- Compare against what calculate-roi stored
-- ============================================================================
SELECT
  'daily_aggregated_metrics' AS source,
  date AS day,
  total_donations AS donation_count,
  total_funds_raised AS total_funds_raised_net,
  new_donors,
  roi_percentage,
  calculated_at
FROM daily_aggregated_metrics
WHERE organization_id = :org_id
  AND date >= :start_date::date
  AND date <= :end_date::date
ORDER BY date;

-- ============================================================================
-- 4. TRANSACTIONS THAT SHIFT DAYS BETWEEN UTC AND ORG TIMEZONE
-- Identifies transactions at day boundaries that could cause discrepancies
-- ============================================================================
SELECT
  transaction_id,
  transaction_type,
  amount,
  transaction_date AS transaction_date_utc,
  DATE(transaction_date) AS day_utc,
  DATE(transaction_date AT TIME ZONE :org_timezone) AS day_local,
  CASE
    WHEN DATE(transaction_date) != DATE(transaction_date AT TIME ZONE :org_timezone)
    THEN 'SHIFTS DAY'
    ELSE 'same day'
  END AS day_shift_status
FROM actblue_transactions
WHERE organization_id = :org_id
  AND transaction_date >= :start_date::date
  AND transaction_date < (:end_date::date + INTERVAL '1 day')
  AND DATE(transaction_date) != DATE(transaction_date AT TIME ZONE :org_timezone)
ORDER BY transaction_date;

-- ============================================================================
-- 5. DUPLICATE DETECTION
-- Find potential duplicates by transaction_id, lineitem_id, receipt_id
-- ============================================================================
SELECT
  'Duplicate by transaction_id' AS issue_type,
  transaction_id,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id) AS row_ids
FROM actblue_transactions
WHERE organization_id = :org_id
GROUP BY transaction_id
HAVING COUNT(*) > 1;

-- Check for near-duplicates (same donor, amount, close time)
SELECT
  'Near-duplicate (same donor/amount within 1 minute)' AS issue_type,
  donor_email,
  amount,
  MIN(transaction_date) AS first_tx,
  MAX(transaction_date) AS last_tx,
  COUNT(*) AS tx_count,
  ARRAY_AGG(transaction_id) AS transaction_ids
FROM actblue_transactions
WHERE organization_id = :org_id
  AND transaction_date >= :start_date::date
  AND transaction_date < (:end_date::date + INTERVAL '1 day')
  AND transaction_type = 'donation'
GROUP BY donor_email, amount, DATE_TRUNC('minute', transaction_date)
HAVING COUNT(*) > 1;

-- ============================================================================
-- 6. PERIOD SUMMARY COMPARISON
-- Single-row summary for the entire period to compare with dashboard KPIs
-- ============================================================================
SELECT
  'Period Summary (Raw Transactions)' AS source,
  COUNT(*) FILTER (WHERE transaction_type = 'donation') AS donation_count,
  SUM(amount) FILTER (WHERE transaction_type = 'donation') AS gross_raised,
  SUM(COALESCE(net_amount, amount - COALESCE(fee, 0))) FILTER (WHERE transaction_type = 'donation') AS net_raised,
  SUM(COALESCE(fee, 0)) FILTER (WHERE transaction_type = 'donation') AS total_fees,
  SUM(ABS(COALESCE(net_amount, amount))) FILTER (WHERE transaction_type IN ('refund', 'cancellation')) AS total_refunds,
  SUM(COALESCE(net_amount, amount - COALESCE(fee, 0))) FILTER (WHERE transaction_type = 'donation')
    - COALESCE(SUM(ABS(COALESCE(net_amount, amount))) FILTER (WHERE transaction_type IN ('refund', 'cancellation')), 0) AS net_revenue,
  COUNT(DISTINCT donor_email) FILTER (WHERE transaction_type = 'donation') AS unique_donors
FROM actblue_transactions
WHERE organization_id = :org_id
  AND transaction_date >= :start_date::date
  AND transaction_date < (:end_date::date + INTERVAL '1 day');

-- Compare with daily_aggregated_metrics totals
SELECT
  'Period Summary (daily_aggregated_metrics)' AS source,
  SUM(total_donations) AS donation_count,
  SUM(total_funds_raised) AS total_funds_raised_net,
  SUM(new_donors) AS new_donors_sum
FROM daily_aggregated_metrics
WHERE organization_id = :org_id
  AND date >= :start_date::date
  AND date <= :end_date::date;
