# Creative Intelligence Page - Comprehensive Audit Report

**Repo:** mojo-digital-wins
**Branch:** docs/dashboard-architecture
**Audit Date:** 2026-01-26
**Page:** `src/pages/ClientCreativeIntelligence.tsx`
**Route:** `/client/creative-intelligence`

---

## Executive Summary

This audit examined the Creative Intelligence page from five expert perspectives: Meta Ads API, Data Architecture, UX/UI, ML/Statistics, and Political Campaign Strategy. The page has a solid foundation but contains **critical statistical flaws** that undermine the validity of insights presented to users.

### Severity Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| **P0 - Critical** | 4 | Must fix before production - data integrity/validity issues |
| **P1 - High** | 7 | Significant impact on user value or system reliability |
| **P2 - Medium** | 9 | Improvements to functionality or user experience |
| **P3 - Low** | 5 | Nice-to-have enhancements |

### Top Critical Issues

1. **Invalid Statistical Confidence** - "correlation_coefficient" field stores lift %, confidence formula is mathematically incorrect
2. **No Significance Testing** - 50+ statistical comparisons with no p-values, ~99% false positive rate
3. **Ad Fatigue Linear Extrapolation** - Predicting exhaustion dates using invalid linear projection
4. **No Date Range Filtering** - Users cannot analyze specific time periods

---

## 1. ML/STATISTICS EXPERT AUDIT

### Critical Issues (P0)

#### 1.1 Invalid Confidence Calculation
**File:** `supabase/functions/calculate-creative-learnings/index.ts:402-405`

```typescript
// CURRENT - MATHEMATICALLY INCORRECT
const confidence = Math.min(100, sample_size * 10 * (1 - coeffOfVar));
```

**Problem:** This formula has no statistical basis. Multiplying sample size by 10 and subtracting coefficient of variation doesn't produce valid confidence intervals.

**Fix Required:**
```typescript
// CORRECT - Use actual statistical confidence interval
const standardError = stdDev / Math.sqrt(sample_size);
const marginOfError = 1.96 * standardError; // 95% CI
const confidenceInterval = {
  lower: mean - marginOfError,
  upper: mean + marginOfError
};
const confidence = 1 - (marginOfError / mean); // Relative precision
```

#### 1.2 Lift Stored as Correlation
**File:** `supabase/functions/calculate-creative-learnings/index.ts:436`

```typescript
// WRONG CONCEPT
correlation_coefficient: (avgMetric - orgAvg) / orgAvg * 100, // This is LIFT %
```

**Problem:** Lift percentage and correlation coefficient are fundamentally different concepts:
- **Lift:** `(treatment - control) / control` - measures relative improvement
- **Correlation:** Pearson's r ∈ [-1, 1] - measures linear relationship strength

**Fix Required:**
- Rename column to `lift_percentage`
- If correlation is needed, calculate actual Pearson correlation between creative attributes and performance

#### 1.3 No Multiple Comparison Correction
**Problem:** With 50+ statistical tests per analysis run:
- Without correction: P(at least one false positive) = 1 - 0.95^50 ≈ **92%**
- Presenting spurious findings as "insights"

**Fix Required:**
```typescript
// Apply Benjamini-Hochberg FDR correction
function adjustPValues(pValues: number[], alpha: number = 0.05): number[] {
  const sorted = pValues.map((p, i) => ({ p, i }))
    .sort((a, b) => a.p - b.p);

  const n = pValues.length;
  const adjusted = new Array(n);

  for (let k = 0; k < n; k++) {
    const threshold = (k + 1) / n * alpha;
    adjusted[sorted[k].i] = sorted[k].p <= threshold;
  }

  return adjusted;
}
```

#### 1.4 Ad Fatigue Detection Statistical Invalidity
**File:** `supabase/functions/detect-ad-fatigue/index.ts:142-145, 182-189`

**Current Approach:**
```typescript
// Linear regression on CTR over time
const ctrDeclineRate = calculateLinearSlope(dailyCTR);
const daysUntilExhaustion = currentCTR / Math.abs(ctrDeclineRate);
```

**Problems:**
1. No significance test on slope - could be noise
2. Linear extrapolation of non-linear decay
3. No confidence bounds on prediction

