# Trend Quality Fix Plan

**Date:** 2026-01-19
**Status:** Phase 2 Fixes Applied - Awaiting Rerun
**Based on:** Phase 1 Audit Results

---

## Current Status (After Phase 2 Fixes)

| Issue | Before | After | Target | Status |
|-------|--------|-------|--------|--------|
| Event Phrase Rate | 0% | 34.6% | >50% | Improved, needs rerun |
| Multi-Source (3+) | 0% | 2.4% | >70% | Root cause identified & fixed |
| Single-Word Rate | 19% | 9.2% | <15% | ✅ PASSED |
| Avg Confidence | 34.2 | TBD | >50 | Pending |

## Executive Summary

The audit revealed **4 critical issues** causing 0% event phrase rate and poor trend quality:

| Issue | Current | Target | Root Cause |
|-------|---------|--------|------------|
| Event Phrase Rate | 0% | >50% | AI NER not generating event phrases |
| Multi-Source (3+) | 0% | >70% | Source aggregation broken |
| Single-Word Rate | 19% | <15% | Missing single-word filter |
| Avg Confidence | 34.2 | >50 | Cascading from above issues |

---

## Fix Plan with Agent Assignments

### Phase 1: Event Phrase Generation (Priority: CRITICAL)

#### Task 1.1: Fix AI Prompt in `batch-analyze-content`
**Assigned to: Agent 24 (Keyword Extraction Auditor)**

**Problem:** The AI NER prompt in `batch-analyze-content/index.ts` is only extracting entities, not event phrases.

**File:** `supabase/functions/batch-analyze-content/index.ts`

**Current Behavior:**
- AI extracts: `["Donald Trump", "ICE", "Greenland"]`
- Expected: `["Trump Announces Tariff on Canada", "ICE Conducts Chicago Raids"]`

**Fix Required:**
1. Locate the AI prompt (around line 315-400) that calls Lovable AI Gateway
2. Modify the prompt to explicitly request:
   - **Event phrases** in Subject + Verb + Object format
   - **NOT just entity names**
3. Add validation that at least 1 event phrase is returned per article

**Prompt Enhancement Example:**
```
Extract both ENTITIES and EVENT PHRASES from this headline.

ENTITIES: Named people, organizations, places (e.g., "Donald Trump", "ICE", "Congress")

EVENT PHRASES: What is HAPPENING - must include:
- A SUBJECT (who/what)
- A VERB (action: announces, passes, blocks, fires, arrests, raids, etc.)
- An OBJECT (what is affected)

Examples:
- Headline: "Trump Fires FBI Director Over Russia Investigation"
  - Entities: ["Donald Trump", "FBI"]
  - Event Phrases: ["Trump Fires FBI Director"]

- Headline: "ICE Conducts Raids in Chicago Sanctuary City"
  - Entities: ["ICE", "Chicago"]
  - Event Phrases: ["ICE Conducts Chicago Raids"]

IMPORTANT: Every headline should have at least ONE event phrase. If unsure, use format: "[Subject] [Verb] [Object]"
```

---

#### Task 1.2: Strengthen Fallback Generation
**Assigned to: Agent 24 (Keyword Extraction Auditor)**

**Problem:** `generateFallbackEventPhrase()` exists but isn't matching headlines effectively.

**File:** `supabase/functions/batch-analyze-content/index.ts` (lines 231-291)

**Current Issue:** Verb patterns are too strict and miss common headline formats.

**Fix Required:**
1. Add more verb patterns:
```typescript
// Add these patterns:
/^(.+?)\s+(announces?|reveals?|confirms?|denies?)\s+(.+)/i,
/^(.+?)\s+(plans?|considers?|mulls?|weighs?)\s+(.+)/i,
/^(.+?)\s+(calls?\s+for|pushes?\s+for|demands?)\s+(.+)/i,
```

2. Add headline truncation fallback:
```typescript
// If no verb match, use first 5 words of headline with top entity
if (!match && entities.length > 0) {
  const words = title.split(/\s+/).slice(0, 5);
  if (words.length >= 3) {
    return words.join(' ');
  }
}
```

