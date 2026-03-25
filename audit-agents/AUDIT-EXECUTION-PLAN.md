# Comprehensive Audit Execution Plan
## News & Trends V2 System Deep Audit

**Audit Date:** January 2026
**System Version:** News & Trends V2 (Profile-First 70/30 Architecture)
**Scope:** Full system audit of recent overhaul implementation

---

## Executive Summary

This audit plan provides a systematic approach to validate the News & Trends V2 overhaul implementation. The audit will verify:
- Data pipeline integrity and schema correctness
- Anti-filter-bubble mechanisms effectiveness
- Algorithm fairness across organization types
- Policy domain and geographic classification accuracy
- Security controls and RLS policies
- Learning system stability and feedback loop safety

---

## Scope of Changes Being Audited

### Database Schema (Migration: `20260119034328_news_trends_overhaul.sql`)

| Table | Purpose | Critical Checks |
|-------|---------|-----------------|
| `org_topic_affinities` | Learned topic preferences | RLS, decay mechanism, score bounds |
| `org_trend_relevance_cache` | Pre-computed relevance scores | RLS, score accuracy, cache freshness |
| `campaign_topic_extractions` | AI-extracted campaign topics | RLS, extraction quality |
| `trend_campaign_correlations` | Links trends to campaign outcomes | Correlation validity, RLS |
| `trend_filter_log` | Tracks filtered trends | Privacy, retention policy |
| `political_entities` | Politicians/orgs knowledge base | Coverage, accuracy |
| `policy_domain_keywords` | Domain classification keywords | Completeness, balance |
| `rss_sources.policy_domains` | Source domain tags | Accuracy, coverage |
| `trend_events.*` | New columns for domains/geo/entities | Classification accuracy |

### Shared Utility Functions

| File | Purpose | Critical Checks |
|------|---------|-----------------|
| `policyDomainKeywords.ts` | 12 policy domains with keywords | Keyword coverage, balance, collisions |
| `orgRelevanceV3.ts` | 70/30 scoring implementation | Score caps, exploration bonus, transparency |
| `trendDiversity.ts` | Anti-filter-bubble diversity | Domain representation, fair distribution |
| `politicalEntities.ts` | Entity detection, geo tagging | State coverage, politician detection |

### Edge Functions

| Function | Purpose | Critical Checks |
|----------|---------|-----------------|
| `tag-trend-policy-domains` | Classify trends by domain | Tagging accuracy, multi-domain handling |
| `tag-trend-geographies` | Detect geographic scope | All 50 states, geo_level accuracy |
| `extract-trend-entities` | Extract politicians/orgs | Entity recognition precision |
| `get-trends-for-org` | Main personalization API | RLS, diversity enforcement, scoring |
| `correlate-trends-campaigns` | Link outcomes to trends | Correlation quality, timing |
| `update-org-affinities` | Update learned preferences | EMA formula, score bounds, RLS |
| `decay-stale-affinities` | Weekly decay job | Decay rate, min score, scheduling |
| `extract-campaign-topics` | Extract topics from campaigns | Extraction accuracy |

### Frontend Components

| Component | Purpose | Critical Checks |
|-----------|---------|-----------------|
| `TrendCardEnhanced.tsx` | Display trends with badges | Badge accuracy, domain colors |
| `TrendsFilterRail.tsx` | Filtering controls | Filter functionality, UI state |
| `src/types/newsTrends.ts` | Shared TypeScript types | Type correctness, completeness |

---

## Audit Phases

### Phase 1: Foundation Audit (Parallel)
**Duration:** Day 1-2
**Agents:** Data Pipeline (01) + Security (05)

These audits have no dependencies and can run in parallel.

#### 1A: Data Pipeline Quality Audit

**Objective:** Verify schema integrity and data quality

**Specific Tasks:**

1. **Schema Verification**
   ```sql
   -- Verify all new tables exist with correct columns
   SELECT table_name, column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name IN (
     'org_topic_affinities',
     'org_trend_relevance_cache',
     'campaign_topic_extractions',
     'trend_campaign_correlations',
     'trend_filter_log',
     'political_entities',
     'policy_domain_keywords'
   )
   ORDER BY table_name, ordinal_position;
   ```

2. **Index Verification**
   ```sql
   -- Check all required indexes exist
   SELECT indexname, tablename, indexdef
   FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename IN (
       'org_topic_affinities',
       'org_trend_relevance_cache',
       'trend_events'
     );
   ```