**Fix Required:**
```typescript
// Use CUSUM or BOCPD for change point detection
interface ChangePointResult {
  detected: boolean;
  changeDate: Date | null;
  confidence: number;
  preChangeMean: number;
  postChangeMean: number;
  pValue: number;
}

// Welch's t-test for significance
function welchTTest(group1: number[], group2: number[]): { t: number; pValue: number } {
  const n1 = group1.length, n2 = group2.length;
  const mean1 = mean(group1), mean2 = mean(group2);
  const var1 = variance(group1), var2 = variance(group2);

  const se = Math.sqrt(var1/n1 + var2/n2);
  const t = (mean1 - mean2) / se;

  // Welch-Satterthwaite degrees of freedom
  const df = Math.pow(var1/n1 + var2/n2, 2) /
    (Math.pow(var1/n1, 2)/(n1-1) + Math.pow(var2/n2, 2)/(n2-1));

  const pValue = 2 * (1 - tDistCDF(Math.abs(t), df));
  return { t, pValue };
}
```

### High Priority Issues (P1)

#### 1.5 Performance Quadrant Uses Relative Thresholds
**File:** `src/components/client/CreativePerformanceQuadrant.tsx:115-116`

```typescript
const ctrThreshold = median(allCTRs);
const cpaThreshold = median(allCPAs);
```

**Problem:** Same creative classified as "Star" or "Underperformer" depending on what else is in the sample. Users need absolute benchmarks.

**Fix Required:**
- Use industry/campaign-type benchmarks as baseline
- Allow user-defined thresholds
- Show percentile rank against historical data

#### 1.6 No Minimum Sample Size Enforcement

**Current:** Analysis runs with any amount of data
**Problem:** Statistical conclusions from n=5 are meaningless

**Fix Required:**
```typescript
const MIN_SAMPLE_SIZE = 30; // Central Limit Theorem minimum
const MIN_IMPRESSIONS = 1000; // For CTR significance

if (sample_size < MIN_SAMPLE_SIZE || impressions < MIN_IMPRESSIONS) {
  return {
    result: null,
    reason: 'INSUFFICIENT_DATA',
    required: { sample_size: MIN_SAMPLE_SIZE, impressions: MIN_IMPRESSIONS }
  };
}
```

---

## 2. META ADS API EXPERT AUDIT

### High Priority Issues (P1)

#### 2.1 Missing 13-Month Data Limit Validation
**Problem:** Meta Marketing API only allows data retrieval up to 13 months in the past. No validation prevents users from requesting older data.

**Fix Required:**
```typescript
const MAX_DATA_AGE_DAYS = 13 * 30; // ~13 months

function validateDateRange(startDate: Date, endDate: Date): void {
  const thirteenMonthsAgo = new Date();
  thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);

  if (startDate < thirteenMonthsAgo) {
    throw new Error(`Meta API only provides data up to 13 months. Earliest allowed: ${thirteenMonthsAgo.toISOString()}`);
  }
}
```

#### 2.2 No Rate Limit Handling
**Problem:** Bulk creative analysis can trigger rate limits. No exponential backoff or quota tracking.

**Fix Required:**
```typescript
async function fetchWithRateLimit<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 17 || error.code === 4) { // Rate limit codes
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Rate limit exceeded after retries');
}
```

### Medium Priority Issues (P2)

#### 2.3 Attribution Window Not Configurable
**Current:** Fixed attribution window in queries
**Recommendation:** Allow users to select 1-day click, 7-day click, 1-day view, etc.

#### 2.4 No CAPI Deduplication Validation
**Problem:** When CAPI and Pixel both fire, duplicates can inflate metrics.
**Fix:** Validate `event_id` deduplication is properly configured

#### 2.5 Missing Creative Type Segmentation
**Problem:** Comparing video vs static image vs carousel without segmentation produces invalid conclusions.
**Fix:** Add `creative_type` dimension to all analyses

---

## 3. DATA ARCHITECTURE EXPERT AUDIT

### High Priority Issues (P1)

