-- Backfill: Fix historical ActBlue transaction timestamps
-- These were stored as UTC but should have been interpreted as Eastern Time
-- Transactions between 00:00-04:59 UTC are likely 19:00-23:59 EST the previous day

-- Create a function to apply the correction
CREATE OR REPLACE FUNCTION fix_actblue_timestamp_offset()
RETURNS TABLE(corrected_count BIGINT) AS $$
DECLARE
  v_count BIGINT;
BEGIN
  -- Update transactions where the timestamp was likely misinterpreted
  -- We add 5 hours (EST offset) to correct the storage error
  -- Only affect transactions that appear to be in the problematic window
  -- and were created before the fix was deployed (Jan 26, 2026)
  
  WITH corrected AS (
    UPDATE actblue_transactions
    SET transaction_date = transaction_date + INTERVAL '5 hours'
    WHERE 
      -- Only transactions created before the fix
      created_at < '2026-01-26T07:00:00Z'
      -- Transactions in the 00:00-04:59 UTC window (19:00-23:59 EST previous day)
      AND EXTRACT(HOUR FROM transaction_date) BETWEEN 0 AND 4
      -- Only donations (not refunds which may have different timing)
      AND (transaction_type IS NULL OR transaction_type = 'donation')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM corrected;
  
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the fix
SELECT * FROM fix_actblue_timestamp_offset();

-- Log the result
DO $$
DECLARE
  v_result BIGINT;
BEGIN
  SELECT corrected_count INTO v_result FROM fix_actblue_timestamp_offset();
  RAISE NOTICE 'ActBlue timestamp backfill complete: % transactions corrected', v_result;
END $$;

-- Clean up - drop the function after use
DROP FUNCTION IF EXISTS fix_actblue_timestamp_offset();

-- Add a comment to document this migration
COMMENT ON TABLE actblue_transactions IS 'ActBlue donation transactions. Timestamps are stored in UTC. Historical data before Jan 26, 2026 was corrected via migration to fix EST→UTC interpretation error.';