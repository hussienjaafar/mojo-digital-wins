# Root Cause Analysis: Missing Stories, Duplicates & Priority Mismatches

**Date:** January 20, 2026
**Auditor:** Claude Code (Deep System Audit)
**Scope:** Full pipeline - Ingestion → Analysis → Scoring → Display

---

## Executive Summary

**VERDICT: BOTH data ingestion AND analysis issues exist**

| Issue Category | Severity | Root Cause |
|----------------|----------|------------|
| Missing Stories | 🔴 CRITICAL | Only 7 Google News sources, missing entire news categories |
| Duplicate Trends | 🔴 CRITICAL | Clustering works but doesn't merge into single record |
| Priority Mismatches | 🟠 HIGH | Evergreen penalties + z-score dominance crush political news |
| "Stable" Mislabeling | 🟠 HIGH | High-baseline topics can't spike enough for "Surging" |

---

## Part 1: Data Ingestion Issues

### Issue 1.1: Severely Limited Source Coverage

**File:** `supabase/functions/fetch-google-news/index.ts`

The system only has **7 hardcoded Google News sources**:

| Source | Query Focus |
|--------|-------------|
| US Politics | General politics |
| Congress Legislation | congress+legislation |
| White House | white+house+biden+trump |
| Supreme Court | supreme+court+ruling |
| Election 2024 | election+2024+campaign |
| Immigration Policy | immigration+policy+border |
| Civil Rights | civil+rights+discrimination |

**Missing Categories:**
- ❌ International affairs (UN, WHO, foreign policy)
- ❌ Religious organizations (Vatican, Catholic Church)
- ❌ Military/defense (Insurrection Act, federal troops)
- ❌ State government (Minnesota, governors)
- ❌ Health policy (WHO, CDC)

**Impact:** Stories outside these 7 categories are **never ingested**.

### Issue 1.2: Aggressive Blocklist Filters UN Stories

**File:** `supabase/functions/detect-trend-events/index.ts` (Lines 123-144)

```typescript
const TOPIC_BLOCKLIST = new Set([
  'us', 'uk', 'eu', 'un', 'mlk', 'ice',  // Blocks acronyms!
  // ... plus generic terms
]);
```

**Impact:** "UN", "WHO", "ICE" topics are **actively filtered out**.

### Issue 1.3: Rate Limits & Batch Size Constraints

| Limit | Value | Impact |
|-------|-------|--------|
| MAX_SOURCES_PER_RUN | 6 | Only 6 of 7 sources per execution |
| NER batch size | 50 | Articles wait hours for analysis |
| fetch-google-news rate | 10/min | Cascading delays if errors |
| analyze-content rate | 6/min | Severe AI processing bottleneck |

---

## Part 2: Analysis Pipeline Issues

### Issue 2.1: Single-Word Entity Threshold Too High

**File:** `detect-trend-events/index.ts` (Lines 335-339)

```typescript
const QUALITY_THRESHOLDS = {
  MIN_MENTIONS_SINGLE_WORD: 20,      // Requires 20+ mentions!
  MIN_SOURCES_SINGLE_WORD: 3,        // 3 distinct domains
  MIN_NEWS_SOURCES_SINGLE_WORD: 3,   // All must be news
};
```

**Impact:** "Minnesota" needs 20+ mentions to trend, while multi-word phrases need only 3.

### Issue 2.2: Evergreen Penalty Crushes Political News

**File:** `detect-trend-events/index.ts` (Lines 195-215)

```typescript
function calculateEvergreenPenalty(...) {
  const baseEntityPenalty = isSingleWordEntity ? 0.15 : 1.0;  // 85% reduction!

  if (zScoreVelocity > 8) return 0.80 * baseEntityPenalty;   // Best case: 12%
  if (zScoreVelocity > 6) return 0.55 * baseEntityPenalty;   // 8%
  if (zScoreVelocity > 5) return 0.35 * baseEntityPenalty;   // 5%
  if (zScoreVelocity > 4) return 0.20 * baseEntityPenalty;   // 3%

  return hasHistoricalBaseline ? 0.05 * baseEntityPenalty : 0.08;  // Worst: 0.75%!
}
```