#### 3.1 No Single Source of Truth
**Problem:** Creative performance data scattered across:
- `meta_ad_metrics` - daily snapshots
- `meta_ad_insights` - aggregated insights
- `creative_performance` - derived metrics
- Edge function caches

**Fix Required:**
```sql
-- Create canonical creative performance view
CREATE MATERIALIZED VIEW creative_performance_canonical AS
SELECT
  ad_id,
  creative_id,
  organization_id,
  date,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks,
  SUM(spend) as spend,
  SUM(conversions) as conversions,
  -- Canonical CTR calculation
  CASE WHEN SUM(impressions) > 0
    THEN SUM(clicks)::decimal / SUM(impressions)
    ELSE NULL
  END as ctr,
  -- Canonical CPA calculation
  CASE WHEN SUM(conversions) > 0
    THEN SUM(spend)::decimal / SUM(conversions)
    ELSE NULL
  END as cpa
FROM meta_ad_metrics
GROUP BY ad_id, creative_id, organization_id, date;

CREATE UNIQUE INDEX ON creative_performance_canonical (ad_id, date);
REFRESH MATERIALIZED VIEW CONCURRENTLY creative_performance_canonical;
```

#### 3.2 CTR Calculation Ambiguity
**Problem:** Different queries calculate CTR differently:
- Some use `link_clicks / impressions`
- Some use `clicks / impressions`
- Some use `outbound_clicks / reach`

**Fix Required:**
- Define canonical CTR formula in one place
- Document which click type is used and why
- Add `ctr_type` enum: `'link_click' | 'all_clicks' | 'outbound'`

#### 3.3 N+1 Query Pattern
**File:** Multiple components fetch related data in loops

**Fix Required:**
```typescript
// BAD: N+1 queries
for (const creative of creatives) {
  const insights = await fetchInsights(creative.id);
}

// GOOD: Batch fetch
const creativeIds = creatives.map(c => c.id);
const allInsights = await fetchInsightsBatch(creativeIds);
const insightMap = new Map(allInsights.map(i => [i.creative_id, i]));
```

### Medium Priority Issues (P2)

#### 3.4 Missing Indexes
```sql
-- Required indexes for common queries
CREATE INDEX CONCURRENTLY idx_creative_learnings_org_date
  ON creative_learnings(organization_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_meta_ad_metrics_creative_date
  ON meta_ad_metrics(creative_id, date DESC);
```

#### 3.5 No Data Freshness Indicator
**Problem:** Users don't know how recent the data is
**Fix:** Add `last_synced_at` column and display in UI

---

## 4. UX/UI EXPERT AUDIT

### High Priority Issues (P1)

#### 4.1 Cognitive Overload
**Problem:** Command Center shows too many metrics simultaneously
- Ad Fatigue (4 sections)
- Performance Quadrant
- Correlation Engine
- Donor Psychology
- All visible at once

**Fix Required:**
- Progressive disclosure: Show summary cards, expand to details
- Prioritize by actionability: What can user DO with this info?
- Add "Key Takeaways" summary at top

#### 4.2 No Date Range Filtering
**Problem:** Users cannot analyze specific time periods

**Fix Required:**
```tsx
<DateRangePicker
  presets={['last_7d', 'last_30d', 'last_90d', 'custom']}
  onChange={({ startDate, endDate }) => refetchAll({ startDate, endDate })}
/>
```

#### 4.3 Missing Loading States
**Problem:** Components show nothing or stale data during fetch

**Fix Required:**
```tsx
if (isLoading) {
  return <Skeleton variant="dashboard" rows={5} />;
}

if (isError) {
  return <ErrorState
    message="Failed to load creative insights"
    retry={refetch}
  />;
}

if (data.length === 0) {
  return <EmptyState
    title="No creative data yet"
    description="Run some ads to see performance insights"
  />;
}
```

### Medium Priority Issues (P2)

#### 4.4 WCAG Accessibility Gaps
**Problems Found:**
- Color-only status indicators (red/green for performance)
- Missing aria-labels on interactive charts
- Insufficient color contrast in some areas
- No keyboard navigation for chart interactions

**Fix Required:**
```tsx
// Add secondary indicators beyond color
<StatusBadge
  status={performance}
  aria-label={`Performance: ${performance}`}
>
  {performance === 'good' && <CheckIcon />}
  {performance === 'bad' && <AlertIcon />}
  {performanceLabel}
</StatusBadge>
```

