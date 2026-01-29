# Creative Intelligence V2 Remediation Plan

**Created:** 2026-01-29
**Status:** Ready for Implementation
**Estimated Scope:** 6 focused agent tasks

## Executive Summary

The Creative Intelligence V2 system has critical gaps between design and implementation. This plan addresses the core issues preventing actionable insights:

1. **Statistical rigor removed** - FDR correction, p-values, effect size stripped from latest RPC
2. **Wrong data displayed** - "Political Stance" shows `tone` field, not `political_stances` array
3. **Topic extraction not validated** - LLM outputs accepted without coherence checks
4. **Unused extracted fields** - `issue_tags`, `policy_positions`, `donor_pain_points` never analyzed
5. **Invalid formulas** - Confidence calculation in edge function is mathematically incorrect
6. **Missing political features** - Donor segmentation, FEC compliance, election countdown

## Research Summary

### Statistical Methods (Sources: [Benjamini-Hochberg Procedure](https://www.statisticshowto.com/benjamini-hochberg-procedure/), [FDR Columbia](https://www.publichealth.columbia.edu/research/population-health-methods/false-discovery-rate))
- Benjamini-Hochberg controls FDR at specified level (typically 0.05)
- Must rank p-values, then compare each to (rank/total) × α
- PostgreSQL has no native FDR function - must implement in PL/pgSQL

### Ad Fatigue Detection (Sources: [Madgicx ML Algorithms](https://madgicx.com/blog/machine-learning-algorithms-for-ad-fatigue-detection), [ACM FoRI Research](https://dl.acm.org/doi/10.1145/3583780.3615461))
- ML algorithms achieve 90-97% accuracy for predicting creative refresh need
- CTR declines 15% within first week, 40% with excessive frequency
- FoRI (Frequency over Recent Intervals) features improve detection
- Feed-based platforms: fatigue at 7-14 days; TikTok: 5-7 days

### Political Campaign Analytics (Sources: [Tech for Campaigns 2024 Report](https://www.techforcampaigns.org/results/2024-digital-ads-report), [ActBlue Q3 2024](https://live-actblue-blog.pantheonsite.io/2024/10/15/small-dollar-donors-power-historic-q3-surge-1-5-billion-raised-for-2024s-crucial-election/))
- Creative drives 47% of ad effectiveness
- 56.2% of small-dollar donors return to give multiple times
- Multi-touch attribution improves conversion tracking by 33%
- Influencer content sees 42% higher engagement than standard creative

### Topic Validation (Sources: [LLM Evaluation Guide](https://www.confident-ai.com/blog/llm-evaluation-metrics-everything-you-need-for-llm-evaluation), [ACL Topic Coherence](https://aclanthology.org/2024.findings-eacl.123.pdf))
- Coherence scores range -1 to 1 (higher = more interpretable)
- G-Eval uses chain-of-thought for evaluation steps
- Topic diversity = proportion of unique words across topics (0-1)
- Need 5 or fewer LLM evaluation metrics per pipeline

---

## Agent Task Breakdown

### Task 1: Restore Statistical Rigor to RPC
**Agent Type:** `feature-dev:code-architect` + implementation

**Objective:** Restore FDR correction, p-values, effect size, and statistical power to `get_creative_intelligence` RPC

**Files to Modify:**
- `supabase/migrations/` - Create new migration to update RPC

**Requirements:**
1. Implement Benjamini-Hochberg FDR correction in PL/pgSQL:
   ```sql
   -- Rank p-values ascending
   -- For each p-value at rank i: adjusted_p = p * (total / i)
   -- Mark significant if adjusted_p < 0.05
   ```
2. Add p-value calculation from z-scores (two-tailed)
3. Add Cohen's d effect size: `(mean - global_mean) / pooled_stddev`
4. Add statistical power estimation based on sample size and effect size
5. Enforce minimum sample size (n ≥ 3) before showing results

**Acceptance Criteria:**
- [ ] `issue_performance` includes `p_value`, `p_value_adjusted`, `is_significant`
- [ ] `effect_size` and `statistical_power` fields populated
- [ ] Results with n < 3 return `INSUFFICIENT_DATA` flag
- [ ] Unit tests for FDR calculation

---

### Task 2: Fix Political Stance Analysis
**Agent Type:** `feature-dev:code-architect` + implementation

**Objective:** Use actual `political_stances` array instead of `tone` field for Political Stance Performance

**Files to Modify:**
- `supabase/migrations/` - Update RPC
- `src/components/creative-intelligence/StancePerformanceChart.tsx` - Update UI labels if needed

**Requirements:**
1. Change RPC from:
   ```sql
   mci.tone as stance  -- WRONG
   ```
   To:
   ```sql
   UNNEST(mci.political_stances) as stance  -- CORRECT
   ```
