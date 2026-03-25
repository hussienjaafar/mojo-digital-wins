# Algorithm Fairness Auditor

**Role:** AI Ethics Specialist / Ethical AI Auditor
**Audit Type:** Algorithmic Fairness & Bias Detection
**Reference:** [BABL AI Algorithm Auditor Certification](https://courses.babl.ai/p/ai-and-algorithm-auditor-certification), [Royal Society - Algorithm Auditing](https://royalsocietypublishing.org/doi/10.1098/rsos.230859), [ISACA - AI Algorithm Audits](https://www.isaca.org/resources/isaca-journal/issues/2021/volume-6/algorithms-and-the-auditor)

## Audit Objectives

1. Detect bias in scoring algorithms
2. Ensure fairness across organization types
3. Verify transparency of decision-making
4. Check for unintended discriminatory outcomes
5. Validate scoring algorithm explainability

## Fairness Dimensions to Evaluate

Based on research, fairness in recommendation systems can be measured across multiple dimensions:

### 1. Group Fairness
- Do different organization types receive equitable treatment?
- Are small vs. large organizations scored fairly?
- Do newer vs. established organizations have equal opportunity?

### 2. Individual Fairness
- Are similar organizations receiving similar recommendations?
- Is there consistency in scoring for similar trend-profile combinations?

### 3. Calibration Fairness
- Are confidence scores well-calibrated across groups?
- Do relevance predictions match actual relevance?

## Audit Checklist

### 1. Scoring Algorithm Bias Analysis

**Files to Examine:**
- `supabase/functions/_shared/orgRelevanceV3.ts`
- `supabase/functions/compute-org-relevance/index.ts`

**Checks:**
- [ ] Scoring formula does not systematically favor certain organization types
- [ ] No hardcoded biases toward specific domains
- [ ] Watchlist matching is not overly influential
- [ ] Geographic matching doesn't disadvantage certain regions
- [ ] Scoring breakdown is transparent and auditable

**Bias Test: Organization Type**
```sql
-- Check score distribution by org type
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
```

**Expected:** Scores should be similar across org types (within 1 stddev)

### 2. Cold Start Bias Detection

**Problem:** New organizations with no history may be disadvantaged

**Checks:**
- [ ] New orgs can achieve high relevance scores (60+) without history
- [ ] NEW_OPPORTUNITY flag helps new orgs discover relevant content
- [ ] Profile-based scoring (70%) is sufficient for good recommendations
- [ ] No minimum history requirement for basic functionality

**Test Query:**
```sql
-- Compare new vs established org scores
WITH org_history AS (
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
  h.maturity,
  COUNT(DISTINCT r.organization_id) as org_count,
  AVG(r.relevance_score) as avg_score,
  AVG(CASE WHEN r.is_new_opportunity THEN 1 ELSE 0 END) as new_opp_rate
FROM org_trend_relevance_cache r
JOIN org_history h ON h.id = r.organization_id
GROUP BY h.maturity;
```

### 3. Geographic Bias Detection

**Checks:**
- [ ] Organizations in all states receive equitable recommendations
- [ ] National organizations don't dominate over local
- [ ] International news doesn't crowd out domestic priorities
- [ ] Geographic matching boost (5 pts) is appropriate

**Test Query:**
```sql
-- Check score distribution by org geography
SELECT
  unnest(op.geographies) as geo,
  COUNT(DISTINCT r.organization_id) as org_count,
  AVG(r.relevance_score) as avg_score
FROM org_trend_relevance_cache r
JOIN org_profiles op ON op.organization_id = r.organization_id
GROUP BY geo
HAVING COUNT(DISTINCT r.organization_id) >= 3
ORDER BY avg_score DESC
LIMIT 20;
```

### 4. Domain Bias Detection

**Problem:** Some policy domains may systematically receive higher/lower scores

**Checks:**
- [ ] All 12 policy domains have comparable average scores
- [ ] Domain-specific keywords have balanced weights
- [ ] No domain is systematically disadvantaged

**Test Query:**
```sql
-- Check relevance by matched domain
SELECT
  unnest(r.matched_domains) as domain,
  COUNT(*) as matches,
  AVG(r.relevance_score) as avg_score,
  MIN(r.relevance_score) as min_score,
  MAX(r.relevance_score) as max_score
FROM org_trend_relevance_cache r
GROUP BY domain
ORDER BY avg_score DESC;
```

**Expected:** Domain scores should be within 10 points of each other

### 5. Scoring Transparency Audit

**Checks:**
- [ ] Every score has documented reasons
- [ ] Scoring breakdown is stored and retrievable
- [ ] Users can understand why they see specific trends
- [ ] Score factors are human-readable

**Code Review:**
```typescript
// Check that relevance reasons are always populated
// In orgRelevanceV3.ts - verify reasons array is never empty
if (result.reasons.length === 0) {
  result.reasons.push('No specific topic or entity matches found');
}
```

### 6. Outcome Fairness (Feedback Loop Audit)

**Problem:** Learning from outcomes can amplify initial biases

**Files to Examine:**
- `supabase/functions/update-org-affinities/index.ts`
- `supabase/functions/correlate-trends-campaigns/index.ts`

**Checks:**
- [ ] Campaign performance baseline is fair across org types
- [ ] Affinity updates use exponential moving average (prevents sudden shifts)
- [ ] Affinity score is clamped (0.2-0.95) to prevent extremes
- [ ] Decay mechanism prevents permanent amplification
- [ ] "Rich get richer" effect is mitigated

**Feedback Loop Risk Assessment:**
```
Scenario: Org A has more campaigns → more data → better affinities → higher scores → more engagement → more campaigns

Mitigation Check:
- [ ] Affinity capped at 20% influence ✓
- [ ] Profile-based scoring independent of history ✓
- [ ] New opportunity bonus for unexplored topics ✓
- [ ] Decay prevents permanent advantage ✓
```

### 7. Political Neutrality Audit

**Critical for political tech platforms**

**Checks:**
- [ ] Scoring does not favor left/right political orientation
- [ ] Conservative and progressive sources equally weighted
- [ ] No partisan bias in keyword selection
- [ ] Entity detection covers politicians from all parties

**Keyword Balance Check:**
```typescript
// In policyDomainKeywords.ts - verify political balance
// Count keywords that might be associated with each political leaning
// Ensure approximate balance
```

## Fairness Metrics to Calculate

### 1. Demographic Parity
```
P(high_relevance | org_type=A) ≈ P(high_relevance | org_type=B)
```

### 2. Equalized Odds
```
P(shown_trend | actually_relevant, org_type=A) ≈
P(shown_trend | actually_relevant, org_type=B)
```

### 3. Predictive Parity
```
P(actually_relevant | shown_trend, org_type=A) ≈
P(actually_relevant | shown_trend, org_type=B)
```

## Findings Template

### Finding: [TITLE]
**Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO
**Category:** Bias | Unfairness | Transparency Gap | Feedback Loop Risk
**Affected Groups:** [Which organization types/regions/domains]

**Statistical Evidence:**
- Group A avg score: X
- Group B avg score: Y
- Difference: Z (p-value if applicable)

**Description:**
[What was found]

**Fairness Impact:**
[Who is disadvantaged and how]

**Recommendation:**
[Specific algorithmic adjustment or parameter change]

---

## Red Flags to Watch For

1. **Score variance > 2x between org types** - Potential systematic bias
2. **New orgs scoring < 50% of established orgs** - Cold start problem
3. **Single domain avg score 20+ points higher** - Domain bias
4. **Affinity scores clustering at extremes** - Feedback loop runaway
5. **Geographic score variance > 15 points** - Geographic bias
6. **Missing reasons in scoring** - Transparency failure

## Audit Execution Instructions

1. Run statistical queries for all bias dimensions
2. Calculate fairness metrics across groups
3. Review scoring algorithm for hardcoded biases
4. Test cold start scenarios with synthetic orgs
5. Analyze feedback loop potential
6. Document all findings with statistical evidence
7. Recommend specific parameter adjustments
8. Propose A/B tests to validate fixes
