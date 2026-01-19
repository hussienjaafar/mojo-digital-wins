# End-to-End User Experience Auditor

**Role:** QA Engineer / Product Analyst
**Focus:** Data display, feature completeness, empty states
**Priority:** HIGH

---

## Overview

This auditor verifies that data flows correctly from the database to the user interface. Even if the data pipeline is working, UI bugs or incorrect queries can result in empty screens for users.

---

## Critical User Flows

### Admin Dashboard Flows
| Flow | Page | Data Requirement |
|------|------|------------------|
| Political Intelligence | /admin/political-intelligence | trend_events + org_trend_scores |
| News & Trends | /admin/news-trends | trend_events + org_trend_scores |
| Critical Alerts | /admin/critical-alerts | client_entity_alerts |
| Opportunities | /admin/opportunities | fundraising_opportunities |

### Client Dashboard Flows
| Flow | Page | Data Requirement |
|------|------|------------------|
| News & Trends | /client/news-trends | trend_events + org_trend_scores |
| Intelligence Center | /client/media-intelligence | trend_events + client_entity_alerts |
| Watchlist | /client/entity-watchlist | entity_watchlist + matches |

---

## Audit Checklist

### 1. Data Availability Check

**Verify data exists for UI to display:**

```sql
-- Check core tables have data
SELECT 'trend_events' as table_name, COUNT(*) as count FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 'trend_evidence', COUNT(*) FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 'org_trend_scores', COUNT(*) FROM org_trend_scores
UNION ALL
SELECT 'client_entity_alerts', COUNT(*) FROM client_entity_alerts
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'fundraising_opportunities', COUNT(*) FROM fundraising_opportunities
WHERE created_at > NOW() - INTERVAL '7 days';
```

**Expected Results:**
- [ ] trend_events > 0
- [ ] trend_evidence > 0
- [ ] org_trend_scores > 0 (for active orgs)
- [ ] Data is recent (not stale)

### 2. Admin Political Intelligence Page

**Page:** `/admin/political-intelligence` (News & Trends)

**Query Simulation:**
```sql
-- Simulate the useTrendEvents hook query
SELECT
  id,
  event_title,
  is_trending,
  is_breaking,
  confidence_score,
  velocity,
  z_score_velocity,
  source_count,
  last_seen_at
FROM trend_events
WHERE is_trending = true
AND confidence_score >= 30
AND last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY
  is_breaking DESC,
  confidence_score DESC,
  velocity DESC
LIMIT 50;
```

**Actionability Check:**
```sql
-- Check how many would pass actionability filters
SELECT
  COUNT(*) as total_fetched,
  COUNT(*) FILTER (WHERE is_breaking = true) as breaking,
  COUNT(*) FILTER (WHERE confidence_score >= 70) as high_confidence,
  COUNT(*) FILTER (WHERE z_score_velocity >= 2) as high_velocity,
  COUNT(*) FILTER (
    is_breaking = true OR
    confidence_score >= 70 OR
    z_score_velocity >= 2
  ) as would_display
FROM trend_events
WHERE is_trending = true
AND confidence_score >= 30
AND last_seen_at > NOW() - INTERVAL '24 hours';
```

**Expected Results:**
- [ ] total_fetched > 0
- [ ] would_display > 0 (this is what shows in "Key Developments")
- [ ] If would_display = 0, actionability criteria are too strict

### 3. Organization Relevance Scores

```sql
-- Check if org scores exist for the admin org
SELECT
  organization_id,
  COUNT(*) as score_count,
  MAX(computed_at) as latest_score,
  AVG(relevance_score) as avg_relevance,
  COUNT(*) FILTER (WHERE relevance_score >= 30) as high_relevance_count
FROM org_trend_scores
GROUP BY organization_id
ORDER BY score_count DESC;
```

**Expected Results:**
- [ ] Org scores exist for test organizations
- [ ] Scores are recent (computed_at < 1 hour ago)
- [ ] Some scores have relevance >= 30

### 4. Empty State Analysis

**Identify why UI shows "No actionable signals":**