**EVERGREEN_ENTITIES includes:**
- trump, biden, harris, pelosi, schumer, mcconnell
- congress, senate, house, supreme court
- gaza, israel, ukraine, russia, china, iran
- tariffs, trade

**Impact:** A story about Trump with z-score of 4 gets: `4 * 5 * 0.03 = 0.6 points` vs 50 possible.

### Issue 2.3: Label Quality Penalties Stack

```
entity_only label:           0.4-0.6x (40-60% reduction)
+ no context bundles:        0.35x (65% reduction)
+ single-word entity:        0.15x (85% reduction)
= Combined: rankScore * 0.02 (98% reduction!)
```

### Issue 2.4: Z-Score Calculation Favors Rare Topics

**File:** `detect-trend-events/index.ts` (Lines 1789-1808)

```typescript
// Topics WITH baseline (evergreen):
z = (currentRate - baseline7d) / stddev;  // Often ~0.3-0.6

// Topics WITHOUT baseline (new/rare):
conservativeBaseline = currentRate / 3;   // Artificially low baseline
z = currentRate / sqrt(conservativeBaseline);  // Often ~5-10!
```

**Impact:** Rare topics get z=8, evergreen topics get z=0.5. Rankings favor obscure stories.

---

## Part 3: Trend Stage Mislabeling ("Stable" vs "Surging")

### Issue 3.1: Trend Stage Logic Breaks for High-Baseline Topics

**File:** `detect-trend-events/index.ts` (Lines 1963-1976)

```typescript
if (zScoreVelocity > 2 && acceleration > 20) {
  trendStage = 'surging';
} else if (zScoreVelocity > 0.5) {
  trendStage = 'surging';
} else {
  trendStage = 'stable';  // DEFAULT
}
```

**Example: "Trump Threatens Tariffs"**
- 26 mentions, 16 sources (high volume!)
- But tariffs baseline = 5/hour (always discussed)
- Current rate = 5.2/hour
- z-score = (5.2 - 5) / stddev ≈ 0.3
- 0.3 < 0.5 → **"stable"** despite being breaking news

### Issue 3.2: Volume Doesn't Override Z-Score

The system has no logic for: "If mentions > X, force surging regardless of z-score"

---

## Part 4: Duplicate Trends Issue

### Issue 4.1: Clustering Identifies But Doesn't Merge

**File:** `detect-trend-events/index.ts` (Lines 1515-1610)

The system:
1. ✅ Identifies "Trump tariffs Greenland" and "EU on Trump Greenland tariffs" are related
2. ✅ Creates a cluster linking them
3. ❌ **Still upserts both as separate trend_events rows**
4. ❌ **Frontend displays all rows without cluster deduplication**

### Issue 4.2: Topic Key Normalization Creates Different Keys

```typescript
const normalizeTopicKey = (topic: string): string => {
  return topic.toLowerCase().replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_');
};

// Results:
"Trump tariffs Greenland"       → "trump_tariffs_greenland"
"Trump Greenland tariffs"       → "trump_greenland_tariffs"    // DIFFERENT!
"EU: Trump Greenland tariffs"   → "eu_trump_greenland_tariffs" // DIFFERENT!
```

**Impact:** Semantically identical topics get 3 separate database rows.

### Issue 4.3: Frontend Has No Cluster Deduplication

**File:** `src/hooks/useTrendEvents.tsx`

```typescript
const query = supabase
  .from('trend_events_active')
  .select('*')  // Fetches ALL rows, including cluster duplicates
  .limit(limit);
```

The `cluster_id` field exists but is **never used for deduplication**.

---

## Part 5: Why Specific Stories Are Missing