3. **Foreign Key Integrity**
   ```sql
   -- Verify FK constraints
   SELECT
     tc.table_name, kcu.column_name,
     ccu.table_name AS foreign_table_name,
     ccu.column_name AS foreign_column_name
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu
     ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
     ON ccu.constraint_name = tc.constraint_name
   WHERE constraint_type = 'FOREIGN KEY'
     AND tc.table_name IN ('org_topic_affinities', 'org_trend_relevance_cache');
   ```

4. **Data Freshness Check**
   ```sql
   -- Check data recency by source type
   SELECT
     source_type,
     COUNT(*) as record_count,
     MAX(indexed_at) as latest_data,
     NOW() - MAX(indexed_at) as data_age
   FROM trend_evidence
   GROUP BY source_type
   ORDER BY data_age DESC;
   ```

5. **RSS Source Domain Tagging**
   ```sql
   -- Verify RSS sources have policy domains
   SELECT
     COUNT(*) as total_sources,
     COUNT(*) FILTER (WHERE policy_domains IS NOT NULL AND policy_domains != '{}') as tagged_sources,
     COUNT(*) FILTER (WHERE policy_domains IS NULL OR policy_domains = '{}') as untagged_sources
   FROM rss_sources;

   -- Check domain distribution across sources
   SELECT
     unnest(policy_domains) as domain,
     COUNT(*) as source_count
   FROM rss_sources
   WHERE policy_domains IS NOT NULL
   GROUP BY domain
   ORDER BY source_count DESC;
   ```

6. **Trend Tagging Rates**
   ```sql
   -- Check trend tagging completeness
   SELECT
     COUNT(*) as total_trends,
     COUNT(*) FILTER (WHERE policy_domains IS NOT NULL AND policy_domains != '{}') as domain_tagged,
     COUNT(*) FILTER (WHERE geographies IS NOT NULL AND geographies != '{}') as geo_tagged,
     COUNT(*) FILTER (WHERE politicians_mentioned IS NOT NULL AND politicians_mentioned != '{}') as entity_tagged,
     ROUND(100.0 * COUNT(*) FILTER (WHERE policy_domains IS NOT NULL AND policy_domains != '{}') / NULLIF(COUNT(*), 0), 2) as domain_rate,
     ROUND(100.0 * COUNT(*) FILTER (WHERE geographies IS NOT NULL AND geographies != '{}') / NULLIF(COUNT(*), 0), 2) as geo_rate
   FROM trend_events
   WHERE created_at > NOW() - INTERVAL '7 days';
   ```

**Files to Review:**
- `supabase/migrations/20260119034328_news_trends_overhaul.sql`
- `supabase/migrations/20260119034329_tag_rss_sources_policy_domains.sql`
- `supabase/functions/tag-trend-policy-domains/index.ts`
- `supabase/functions/tag-trend-geographies/index.ts`

**Expected Outcomes:**
- [ ] All tables created with correct schema
- [ ] All indexes present and properly defined
- [ ] FK constraints enforced
- [ ] Data freshness < 6 hours for active sources
- [ ] RSS source tagging > 90%
- [ ] Trend domain tagging > 80%
- [ ] Trend geo tagging > 60%

---

#### 1B: Security & Compliance Audit

**Objective:** Verify RLS policies and data isolation

**Specific Tasks:**

1. **RLS Policy Verification**
   ```sql
   -- Check RLS enabled on all org-scoped tables
   SELECT
     schemaname,
     tablename,
     rowsecurity as rls_enabled
   FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename IN (
       'org_topic_affinities',
       'org_trend_relevance_cache',
       'campaign_topic_extractions',
       'trend_campaign_correlations',
       'trend_filter_log'
     );

   -- List all RLS policies
   SELECT
     tablename,
     policyname,
     permissive,
     roles,
     cmd,
     qual::text as policy_expression
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN (
       'org_topic_affinities',
       'org_trend_relevance_cache',
       'campaign_topic_extractions',
       'trend_campaign_correlations',
       'trend_filter_log'
     )
   ORDER BY tablename, policyname;
   ```

2. **Cross-Org Data Isolation Test**
   ```sql
   -- Verify no org can see another org's data
   -- Run as authenticated user from Org A
   SET request.jwt.claim.organization_id = 'test-org-a-uuid';

   SELECT COUNT(*) as should_be_zero
   FROM org_topic_affinities
   WHERE organization_id != 'test-org-a-uuid';

   SELECT COUNT(*) as should_be_zero
   FROM org_trend_relevance_cache
   WHERE organization_id != 'test-org-a-uuid';
   ```