2. Add stance-level statistical analysis (same as issue_performance):
   - Mean ROAS, stddev, confidence intervals
   - P-values with FDR correction
   - Effect size
3. Keep minimum threshold of 2+ creatives per stance
4. Handle NULL/empty arrays gracefully

**Acceptance Criteria:**
- [ ] Political Stance Performance shows actual stances (e.g., "anti-AIPAC", "pro-ceasefire")
- [ ] Statistical significance displayed for each stance
- [ ] Empty state when no stances extracted

---

### Task 3: Implement Topic Extraction Validation
**Agent Type:** `feature-dev:code-architect` + implementation

**Objective:** Add coherence scoring and validation layer for LLM topic extraction

**Files to Modify:**
- `supabase/functions/analyze-meta-creatives/index.ts`
- New: `supabase/functions/_shared/topic-validation.ts`

**Requirements:**
1. Add topic coherence scoring:
   - Calculate word embedding similarity within extracted topics
   - Flag low-coherence extractions (score < 0.3) for review
   - Store `topic_coherence_score` in `meta_creative_insights`

2. Add extraction confidence:
   - Use LLM self-evaluation (ask model to rate confidence 1-5)
   - Replace hardcoded `analysis_confidence: 0.85` with dynamic value

3. Add fallback patterns:
   - If LLM fails or returns low coherence, use regex patterns as backup
   - Log validation failures for monitoring

4. Add diversity check:
   - Ensure extracted `issue_tags` are not all duplicates of `issue_primary`
   - Flag suspiciously uniform extractions

**Acceptance Criteria:**
- [ ] `topic_coherence_score` field added to schema
- [ ] Dynamic `analysis_confidence` based on LLM self-rating
- [ ] Fallback to regex patterns when LLM coherence low
- [ ] Logging for validation metrics

---

### Task 4: Analyze Unused Extracted Fields
**Agent Type:** `feature-dev:code-architect` + implementation

**Objective:** Add analysis for `issue_tags`, `policy_positions`, `donor_pain_points`, `values_appealed`

**Files to Modify:**
- `supabase/migrations/` - Extend RPC
- `src/components/creative-intelligence/` - New visualization components

**Requirements:**
1. Add to RPC:
   ```sql
   -- Issue tags breakdown (secondary issues)
   issue_tags_performance AS (
     SELECT UNNEST(issue_tags) as tag, ...
   ),

   -- Policy position effectiveness
   policy_performance AS (
     SELECT UNNEST(policy_positions) as policy, ...
   ),

   -- Donor psychology correlations
   pain_point_performance AS (
     SELECT UNNEST(donor_pain_points) as pain_point, AVG(roas), ...
   ),

   -- Values that drive conversions
   values_performance AS (
     SELECT UNNEST(values_appealed) as value, AVG(roas), ...
   )
   ```

2. Add FDR correction to all new analyses

3. Create UI components:
   - `DonorPsychologyCard` - Top pain points and values by ROAS
   - `PolicyEffectivenessChart` - Which policies resonate
   - `IssueTagsBreakdown` - Secondary issue analysis

**Acceptance Criteria:**
- [ ] RPC returns `pain_point_performance`, `values_performance`, `policy_performance`
- [ ] All arrays analyzed with statistical significance
- [ ] New UI components display actionable insights
- [ ] "Top 3 donor pain points by ROAS" visible in dashboard

---

### Task 5: Fix Edge Function Statistical Issues
**Agent Type:** `feature-dev:code-architect` + implementation

**Objective:** Fix invalid confidence formula in `calculate-creative-learnings` and add FDR correction

**Files to Modify:**
- `supabase/functions/calculate-creative-learnings/index.ts`

**Requirements:**
1. Fix invalid confidence formula (line ~405):
   ```typescript
   // BEFORE (invalid):
   const confidenceLevel = Math.min(100, (withRoas.length * 10) * (1 - Math.min(coeffOfVar, 0.9)));

   // AFTER (proper 95% CI):
   const standardError = stdDev / Math.sqrt(withRoas.length);
   const ciWidth = 1.96 * standardError;
   const confidenceLevel = Math.max(0, Math.min(100,
     100 * (1 - ciWidth / Math.abs(avgRoas))
   ));
   ```

2. Add FDR correction to array-based correlations:
   - Collect all p-values from pain_point_roas, values_roas, etc.
   - Apply Benjamini-Hochberg across all tests
   - Only mark `is_actionable: true` if FDR-adjusted p < 0.05

3. Rename `correlation_coefficient` field to `lift_percentage` for semantic clarity

4. Add minimum sample check: require n ≥ 3 before calculating correlations

**Acceptance Criteria:**
- [ ] Confidence formula mathematically valid
- [ ] FDR correction applied to all array correlations
- [ ] 92% false positive rate reduced to ~5%
- [ ] Field naming semantically correct

---

