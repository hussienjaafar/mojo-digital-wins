# Schema Migration Agent

**Role:** Database Engineer / Migration Specialist
**Focus:** Create migrations for RLS policies and indexes
**Reference:** Supabase RLS Best Practices, PostgreSQL Performance

---

## Assigned Issues

| Priority | Issue | Migration Required |
|----------|-------|-------------------|
| MEDIUM | trend_filter_log missing user SELECT policy | RLS policy |
| LOW | Missing NOT NULL on priority_bucket | ALTER COLUMN |
| LOW | Missing index on campaign_type | CREATE INDEX |

---

## Task 1: Add trend_filter_log User SELECT Policy (MEDIUM)

### Migration File
```sql
-- File: supabase/migrations/20260119100000_add_filter_log_user_policy.sql

-- Add user SELECT policy for trend_filter_log
-- Users should be able to view filter logs for their own organization

-- First, check existing policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trend_filter_log'
    AND policyname = 'Users can view own org filter logs'
  ) THEN
    CREATE POLICY "Users can view own org filter logs"
    ON trend_filter_log FOR SELECT
    USING (
      organization_id IN (
        SELECT co.id
        FROM client_organizations co
        WHERE co.user_id = auth.uid()
      )
    );
  END IF;
END
$$;

-- Verify RLS is enabled on the table
ALTER TABLE trend_filter_log ENABLE ROW LEVEL SECURITY;

-- Add comment for documentation
COMMENT ON POLICY "Users can view own org filter logs" ON trend_filter_log IS
  'Allows authenticated users to view filter logs only for organizations they belong to';
```

### Verification Query
```sql
-- Check policy was created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'trend_filter_log';

-- Expected: Row with policyname = 'Users can view own org filter logs'
```

---

## Task 2: Add NOT NULL Constraint on priority_bucket (LOW)

### Investigation First
```sql
-- Check for existing NULL values
SELECT COUNT(*) as null_count
FROM trend_events
WHERE priority_bucket IS NULL;

-- If > 0, need to set defaults first
UPDATE trend_events
SET priority_bucket = 'MEDIUM'
WHERE priority_bucket IS NULL;
```

### Migration File
```sql
-- File: supabase/migrations/20260119100001_add_priority_bucket_not_null.sql

-- Set default value for any existing NULLs
UPDATE trend_events
SET priority_bucket = 'MEDIUM'
WHERE priority_bucket IS NULL;

-- Add NOT NULL constraint
ALTER TABLE trend_events
ALTER COLUMN priority_bucket SET NOT NULL;

-- Add default value for future inserts
ALTER TABLE trend_events
ALTER COLUMN priority_bucket SET DEFAULT 'MEDIUM';

-- Add check constraint to ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trend_events_priority_bucket_check'
  ) THEN
    ALTER TABLE trend_events
    ADD CONSTRAINT trend_events_priority_bucket_check
    CHECK (priority_bucket IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'));
  END IF;
END
$$;
```

### Verification Query
```sql
-- Check constraint exists
SELECT
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'trend_events'
AND column_name = 'priority_bucket';

-- Expected: is_nullable = 'NO'
```

---

## Task 3: Add Index on campaign_type (LOW)

### Analysis First
```sql
-- Check query patterns that would benefit
EXPLAIN ANALYZE
SELECT * FROM campaign_topic_extractions
WHERE campaign_type = 'email';

-- Check cardinality
SELECT campaign_type, COUNT(*) as count
FROM campaign_topic_extractions
GROUP BY campaign_type
ORDER BY count DESC;
```

### Migration File
```sql
-- File: supabase/migrations/20260119100002_add_campaign_type_index.sql

-- Add index on campaign_type for faster filtering
-- Using CONCURRENTLY to avoid table locks in production
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_topic_extractions_campaign_type
ON campaign_topic_extractions (campaign_type);

-- Also add composite index for common query pattern
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_topic_extractions_org_type
ON campaign_topic_extractions (organization_id, campaign_type);

-- Add index for baseline performance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_metrics_type_created
ON campaign_metrics (campaign_type, created_at DESC);
```

### Verification Query
```sql
-- Check indexes were created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('campaign_topic_extractions', 'campaign_metrics')
AND indexname LIKE '%campaign_type%';

-- Test query performance improvement
EXPLAIN ANALYZE
SELECT * FROM campaign_topic_extractions
WHERE campaign_type = 'email'
AND organization_id = 'test-org-id';
```

---

## Execution Order

Migrations should be run in this order:
1. `20260119100000_add_filter_log_user_policy.sql` - RLS policy (no dependencies)
2. `20260119100001_add_priority_bucket_not_null.sql` - Schema constraint
3. `20260119100002_add_campaign_type_index.sql` - Performance index

---

## Rollback Scripts

### Rollback Task 1
```sql
DROP POLICY IF EXISTS "Users can view own org filter logs" ON trend_filter_log;
```

### Rollback Task 2
```sql
ALTER TABLE trend_events ALTER COLUMN priority_bucket DROP NOT NULL;
ALTER TABLE trend_events ALTER COLUMN priority_bucket DROP DEFAULT;
ALTER TABLE trend_events DROP CONSTRAINT IF EXISTS trend_events_priority_bucket_check;
```

### Rollback Task 3
```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_campaign_topic_extractions_campaign_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_campaign_topic_extractions_org_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_campaign_metrics_type_created;
```

---

## Execution Checklist

- [ ] Task 1: Create and apply RLS policy migration
- [ ] Task 2: Create and apply NOT NULL migration
- [ ] Task 3: Create and apply index migration

## Post-Fix Verification

Run Data Pipeline Audit:
```bash
claude -p "Run audit-agents/01-data-pipeline-auditor.md on the News & Trends system"
```

Expected Results:
- RLS coverage: 100%
- All constraints applied
- Query performance improved