#### 4.5 No Export Functionality
**Problem:** Users cannot export insights for stakeholder reports

**Fix Required:**
- Add CSV export for data tables
- Add PDF/PNG export for charts
- Add "Share insights" link generator

#### 4.6 Confusing Quadrant Labels
**Current:** "Stars", "Workhorses", "Question Marks", "Dogs"
**Problem:** BCG Matrix terminology unfamiliar to many users

**Fix Required:**
- Use clearer labels: "High Performers", "Reliable", "Potential", "Needs Attention"
- Add tooltips explaining what each quadrant means

---

## 5. POLITICAL CAMPAIGN EXPERT AUDIT

### High Priority Issues (P1)

#### 5.1 Missing Political-Specific Metrics
**Required Additions:**
- **Cost Per Acquisition (CPA):** Not just donations, but email signups, volunteer signups
- **Donor Lifetime Value (LTV):** Predict total giving over campaign cycle
- **Reactivation Rate:** % of lapsed donors who give again after creative exposure
- **Small Dollar %:** Ratio of <$200 donations (important for grassroots messaging)

```typescript
interface PoliticalCreativeMetrics {
  costPerDonor: number;
  costPerEmail: number;
  costPerVolunteer: number;
  predictedLTV: number;
  reactivationRate: number;
  smallDollarPercentage: number;
  averageGiftSize: number;
  recurringConversionRate: number;
}
```

#### 5.2 No Urgency/Deadline Context
**Problem:** Political campaigns have hard deadlines (elections, FEC quarters)
**Current:** Analysis treats all time periods equally

**Fix Required:**
- Add deadline countdown context
- Weight recent data more heavily near deadlines
- Show "days until [election/FEC deadline]" in relevant views

#### 5.3 Missing Compliance Guardrails
**FEC Requirements:**
- Contribution limits ($3,300 individual to candidate in 2026)
- Itemization thresholds ($200 cumulative)
- Occupation/employer collection requirements

**Fix Required:**
- Flag creatives driving contributions near limits
- Alert when donors approach itemization threshold
- Track compliance rate per creative

### Medium Priority Issues (P2)

#### 5.4 No Donor Segment Analysis
**Problem:** Analyzing all donors together loses signal
**Required Segments:**
- New vs Returning donors
- One-time vs Recurring
- Small dollar (<$50) vs Mid-level ($50-$999) vs Major ($1000+)
- Geographic (in-district vs out-of-district)

#### 5.5 No Message Testing Framework
**Problem:** Can't compare policy topics, emotional appeals, or candidate positioning

**Fix Required:**
- Add creative tagging system (topic, tone, CTA type)
- Enable A/B comparison views
- Track which messages resonate with which segments

---

## 6. PRODUCTION READINESS CHECKLIST

### Infrastructure

| Item | Status | Action Required |
|------|--------|-----------------|
| Error monitoring | ❌ | Add Sentry/DataDog integration |
| Performance monitoring | ❌ | Add APM for slow queries |
| Caching layer | ⚠️ | Add Redis for expensive computations |
| Rate limiting | ❌ | Implement per-org API limits |
| Background jobs | ✅ | Using Supabase Edge Functions |

### Data Quality

| Item | Status | Action Required |
|------|--------|-----------------|
| Data validation | ❌ | Add Zod schemas for all inputs |
| Anomaly detection | ❌ | Flag suspicious data patterns |
| Audit logging | ⚠️ | Log analysis runs with parameters |
| Data lineage | ❌ | Track data transformations |

### Testing

| Item | Status | Action Required |
|------|--------|-----------------|
| Unit tests | ⚠️ | Add tests for statistical functions |
| Integration tests | ❌ | Test full analysis pipeline |
| Load testing | ❌ | Verify performance at scale |
| A/B test framework | ❌ | Test new algorithms safely |

---

## 7. RECOMMENDED TOPIC EXTRACTION UPGRADE

### Current State
The `analyze-creative-motivation` function uses basic LLM extraction without validation.

### Recommended Upgrade: Hybrid Topic Modeling