3. **Service Key Usage Audit**
   ```bash
   # Search for service key usage patterns
   grep -r "SUPABASE_SERVICE_ROLE_KEY" supabase/functions/
   grep -r "service_role" supabase/functions/

   # Verify service key not in client code
   grep -r "service_role" src/
   ```

4. **Edge Function Auth Review**

   Review each function for proper authentication:
   - `get-trends-for-org/index.ts` - MUST require auth
   - `update-org-affinities/index.ts` - MUST require auth
   - `tag-trend-policy-domains/index.ts` - Service role (cron job)
   - `decay-stale-affinities/index.ts` - Service role (cron job)

5. **Injection Vulnerability Scan**
   ```bash
   # Check for SQL injection patterns
   grep -rn "sql\`.*\${" supabase/functions/
   grep -rn '+ .*query' supabase/functions/

   # Check for dynamic table access
   grep -rn "\.from\(.*\`" supabase/functions/
   ```

**Files to Review:**
- `supabase/migrations/20260119034328_news_trends_overhaul.sql` (RLS policies)
- `supabase/functions/get-trends-for-org/index.ts` (auth handling)
- `supabase/functions/update-org-affinities/index.ts` (auth handling)
- All Edge Functions for authentication patterns

**Expected Outcomes:**
- [ ] RLS enabled on all 5 org-scoped tables
- [ ] SELECT/INSERT/UPDATE/DELETE policies for each table
- [ ] Cross-org data isolation verified
- [ ] Service key usage limited to cron functions
- [ ] No SQL injection vulnerabilities found
- [ ] All user-facing functions require authentication

---

### Phase 2: Classification Audit
**Duration:** Day 2-3
**Agent:** Domain Coverage (04)
**Dependency:** Phase 1 complete

#### 2A: Domain Coverage Audit

**Objective:** Verify classification accuracy and coverage

**Specific Tasks:**

1. **Keyword Count Analysis**
   ```typescript
   // Verify each domain has sufficient keywords
   import { POLICY_DOMAIN_KEYWORDS } from '../_shared/policyDomainKeywords';

   Object.entries(POLICY_DOMAIN_KEYWORDS).forEach(([domain, keywords]) => {
     const count = keywords.length;
     const status = count >= 50 ? 'OK' : 'INSUFFICIENT';
     console.log(`${domain}: ${count} keywords [${status}]`);
   });
   ```

2. **Keyword Collision Detection**
   ```typescript
   // Find keywords appearing in multiple domains
   const keywordDomains: Record<string, string[]> = {};

   Object.entries(POLICY_DOMAIN_KEYWORDS).forEach(([domain, keywords]) => {
     keywords.forEach(kw => {
       if (!keywordDomains[kw]) keywordDomains[kw] = [];
       keywordDomains[kw].push(domain);
     });
   });

   const collisions = Object.entries(keywordDomains)
     .filter(([_, domains]) => domains.length > 2);

   console.log(`Collision count: ${collisions.length}`);
   console.log('Keywords in 3+ domains:', collisions);
   ```

3. **State Pattern Coverage**
   ```typescript
   // Verify all 50 states + DC + territories covered
   import { STATE_PATTERNS } from '../_shared/politicalEntities';

   const REQUIRED_STATES = [
     'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
     'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
     'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
     'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
     'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
     'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
     'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
     'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
     'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
     'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
     'District of Columbia'
   ];

   const missing = REQUIRED_STATES.filter(state =>
     !Object.keys(STATE_PATTERNS).some(key =>
       key.toLowerCase() === state.toLowerCase()
     )
   );

   console.log(`Missing states: ${missing.length}`, missing);
   ```

4. **Domain Distribution in Trends**
   ```sql
   -- Check domain representation in recent trends
   SELECT
     unnest(policy_domains) as domain,
     COUNT(*) as trend_count,
     ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
   FROM trend_events
   WHERE created_at > NOW() - INTERVAL '7 days'
     AND policy_domains IS NOT NULL AND policy_domains != '{}'
   GROUP BY domain
   ORDER BY trend_count DESC;
   ```