---

#### Task 1.3: Add Event Phrase Validation in `detect-trend-events`
**Assigned to: Agent 25 (Scoring Algorithm Auditor)**

**Problem:** `detect-trend-events` accepts `is_event_phrase=false` without attempting to upgrade.

**File:** `supabase/functions/detect-trend-events/index.ts`

**Fix Required:**
1. In the topic aggregation loop (around line 1063), add:
```typescript
// If topic is entity-only, attempt to generate event phrase from top headline
if (!computedIsEventPhrase && agg.mentions.length > 0) {
  const topHeadline = agg.mentions[0].title;
  const fallback = tryGenerateFallbackFromHeadline(topHeadline, topic);
  if (fallback) {
    agg.event_title = fallback;
    agg.is_event_phrase = true;
    agg.label_quality_hint = 'fallback_generated';
  }
}
```

---

### Phase 2: Source Aggregation Fix (Priority: HIGH)

#### Task 2.1: Debug Source Count Aggregation
**Assigned to: Agent 25 (Scoring Algorithm Auditor)**

**Problem:** 0% of trends have 3+ sources despite `source_count` field existing.

**File:** `supabase/functions/detect-trend-events/index.ts`

**Investigation:**
1. Check how `by_source_deduped` is calculated (around line 1080-1120)
2. Verify `source_count` is set correctly in upsert (around line 2080)

**Likely Issues:**
- Deduplication is too aggressive (content_hash collision)
- Source type is not being set correctly on mentions
- Tier classification is failing

**Fix Required:**
1. Add debug logging:
```typescript
console.log(`[SOURCE DEBUG] ${agg.event_title}: rss=${agg.by_source_deduped.rss}, gn=${agg.by_source_deduped.google_news}, bs=${agg.by_source_deduped.bluesky}`);
```

2. Ensure `source_count` uses correct calculation:
```typescript
const source_count = agg.by_source_deduped.rss + agg.by_source_deduped.google_news + agg.by_source_deduped.bluesky;
```

---

### Phase 3: Single-Word Entity Filter (Priority: HIGH)

#### Task 3.1: Add Hard Filter for Single-Word Entities
**Assigned to: Agent 22 (Evergreen Topic Auditor)**

**Problem:** Single-word entities like "ICE", "Mlk", "Florida" are trending.

**File:** `supabase/functions/detect-trend-events/index.ts`

**Fix Required:**
Add filter before trending decision (around line 1750):

```typescript
// HARD REJECT: Single-word entities cannot trend
const wordCount = (agg.event_title || '').split(/\s+/).filter(Boolean).length;
if (wordCount === 1) {
  // Single-word entity - do not mark as trending
  isTrending = false;
  qualityGateFiltered++;
  console.log(`[QUALITY GATE] Rejected single-word: "${agg.event_title}"`);
  continue; // or set is_trending = false
}
```

---

#### Task 3.2: Increase Evergreen Penalty for Single Words
**Assigned to: Agent 22 (Evergreen Topic Auditor)**

**File:** `supabase/functions/detect-trend-events/index.ts` (line 191-200)

**Current:**
```typescript
const baseEntityPenalty = isSingleWordEntity ? 0.6 : 1.0;
```

**Fix Required:**
```typescript
// STRENGTHENED: Single-word entities get severe penalty
const baseEntityPenalty = isSingleWordEntity ? 0.15 : 1.0;  // Was 0.6
```

---

### Phase 4: Deduplication (Priority: MEDIUM)

#### Task 4.1: Implement Near-Duplicate Detection
**Assigned to: Agent 28 (Deduplication Implementer)**

**Problem:** Similar trends appear separately (e.g., "Donald Trump" and "Trump Greenland")

**Fix Required:**
1. Enable pg_trgm extension (if not already)
2. Add similarity check before inserting new trend:
```typescript
// Check for similar existing trends
const { data: similar } = await supabase
  .from('trend_events')
  .select('id, event_title')
  .eq('is_trending', true)
  .textSearch('event_title', agg.event_title, { type: 'websearch' });

if (similar && similar.length > 0) {
  // Merge into existing trend instead of creating new
  // ... merge logic
}
```

