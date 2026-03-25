# Trend Detection Fix Plan - Phased Approach

**Date:** January 20, 2026
**Based on:** Root Cause Analysis Deep Audit

---

## Phase Overview

| Phase | Focus | Impact | Effort |
|-------|-------|--------|--------|
| **Phase 1** | Remove blocklist filters | 🔴 Critical | Low |
| **Phase 2** | Fix duplicate display | 🔴 Critical | Medium |
| **Phase 3** | Reduce scoring penalties | 🟠 High | Medium |
| **Phase 4** | Fix trend stage logic | 🟠 High | Low |
| **Phase 5** | Expand data sources | 🔴 Critical | High |
| **Phase 6** | Architectural improvements | 🟡 Medium | High |

---

## Phase 1: Remove Blocklist Filters
**Priority:** CRITICAL | **Effort:** LOW | **Impact:** Immediate

### Problem
UN/WHO/ICE stories are actively blocked by the TOPIC_BLOCKLIST.

### Files to Modify
- `supabase/functions/detect-trend-events/index.ts`

### Changes Required
1. Remove problematic acronyms from TOPIC_BLOCKLIST (lines 123-144)
2. Reduce single-word entity threshold from 20 → 8

### Lovable Prompt
```
Fix the topic blocklist in `supabase/functions/detect-trend-events/index.ts` to stop filtering legitimate news.

Changes needed:

1. Find TOPIC_BLOCKLIST (around line 123-144) and REMOVE these entries:
   - 'un' (blocks United Nations stories)
   - 'who' (blocks World Health Organization)
   - 'ice' (blocks Immigration and Customs Enforcement)
   - 'eu' (blocks European Union)
   - 'uk' (blocks United Kingdom)

   Keep generic terms like 'breaking', 'news', 'update', 'says' in the blocklist.

2. Find QUALITY_THRESHOLDS (around line 335) and change:
   - MIN_MENTIONS_SINGLE_WORD: from 20 to 8
   - MIN_SOURCES_SINGLE_WORD: from 3 to 2

3. Add logging to track what's being blocked:
   console.log(`[BLOCKLIST] Filtered topic: "${topic}" - matched blocklist`);

The goal is to allow UN, WHO, ICE, EU stories to surface while still filtering generic noise.
```

### Success Criteria
- [ ] WHO withdrawal stories appear in trends
- [ ] ICE-related stories not filtered
- [ ] Single-word entities with 8+ mentions can trend

---

## Phase 2: Fix Duplicate Display
**Priority:** CRITICAL | **Effort:** MEDIUM | **Impact:** Immediate

### Problem
"EU chief: Trump tariffs Greenland" appears 3 times because clustering identifies related topics but doesn't consolidate them.

### Files to Modify
- `supabase/functions/detect-trend-events/index.ts`
- `src/hooks/useTrendEvents.tsx`

### Changes Required
1. Consolidate cluster members before upsert
2. Add frontend deduplication by cluster_id

### Lovable Prompt
```
Fix duplicate trends appearing in the trending list.

PROBLEM: "EU chief: Proposed Trump tariffs over Greenland a 'mistake'" appears 3 times because related topics aren't being merged.

CHANGES NEEDED:

1. In `supabase/functions/detect-trend-events/index.ts`, after clustering is complete (around line 1600), add logic to consolidate cluster members:

   // Before upserting, merge cluster members into canonical representative
   const consolidatedEvents = new Map<string, TopicAggregate>();

   for (const [eventKey, agg] of topicMap.entries()) {
     const clusterId = agg.cluster_id || eventKey;

     if (!consolidatedEvents.has(clusterId)) {
       consolidatedEvents.set(clusterId, agg);
     } else {
       // Merge into existing canonical
       const canonical = consolidatedEvents.get(clusterId)!;
       // Keep higher-scoring version as canonical
       if (agg.rank_score > canonical.rank_score) {
         // Preserve merged mentions count
         agg.evidence_count += canonical.evidence_count;
         consolidatedEvents.set(clusterId, agg);
       } else {
         canonical.evidence_count += agg.evidence_count;
       }
     }
   }

   // Use consolidatedEvents for upsert instead of topicMap

2. In `src/hooks/useTrendEvents.tsx`, add post-fetch deduplication (around line 250):

   // Deduplicate by cluster_id, keeping highest rank_score
   const deduplicatedEvents = Array.from(
     (data || []).reduce((map, event) => {
       const key = event.cluster_id || event.id;
       const existing = map.get(key);
       if (!existing || event.rank_score > existing.rank_score) {
         map.set(key, event);
       }
       return map;
     }, new Map<string, TrendEvent>()).values()
   );

   setEvents(deduplicatedEvents as TrendEvent[]);

SUCCESS CRITERIA:
- Related topics should appear only once
- The highest-quality version should be displayed
- Evidence counts should be merged
```