5. **Geographic Distribution**
   ```sql
   -- Check geographic coverage
   SELECT
     unnest(geographies) as geography,
     COUNT(*) as trend_count
   FROM trend_events
   WHERE created_at > NOW() - INTERVAL '7 days'
     AND geographies IS NOT NULL AND geographies != '{}'
   GROUP BY geography
   ORDER BY trend_count DESC
   LIMIT 30;

   -- Check geo_level distribution
   SELECT
     geo_level,
     COUNT(*) as count,
     ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
   FROM trend_events
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY geo_level;
   ```

6. **False Positive Sampling**
   ```sql
   -- Sample Healthcare-tagged trends for manual review
   SELECT id, headline, policy_domains
   FROM trend_events
   WHERE 'Healthcare' = ANY(policy_domains)
     AND created_at > NOW() - INTERVAL '7 days'
   ORDER BY RANDOM()
   LIMIT 20;
   -- MANUAL: Review each - is it actually Healthcare-related?
   ```

7. **False Negative Detection**
   ```sql
   -- Find potentially misclassified trends
   SELECT id, headline, policy_domains
   FROM trend_events
   WHERE headline ILIKE ANY(ARRAY['%medicare%', '%hospital%', '%vaccine%'])
     AND (policy_domains IS NULL OR NOT 'Healthcare' = ANY(policy_domains))
     AND created_at > NOW() - INTERVAL '7 days'
   LIMIT 20;
   -- MANUAL: Should these have been tagged Healthcare?
   ```

**Files to Review:**
- `supabase/functions/_shared/policyDomainKeywords.ts`
- `supabase/functions/_shared/politicalEntities.ts`
- `supabase/functions/tag-trend-policy-domains/index.ts`
- `supabase/functions/tag-trend-geographies/index.ts`
- `supabase/functions/extract-trend-entities/index.ts`

**Expected Outcomes:**
- [ ] All 12 domains have 50+ keywords
- [ ] Keyword collision rate < 5%
- [ ] All 50 states + DC detected
- [ ] Domain distribution reasonably balanced (no >30% single domain)
- [ ] False positive rate < 15%
- [ ] False negative rate < 20%

---

### Phase 3: Personalization Audit (Parallel)
**Duration:** Day 3-4
**Agents:** Filter Bubble (02) + Algorithm Fairness (03)
**Dependency:** Phase 2 complete

#### 3A: Filter Bubble & Diversity Audit

**Objective:** Verify anti-filter-bubble mechanisms work

**Specific Tasks:**

1. **70/30 Scoring Split Verification**

   Review `orgRelevanceV3.ts` for:
   - Profile-based scoring caps at 70 points (35+20+15)
   - Learned affinity caps at 20 points
   - Exploration bonus caps at 10 points
   - Total score caps at 100

   ```typescript
   // Verify in orgRelevanceV3.ts
   // Profile-based (70 pts max):
   //   - Domain match: 35 pts max
   //   - Focus areas: 20 pts max
   //   - Watchlist: 15 pts max
   // Learned-based (30 pts max):
   //   - Affinity: 20 pts max
   //   - Exploration: 10 pts max
   ```

2. **Domain Diversity Enforcement**
   ```sql
   -- For a sample org, check domain coverage in recommendations
   WITH org_recommendations AS (
     SELECT
       r.trend_event_id,
       r.relevance_score,
       r.is_new_opportunity,
       t.policy_domains
     FROM org_trend_relevance_cache r
     JOIN trend_events t ON t.id = r.trend_event_id
     WHERE r.organization_id = '[SAMPLE_ORG_ID]'
     ORDER BY r.relevance_score DESC
     LIMIT 20
   )
   SELECT
     unnest(policy_domains) as domain,
     COUNT(*) as count,
     AVG(relevance_score) as avg_score,
     SUM(CASE WHEN is_new_opportunity THEN 1 ELSE 0 END) as new_opps
   FROM org_recommendations
   GROUP BY domain
   ORDER BY count DESC;
   ```

3. **NEW_OPPORTUNITY Rate Check**
   ```sql
   -- Check NEW_OPPORTUNITY flag rate
   SELECT
     organization_id,
     COUNT(*) as total_recommendations,
     SUM(CASE WHEN is_new_opportunity THEN 1 ELSE 0 END) as new_opportunities,
     ROUND(100.0 * SUM(CASE WHEN is_new_opportunity THEN 1 ELSE 0 END) / COUNT(*), 2) as new_opp_rate
   FROM org_trend_relevance_cache
   WHERE computed_at > NOW() - INTERVAL '24 hours'
   GROUP BY organization_id
   HAVING COUNT(*) >= 10
   ORDER BY new_opp_rate DESC;
   -- Expected: 15-30% NEW_OPPORTUNITY rate
   ```