---

### Phase 5: UX Improvements (Priority: MEDIUM)

#### Task 5.1: Twitter-Like Drill-Down
**Assigned to: Agent 29 (Twitter-Like UX Implementer)**

**Scope:** Frontend changes to show articles when clicking trends.

**See:** `audit-agents/29-twitter-like-ux-implementer.md` for full implementation spec.

---

## Implementation Order

| Order | Task | Agent | Effort | Impact |
|-------|------|-------|--------|--------|
| 1 | Fix AI prompt for event phrases | Agent 24 | High | Critical |
| 2 | Strengthen fallback generation | Agent 24 | Medium | High |
| 3 | Add single-word filter | Agent 22 | Low | High |
| 4 | Increase evergreen penalty | Agent 22 | Low | Medium |
| 5 | Debug source count | Agent 25 | Medium | High |
| 6 | Add event phrase validation | Agent 25 | Medium | High |
| 7 | Near-duplicate detection | Agent 28 | High | Medium |
| 8 | Twitter-like UX | Agent 29 | High | Medium |

---

## Success Metrics (Post-Fix)

| Metric | Current | Target |
|--------|---------|--------|
| Event Phrase Rate | 0% | >50% |
| Single-Word Rate | 19% | <15% |
| Multi-Source Rate | 0% | >70% |
| Avg Confidence | 34.2 | >50 |
| Exact Duplicates | Unknown | 0 |
| Near Duplicates | Unknown | <5 |

---

## Lovable Prompts by Task

### Prompt for Tasks 1.1 + 1.2 (Agent 24 Work)

```
Fix the event phrase extraction in `supabase/functions/batch-analyze-content/index.ts`.

Current problem: The AI NER is only extracting entity names (e.g., "Donald Trump", "ICE"), not event phrases (e.g., "Trump Fires FBI Director", "ICE Conducts Raids").

Changes needed:

1. Find the AI prompt that calls the Lovable AI Gateway (around line 315-400)

2. Modify the prompt to explicitly request EVENT PHRASES in Subject + Verb + Object format. Add this instruction:
   "For each headline, extract at least ONE event phrase describing what is HAPPENING, not just who is mentioned. Format: [Subject] [Verb] [Object]. Example: 'Trump Announces Tariff' not just 'Trump'."

3. In `generateFallbackEventPhrase()` (line 231), add these verb patterns:
   - /^(.+?)\s+(announces?|reveals?|confirms?|denies?)\s+(.+)/i
   - /^(.+?)\s+(plans?|considers?|mulls?|weighs?)\s+(.+)/i
   - /^(.+?)\s+(calls?\s+for|pushes?\s+for|demands?)\s+(.+)/i

4. Add a final fallback: if no verb match, use the first 5 words of the headline as the event phrase (if it contains a known entity).

5. Add logging: console.log(`[EVENT PHRASE] Generated: "${phrase}" from "${title.substring(0,50)}..."`)

The goal is to go from 0% event phrase rate to >50%.
```

### Prompt for Tasks 3.1 + 3.2 (Agent 22 Work)

```
Add a hard filter for single-word entities in `supabase/functions/detect-trend-events/index.ts`.

Current problem: Single-word topics like "ICE", "Mlk", "Florida", "Us" are trending. These are too vague and not actionable.

Changes needed:

1. Find the trending decision logic (around line 1750, near `isTrending = true`)

2. Add this filter BEFORE marking as trending:
   ```typescript
   const wordCount = (agg.event_title || '').split(/\s+/).filter(Boolean).length;
   if (wordCount === 1) {
     isTrending = false;
     qualityGateFiltered++;
     console.log(`[QUALITY GATE] Rejected single-word: "${agg.event_title}"`);
   }
   ```

3. Find `calculateEvergreenPenalty()` (around line 191) and change:
   - FROM: `const baseEntityPenalty = isSingleWordEntity ? 0.6 : 1.0;`
   - TO: `const baseEntityPenalty = isSingleWordEntity ? 0.15 : 1.0;`

4. Add to TOPIC_BLOCKLIST (around line 123):
   - 'us', 'eu', 'uk', 'mlk' (common ambiguous abbreviations)

The goal is to reduce single-word rate from 19% to <15%.
```

