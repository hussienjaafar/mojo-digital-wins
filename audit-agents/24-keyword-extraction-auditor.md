# Keyword Extraction Auditor

**Agent ID:** 24
**Role:** NLP / Data Quality Analyst
**Focus:** Audit the quality of topic/keyword extraction
**Priority:** MEDIUM
**Estimated Time:** 1-2 hours

---

## Overview

This agent audits how keywords/topics are extracted from news articles and social posts. Key questions:

1. Are we extracting meaningful event phrases vs just entity names?
2. Is the extraction validation working correctly?
3. Are action verbs being detected properly?
4. Is the label quality classification accurate?

---

## Current Extraction System

**Location:** `supabase/functions/extract-trending-topics/index.ts`

### Current Validation Rules:

```typescript
// From extract-trending-topics/index.ts

// Multi-word requirement (2-6 words)
if (words.length < 2 || words.length > 6) return false;

// Must start with capital letter
if (topic[0] !== topic[0].toUpperCase()) return false;

// Cannot be news source/publisher
if (newsSources.includes(topic)) return false;

// Must have action verb OR event noun
const actionVerbs = ['passes', 'blocks', 'signs', 'announces', 'fires', ...];
const eventNouns = ['bill', 'order', 'vote', 'election', 'hearing', ...];
const hasActionVerb = actionVerbs.some(v => words.includes(v));
const hasEventNoun = eventNouns.some(n => words.includes(n));
if (!hasActionVerb && !hasEventNoun) return false;
```

---

## Audit Queries

### Query 1: Label Quality Distribution

```sql
-- Check the distribution of label quality types
SELECT
  COALESCE(label_quality, 'unknown') as quality,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage,
  ROUND(AVG(confidence_score), 1) as avg_confidence,
  ROUND(AVG(z_score_velocity), 2) as avg_velocity
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY count DESC;
```

**Expected Distribution:**
| Quality | Target % |
|---------|----------|
| event_phrase | >50% |
| fallback_generated | <30% |
| entity_only | <15% |
| unknown | <5% |

---

### Query 2: Action Verb Detection Effectiveness

```sql
-- Check if trends with action verbs are being detected
WITH action_verbs AS (
  SELECT unnest(ARRAY[
    'passes', 'blocks', 'signs', 'announces', 'launches', 'faces',
    'wins', 'loses', 'approves', 'rejects', 'fires', 'nominates',
    'confirms', 'denies', 'vetoes', 'introduces', 'proposes'
  ]) as verb
)
SELECT
  te.event_title,
  te.is_event_phrase,
  te.label_quality,
  te.confidence_score,
  av.verb as detected_verb
FROM trend_events te
LEFT JOIN action_verbs av ON LOWER(te.event_title) LIKE '%' || av.verb || '%'
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY
  CASE WHEN av.verb IS NOT NULL THEN 0 ELSE 1 END,
  te.confidence_score DESC
LIMIT 30;
```

**Check:** Trends with action verbs should have `is_event_phrase = true`

---

### Query 3: Word Count Distribution

```sql
-- Analyze trend title word counts
SELECT
  array_length(string_to_array(event_title, ' '), 1) as word_count,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage,
  array_agg(event_title ORDER BY confidence_score DESC) FILTER (WHERE confidence_score > 60) as examples
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1;
```

**Expected:**
- 1 word: <10% (entity-only, should be suppressed)
- 2-3 words: 30-40%
- 4-6 words: 50-60% (best event phrases)
- 7+ words: <5% (too long)

---

### Query 4: Label Source Analysis

```sql
-- Where are labels coming from?
SELECT
  COALESCE(label_source, 'unknown') as source,
  COUNT(*) as count,
  ROUND(AVG(confidence_score), 1) as avg_confidence,
  array_agg(event_title ORDER BY confidence_score DESC) FILTER (WHERE confidence_score > 50) as top_examples
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY count DESC;
```

**Label Sources:**
- `ai_extraction` - AI extracted from content
- `headline_pattern` - Extracted from headline
- `entity_merge` - Merged from entity mentions
- `manual` - Manually curated

---

### Query 5: Entity-Only Trends (Should Have Event Context)

```sql
-- Find trends that are just entity names
SELECT
  event_title,
  label_quality,
  confidence_score,
  z_score_velocity,
  source_count,
  top_headline,
  -- Check if the headline has more context
  CASE
    WHEN top_headline IS NOT NULL
      AND LENGTH(top_headline) > LENGTH(event_title) + 10
    THEN 'HEADLINE HAS MORE CONTEXT - Use it!'
    ELSE 'No better context available'
  END as recommendation
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND (
    label_quality = 'entity_only'
    OR array_length(string_to_array(event_title, ' '), 1) <= 2
  )
ORDER BY confidence_score DESC
LIMIT 20;
```

---

### Query 6: Extraction Quality by Source Type