```sql
-- Diagnostic: Why might no data display?
WITH trend_data AS (
  SELECT
    id,
    event_title,
    is_trending,
    is_breaking,
    confidence_score,
    z_score_velocity,
    last_seen_at
  FROM trend_events
  WHERE last_seen_at > NOW() - INTERVAL '24 hours'
)
SELECT
  COUNT(*) as total_trends_24h,
  COUNT(*) FILTER (WHERE is_trending = true) as trending_true,
  COUNT(*) FILTER (WHERE is_trending = false) as trending_false,
  COUNT(*) FILTER (WHERE confidence_score >= 30) as confidence_30_plus,
  COUNT(*) FILTER (WHERE confidence_score >= 70) as confidence_70_plus,
  COUNT(*) FILTER (WHERE is_breaking = true) as breaking_true,
  COUNT(*) FILTER (WHERE z_score_velocity >= 2) as velocity_high,
  COUNT(*) FILTER (
    WHERE is_trending = true
    AND confidence_score >= 30
    AND (
      is_breaking = true OR
      confidence_score >= 70 OR
      z_score_velocity >= 2
    )
  ) as would_display_in_ui
FROM trend_data;
```

**Decision Tree:**
1. If `total_trends_24h = 0` → Pipeline issue (no data ingested)
2. If `trending_true = 0` → detect-trend-events not running
3. If `confidence_30_plus = 0` → Confidence calculation issue
4. If `would_display_in_ui = 0` → Actionability criteria too strict

### 5. UI Component Data Requirements

**For You Tab Requirements:**
- Needs: `org_trend_scores` with `relevance_score >= 30` for current org
- Falls back to: General trending if no org scores

**Explore Tab Requirements:**
- Needs: `trend_events` with `is_trending = true`
- No org-specific filtering

**Breaking Now Requirements:**
- Needs: `trend_events` with `is_breaking = true`

**Watchlist Mentions Requirements:**
- Needs: `entity_watchlist` entries configured
- Needs: `match-entity-watchlist` to have run

### 6. Feature Completeness

**Admin Dashboard Features:**
- [ ] Key Developments section shows data
- [ ] For You tab shows personalized trends
- [ ] Explore tab shows all trending
- [ ] News Feed tab shows evidence articles
- [ ] Filters work (Breaking, High Confidence, etc.)
- [ ] Search works
- [ ] Briefing panel shows data
- [ ] Notifications badge shows count

**Client Dashboard Features:**
- [ ] Priority Feed shows relevant trends
- [ ] Explore Trends shows all trending
- [ ] Breaking Now section works
- [ ] Watchlist Mentions shows matches
- [ ] Real-time updates work

### 7. API Endpoint Verification

**Test get-trends-for-org endpoint:**
```bash
curl -X POST \
  https://[PROJECT_REF].supabase.co/functions/v1/get-trends-for-org \
  -H "Authorization: Bearer [USER_JWT]" \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "[ORG_ID]"}'
```

**Expected Response:**
- Status: 200 OK
- Body contains: `trends` array with items
- Each trend has: `id`, `event_title`, `relevance_score`

---

## Common Issues & Remediation

### Issue: "No actionable signals" but data exists
**Cause:** Actionability criteria too strict
**Location:** `src/pages/admin/NewsTrendsPage.tsx` lines 108-138
**Fix:** Lower thresholds:
- confidence_score >= 70 → >= 50
- z_score_velocity >= 2 → >= 1.5
- Or add more criteria paths

### Issue: Explore tab empty but For You works
**Cause:** `is_trending` filter in useTrendEvents
**Fix:** Verify detect-trend-events is setting `is_trending = true`

### Issue: Organization has no scores
**Cause:** compute-org-relevance not running for that org
**Fix:** Run compute-org-relevance manually, verify org has profile

### Issue: Real-time not updating
**Cause:** Subscription not connected
**Fix:** Check WebSocket connection, verify Supabase realtime enabled

---

## Output Template

```markdown
## End-to-End UX Audit Results

**Audit Date:** [DATE]

### Data Availability

| Table | Count | Recent | Status |
|-------|-------|--------|--------|
| trend_events (24h) | | | |
| trend_evidence (24h) | | | |
| org_trend_scores | | | |

### UI Display Analysis

| Metric | Value | Required | Status |
|--------|-------|----------|--------|
| Total trends (24h) | | >0 | |
| Trending = true | | >0 | |
| Would display in UI | | >0 | |

### Empty State Diagnosis

**Root Cause:** [IDENTIFIED CAUSE]

**Recommended Fix:** [SPECIFIC FIX]

### Feature Checklist

| Feature | Admin | Client | Status |
|---------|-------|--------|--------|
| Key Developments | | N/A | |
| For You | | | |
| Explore | | | |
| Breaking Now | | | |
| Watchlist | | | |

### Findings

#### [SEVERITY] Finding Title
- **Component:** [affected component]
- **Issue:** [description]
- **Impact:** [user sees what]
- **Remediation:** [fix steps]
```