### Prompt for Task 2.1 (Agent 25 Work)

```
Debug and fix the source count aggregation in `supabase/functions/detect-trend-events/index.ts`.

Current problem: 0% of trends have source_count >= 3, but we're ingesting from multiple sources (RSS, Google News, Bluesky).

Investigation needed:

1. Find where `by_source_deduped` is calculated (around line 1080-1120)

2. Add debug logging:
   ```typescript
   console.log(`[SOURCE DEBUG] ${agg.event_title}: rss=${agg.by_source_deduped.rss}, gn=${agg.by_source_deduped.google_news}, bs=${agg.by_source_deduped.bluesky}`);
   ```

3. Check how mentions are being added to the aggregation - verify `source_type` is being set correctly

4. Find the upsert logic (around line 2080) and verify `source_count` is calculated as:
   ```typescript
   source_count: agg.by_source_deduped.rss + agg.by_source_deduped.google_news + agg.by_source_deduped.bluesky
   ```

5. If sources aren't being classified correctly, check the `fetchFromGoogleNews()`, `fetchFromRss()`, and `fetchFromBluesky()` functions to ensure they're setting `source_type` on each mention.

The goal is to achieve >70% multi-source rate (3+ sources per trend).
```

---

## Files to Modify

| File | Tasks | Agent |
|------|-------|-------|
| `supabase/functions/batch-analyze-content/index.ts` | 1.1, 1.2 | Agent 24 |
| `supabase/functions/detect-trend-events/index.ts` | 1.3, 2.1, 3.1, 3.2 | Agent 22, 25 |
| `src/components/trends/*` | 5.1 | Agent 29 |

---

## Fixes Applied (2026-01-19)

### Phase 1 Fixes (Already Deployed)

In `supabase/functions/batch-analyze-content/index.ts`:
1. ✅ Enhanced AI prompt with MANDATORY event phrase requirement
2. ✅ Added 50+ action verbs to ACTION_VERBS list
3. ✅ Strengthened fallback generation with more patterns
4. ✅ Added headline truncation fallback

In `supabase/functions/detect-trend-events/index.ts`:
1. ✅ Tightened single-word thresholds (MIN_MENTIONS: 8→20, MIN_SOURCES: 2→3)
2. ✅ Reduced ALLOWED_SINGLE_WORD_ENTITIES drastically
3. ✅ Added ambiguous terms to blocklist (us, uk, eu, mlk, ice)
4. ✅ Increased single-word evergreen penalty (0.6→0.15)

### Phase 2 Fixes (Committed 2026-01-19)

In `supabase/functions/detect-trend-events/index.ts`:
1. ✅ **Bluesky domain fix**: Set `domain: 'bsky.app'` for Bluesky mentions (was undefined)
2. ✅ **Google News domain fix**: Use `canonical_url || url` for domain extraction (was using redirect URL)
3. ✅ **Debug logging**: Added TOP DOMAINS logging for source distribution diagnosis

In `supabase/functions/audit-trend-quality/index.ts`:
1. ✅ Fixed TypeScript error handling (`error.message` → proper type guard)

### Pending

- Rerun trend detection job to apply Phase 2 fixes
- Monitor multi-source rate - if still low, may need data diversity improvements
- Event phrase rate may improve after reprocessing with fixed domain counting

---

## Verification

After implementing fixes, run the audit again:

```bash
node --env-file=.env scripts/local-trend-audit.mjs
```

Or use Lovable prompt:
```
Query trend_events where is_trending=true and last_seen_at > 24 hours ago.
Calculate: Event Phrase Rate, Single-Word Rate, Multi-Source Rate, Avg Confidence.
Compare to targets: Event Phrase >50%, Single-Word <15%, Multi-Source >70%, Confidence >50.
```