### Success Criteria
- [ ] EU/Greenland story appears only once
- [ ] Cluster members are consolidated
- [ ] Evidence counts are properly merged

---

## Phase 3: Reduce Scoring Penalties
**Priority:** HIGH | **Effort:** MEDIUM | **Impact:** High

### Problem
Political stories get 80-98% score reductions due to stacked penalties.

### Files to Modify
- `supabase/functions/detect-trend-events/index.ts`

### Changes Required
1. Increase evergreen penalty floor from 0.05 to 0.30
2. Reduce entity-only penalty
3. Add high-velocity override

### Lovable Prompt
```
Reduce the aggressive scoring penalties that bury legitimate political news in `supabase/functions/detect-trend-events/index.ts`.

PROBLEM: Political stories get 80-98% score reductions due to:
- Evergreen penalty: 0.05-0.20x (95-80% reduction)
- Entity-only penalty: 0.35-0.6x (65-40% reduction)
- Single-word penalty: 0.15x (85% reduction)

CHANGES NEEDED:

1. Find `calculateEvergreenPenalty()` (around line 195) and INCREASE the minimum penalties:

   CHANGE FROM:
   if (zScoreVelocity > 8) return 0.80 * baseEntityPenalty;
   if (zScoreVelocity > 6) return 0.55 * baseEntityPenalty;
   if (zScoreVelocity > 5) return 0.35 * baseEntityPenalty;
   if (zScoreVelocity > 4) return 0.20 * baseEntityPenalty;
   return hasHistoricalBaseline ? 0.05 * baseEntityPenalty : 0.08 * baseEntityPenalty;

   CHANGE TO:
   if (zScoreVelocity > 6) return 0.95 * baseEntityPenalty;  // Almost no penalty for high spikes
   if (zScoreVelocity > 4) return 0.80 * baseEntityPenalty;
   if (zScoreVelocity > 3) return 0.65 * baseEntityPenalty;
   if (zScoreVelocity > 2) return 0.50 * baseEntityPenalty;
   return hasHistoricalBaseline ? 0.30 * baseEntityPenalty : 0.35 * baseEntityPenalty;  // Floor of 0.30

2. Change single-word base penalty (around line 197):
   FROM: const baseEntityPenalty = isSingleWordEntity ? 0.15 : 1.0;
   TO:   const baseEntityPenalty = isSingleWordEntity ? 0.40 : 1.0;

3. Find the label quality modifier in `calculateRankScore()` (around line 300) and increase entity-only scores:
   FROM: entity_only without tier1/2 = 0.4
   TO:   entity_only without tier1/2 = 0.6

4. Add a HIGH VOLUME override - if a topic has 15+ mentions in 24h, apply minimum 0.5x penalty regardless of other factors:

   // At the end of penalty calculation:
   if (current24h >= 15) {
     return Math.max(calculatedPenalty, 0.5);  // High volume gets at least 50% of score
   }

SUCCESS CRITERIA:
- Political stories should rank in top 20 when they have 20+ mentions
- Evergreen topics with high velocity should score competitively
- "Trump Threatens Tariffs" with 26 mentions should rank higher than 3-mention stories
```

### Success Criteria
- [ ] Political topics with 20+ mentions rank in top 20
- [ ] Evergreen penalty floor is 0.30 (not 0.05)
- [ ] High-volume stories not buried

---

## Phase 4: Fix Trend Stage Logic
**Priority:** HIGH | **Effort:** LOW | **Impact:** Medium