```sql
-- Does extraction quality vary by source?
WITH evidence_quality AS (
  SELECT
    tev.source_type,
    te.event_title,
    te.label_quality,
    te.is_event_phrase
  FROM trend_evidence tev
  JOIN trend_events te ON tev.trend_event_id = te.id
  WHERE te.is_trending = true
    AND te.last_seen_at > NOW() - INTERVAL '24 hours'
)
SELECT
  source_type,
  COUNT(DISTINCT event_title) as unique_trends,
  COUNT(*) FILTER (WHERE label_quality = 'event_phrase') as event_phrases,
  COUNT(*) FILTER (WHERE label_quality = 'entity_only') as entity_only,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_event_phrase) / NULLIF(COUNT(*), 0), 1) as event_phrase_pct
FROM evidence_quality
GROUP BY source_type
ORDER BY unique_trends DESC;
```

---

### Query 7: Missing Action Verbs Check

```sql
-- Headlines that have action verbs but trend doesn't
WITH headlines_with_verbs AS (
  SELECT
    te.id,
    te.event_title,
    te.top_headline,
    te.is_event_phrase
  FROM trend_events te
  WHERE te.is_trending = true
    AND te.last_seen_at > NOW() - INTERVAL '24 hours'
    AND te.top_headline ~* '\b(passes|blocks|signs|fires|nominates|announces|wins|loses|approves|rejects|vetoes)\b'
    AND NOT te.is_event_phrase
)
SELECT
  event_title as current_label,
  top_headline as headline_with_verb,
  'Headline has verb but trend label does not' as issue
FROM headlines_with_verbs
LIMIT 20;
```

---

### Query 8: Canonical Label Selection Audit

```sql
-- Check if we're selecting the best label from options
SELECT
  te.event_title as selected_label,
  te.top_headline,
  te.canonical_label,
  te.related_phrases,
  te.label_quality,
  te.confidence_score,
  CASE
    WHEN te.top_headline IS NOT NULL
      AND te.top_headline ~* '\b(passes|fires|signs|announces)\b'
      AND NOT te.event_title ~* '\b(passes|fires|signs|announces)\b'
    THEN '⚠️ HEADLINE HAS BETTER VERB'
    WHEN te.label_quality = 'entity_only'
      AND te.top_headline IS NOT NULL
    THEN '⚠️ ENTITY-ONLY BUT HEADLINE EXISTS'
    ELSE '✅ OK'
  END as audit_result
FROM trend_events te
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY
  CASE
    WHEN te.label_quality = 'entity_only' THEN 1
    WHEN te.label_quality = 'fallback_generated' THEN 2
    ELSE 3
  END,
  te.confidence_score DESC
LIMIT 30;
```

---

## Extraction Quality Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Event phrase rate | ? | >50% |
| Entity-only rate | ? | <15% |
| Action verb detection | ? | >80% when present |
| Avg word count | ? | 3-5 words |
| Label from headline | ? | >70% |

---

## Common Extraction Issues

### Issue 1: Entity-Only Extraction
**Symptom:** Labels like "Trump", "Biden", "Gaza"
**Cause:** Extraction not finding event phrases
**Fix:** Use headline as fallback, require action verb

### Issue 2: Too-Long Labels
**Symptom:** Labels > 6 words
**Cause:** Extracting full sentences
**Fix:** Truncate to key phrase, remove filler words

### Issue 3: Generic Labels
**Symptom:** "Breaking News", "Update", "Report"
**Cause:** Extracting meta-text instead of content
**Fix:** Add to blocklist, improve content targeting

### Issue 4: Duplicate Phrasing
**Symptom:** "Trump Fires" vs "Fires Trump" vs "Trump Has Fired"
**Cause:** No canonicalization
**Fix:** Implement phrase normalization

---

## Remediation Recommendations

### 1. Improve Event Phrase Detection

```typescript
// Add more action verbs
const ACTION_VERBS = [
  // Current
  'passes', 'blocks', 'signs', 'announces', 'launches', 'faces',
  'wins', 'loses', 'approves', 'rejects', 'fires', 'nominates',
  // Add these
  'unveils', 'reveals', 'threatens', 'demands', 'accuses',
  'criticizes', 'defends', 'supports', 'opposes', 'warns',
  'pledges', 'promises', 'admits', 'denies', 'confirms'
];
```

### 2. Use Headline as Fallback

```typescript
function selectBestLabel(extracted: string, headline: string): string {
  // If extraction is entity-only, try headline
  if (isEntityOnly(extracted) && headline) {
    const headlinePhrase = extractEventPhrase(headline);
    if (headlinePhrase) return headlinePhrase;
  }
  return extracted;
}
```

### 3. Phrase Canonicalization

```typescript
function canonicalizePhrase(phrase: string): string {
  // Normalize to Subject-Verb-Object order
  // "Wray Fired by Trump" → "Trump Fires Wray"
  // "Bill Passed by House" → "House Passes Bill"
  return normalizedPhrase;
}
```

---

## Verification Checklist

- [ ] Event phrase rate > 50%
- [ ] Entity-only rate < 15%
- [ ] Action verbs detected when present
- [ ] Word count distribution is 3-5 average
- [ ] Headlines used as fallback
- [ ] No generic/noise labels trending

---

## Next Agent

After completing this audit, proceed to:
→ `25-scoring-algorithm-auditor.md` (Audit the trend scoring algorithm)
