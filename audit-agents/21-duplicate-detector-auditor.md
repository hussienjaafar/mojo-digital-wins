# Duplicate Detector Auditor

**Agent ID:** 21
**Role:** Data Quality Analyst
**Focus:** Identify duplicate and near-duplicate trends
**Priority:** HIGH
**Estimated Time:** 1-2 hours

---

## Overview

This agent audits the system for duplicate trends that create a poor user experience:
1. **Exact duplicates** - Same event_title
2. **Near-duplicates** - High text similarity (Levenshtein)
3. **Semantic duplicates** - Same topic, different phrasing
4. **Entity-grouped duplicates** - Same entity, multiple trends

---

## Prerequisites

Enable the pg_trgm extension for similarity functions:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## Audit Queries

### Query 1: Exact Title Duplicates

```sql
-- Find trends with identical titles (exact duplicates)
SELECT
  LOWER(event_title) as normalized_title,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY confidence_score DESC) as trend_ids,
  array_agg(confidence_score ORDER BY confidence_score DESC) as scores
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY LOWER(event_title)
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
```

**Expected:** 0 results. Any matches = dedup failure.

---

### Query 2: Near-Duplicate Detection (Trigram Similarity)

```sql
-- Find trends with high text similarity (>60%)
SELECT
  a.id as id_a,
  b.id as id_b,
  a.event_title as title_a,
  b.event_title as title_b,
  ROUND(similarity(a.event_title, b.event_title)::numeric, 3) as similarity_score,
  a.confidence_score as score_a,
  b.confidence_score as score_b,
  CASE
    WHEN a.confidence_score > b.confidence_score THEN 'KEEP A'
    ELSE 'KEEP B'
  END as merge_action
FROM trend_events a
JOIN trend_events b ON a.id < b.id
WHERE a.is_trending = true AND b.is_trending = true
  AND a.last_seen_at > NOW() - INTERVAL '24 hours'
  AND b.last_seen_at > NOW() - INTERVAL '24 hours'
  AND similarity(a.event_title, b.event_title) > 0.6
ORDER BY similarity_score DESC
LIMIT 50;
```

**Similarity Thresholds:**
| Score | Classification |
|-------|---------------|
| 0.9-1.0 | Near-exact duplicate - MERGE |
| 0.7-0.9 | Likely duplicate - REVIEW |
| 0.6-0.7 | Possible duplicate - REVIEW |
| <0.6 | Different topics - OK |

---

### Query 3: Same Entity, Different Labels

```sql
-- Find multiple trends about the same entity
WITH entity_trends AS (
  SELECT
    id,
    event_title,
    confidence_score,
    COALESCE(
      politicians_mentioned[1],
      organizations_mentioned[1],
      CASE WHEN array_length(string_to_array(event_title, ' '), 1) <= 2
           THEN event_title END
    ) as primary_entity
  FROM trend_events
  WHERE is_trending = true
    AND last_seen_at > NOW() - INTERVAL '24 hours'
)
SELECT
  primary_entity,
  COUNT(*) as trend_count,
  array_agg(event_title ORDER BY confidence_score DESC) as titles,
  array_agg(confidence_score ORDER BY confidence_score DESC) as scores
FROM entity_trends
WHERE primary_entity IS NOT NULL
GROUP BY primary_entity
HAVING COUNT(*) > 1
ORDER BY trend_count DESC;
```

**Expected Action:**
- If same entity has entity-only label AND event phrase → merge into event phrase
- If same entity has multiple event phrases → keep all (different events)

---

### Query 4: Title Prefix/Suffix Duplicates

```sql
-- Find trends where one title is a prefix/suffix of another
SELECT
  a.event_title as shorter_title,
  b.event_title as longer_title,
  a.confidence_score as shorter_score,
  b.confidence_score as longer_score,
  LENGTH(b.event_title) - LENGTH(a.event_title) as length_diff
FROM trend_events a
JOIN trend_events b ON a.id != b.id
WHERE a.is_trending = true AND b.is_trending = true
  AND a.last_seen_at > NOW() - INTERVAL '24 hours'
  AND b.last_seen_at > NOW() - INTERVAL '24 hours'
  AND LENGTH(a.event_title) < LENGTH(b.event_title)
  AND (
    LOWER(b.event_title) LIKE LOWER(a.event_title) || '%'
    OR LOWER(b.event_title) LIKE '%' || LOWER(a.event_title)
  )
ORDER BY length_diff ASC
LIMIT 30;
```

**Examples:**
- "Trump" vs "Trump Fires FBI Director" → Keep longer
- "Gaza" vs "Gaza Ceasefire" → Keep longer

---

### Query 5: Semantic Duplicate Candidates

```sql
-- Find trends that might be semantically the same
-- (same key words in different order)
WITH word_sets AS (
  SELECT
    id,
    event_title,
    confidence_score,
    array_agg(word ORDER BY word) as sorted_words
  FROM (
    SELECT
      id,
      event_title,
      confidence_score,
      unnest(string_to_array(LOWER(regexp_replace(event_title, '[^a-zA-Z0-9 ]', '', 'g')), ' ')) as word
    FROM trend_events
    WHERE is_trending = true
      AND last_seen_at > NOW() - INTERVAL '24 hours'
  ) words
  WHERE length(word) > 2  -- Ignore short words
  GROUP BY id, event_title, confidence_score
)
SELECT
  a.event_title as title_a,
  b.event_title as title_b,
  a.confidence_score as score_a,
  b.confidence_score as score_b,
  a.sorted_words
FROM word_sets a
JOIN word_sets b ON a.id < b.id
WHERE a.sorted_words = b.sorted_words
ORDER BY a.confidence_score DESC;
```

