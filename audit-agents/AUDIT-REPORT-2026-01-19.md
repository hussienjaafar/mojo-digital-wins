# News & Trends V2 System Audit Report

**Audit Date:** 2026-01-19
**Audit Version:** 1.0
**System:** News & Trends V2 (Profile-First 70/30 Architecture)
**Auditor:** Claude AI Audit Agents

---

## Executive Summary

### Overall Health Score: C+ (Needs Attention Before Production)

The News & Trends V2 system demonstrates excellent architectural design with strong anti-filter-bubble mechanisms. However, **2 CRITICAL** and **5 HIGH** severity issues were identified that must be resolved before production deployment.

| Category | Status | CRITICAL | HIGH | MEDIUM | LOW | INFO |
|----------|--------|----------|------|--------|-----|------|
| Data Pipeline | PASS (with issues) | 0 | 2 | 3 | 3 | 5 |
| Security | **NEEDS FIX** | 1 | 2 | 2 | 3 | 0 |
| Domain Coverage | **NEEDS FIX** | 1 | 4 | 3 | 3 | 4 |
| Filter Bubble | PASS | 0 | 0 | 2 | 2 | 11 |
| Fairness | PASS | 0 | 0 | 1 | 2 | 10 |
| Learning System | **BLOCKED** | 1 | 0 | 2 | 2 | 12 |
| **TOTAL** | | **2** | **5** | **13** | **15** | **42** |

---

## Top 5 Priority Issues

### 1. CRITICAL: Learning System Uses Random Performance Data
**File:** `supabase/functions/correlate-trends-campaigns/index.ts:200`

The trend-campaign correlation function uses `Math.random()` as a placeholder instead of actual campaign performance metrics. This completely breaks the learning feedback loop - all learned affinities are based on random values, not real outcomes.

**Impact:** The entire learning system (30% of scoring) is non-functional.

**Fix Required:** Implement actual performance calculation from campaign metrics.

---

### 2. CRITICAL: get-trends-for-org Bypasses RLS with Service Key
**File:** `supabase/functions/get-trends-for-org/index.ts:142-143`

The main user-facing API creates a Supabase client using `SUPABASE_SERVICE_ROLE_KEY`, which bypasses Row Level Security on all queries. While authentication is validated, RLS policies are not enforced.

**Impact:** Potential for data leakage if authentication is compromised.

**Fix Required:** Use user-scoped client (with JWT) for data queries.

---

### 3. HIGH: Cron Secret Validation Fails OPEN in 5 Functions
**Files:** Multiple Edge Functions

Five functions implement local `validateCronSecret()` that returns `true` if `CRON_SECRET` is not configured, allowing unauthorized access.

**Affected Functions:**
- `tag-trend-policy-domains/index.ts`
- `tag-trend-geographies/index.ts`
- `update-org-affinities/index.ts`
- `decay-stale-affinities/index.ts`
- `correlate-trends-campaigns/index.ts`

**Fix Required:** Use shared `validateCronSecret` from `_shared/security.ts` which fails closed.

---

### 4. HIGH: All 12 Policy Domains Below Keyword Target
**File:** `supabase/functions/_shared/policyDomainKeywords.ts`

All policy domains have 23-34 keywords instead of the target 50+. Average is 27.3 keywords (55% of target).

**Impact:** Reduced classification accuracy, trends may go untagged.

**Fix Required:** Expand keyword lists, prioritizing Housing (23), Criminal Justice (24), and Voting Rights (24).

---

### 5. HIGH: State Abbreviation Matching Causes False Positives
**File:** `supabase/functions/_shared/politicalEntities.ts:169`

State abbreviation matching uses `includes()` without word boundaries. Common words like "any" (NY), "text" (TX), "main" (IN) trigger false state detection.

**Impact:** Geographic tagging is unreliable for abbreviated state references.

**Fix Required:** Implement word boundary checking: `/\b${abbrev}\b/i`

---

## Findings by Category

### Data Pipeline Quality (13 Findings)

| Severity | Finding | Status |
|----------|---------|--------|
| HIGH | Missing retry logic in ingestion functions | Open |
| HIGH | O(n^2) duplicate detection algorithm | Open |
| MEDIUM | Cron secret fails open pattern | Duplicate (Security) |
| MEDIUM | No max batch size validation | Open |
| MEDIUM | 32-bit content hash collision risk | Open |
| MEDIUM | Over-tagged sources (Politico has 6 domains) | Open |
| LOW | Missing NOT NULL on priority_bucket | Open |
| LOW | Missing index on campaign_type | Open |
| LOW | Catch-all fallback may over-tag sources | Open |
| INFO | Schema verification passed | N/A |
| INFO | All tables have PKs and FKs | N/A |
| INFO | GIN indexes on arrays present | N/A |
| INFO | URL normalization comprehensive | N/A |

### Security & Compliance (8 Findings)