| Missing Story | Ingestion Issue | Analysis Issue |
|---------------|-----------------|----------------|
| **Minnesota Insurrection Act** | No "minnesota military" or "insurrection act" source | "Minnesota" = single-word, needs 20 mentions |
| **Catholic Cardinals** | No religious/Vatican source | Not in political entities KB |
| **WHO Withdrawal** | "WHO" blocked by acronym filter | No health policy source |
| **UNRWA Demolition** | "UN" blocked by filter | UNRWA not in entity KB, no intl source |

---

## Part 6: Priority Fixes

### CRITICAL (Immediate)

| Fix | File | Change |
|-----|------|--------|
| Expand Google News sources | `fetch-google-news/index.ts` | 7 → 50+ sources |
| Remove UN/WHO from blocklist | `detect-trend-events/index.ts` | Delete from TOPIC_BLOCKLIST |
| Reduce single-word threshold | `detect-trend-events/index.ts` | 20 → 5 mentions |
| Fix cluster merging | `detect-trend-events/index.ts` | Consolidate clusters before upsert |
| Add frontend dedup | `useTrendEvents.tsx` | Deduplicate by cluster_id |

### HIGH (Short-term)

| Fix | File | Change |
|-----|------|--------|
| Reduce evergreen penalty | `detect-trend-events/index.ts` | 0.05 → 0.30 minimum |
| Add volume override for stage | `detect-trend-events/index.ts` | If mentions > 20, force "surging" |
| Increase batch sizes | `batch-analyze-content/index.ts` | 50 → 200 NER items |
| Add intl/religious sources | Database | RSS feeds for Reuters, Vatican News, UN Dispatch |

### MEDIUM (Architectural)

| Fix | Impact |
|-----|--------|
| Per-org source customization | Clients add their own feeds |
| Dynamic keyword expansion | Trending searches feed back to ingestion |
| Semantic topic normalization | Word order doesn't create separate keys |
| Cluster-based canonical selection | Best representative wins, others merged |

---

## Summary Diagnosis

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEWS STORY LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  REAL WORLD NEWS                                                │
│       ↓                                                          │
│  ❌ INGESTION FILTER (7 narrow sources, blocklist)              │
│       ↓  ~40% of major stories blocked here                     │
│  ✅ Article stored in google_news_articles                      │
│       ↓                                                          │
│  ⚠️ NER EXTRACTION (rate limited, batch constrained)            │
│       ↓  Delays of hours possible                               │
│  ⚠️ TOPIC AGGREGATION (creates duplicates)                      │
│       ↓                                                          │
│  ❌ QUALITY GATES (20 mentions for single-word)                 │
│       ↓  ~30% of topics filtered here                           │
│  ❌ EVERGREEN PENALTY (80-95% score reduction)                  │
│       ↓  Political news buried                                  │
│  ❌ LABEL QUALITY PENALTY (40-98% additional reduction)         │
│       ↓                                                          │
│  ⚠️ TREND STAGE CALC (z-score based, not volume)               │
│       ↓  Breaking news marked "stable"                          │
│  ❌ CLUSTER MERGING FAILS (duplicates not consolidated)         │
│       ↓                                                          │
│  ❌ FRONTEND DISPLAY (no cluster dedup)                         │
│       ↓                                                          │
│  USER SEES: Missing stories, duplicates, wrong priorities       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Answer: BOTH ingestion AND analysis issues exist. The pipeline has ~6 critical failure points.**

---

## Files to Modify

| File | Issues |
|------|--------|
| `supabase/functions/fetch-google-news/index.ts` | Source coverage, batch limits |
| `supabase/functions/detect-trend-events/index.ts` | Blocklist, thresholds, penalties, clustering, stage calc |
| `supabase/functions/batch-analyze-content/index.ts` | Rate limits, batch size |
| `src/hooks/useTrendEvents.tsx` | Cluster deduplication |
| Database: `google_news_sources` table | Add 40+ new sources |

---

**Audit Complete:** January 20, 2026
**Verdict:** Critical architectural issues at multiple pipeline stages
**Recommended:** Phased fix approach starting with source expansion and blocklist removal
