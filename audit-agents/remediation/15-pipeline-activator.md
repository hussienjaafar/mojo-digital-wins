# Pipeline Activator

**Role:** Data Engineer / Operations
**Focus:** Manual pipeline triggering, data flow verification
**Priority:** CRITICAL
**Estimated Time:** 1-2 hours
**Dependencies:** `14-scheduler-remediator.md` must be complete

---

## Overview

This agent manually triggers all pipeline stages to populate data immediately, rather than waiting for scheduled execution. This is essential for:

1. Immediate data population after scheduler setup
2. Debugging pipeline issues
3. Verifying end-to-end data flow

---

## Prerequisites

- [ ] `14-scheduler-remediator.md` completed
- [ ] Service role key available
- [ ] CRON_SECRET set in environment

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  INGESTION LAYER                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ fetch-google-   │  │ fetch-rss-      │  │ collect-        │     │
│  │ news            │  │ feeds           │  │ bluesky-posts   │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
│           │                    │                    │               │
│           └─────────────┬──────┴────────────────────┘               │
│                         ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    trend_evidence                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                         │                                           │
│  PROCESSING LAYER       ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               detect-trend-events                            │   │
│  │         (Sets is_trending flags, calculates scores)          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                         │                                           │
│           ┌─────────────┼─────────────┐                            │
│           ▼             ▼             ▼                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │ extract-     │ │ tag-trend-   │ │ tag-trend-   │               │
│  │ entities     │ │ domains      │ │ geographies  │               │
│  └──────────────┘ └──────────────┘ └──────────────┘               │
│                         │                                           │
│  SCORING LAYER          ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              compute-org-relevance                           │   │
│  │         (Creates org_trend_scores for personalization)       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Activation

### Step 1: Check Current Pipeline State

```sql
-- Pipeline health diagnostic
SELECT
  'trend_evidence' as stage,
  COUNT(*) as count_24h,
  MAX(discovered_at) as latest,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(discovered_at)))/60) as minutes_stale
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'trend_events (all)' as stage,
  COUNT(*) as count_24h,
  MAX(last_seen_at) as latest,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_seen_at)))/60) as minutes_stale
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'trend_events (trending)' as stage,
  COUNT(*) as count_24h,
  MAX(last_seen_at) as latest,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_seen_at)))/60) as minutes_stale
FROM trend_events
WHERE is_trending = true
AND last_seen_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'org_trend_scores' as stage,
  COUNT(*) as count_24h,
  MAX(computed_at) as latest,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(computed_at)))/60) as minutes_stale
FROM org_trend_scores
WHERE computed_at > NOW() - INTERVAL '24 hours';
```

**Note the current state before activation.**

---

### Step 2: Trigger Ingestion Layer

**2.1 Trigger fetch-google-news:**

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/fetch-google-news" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json" \
  -d '{"manual_trigger": true}'
```

**2.2 Trigger fetch-rss-feeds:**

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/fetch-rss-feeds" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json" \
  -d '{"manual_trigger": true}'
```

**Verification:**

```sql
-- Check new evidence was ingested
SELECT source_type, COUNT(*) as new_items
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '5 minutes'
GROUP BY source_type;

-- Expected: At least 1 row with count > 0
```

---

### Step 3: Trigger Processing Layer (CRITICAL)

**3.1 Trigger detect-trend-events:**

This is the MOST CRITICAL function - it sets `is_trending` flags.

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/detect-trend-events" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json" \
  -d '{"force_full_scan": true}'
```

**Verification:**

```sql
-- Check is_trending flags were set
SELECT
  is_trending,
  COUNT(*) as count,
  MAX(last_seen_at) as latest_update
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY is_trending;

-- Expected: is_trending=true should have count > 0
```

**3.2 Trigger entity extraction:**

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/extract-trend-entities" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json"
```

**3.3 Trigger domain tagging:**

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/tag-trend-policy-domains" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json"
```

**3.4 Trigger geographic tagging:**

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/tag-trend-geographies" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json"
```

**Verification:**

```sql
-- Check enrichment was applied
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE politicians_mentioned IS NOT NULL AND array_length(politicians_mentioned, 1) > 0) as has_politicians,
  COUNT(*) FILTER (WHERE policy_domains IS NOT NULL AND array_length(policy_domains, 1) > 0) as has_domains,
  COUNT(*) FILTER (WHERE geographies IS NOT NULL AND array_length(geographies, 1) > 0) as has_geo
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours';
```

---

### Step 4: Trigger Scoring Layer

**4.1 Trigger compute-org-relevance:**

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/compute-org-relevance" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json" \
  -d '{"process_all_orgs": true}'
```

**Verification:**

```sql
-- Check org scores were computed
SELECT
  COUNT(DISTINCT organization_id) as orgs_scored,
  COUNT(*) as total_scores,
  MAX(computed_at) as latest_score,
  AVG(relevance_score) as avg_relevance
FROM org_trend_scores
WHERE computed_at > NOW() - INTERVAL '1 hour';
```

**4.2 Trigger watchlist matching:**

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/match-entity-watchlist" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json"
```

---

### Step 5: Verify End-to-End Data Flow

Run the full pipeline health check:

```sql
-- Complete pipeline verification
SELECT
  stage,
  count_24h,
  latest,
  minutes_stale,
  CASE
    WHEN minutes_stale < 15 THEN '✅ HEALTHY'
    WHEN minutes_stale < 60 THEN '⚠️ WARNING'
    ELSE '❌ CRITICAL'
  END as status
FROM (
  SELECT
    'trend_evidence' as stage,
    COUNT(*) as count_24h,
    MAX(discovered_at) as latest,
    ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(discovered_at)))/60) as minutes_stale
  FROM trend_evidence
  WHERE discovered_at > NOW() - INTERVAL '24 hours'

  UNION ALL

  SELECT
    'trend_events (trending)' as stage,
    COUNT(*) as count_24h,
    MAX(last_seen_at) as latest,
    ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_seen_at)))/60) as minutes_stale
  FROM trend_events
  WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'

  UNION ALL

  SELECT
    'org_trend_scores' as stage,
    COUNT(*) as count_24h,
    MAX(computed_at) as latest,
    ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(computed_at)))/60) as minutes_stale
  FROM org_trend_scores
  WHERE computed_at > NOW() - INTERVAL '24 hours'
) as pipeline_stages
ORDER BY stage;
```

**Expected Results:**

| Stage | count_24h | Status |
|-------|-----------|--------|
| trend_evidence | >100 | ✅ HEALTHY |
| trend_events (trending) | >10 | ✅ HEALTHY |
| org_trend_scores | >0 | ✅ HEALTHY |

---

### Step 6: Verify UI Data Will Display

Simulate the exact query the UI uses:

```sql
-- Simulate useTrendEvents hook query
WITH ui_trends AS (
  SELECT *
  FROM trend_events
  WHERE is_trending = true
    AND confidence_score >= 30
    AND last_seen_at > NOW() - INTERVAL '24 hours'
  ORDER BY is_breaking DESC, confidence_score DESC
  LIMIT 50
)
SELECT
  COUNT(*) as total_fetched,
  COUNT(*) FILTER (WHERE is_breaking = true) as breaking,
  COUNT(*) FILTER (WHERE confidence_score >= 70) as high_confidence,
  COUNT(*) FILTER (WHERE z_score_velocity >= 2) as high_velocity,
  COUNT(*) FILTER (
    WHERE is_breaking = true
       OR confidence_score >= 70
       OR z_score_velocity >= 2
  ) as would_display_actionable
FROM ui_trends;
```

**Expected:** `would_display_actionable` > 0

---

## Quick Activation Script

Run all triggers in sequence (for Lovable or CLI):

```bash
#!/bin/bash
# Pipeline Activation Script

BASE_URL="https://nuclmzoasgydubdshtab.supabase.co/functions/v1"
AUTH="Authorization: Bearer [SERVICE_ROLE_KEY]"
CRON="x-cron-secret: [CRON_SECRET]"

echo "🚀 Starting pipeline activation..."

# Ingestion
echo "📥 Triggering ingestion layer..."
curl -s -X POST "$BASE_URL/fetch-google-news" -H "$AUTH" -H "$CRON" -H "Content-Type: application/json"
curl -s -X POST "$BASE_URL/fetch-rss-feeds" -H "$AUTH" -H "$CRON" -H "Content-Type: application/json"

echo "⏳ Waiting 30 seconds for ingestion..."
sleep 30

# Processing
echo "⚙️ Triggering processing layer..."
curl -s -X POST "$BASE_URL/detect-trend-events" -H "$AUTH" -H "$CRON" -H "Content-Type: application/json" -d '{"force_full_scan": true}'

echo "⏳ Waiting 60 seconds for trend detection..."
sleep 60

# Enrichment (parallel)
echo "🏷️ Triggering enrichment..."
curl -s -X POST "$BASE_URL/extract-trend-entities" -H "$AUTH" -H "$CRON" -H "Content-Type: application/json" &
curl -s -X POST "$BASE_URL/tag-trend-policy-domains" -H "$AUTH" -H "$CRON" -H "Content-Type: application/json" &
curl -s -X POST "$BASE_URL/tag-trend-geographies" -H "$AUTH" -H "$CRON" -H "Content-Type: application/json" &
wait

echo "⏳ Waiting 30 seconds for enrichment..."
sleep 30

# Scoring
echo "📊 Triggering scoring layer..."
curl -s -X POST "$BASE_URL/compute-org-relevance" -H "$AUTH" -H "$CRON" -H "Content-Type: application/json" -d '{"process_all_orgs": true}'
curl -s -X POST "$BASE_URL/match-entity-watchlist" -H "$AUTH" -H "$CRON" -H "Content-Type: application/json"

echo "✅ Pipeline activation complete! Check UI in 1 minute."
```

---

## Troubleshooting

### Issue: detect-trend-events returns 200 but no trending flags set

**Check:** Verify there's enough evidence:

```sql
SELECT COUNT(*) FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours';

-- Need at least 50+ items for meaningful trend detection
```

### Issue: compute-org-relevance returns 0 scores

**Check:** Verify organization profiles exist:

```sql
SELECT COUNT(*) FROM organization_profiles;
SELECT COUNT(*) FROM client_organizations;
```

### Issue: Function timeout errors

**Fix:** Reduce batch size or increase timeout:

```bash
# Add timeout flag
curl -X POST "..." --max-time 120
```

---

## Verification Checklist

- [ ] trend_evidence has new rows (< 5 min old)
- [ ] trend_events has is_trending=true rows
- [ ] policy_domains populated on trends
- [ ] org_trend_scores has recent computations
- [ ] UI query simulation returns would_display > 0

---

## Next Agent

After completing this agent, proceed to:
→ `16-data-freshness-fixer.md` (Reactivate stale data sources)
