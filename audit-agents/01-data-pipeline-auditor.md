# Data Pipeline Quality Auditor

**Role:** Data Engineer / QA Specialist
**Audit Type:** Technical Quality Assurance
**Reference:** [ML-Architects Testing & QA](https://ml-architects.ch/blog_posts/testing_and_quality_assurance.html), [Monte Carlo Data Quality Audits](https://www.montecarlodata.com/blog-how-to-conduct-data-quality-audits/)

## Audit Objectives

1. Verify data ingestion pipelines are working correctly
2. Check for data quality issues (NULLs, schema violations, duplicates)
3. Validate deduplication mechanisms
4. Ensure data freshness and completeness
5. Verify data transformations are correct

## Audit Checklist

### 1. Schema Integrity Checks

**Files to Examine:**
- `supabase/migrations/20260119034328_news_trends_overhaul.sql`
- `src/integrations/supabase/types.ts`

**Checks:**
- [ ] All new tables have proper primary keys
- [ ] Foreign key constraints are correctly defined
- [ ] Index definitions are appropriate for query patterns
- [ ] Column types match expected data
- [ ] DEFAULT values are sensible
- [ ] NOT NULL constraints are applied where needed

**SQL Validation Queries:**
```sql
-- Check for tables without primary keys
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name NOT IN (
  SELECT tc.table_name FROM information_schema.table_constraints tc
  WHERE constraint_type = 'PRIMARY KEY'
);

-- Check for orphaned foreign keys
SELECT conname, conrelid::regclass AS table_name
FROM pg_constraint
WHERE confrelid = 0 AND contype = 'f';
```

### 2. Data Ingestion Validation

**Files to Examine:**
- `supabase/functions/bluesky-stream/index.ts`
- `supabase/functions/fetch-rss-feeds/index.ts`
- `supabase/functions/detect-trend-events/index.ts`

**Checks:**
- [ ] Error handling exists for malformed input
- [ ] Rate limiting is implemented
- [ ] Duplicate detection uses appropriate keys (content_hash, canonical_url)
- [ ] Timestamps are properly handled (UTC consistency)
- [ ] Batch sizes are reasonable (prevent memory issues)
- [ ] Retry logic exists for transient failures

### 3. Deduplication Effectiveness

**Files to Examine:**
- `supabase/functions/_shared/urlNormalizer.ts`
- `supabase/functions/detect-duplicates/index.ts`

**Checks:**
- [ ] URL normalization handles common variations (www, trailing slash, query params)
- [ ] Content hashing algorithm is collision-resistant
- [ ] Canonical URL extraction handles redirects
- [ ] Deduplication runs before trend aggregation
- [ ] Near-duplicate detection exists (fuzzy matching)

**Test Cases:**
```
Input URLs that should normalize to same canonical:
- https://www.example.com/article
- https://example.com/article/
- https://example.com/article?ref=twitter
- http://example.com/article
```

### 4. Policy Domain Tagging Accuracy

**Files to Examine:**
- `supabase/functions/tag-trend-policy-domains/index.ts`
- `supabase/functions/_shared/policyDomainKeywords.ts`
- `supabase/migrations/20260119034329_tag_rss_sources_policy_domains.sql`

**Checks:**
- [ ] All 12 policy domains are represented in keywords
- [ ] Keyword lists have sufficient coverage (50+ keywords per domain)
- [ ] No keyword collisions between domains
- [ ] Source-to-domain mapping is accurate
- [ ] Trends are tagged with multiple domains when appropriate

**Validation Query:**
```sql
-- Check domain distribution in tagged trends
SELECT
  unnest(policy_domains) as domain,
  COUNT(*) as trend_count
FROM trend_events
WHERE policy_domains IS NOT NULL AND policy_domains != '{}'
GROUP BY domain
ORDER BY trend_count DESC;

-- Find trends with no domains
SELECT COUNT(*) as untagged_count
FROM trend_events
WHERE policy_domains IS NULL OR policy_domains = '{}';
```

### 5. Geographic Tagging Accuracy

**Files to Examine:**
- `supabase/functions/tag-trend-geographies/index.ts`
- `supabase/functions/_shared/politicalEntities.ts`

**Checks:**
- [ ] State patterns cover all 50 states + DC + territories
- [ ] Major city mapping is accurate
- [ ] International locations are detected
- [ ] Geo level inference is correct (local < state < national < international)
- [ ] Multiple geographies are captured when mentioned

### 6. Data Freshness Monitoring

**Checks:**
- [ ] Scheduled jobs have appropriate intervals
- [ ] Stale data detection exists
- [ ] Data freshness indicators are accurate
- [ ] TTL cleanup removes old data appropriately

**Validation Query:**
```sql
-- Check data freshness by source
SELECT
  source_type,
  MAX(indexed_at) as latest_data,
  NOW() - MAX(indexed_at) as age
FROM trend_evidence
GROUP BY source_type;

-- Check scheduled job execution
SELECT job_name, last_run, next_run, is_enabled
FROM scheduled_jobs
WHERE function_name IN (
  'tag-trend-policy-domains',
  'tag-trend-geographies',
  'extract-trend-entities'
);
```

## Findings Template

### Finding: [TITLE]
**Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO
**Category:** Bug | Gap | Missed Opportunity
**File:** `path/to/file.ts:line`

**Description:**
[What was found]

**Evidence:**
[Code snippet, query result, or test case]

**Recommendation:**
[Specific fix]

**Effort:** Low | Medium | High

---

## Audit Execution Instructions

1. Read all files listed in each section
2. Execute validation queries against the database schema
3. Trace data flow from ingestion to storage
4. Document all findings using the template
5. Prioritize findings by severity
6. Generate summary report with actionable recommendations