**Examples of semantic duplicates:**
- "Trump Fires Wray" vs "Wray Fired by Trump"
- "House Passes Bill" vs "Bill Passed by House"

---

### Query 6: Duplicate Rate Summary

```sql
-- Calculate overall duplicate metrics
WITH exact_dupes AS (
  SELECT COUNT(*) - COUNT(DISTINCT LOWER(event_title)) as exact_count
  FROM trend_events
  WHERE is_trending = true AND last_seen_at > NOW() - INTERVAL '24 hours'
),
near_dupes AS (
  SELECT COUNT(*) as near_count
  FROM (
    SELECT a.id
    FROM trend_events a
    JOIN trend_events b ON a.id < b.id
    WHERE a.is_trending = true AND b.is_trending = true
      AND a.last_seen_at > NOW() - INTERVAL '24 hours'
      AND b.last_seen_at > NOW() - INTERVAL '24 hours'
      AND similarity(a.event_title, b.event_title) > 0.7
  ) pairs
),
total AS (
  SELECT COUNT(*) as total_count
  FROM trend_events
  WHERE is_trending = true AND last_seen_at > NOW() - INTERVAL '24 hours'
)
SELECT
  'Total Trending' as metric,
  total_count::text as value
FROM total
UNION ALL
SELECT
  'Exact Duplicates',
  exact_count::text
FROM exact_dupes
UNION ALL
SELECT
  'Near Duplicates (>70% sim)',
  near_count::text
FROM near_dupes
UNION ALL
SELECT
  'Duplicate Rate (%)',
  ROUND(100.0 * (SELECT exact_count FROM exact_dupes) / NULLIF((SELECT total_count FROM total), 0), 1)::text;
```

---

### Query 7: Cluster Analysis for Dedup

```sql
-- Group trends into potential clusters based on shared words
WITH trend_words AS (
  SELECT
    id,
    event_title,
    confidence_score,
    string_to_array(LOWER(event_title), ' ') as words
  FROM trend_events
  WHERE is_trending = true
    AND last_seen_at > NOW() - INTERVAL '24 hours'
),
word_overlap AS (
  SELECT
    a.id as id_a,
    b.id as id_b,
    a.event_title as title_a,
    b.event_title as title_b,
    array_length(array(SELECT unnest(a.words) INTERSECT SELECT unnest(b.words)), 1) as shared_words,
    array_length(a.words, 1) as words_a,
    array_length(b.words, 1) as words_b
  FROM trend_words a
  JOIN trend_words b ON a.id < b.id
)
SELECT
  title_a,
  title_b,
  shared_words,
  ROUND(100.0 * shared_words / LEAST(words_a, words_b), 0) as overlap_pct
FROM word_overlap
WHERE shared_words >= 2
  AND shared_words::float / LEAST(words_a, words_b) > 0.5
ORDER BY overlap_pct DESC, shared_words DESC
LIMIT 30;
```

---

## Duplicate Detection Thresholds

| Detection Type | Threshold | Action |
|---------------|-----------|--------|
| Exact match | 100% | Auto-merge |
| Trigram similarity | >85% | Auto-merge |
| Trigram similarity | 70-85% | Manual review |
| Word overlap | >60% | Manual review |
| Same primary entity | N/A | Review for merge |

---

## Remediation Actions

### For Exact Duplicates:
1. Identify root cause (extraction bug?)
2. Keep highest confidence version
3. Merge evidence from both

### For Near-Duplicates:
1. Implement embedding-based clustering
2. Set similarity threshold at 0.85
3. Auto-merge during trend detection

### For Entity-Grouped Duplicates:
1. Prefer event phrases over entity-only
2. Keep multiple distinct events for same entity
3. Implement canonical label selection

---

## Implementation: Dedup Algorithm

```typescript
// Pseudocode for deduplication
async function deduplicateTrends(trends: TrendEvent[]): Promise<TrendEvent[]> {
  const clusters: Map<string, TrendEvent[]> = new Map();

  for (const trend of trends) {
    let foundCluster = false;

    for (const [clusterId, clusterTrends] of clusters) {
      const representative = clusterTrends[0];
      const similarity = calculateSimilarity(trend.event_title, representative.event_title);

      if (similarity > 0.85) {
        // Add to existing cluster
        clusterTrends.push(trend);
        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      // Create new cluster
      clusters.set(trend.id, [trend]);
    }
  }

  // For each cluster, keep the best representative
  return Array.from(clusters.values()).map(cluster => {
    // Prefer: event_phrase > higher confidence > more sources
    return cluster.sort((a, b) => {
      if (a.is_event_phrase !== b.is_event_phrase) {
        return a.is_event_phrase ? -1 : 1;
      }
      if (a.confidence_score !== b.confidence_score) {
        return b.confidence_score - a.confidence_score;
      }
      return b.source_count - a.source_count;
    })[0];
  });
}
```

---

## Verification Checklist

- [ ] Exact duplicates = 0
- [ ] Near-duplicates (>85% similarity) = 0
- [ ] Duplicate rate < 2%
- [ ] Entity-grouped duplicates reviewed
- [ ] Dedup algorithm implemented

---

## Next Agent

After completing this audit, proceed to:
→ `22-evergreen-topic-auditor.md` (Audit evergreen topic handling)