### Problem
"Trump Threatens Tariffs" marked "Stable" despite 26 mentions because z-score is low against high baseline.

### Files to Modify
- `supabase/functions/detect-trend-events/index.ts`

### Changes Required
1. Add volume-based override for trend stage
2. Lower z-score threshold for "surging"

### Lovable Prompt
```
Fix the trend stage calculation in `supabase/functions/detect-trend-events/index.ts` so high-volume stories aren't marked "Stable".

PROBLEM: "Trump Threatens Tariffs" has 26 mentions but is marked "Stable" because:
- High baseline (tariffs always discussed)
- z-score only 0.3 (not enough for "surging" threshold of 0.5)

CHANGES NEEDED:

1. Find the trend stage calculation (around line 1963-1976) and ADD volume-based overrides:

   // EXISTING:
   let trendStage = 'stable';
   if (zScoreVelocity > 3 && acceleration > 50 && hoursOld < 3) {
     trendStage = 'emerging';
   } else if (zScoreVelocity > 2 && acceleration > 20) {
     trendStage = 'surging';
   } // ... etc

   // ADD THESE VOLUME OVERRIDES BEFORE the existing logic:

   // HIGH VOLUME OVERRIDE: Stories with lots of recent activity are surging
   if (current1h_deduped >= 5) {
     trendStage = 'surging';  // 5+ mentions in last hour = definitely surging
   } else if (current24h_deduped >= 20 && sourceCount >= 5) {
     trendStage = 'surging';  // 20+ mentions from 5+ sources = surging
   } else if (current24h_deduped >= 15 && current1h_deduped >= 2) {
     trendStage = 'surging';  // High volume + recent activity = surging
   }
   // Then fall through to z-score logic for lower-volume topics

2. Lower the z-score threshold for surging:
   FROM: else if (zScoreVelocity > 0.5) { trendStage = 'surging'; }
   TO:   else if (zScoreVelocity > 0.3) { trendStage = 'surging'; }

3. Add logging to track stage decisions:
   console.log(`[TREND STAGE] "${agg.event_title}": z=${zScoreVelocity.toFixed(2)}, 1h=${current1h_deduped}, 24h=${current24h_deduped} → ${trendStage}`);

SUCCESS CRITERIA:
- Stories with 20+ mentions should never be "Stable"
- Stories with 5+ mentions in the last hour should be "Surging"
- Lower z-score threshold allows more stories to qualify as "Surging"
```

### Success Criteria
- [ ] 26-mention story is "Surging" not "Stable"
- [ ] 5+ mentions in last hour = "Surging"
- [ ] Volume overrides z-score for high-activity stories

---

## Phase 5: Expand Data Sources
**Priority:** CRITICAL | **Effort:** HIGH | **Impact:** Very High

### Problem
Only 7 Google News sources, missing entire news categories.

### Changes Required
1. Add 40+ new Google News search queries
2. Add RSS feeds for international, religious, policy news
3. Increase MAX_SOURCES_PER_RUN