| Severity | Finding | Status |
|----------|---------|--------|
| CRITICAL | get-trends-for-org uses service key for queries | Open |
| HIGH | update-org-affinities accepts org_id from body | Open |
| HIGH | Cron secret fails open in 5 functions | Open |
| MEDIUM | trend_filter_log missing user SELECT policy | Open |
| MEDIUM | Missing INSERT/UPDATE/DELETE user policies | Documented |
| LOW | CORS allows all origins | Open |
| LOW | No rate limiting on user functions | Open |
| LOW | Console logging exposes org IDs | Open |

### Domain Coverage (15 Findings)

| Severity | Finding | Status |
|----------|---------|--------|
| CRITICAL | Executive branch data potentially outdated | Open |
| HIGH | All domains below 50 keyword target | Open |
| HIGH | State abbreviation matching false positives | Open |
| HIGH | No cabinet members in entity list | Open |
| HIGH | No state governors in entity list | Open |
| MEDIUM | Keyword collisions (medicare, minimum wage) | Open |
| MEDIUM | Missing 12 top-50 US cities | Open |
| MEDIUM | 6/9 Supreme Court justices missing | Open |
| LOW | Missing critical Healthcare terms (FDA, CDC) | Open |
| LOW | Missing Technology terms (ChatGPT, crypto) | Open |
| LOW | 2 US territories missing | Open |
| INFO | All 50 states + DC covered | N/A |
| INFO | 3 territories present | N/A |
| INFO | 2-keyword match threshold reasonable | N/A |
| INFO | Source-based domain inheritance working | N/A |

### Filter Bubble & Diversity (15 Findings)

| Severity | Finding | Status |
|----------|---------|--------|
| MEDIUM | Minimum relevance threshold may be too low (25) | Review |
| MEDIUM | Advanced diversity function not used in API | Review |
| LOW | Modifiers can exceed 100 (mitigated by cap) | Documented |
| LOW | No hard cap on NEW_OPPORTUNITY in basic function | Review |
| INFO | 70/30 scoring split correctly implemented | N/A |
| INFO | Profile caps correct (35+20+15=70) | N/A |
| INFO | Learned affinity cap correct (20) | N/A |
| INFO | Exploration bonus correct (10) | N/A |
| INFO | Domain diversity enforced | N/A |
| INFO | Diversity applied before truncation | N/A |
| INFO | Decay protects self-declared affinities | N/A |
| INFO | Decay parameters match spec | N/A |
| INFO | Filter logging implemented | N/A |
| INFO | NEW_OPPORTUNITY logic correct | N/A |
| INFO | Average affinity used (not max) | N/A |

### Algorithm Fairness (13 Findings)

| Severity | Finding | Status |
|----------|---------|--------|
| MEDIUM | No time-based decay for inactive topics | Review |
| LOW | Geographic matching favors US national orgs | Documented |
| LOW | Criminal Justice keywords reform-skewed | Open |
| INFO | No organization type bias detected | N/A |
| INFO | No domain favoritism detected | N/A |
| INFO | Watchlist appropriately capped at 15 pts | N/A |
| INFO | Cold start orgs can achieve 70+ pts | N/A |
| INFO | NEW_OPPORTUNITY helps cold start | N/A |
| INFO | Affinity cap prevents feedback loop | N/A |
| INFO | Profile scoring independent of history | N/A |
| INFO | Exploration bonus breaks filter bubbles | N/A |
| INFO | Affinity bounds (0.2-0.95) prevent extremes | N/A |
| INFO | Scoring fully transparent with reasons | N/A |

### Learning System (17 Findings)

| Severity | Finding | Status |
|----------|---------|--------|
| CRITICAL | Random performance data placeholder | **BLOCKING** |
| MEDIUM | Performance in correlation creates feedback | Review |
| MEDIUM | Rule-based topic extraction (no AI) | Open |
| LOW | Partial string matching in topic overlap | Open |
| LOW | Decay job swallows logging errors | Open |
| INFO | EMA formula correct (alpha=0.3) | N/A |
| INFO | Affinity bounds correct (0.2-0.95) | N/A |
| INFO | Decay rate correct (0.95 = 5%/week) | N/A |
| INFO | Decay min score correct (0.3) | N/A |
| INFO | Stale threshold correct (30 days) | N/A |
| INFO | Only learned affinities decay | N/A |
| INFO | Decay job logs execution | N/A |
| INFO | Correlation time window correct (48h) | N/A |
| INFO | Min correlation threshold correct (0.2) | N/A |
| INFO | Cold start profile scoring dominates | N/A |
| INFO | NEW_OPPORTUNITY works for new orgs | N/A |
| INFO | Learned contribution capped at 20 pts | N/A |

---

## Key Metrics

### System Health Dashboard

| Metric | Target | Status |
|--------|--------|--------|
| RLS Coverage | 100% | 83% (trend_filter_log missing user policy) |
| Domain Tagging Keywords | 50+ per domain | 27.3 avg (55% of target) |
| State Coverage | 51 (50+DC) | 51 (100%) |
| Entity Coverage (Politicians) | 50+ | 16 (32%) |
| Entity Coverage (Agencies) | 20+ | 11 (55%) |
| 70/30 Split Accuracy | 100% | 100% |
| Anti-Filter-Bubble Mechanisms | All present | 11/13 (85%) |
| Learning System | Functional | **BLOCKED** |