4. **Decay Mechanism Verification**
   ```sql
   -- Check that decay job is running
   SELECT
     job_name,
     last_run,
     next_run,
     is_enabled
   FROM scheduled_jobs
   WHERE function_name = 'decay-stale-affinities';

   -- Check affinity decay is happening
   SELECT
     CASE
       WHEN affinity_score >= 0.8 THEN 'high (0.8+)'
       WHEN affinity_score >= 0.5 THEN 'medium (0.5-0.8)'
       WHEN affinity_score >= 0.3 THEN 'low (0.3-0.5)'
       ELSE 'decayed (<0.3)'
     END as bucket,
     COUNT(*) as count,
     AVG(EXTRACT(EPOCH FROM (NOW() - last_used_at)) / 86400) as avg_days_stale
   FROM org_topic_affinities
   WHERE source = 'learned_outcome'
   GROUP BY bucket
   ORDER BY bucket;
   ```

5. **Single-Domain Dominance Check**
   ```sql
   -- Check for filter bubble (single domain > 50%)
   WITH org_domain_dist AS (
     SELECT
       r.organization_id,
       unnest(t.policy_domains) as domain,
       COUNT(*) as count
     FROM org_trend_relevance_cache r
     JOIN trend_events t ON t.id = r.trend_event_id
     WHERE r.relevance_score >= 25
     GROUP BY r.organization_id, domain
   ),
   org_totals AS (
     SELECT organization_id, SUM(count) as total
     FROM org_domain_dist
     GROUP BY organization_id
   )
   SELECT
     d.organization_id,
     d.domain,
     d.count,
     t.total,
     ROUND(100.0 * d.count / t.total, 2) as percentage
   FROM org_domain_dist d
   JOIN org_totals t ON t.organization_id = d.organization_id
   WHERE d.count::float / t.total > 0.5
   ORDER BY percentage DESC;
   -- Expected: No org should have >50% in single domain
   ```

6. **Filter Log Analysis**
   ```sql
   -- Analyze what's being filtered
   SELECT
     filter_reason,
     COUNT(*) as filtered_count,
     AVG(relevance_score) as avg_score,
     COUNT(DISTINCT organization_id) as orgs_affected
   FROM trend_filter_log
   WHERE logged_at > NOW() - INTERVAL '7 days'
   GROUP BY filter_reason
   ORDER BY filtered_count DESC;
   ```

**Files to Review:**
- `supabase/functions/_shared/orgRelevanceV3.ts`
- `supabase/functions/_shared/trendDiversity.ts`
- `supabase/functions/get-trends-for-org/index.ts`
- `supabase/functions/decay-stale-affinities/index.ts`

**Expected Outcomes:**
- [ ] Profile scoring caps at 70 points
- [ ] Learned affinity caps at 20 points
- [ ] Exploration bonus caps at 10 points
- [ ] All declared domains represented in recommendations
- [ ] NEW_OPPORTUNITY rate 15-30%
- [ ] No single domain >50% of recommendations
- [ ] Decay job running weekly

---

#### 3B: Algorithm Fairness Audit

**Objective:** Detect bias across organization types

**Specific Tasks:**

1. **Score Distribution by Org Type**
   ```sql
   -- Check for org type bias
   SELECT
     op.org_type,
     COUNT(DISTINCT r.organization_id) as org_count,
     AVG(r.relevance_score) as avg_score,
     STDDEV(r.relevance_score) as score_stddev,
     PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.relevance_score) as median_score
   FROM org_trend_relevance_cache r
   JOIN org_profiles op ON op.organization_id = r.organization_id
   GROUP BY op.org_type
   ORDER BY avg_score DESC;
   -- Expected: Scores within 1 stddev across org types
   ```