### Lovable Prompt
```
Expand the Google News sources in the database to cover more news categories.

PROBLEM: Currently only 7 sources covering limited topics. Missing:
- International affairs (UN, WHO, foreign policy)
- Religious organizations (Vatican, Catholic Church)
- Military/defense (federal troops, national guard)
- State government (governors, state actions)
- Health policy (WHO, CDC, public health)

CHANGES NEEDED:

1. Add new rows to the `google_news_sources` table with these search queries:

   -- International Affairs
   ('UN Affairs', 'search?q=united+nations+security+council&hl=en-US&gl=US&ceid=US:en', true, 'international'),
   ('WHO Health', 'search?q=world+health+organization+WHO&hl=en-US&gl=US&ceid=US:en', true, 'health'),
   ('NATO Alliance', 'search?q=NATO+alliance+military&hl=en-US&gl=US&ceid=US:en', true, 'international'),
   ('European Union', 'search?q=european+union+EU+policy&hl=en-US&gl=US&ceid=US:en', true, 'international'),
   ('Middle East', 'search?q=israel+gaza+middle+east&hl=en-US&gl=US&ceid=US:en', true, 'international'),
   ('Russia Ukraine', 'search?q=russia+ukraine+war&hl=en-US&gl=US&ceid=US:en', true, 'international'),

   -- Military/Defense
   ('Military Policy', 'search?q=pentagon+military+troops&hl=en-US&gl=US&ceid=US:en', true, 'defense'),
   ('National Guard', 'search?q=national+guard+deployment&hl=en-US&gl=US&ceid=US:en', true, 'defense'),
   ('Federal Law Enforcement', 'search?q=FBI+DOJ+federal+agents&hl=en-US&gl=US&ceid=US:en', true, 'law_enforcement'),
   ('ICE Immigration', 'search?q=ICE+immigration+enforcement&hl=en-US&gl=US&ceid=US:en', true, 'immigration'),

   -- Religious/Social
   ('Vatican Catholic', 'search?q=pope+vatican+catholic+church&hl=en-US&gl=US&ceid=US:en', true, 'religion'),
   ('Religious Leaders', 'search?q=cardinal+bishop+religious+leaders&hl=en-US&gl=US&ceid=US:en', true, 'religion'),

   -- State Government
   ('Governors State', 'search?q=governor+state+government&hl=en-US&gl=US&ceid=US:en', true, 'state'),
   ('State Legislation', 'search?q=state+legislature+bill+law&hl=en-US&gl=US&ceid=US:en', true, 'state'),

   -- Executive Branch
   ('Executive Orders', 'search?q=executive+order+presidential+action&hl=en-US&gl=US&ceid=US:en', true, 'executive'),
   ('Cabinet Agencies', 'search?q=cabinet+secretary+agency&hl=en-US&gl=US&ceid=US:en', true, 'executive'),

   -- Economic/Trade
   ('Tariffs Trade', 'search?q=tariffs+trade+policy&hl=en-US&gl=US&ceid=US:en', true, 'economy'),
   ('Federal Reserve', 'search?q=federal+reserve+interest+rates&hl=en-US&gl=US&ceid=US:en', true, 'economy'),

   -- Health Policy
   ('Public Health', 'search?q=CDC+public+health+policy&hl=en-US&gl=US&ceid=US:en', true, 'health'),

   -- Breaking News
   ('Breaking Political', 'search?q=breaking+news+political&hl=en-US&gl=US&ceid=US:en', true, 'breaking'),

2. In `supabase/functions/fetch-google-news/index.ts`, increase the batch size:
   FROM: const MAX_SOURCES_PER_RUN = 6;
   TO:   const MAX_SOURCES_PER_RUN = 15;

3. Increase the rate limit slightly:
   FROM: checkRateLimit('fetch-google-news', 10, 60000)
   TO:   checkRateLimit('fetch-google-news', 15, 60000)

SUCCESS CRITERIA:
- Minnesota/Insurrection Act stories should now be captured
- Catholic Cardinals statements should appear
- WHO/UN stories should be ingested
- International affairs coverage significantly improved
```

### Success Criteria
- [ ] 25+ Google News sources active
- [ ] International stories being ingested
- [ ] Religious/Vatican stories captured
- [ ] State government coverage improved

---

## Phase 6: Architectural Improvements
**Priority:** MEDIUM | **Effort:** HIGH | **Impact:** Long-term

### Changes (Future)
1. Per-organization source customization
2. Dynamic keyword expansion from trending searches
3. Semantic topic normalization (word order independent)
4. Real-time social media trend detection feeding back to news queries

---

## Execution Order

```
Week 1: Phase 1 (Blocklist) + Phase 2 (Duplicates)
        └─ Immediate quality improvement

Week 2: Phase 3 (Scoring) + Phase 4 (Trend Stage)
        └─ Better ranking and labeling

Week 3: Phase 5 (Sources)
        └─ Coverage expansion

Week 4+: Phase 6 (Architecture)
        └─ Long-term improvements
```

---

## Verification After Each Phase

After each phase, run the audit:
```bash
node --env-file=.env scripts/local-trend-audit.mjs
```

And compare top trends to ground truth:
1. Search current breaking political news
2. Check if tool shows matching trends
3. Verify no duplicates in top 20
4. Confirm trend stages match activity levels
