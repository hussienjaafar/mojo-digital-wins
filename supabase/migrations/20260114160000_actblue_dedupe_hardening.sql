-- ============================================================================
-- ActBlue Dedupe Hardening Migration
-- Purpose: Prevent duplicate ingestion across webhook + CSV sync
-- ============================================================================

-- PHASE 1: Add receipt_id column if not exists
-- This allows us to track both identifiers separately for deduplication
ALTER TABLE public.actblue_transactions
ADD COLUMN IF NOT EXISTS receipt_id TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.actblue_transactions.receipt_id IS
  'ActBlue receipt ID from CSV exports. Different from lineitem_id but refers to same transaction.';

-- PHASE 2: Create index for faster duplicate detection
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_receipt_id
  ON public.actblue_transactions (organization_id, receipt_id)
  WHERE receipt_id IS NOT NULL;

-- PHASE 3: Create function to detect duplicates
CREATE OR REPLACE FUNCTION public.find_actblue_duplicates(_organization_id UUID)
RETURNS TABLE (
  duplicate_group INT,
  transaction_id TEXT,
  lineitem_id INT,
  receipt_id TEXT,
  amount NUMERIC,
  transaction_date TIMESTAMPTZ,
  donor_email TEXT,
  created_at TIMESTAMPTZ,
  row_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Find exact duplicates by transaction_id
  WITH tx_duplicates AS (
    SELECT
      t.transaction_id,
      COUNT(*) as cnt
    FROM public.actblue_transactions t
    WHERE t.organization_id = _organization_id
    GROUP BY t.transaction_id
    HAVING COUNT(*) > 1
  ),
  -- Find near-duplicates (same amount, donor, within 1 minute)
  near_duplicates AS (
    SELECT
      t1.id AS row1_id,
      t2.id AS row2_id,
      t1.transaction_id AS tx1,
      t2.transaction_id AS tx2
    FROM public.actblue_transactions t1
    JOIN public.actblue_transactions t2 ON
      t1.organization_id = t2.organization_id AND
      t1.id < t2.id AND
      t1.donor_email = t2.donor_email AND
      t1.amount = t2.amount AND
      ABS(EXTRACT(EPOCH FROM (t1.transaction_date - t2.transaction_date))) < 60 AND
      t1.transaction_id != t2.transaction_id
    WHERE t1.organization_id = _organization_id
      AND t1.transaction_type = 'donation'
      AND t2.transaction_type = 'donation'
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY t.transaction_id)::INT AS duplicate_group,
    t.transaction_id,
    t.lineitem_id,
    t.receipt_id,
    t.amount,
    t.transaction_date,
    t.donor_email,
    t.created_at,
    t.id AS row_id
  FROM public.actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND (
      -- Exact duplicates
      t.transaction_id IN (SELECT transaction_id FROM tx_duplicates)
      -- Or near duplicates
      OR t.id IN (SELECT row1_id FROM near_duplicates)
      OR t.id IN (SELECT row2_id FROM near_duplicates)
    )
  ORDER BY t.transaction_id, t.created_at;
$$;

COMMENT ON FUNCTION public.find_actblue_duplicates IS
  'Returns potential duplicate ActBlue transactions for an organization. '
  'Detects: (1) exact duplicates by transaction_id, (2) near-duplicates by same donor+amount within 1 minute.';

-- PHASE 4: Create function to merge/dedupe transactions
-- This keeps the older record (first ingested) and deletes newer duplicates
CREATE OR REPLACE FUNCTION public.merge_actblue_duplicates(
  _organization_id UUID,
  _dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  action TEXT,
  kept_transaction_id TEXT,
  deleted_transaction_id TEXT,
  deleted_row_id UUID,
  amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_count INT := 0;
BEGIN
  -- Verify user has admin access
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required to merge duplicates';
  END IF;

  RETURN QUERY
  WITH duplicates AS (
    SELECT
      t.transaction_id,
      t.id AS row_id,
      t.amount,
      t.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY t.transaction_id
        ORDER BY t.created_at ASC
      ) AS rn
    FROM public.actblue_transactions t
    WHERE t.organization_id = _organization_id
    GROUP BY t.transaction_id, t.id, t.amount, t.created_at
    HAVING COUNT(*) OVER (PARTITION BY t.transaction_id) > 1
  ),
  to_delete AS (
    SELECT
      d.transaction_id,
      d.row_id,
      d.amount,
      (SELECT transaction_id FROM duplicates WHERE rn = 1 AND transaction_id = d.transaction_id LIMIT 1) AS kept_tx_id
    FROM duplicates d
    WHERE d.rn > 1  -- Delete all but the first (oldest) record
  )
  SELECT
    CASE WHEN _dry_run THEN 'WOULD_DELETE' ELSE 'DELETED' END AS action,
    td.kept_tx_id AS kept_transaction_id,
    td.transaction_id AS deleted_transaction_id,
    td.row_id AS deleted_row_id,
    td.amount
  FROM to_delete td;

  -- Actually delete if not dry run
  IF NOT _dry_run THEN
    WITH duplicates AS (
      SELECT
        t.transaction_id,
        t.id AS row_id,
        ROW_NUMBER() OVER (
          PARTITION BY t.transaction_id
          ORDER BY t.created_at ASC
        ) AS rn
      FROM public.actblue_transactions t
      WHERE t.organization_id = _organization_id
      GROUP BY t.transaction_id, t.id, t.created_at
      HAVING COUNT(*) OVER (PARTITION BY t.transaction_id) > 1
    )
    DELETE FROM public.actblue_transactions
    WHERE id IN (
      SELECT row_id FROM duplicates WHERE rn > 1
    );

    GET DIAGNOSTICS _deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate records for organization %', _deleted_count, _organization_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.merge_actblue_duplicates IS
  'Merges duplicate ActBlue transactions by keeping the oldest record. '
  'Use dry_run=TRUE (default) to preview, dry_run=FALSE to actually delete duplicates.';

-- PHASE 5: Add net_amount column if not exists (calculated from amount - fee)
-- This ensures consistent net revenue calculations across all ingestion paths
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'actblue_transactions'
      AND column_name = 'net_amount'
  ) THEN
    ALTER TABLE public.actblue_transactions
    ADD COLUMN net_amount NUMERIC(10,2);
  END IF;
END $$;

-- Create trigger to auto-calculate net_amount when inserting/updating
CREATE OR REPLACE FUNCTION public.calculate_actblue_net_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate net_amount = amount - fee (if not already set)
  IF NEW.net_amount IS NULL AND NEW.amount IS NOT NULL THEN
    NEW.net_amount := NEW.amount - COALESCE(NEW.fee, 0);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (for idempotent migration)
DROP TRIGGER IF EXISTS trigger_calculate_net_amount ON public.actblue_transactions;

-- Create the trigger
CREATE TRIGGER trigger_calculate_net_amount
  BEFORE INSERT OR UPDATE ON public.actblue_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_actblue_net_amount();

-- PHASE 6: Backfill net_amount for existing records
UPDATE public.actblue_transactions
SET net_amount = amount - COALESCE(fee, 0)
WHERE net_amount IS NULL AND amount IS NOT NULL;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.find_actblue_duplicates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_actblue_duplicates(UUID, BOOLEAN) TO authenticated;