2. **Cold Start Fairness**
   ```sql
   -- Compare new vs established org scores
   WITH org_maturity AS (
     SELECT
       o.id,
       CASE
         WHEN COUNT(a.id) = 0 THEN 'new'
         WHEN COUNT(a.id) < 10 THEN 'early'
         ELSE 'established'
       END as maturity
     FROM client_organizations o
     LEFT JOIN org_topic_affinities a ON a.organization_id = o.id
     GROUP BY o.id
   )
   SELECT
     m.maturity,
     COUNT(DISTINCT r.organization_id) as org_count,
     AVG(r.relevance_score) as avg_score,
     AVG(CASE WHEN r.is_new_opportunity THEN 1 ELSE 0 END) as new_opp_rate
   FROM org_trend_relevance_cache r
   JOIN org_maturity m ON m.id = r.organization_id
   GROUP BY m.maturity;
   -- Expected: New orgs should still achieve avg_score > 40
   ```

3. **Geographic Bias Check**
   ```sql
   -- Check score distribution by org geography
   SELECT
     unnest(op.geographies) as geo,
     COUNT(DISTINCT r.organization_id) as org_count,
     AVG(r.relevance_score) as avg_score,
     STDDEV(r.relevance_score) as score_stddev
   FROM org_trend_relevance_cache r
   JOIN org_profiles op ON op.organization_id = r.organization_id
   GROUP BY geo
   HAVING COUNT(DISTINCT r.organization_id) >= 3
   ORDER BY avg_score DESC
   LIMIT 20;
   -- Expected: Score variance < 15 points across geos
   ```

4. **Domain Bias Check**
   ```sql
   -- Check for domain-based scoring bias
   SELECT
     unnest(r.matched_domains) as domain,
     COUNT(*) as matches,
     AVG(r.relevance_score) as avg_score,
     MIN(r.relevance_score) as min_score,
     MAX(r.relevance_score) as max_score
   FROM org_trend_relevance_cache r
   GROUP BY domain
   ORDER BY avg_score DESC;
   -- Expected: Domain scores within 10 points of each other
   ```

5. **Scoring Transparency Check**
   ```sql
   -- Verify all scores have reasons
   SELECT
     COUNT(*) as total,
     COUNT(*) FILTER (WHERE relevance_reasons IS NOT NULL AND relevance_reasons != '[]') as has_reasons,
     COUNT(*) FILTER (WHERE relevance_reasons IS NULL OR relevance_reasons = '[]') as missing_reasons
   FROM org_trend_relevance_cache;
   -- Expected: 100% have reasons
   ```

6. **Feedback Loop Risk Assessment**
   ```sql
   -- Check for rich-get-richer effect
   WITH org_activity AS (
     SELECT
       organization_id,
       COUNT(*) as campaign_count
     FROM campaign_topic_extractions
     GROUP BY organization_id
   )
   SELECT
     CASE
       WHEN o.campaign_count >= 20 THEN 'high_activity'
       WHEN o.campaign_count >= 5 THEN 'medium_activity'
       ELSE 'low_activity'
     END as activity_level,
     COUNT(DISTINCT o.organization_id) as org_count,
     AVG(a.affinity_score) as avg_affinity
   FROM org_activity o
   JOIN org_topic_affinities a ON a.organization_id = o.organization_id
   WHERE a.source = 'learned_outcome'
   GROUP BY activity_level;
   -- Expected: avg_affinity should be similar across activity levels
   ```

**Files to Review:**
- `supabase/functions/_shared/orgRelevanceV3.ts`
- `supabase/functions/update-org-affinities/index.ts`
- `supabase/functions/correlate-trends-campaigns/index.ts`

**Expected Outcomes:**
- [ ] Score variance by org type < 2x
- [ ] New org average score > 40
- [ ] Geographic score variance < 15 points
- [ ] Domain score variance < 10 points
- [ ] 100% of scores have reasons
- [ ] No rich-get-richer effect detected

---

### Phase 4: Learning System Audit
**Duration:** Day 4-5
**Agent:** Learning System (06)
**Dependency:** Phase 3 complete

#### 4A: Learning System Stability Audit

**Objective:** Verify learning algorithms work correctly and safely

**Specific Tasks:**

1. **EMA Formula Verification**

   Review `update-org-affinities/index.ts`:
   ```typescript
   // Verify EMA implementation:
   // newAffinity = alpha * newValue + (1 - alpha) * oldValue
   // where alpha = 0.3

   // Performance signal conversion:
   // +50% performance → 1.0
   // 0% performance → 0.5
   // -50% performance → 0.0
   ```

2. **Affinity Bounds Verification**
   ```sql
   -- Check for out-of-bounds affinity values
   SELECT
     COUNT(*) FILTER (WHERE affinity_score < 0.2) as below_min,
     COUNT(*) FILTER (WHERE affinity_score > 0.95) as above_max,
     COUNT(*) as total,
     MIN(affinity_score) as actual_min,
     MAX(affinity_score) as actual_max
   FROM org_topic_affinities;
   -- Expected: below_min = 0, above_max = 0
   ```