### Task 6: Implement Political Campaign Features
**Agent Type:** `feature-dev:code-architect` + implementation

**Objective:** Add donor segmentation, FEC compliance indicators, and election countdown

**Files to Modify:**
- `supabase/migrations/` - Add columns to `client_organizations`
- `supabase/migrations/` - Extend RPC for donor data
- `src/components/creative-intelligence/DonorSegmentationCard.tsx` - Already exists, needs data
- `src/components/creative-intelligence/ElectionCountdown.tsx` - Already exists, needs backend

**Requirements:**
1. **Donor Segmentation** (from ActBlue data):
   ```sql
   donor_segmentation AS (
     SELECT
       COUNT(*) FILTER (WHERE amount < 200) as small_dollar_count,
       SUM(amount) FILTER (WHERE amount < 200) as small_dollar_total,
       COUNT(*) FILTER (WHERE amount >= 200) as large_dollar_count,
       SUM(amount) FILTER (WHERE amount >= 200) as large_dollar_total,
       COUNT(DISTINCT donor_email) FILTER (WHERE contribution_count > 1) as repeat_donors,
       AVG(amount) as avg_contribution
     FROM actblue_transactions
     WHERE organization_id = p_organization_id
   )
   ```

2. **FEC Compliance Indicators**:
   - Track "Paid for by" disclaimer presence in creatives
   - Flag ads missing required disclosures
   - Add `fec_compliant` boolean to recommendations

3. **Election Countdown**:
   - Add `election_date` column to `client_organizations`
   - Calculate days remaining
   - Add urgency weighting to recommendations:
     ```
     urgency_multiplier = 1 + (1 / days_remaining) when days_remaining < 30
     ```
   - Surface "URGENT" badge for creatives needing attention within 7 days of election

**Acceptance Criteria:**
- [ ] Donor segmentation shows small vs large dollar breakdown
- [ ] Repeat donor percentage displayed
- [ ] Election countdown functional with urgency indicators
- [ ] Recommendations weighted by election proximity

---

## Implementation Order

```
Task 1 (Statistical Rigor) ─────────────────────┐
                                                 │
Task 2 (Political Stances) ─────────────────────┼──► Task 4 (Unused Fields)
                                                 │
Task 3 (Topic Validation) ──────────────────────┘
                                                      │
Task 5 (Edge Function Fix) ───────────────────────────┘
                                                      │
                                                      ▼
                                            Task 6 (Political Features)
```

**Rationale:**
- Tasks 1-3 can run in parallel (independent concerns)
- Task 4 depends on 1-2 (needs FDR correction pattern, stance fix)
- Task 5 can run independently
- Task 6 should run last (builds on corrected data foundation)

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Issue Performance visibility | 0% (empty) | 80%+ with 2+ creatives per issue |
| False positive rate (correlations) | ~92% | <5% with FDR |
| Statistical significance testing | None | All insights have p-values |
| Unused field utilization | 0% | 100% (all extracted fields analyzed) |
| Topic extraction validation | None | Coherence score on all extractions |
| Political stance accuracy | 0% (shows tone) | 100% (shows actual stances) |
| Donor segmentation | Not functional | Full breakdown |
| Election countdown | UI only | Functional with urgency weighting |

---

## Verification Checklist

After implementation, verify:

1. **Issue Performance Rankings** shows actual issues (not empty)
2. **Political Stance Performance** shows stances like "anti-AIPAC", not "angry"
3. **All insights have confidence intervals and p-values**
4. **Donor Segmentation Card** shows real small/large dollar breakdown
5. **Election Countdown** calculates days and adjusts recommendations
6. **Console shows no RPC errors**
7. **TypeScript builds without errors**

---

## Agent Execution Commands

```bash
# Task 1: Statistical Rigor
claude --prompt "Execute Task 1 from docs/plans/2026-01-29-creative-intelligence-v2-remediation.md - Restore statistical rigor to get_creative_intelligence RPC"

# Task 2: Political Stances
claude --prompt "Execute Task 2 from docs/plans/2026-01-29-creative-intelligence-v2-remediation.md - Fix political stance analysis to use political_stances array"

# Task 3: Topic Validation
claude --prompt "Execute Task 3 from docs/plans/2026-01-29-creative-intelligence-v2-remediation.md - Implement topic extraction validation"

# Task 4: Unused Fields
claude --prompt "Execute Task 4 from docs/plans/2026-01-29-creative-intelligence-v2-remediation.md - Analyze unused extracted fields"

# Task 5: Edge Function Fix
claude --prompt "Execute Task 5 from docs/plans/2026-01-29-creative-intelligence-v2-remediation.md - Fix edge function statistical issues"

# Task 6: Political Features
claude --prompt "Execute Task 6 from docs/plans/2026-01-29-creative-intelligence-v2-remediation.md - Implement political campaign features"
```