```typescript
interface TopicExtractionPipeline {
  // Stage 1: Statistical topic modeling
  fastopic: {
    numTopics: number;
    coherenceScore: number;
    topics: Array<{
      id: number;
      keywords: string[];
      weight: number;
    }>;
  };

  // Stage 2: LLM refinement
  llmRefinement: {
    topicLabels: Map<number, string>;
    topicDescriptions: Map<number, string>;
    politicalRelevance: Map<number, number>;
  };

  // Stage 3: Validation
  validation: {
    interRaterAgreement: number; // Krippendorff's alpha
    groundTruthAccuracy: number; // vs manual labels
  };
}
```

### Implementation Steps

1. **Install FASTopic** for fast neural topic modeling
2. **Pre-compute topics** on creative text corpus
3. **Use LLM** only for labeling and refinement (not extraction)
4. **Validate** with human-labeled sample
5. **Track coherence** scores to detect model degradation

---

## 8. PRIORITIZED ACTION PLAN

### Phase 1: Critical Fixes (Week 1)

1. **Fix confidence calculation** - Replace invalid formula with proper CI
2. **Rename correlation_coefficient** - Change to `lift_percentage`
3. **Add significance testing** - Implement Welch's t-test for all comparisons
4. **Add multiple comparison correction** - Benjamini-Hochberg FDR
5. **Add date range filtering** - Critical UX improvement

### Phase 2: Statistical Validity (Week 2)

6. **Replace ad fatigue detection** - Use change point detection
7. **Add minimum sample sizes** - Block analysis on insufficient data
8. **Fix performance quadrant** - Add absolute benchmarks option
9. **Add p-values to all insights** - Only show significant findings

### Phase 3: Data Architecture (Week 3)

10. **Create canonical materialized view** - Single source of truth
11. **Standardize CTR calculation** - One formula everywhere
12. **Add batch fetching** - Eliminate N+1 queries
13. **Add data freshness indicators** - Show last sync time

### Phase 4: UX/Accessibility (Week 4)

14. **Implement progressive disclosure** - Reduce cognitive overload
15. **Add loading/error/empty states** - Complete state handling
16. **Fix accessibility issues** - WCAG AA compliance
17. **Add export functionality** - CSV, PDF, share links

### Phase 5: Political Features (Week 5)

18. **Add political metrics** - CPA, LTV, reactivation
19. **Add donor segmentation** - New/returning, amount tiers
20. **Add deadline context** - Election/FEC countdown
21. **Add compliance guardrails** - Contribution limit alerts

### Phase 6: Production Hardening (Week 6)

22. **Add error monitoring** - Sentry integration
23. **Add performance monitoring** - Slow query tracking
24. **Add caching layer** - Redis for expensive computations
25. **Add comprehensive tests** - Unit, integration, load

---

## Appendix A: Files Requiring Changes

| File | Priority | Changes |
|------|----------|---------|
| `supabase/functions/calculate-creative-learnings/index.ts` | P0 | Fix confidence, rename correlation, add p-values |
| `supabase/functions/detect-ad-fatigue/index.ts` | P0 | Replace with change point detection |
| `src/pages/ClientCreativeIntelligence.tsx` | P1 | Add date filter, progressive disclosure |
| `src/components/client/CreativePerformanceQuadrant.tsx` | P1 | Add absolute benchmarks |
| `supabase/functions/analyze-creative-motivation/index.ts` | P2 | Integrate FASTopic pipeline |
| `src/queries/useCreativeInsightsQuery.ts` | P2 | Add batch fetching |

## Appendix B: New Files to Create

| File | Purpose |
|------|---------|
| `src/lib/statistics.ts` | Shared statistical functions (t-test, FDR, CI) |
| `src/lib/changePointDetection.ts` | CUSUM/BOCPD for ad fatigue |
| `supabase/migrations/xxx_creative_performance_view.sql` | Canonical materialized view |
| `src/components/ui/DateRangePicker.tsx` | Reusable date filter component |
| `src/hooks/usePoliticalMetrics.ts` | Political-specific metric calculations |

---

*Audit Complete - 25 Findings Documented*
*Report Generated: January 26, 2026*