3. **Decay Function Verification**
   ```sql
   -- Verify decay is working (stale affinities should be lower)
   SELECT
     CASE
       WHEN EXTRACT(EPOCH FROM (NOW() - last_used_at)) / 86400 < 30 THEN 'active'
       WHEN EXTRACT(EPOCH FROM (NOW() - last_used_at)) / 86400 < 60 THEN 'stale_30d'
       WHEN EXTRACT(EPOCH FROM (NOW() - last_used_at)) / 86400 < 90 THEN 'stale_60d'
       ELSE 'stale_90d+'
     END as staleness,
     COUNT(*) as count,
     AVG(affinity_score) as avg_score
   FROM org_topic_affinities
   WHERE source = 'learned_outcome'
   GROUP BY staleness
   ORDER BY staleness;
   -- Expected: avg_score should decrease with staleness
   ```

4. **Correlation Quality Analysis**
   ```sql
   -- Check correlation score distribution
   SELECT
     CASE
       WHEN correlation_score >= 0.8 THEN 'high (0.8+)'
       WHEN correlation_score >= 0.5 THEN 'medium (0.5-0.8)'
       ELSE 'low (<0.5)'
     END as quality,
     COUNT(*) as count,
     AVG(performance_vs_baseline) as avg_performance
   FROM trend_campaign_correlations
   GROUP BY quality;

   -- Check for spurious correlations
   SELECT COUNT(*) as suspicious
   FROM trend_campaign_correlations
   WHERE correlation_score > 0.8
     AND performance_vs_baseline < 0.5;
   -- Expected: suspicious count should be low
   ```

5. **Affinity Score Distribution Analysis**
   ```sql
   -- Check for clustering at extremes (feedback loop indicator)
   SELECT
     ROUND(affinity_score, 1) as score_bucket,
     COUNT(*) as count
   FROM org_topic_affinities
   WHERE source = 'learned_outcome'
   GROUP BY score_bucket
   ORDER BY score_bucket;
   -- Expected: Normal distribution, not clustering at 0.2 or 0.95
   ```

6. **Learning Rate Impact Analysis**
   ```sql
   -- Check how quickly affinities change
   SELECT
     times_used,
     AVG(affinity_score) as avg_score,
     STDDEV(affinity_score) as score_variance
   FROM org_topic_affinities
   WHERE source = 'learned_outcome'
   GROUP BY times_used
   ORDER BY times_used;
   -- Expected: Variance should decrease with more uses
   ```

7. **Cold Start Test**
   ```sql
   -- Verify new orgs can get good recommendations
   SELECT
     o.id,
     o.name,
     COUNT(r.id) as recommendation_count,
     AVG(r.relevance_score) as avg_score,
     SUM(CASE WHEN r.is_new_opportunity THEN 1 ELSE 0 END) as new_opps
   FROM client_organizations o
   LEFT JOIN org_topic_affinities a ON a.organization_id = o.id
   JOIN org_trend_relevance_cache r ON r.organization_id = o.id
   WHERE a.id IS NULL  -- No learned affinities
   GROUP BY o.id, o.name
   HAVING COUNT(r.id) >= 5;
   -- Expected: avg_score > 40 even without history
   ```

**Files to Review:**
- `supabase/functions/update-org-affinities/index.ts`
- `supabase/functions/decay-stale-affinities/index.ts`
- `supabase/functions/correlate-trends-campaigns/index.ts`
- `supabase/functions/extract-campaign-topics/index.ts`

**Expected Outcomes:**
- [ ] EMA formula correctly implemented (alpha = 0.3)
- [ ] Affinity scores bounded 0.2-0.95
- [ ] Decay reduces stale affinities
- [ ] No clustering at score extremes
- [ ] Cold start orgs get avg score > 40
- [ ] Correlation quality distribution is reasonable

---

### Phase 5: Report Generation
**Duration:** Day 5-6
**Dependency:** All phases complete

1. **Compile All Findings**
   - Gather results from all 6 audit agents
   - Categorize by severity (CRITICAL/HIGH/MEDIUM/LOW/INFO)
   - Group by audit category