### Fairness Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Score variance by org type | <2x | Not measured (no live data) |
| Cold start capability | >40 pts avg | 70+ achievable |
| Domain score variance | <10 pts | Equal weighting verified |
| Feedback loop risk | LOW | LOW (architecture sound) |

---

## Remediation Plan

### Immediate (Before Production)

1. **[CRITICAL]** Fix `correlate-trends-campaigns/index.ts` random performance placeholder
   - Implement actual campaign performance calculation
   - Query real metrics from campaign data

2. **[CRITICAL]** Fix `get-trends-for-org/index.ts` service key usage
   - Create user-scoped Supabase client for data queries
   - Keep service role only for auth validation

3. **[HIGH]** Replace local cron secret validation in 5 functions
   - Import from `_shared/security.ts`
   - Test all cron endpoints

4. **[HIGH]** Fix state abbreviation matching
   - Add word boundary regex: `/\b${abbrev}\b/i`
   - Test with common false positive words

### Short-term (Week 1-2)

5. **[HIGH]** Expand policy domain keywords
   - Target: 50+ keywords per domain
   - Priority: Housing, Criminal Justice, Voting Rights

6. **[HIGH]** Add missing entities
   - Cabinet members (8+)
   - State governors (50)
   - Supreme Court justices (6 missing)
   - Federal agencies (FDA, CDC, HUD, etc.)

7. **[MEDIUM]** Add trend_filter_log user SELECT policy

8. **[MEDIUM]** Add retry logic to ingestion functions

9. **[MEDIUM]** Add max batch size validation

### Medium-term (Week 3-4)

10. **[MEDIUM]** Replace O(n^2) duplicate detection with LSH
11. **[MEDIUM]** Upgrade content hash to SHA-256
12. **[MEDIUM]** Add missing cities to MAJOR_CITIES
13. **[LOW]** Add rate limiting to user-facing functions
14. **[LOW]** Balance Criminal Justice keywords
15. **[LOW]** Update executive branch data for 2026

---

## Appendix A: Files Reviewed

### Migrations
- `supabase/migrations/20260119034328_news_trends_overhaul.sql`
- `supabase/migrations/20260119034329_tag_rss_sources_policy_domains.sql`

### Shared Utilities
- `supabase/functions/_shared/policyDomainKeywords.ts`
- `supabase/functions/_shared/orgRelevanceV3.ts`
- `supabase/functions/_shared/trendDiversity.ts`
- `supabase/functions/_shared/politicalEntities.ts`
- `supabase/functions/_shared/urlNormalizer.ts`
- `supabase/functions/_shared/security.ts`

### Edge Functions
- `supabase/functions/tag-trend-policy-domains/index.ts`
- `supabase/functions/tag-trend-geographies/index.ts`
- `supabase/functions/extract-trend-entities/index.ts`
- `supabase/functions/get-trends-for-org/index.ts`
- `supabase/functions/correlate-trends-campaigns/index.ts`
- `supabase/functions/update-org-affinities/index.ts`
- `supabase/functions/decay-stale-affinities/index.ts`
- `supabase/functions/extract-campaign-topics/index.ts`
- `supabase/functions/detect-duplicates/index.ts`

---

## Appendix B: Positive Findings Summary

### Architecture Strengths
- 70/30 profile-first scoring correctly implemented
- All profile component caps (35+20+15) working
- Learned affinity hard-capped at 20 points
- Average affinity calculation prevents single-topic domination
- Exploration bonus (+10) encourages diversification
- Domain diversity guarantee ensures representation
- Decay mechanism protects self-declared preferences
- Affinity bounds (0.2-0.95) prevent extremes
- Full scoring transparency with human-readable reasons

### Security Strengths
- RLS enabled on all org-scoped tables
- Parameterized queries throughout (no SQL injection)
- No eval() or dynamic code execution
- Shared security module available with secure patterns

### Data Quality Strengths
- Comprehensive URL normalization (35+ tracking params)
- All schema tables have proper PKs, FKs, indexes
- GIN indexes on array columns for performance
- Source-based domain inheritance working

---

## Conclusion

The News & Trends V2 system has a **well-designed architecture** with strong anti-filter-bubble mechanisms. The 70/30 profile-first approach, exploration bonuses, and decay mechanisms are all correctly implemented.

However, **the system is not ready for production** due to:
1. The learning system being completely broken by placeholder code
2. Critical security issues with service key usage
3. Significant coverage gaps in domain keywords and entity recognition

Once the CRITICAL and HIGH priority issues are resolved, the system should provide fair, diverse, and personalized trend recommendations.

---

**Report Generated:** 2026-01-19
**Audit Duration:** Full system review
**Next Audit Recommended:** After remediation of CRITICAL/HIGH issues