2. **Calculate System Health Score**

   | Category | Weight | Score Formula |
   |----------|--------|---------------|
   | Data Pipeline | 20% | Pass rate of checks |
   | Security | 25% | 100 - (CRITICAL*50 + HIGH*20 + MEDIUM*5) |
   | Classification | 15% | Tagging accuracy % |
   | Diversity | 15% | 100 - (single domain dominance %) |
   | Fairness | 15% | 100 - (variance across groups / 10) |
   | Learning | 10% | Stability metrics |

3. **Generate Remediation Plan**
   - Immediate (CRITICAL): Within 24 hours
   - Short-term (HIGH): Within 1 week
   - Medium-term (MEDIUM): Within 1 month
   - Backlog (LOW/INFO): Next quarter

4. **Create Executive Summary**
   - Overall health score
   - Top 5 priority issues
   - Key metrics dashboard
   - Recommended next steps

---

## Audit Execution Commands

### Run Full Audit Suite
```bash
claude -p "Execute the full News & Trends V2 audit using audit-agents/AUDIT-EXECUTION-PLAN.md. Run all phases in order, document all findings, and generate a comprehensive report."
```

### Run Individual Phases
```bash
# Phase 1A: Data Pipeline
claude -p "Run Phase 1A (Data Pipeline) from audit-agents/AUDIT-EXECUTION-PLAN.md using audit-agents/01-data-pipeline-auditor.md"

# Phase 1B: Security
claude -p "Run Phase 1B (Security) from audit-agents/AUDIT-EXECUTION-PLAN.md using audit-agents/05-security-compliance-auditor.md"

# Phase 2: Domain Coverage
claude -p "Run Phase 2 (Domain Coverage) from audit-agents/AUDIT-EXECUTION-PLAN.md using audit-agents/04-domain-coverage-auditor.md"

# Phase 3A: Filter Bubble
claude -p "Run Phase 3A (Filter Bubble) from audit-agents/AUDIT-EXECUTION-PLAN.md using audit-agents/02-filter-bubble-auditor.md"

# Phase 3B: Fairness
claude -p "Run Phase 3B (Fairness) from audit-agents/AUDIT-EXECUTION-PLAN.md using audit-agents/03-algorithm-fairness-auditor.md"

# Phase 4: Learning System
claude -p "Run Phase 4 (Learning System) from audit-agents/AUDIT-EXECUTION-PLAN.md using audit-agents/06-learning-system-auditor.md"
```

---

## Success Criteria

The audit passes if:

| Metric | Threshold |
|--------|-----------|
| CRITICAL findings | 0 |
| HIGH findings | < 3 |
| RLS coverage | 100% |
| Domain tagging rate | > 80% |
| Geographic tagging rate | > 60% |
| NEW_OPPORTUNITY rate | 15-30% |
| Single domain max | < 50% |
| Score variance by org type | < 2x |
| Cold start avg score | > 40 |
| Affinity bounds violations | 0 |

---

## Appendix: Quick Reference Queries

### A. System Health Dashboard Query
```sql
SELECT
  'Domain Tagging Rate' as metric,
  ROUND(100.0 * COUNT(*) FILTER (WHERE policy_domains IS NOT NULL AND policy_domains != '{}') / COUNT(*), 2) as value
FROM trend_events WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'Geo Tagging Rate',
  ROUND(100.0 * COUNT(*) FILTER (WHERE geographies IS NOT NULL AND geographies != '{}') / COUNT(*), 2)
FROM trend_events WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'NEW_OPPORTUNITY Rate',
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_new_opportunity) / COUNT(*), 2)
FROM org_trend_relevance_cache WHERE computed_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
  'Affinity Out of Bounds',
  COUNT(*)::numeric
FROM org_topic_affinities WHERE affinity_score < 0.2 OR affinity_score > 0.95;
```

### B. RLS Quick Check
```sql
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'org_topic_affinities',
    'org_trend_relevance_cache',
    'campaign_topic_extractions',
    'trend_campaign_correlations',
    'trend_filter_log'
  )
GROUP BY tablename
ORDER BY tablename;
```

### C. Fairness Quick Check
```sql
SELECT
  op.org_type,
  COUNT(DISTINCT r.organization_id) as orgs,
  ROUND(AVG(r.relevance_score), 2) as avg_score
FROM org_trend_relevance_cache r
JOIN org_profiles op ON op.organization_id = r.organization_id
GROUP BY op.org_type
ORDER BY avg_score DESC;
```
