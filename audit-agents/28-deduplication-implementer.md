# Deduplication Implementer

**Agent ID:** 28
**Role:** Backend Engineer / Data Engineer
**Focus:** Implement semantic deduplication for trends
**Priority:** HIGH
**Estimated Time:** 3-4 hours
**Dependencies:** Audit findings from Agent 21

---

## Overview

This agent implements a comprehensive deduplication system to eliminate:
1. **Exact duplicates** - Identical titles
2. **Near-duplicates** - High text similarity (>85%)
3. **Semantic duplicates** - Same topic, different phrasing
4. **Entity-grouped duplicates** - Same entity, multiple vague labels

---

## Implementation Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DEDUPLICATION PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: PRE-INSERTION CHECK (Real-time)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Before inserting new trend:                                         │   │
│  │  1. Normalize title (lowercase, remove punctuation)                  │   │
│  │  2. Check exact match against existing trending                      │   │
│  │  3. Check trigram similarity > 0.85                                  │   │
│  │  4. If match found → MERGE instead of INSERT                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  LAYER 2: BATCH CLUSTERING (Every 15 min)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  For all trending topics:                                            │   │
│  │  1. Generate embeddings for titles                                   │   │
│  │  2. Cluster by cosine similarity > 0.82                              │   │
│  │  3. For each cluster: keep best representative                       │   │
│  │  4. Merge evidence from duplicates into representative               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  LAYER 3: ENTITY CONSOLIDATION                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  For trends sharing primary entity:                                  │   │
│  │  1. Prefer event_phrase over entity_only                            │   │
│  │  2. Keep distinct events (different actions)                        │   │
│  │  3. Merge vague labels into specific ones                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Enable pg_trgm Extension

```sql
-- Enable trigram extension for similarity functions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create index for fast similarity lookups
CREATE INDEX IF NOT EXISTS idx_trend_events_title_trgm
ON trend_events USING gin (event_title gin_trgm_ops);
```

---

## Step 2: Add Cluster ID Column

```sql
-- Add cluster_id for grouping similar trends
ALTER TABLE trend_events
ADD COLUMN IF NOT EXISTS cluster_id UUID,
ADD COLUMN IF NOT EXISTS is_cluster_representative BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS merged_from UUID[];

-- Index for cluster lookups
CREATE INDEX IF NOT EXISTS idx_trend_events_cluster
ON trend_events (cluster_id) WHERE cluster_id IS NOT NULL;
```

---

## Step 3: Create Deduplication Functions

### Function: Check for Duplicates Before Insert

```sql
CREATE OR REPLACE FUNCTION check_trend_duplicate(
  p_event_title TEXT,
  p_similarity_threshold FLOAT DEFAULT 0.85
)
RETURNS TABLE(
  duplicate_id UUID,
  duplicate_title TEXT,
  similarity_score FLOAT,
  action TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    te.id,
    te.event_title,
    similarity(te.event_title, p_event_title)::FLOAT,
    CASE
      WHEN similarity(te.event_title, p_event_title) >= 0.95 THEN 'EXACT_MERGE'
      WHEN similarity(te.event_title, p_event_title) >= p_similarity_threshold THEN 'NEAR_MERGE'
      ELSE 'NO_ACTION'
    END
  FROM trend_events te
  WHERE te.is_trending = true
    AND te.last_seen_at > NOW() - INTERVAL '48 hours'
    AND similarity(te.event_title, p_event_title) >= p_similarity_threshold
  ORDER BY similarity(te.event_title, p_event_title) DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

### Function: Merge Duplicate Trends

```sql
CREATE OR REPLACE FUNCTION merge_trend_into(
  p_source_id UUID,
  p_target_id UUID
)
RETURNS void AS $$
DECLARE
  v_source RECORD;
  v_target RECORD;
BEGIN
  -- Get source and target
  SELECT * INTO v_source FROM trend_events WHERE id = p_source_id;
  SELECT * INTO v_target FROM trend_events WHERE id = p_target_id;

  IF v_source IS NULL OR v_target IS NULL THEN
    RAISE EXCEPTION 'Source or target trend not found';
  END IF;

  -- Update target with merged data
  UPDATE trend_events
  SET
    -- Combine counts
    source_count = GREATEST(v_target.source_count, v_source.source_count),
    news_source_count = v_target.news_source_count + v_source.news_source_count,
    social_source_count = v_target.social_source_count + v_source.social_source_count,
    evidence_count = v_target.evidence_count + v_source.evidence_count,

    -- Keep best metrics
    confidence_score = GREATEST(v_target.confidence_score, v_source.confidence_score),
    z_score_velocity = GREATEST(v_target.z_score_velocity, v_source.z_score_velocity),
    current_1h = v_target.current_1h + v_source.current_1h,
    current_24h = v_target.current_24h + v_source.current_24h,

    -- Prefer event_phrase title
    event_title = CASE
      WHEN v_target.is_event_phrase AND NOT v_source.is_event_phrase THEN v_target.event_title
      WHEN v_source.is_event_phrase AND NOT v_target.is_event_phrase THEN v_source.event_title
      WHEN v_target.confidence_score >= v_source.confidence_score THEN v_target.event_title
      ELSE v_source.event_title
    END,
    is_event_phrase = v_target.is_event_phrase OR v_source.is_event_phrase,

    -- Track merged sources
    merged_from = array_append(COALESCE(v_target.merged_from, ARRAY[]::UUID[]), p_source_id),

    -- Update timestamps
    first_seen_at = LEAST(v_target.first_seen_at, v_source.first_seen_at),
    last_seen_at = GREATEST(v_target.last_seen_at, v_source.last_seen_at),

    updated_at = NOW()
  WHERE id = p_target_id;

  -- Update evidence to point to target
  UPDATE trend_evidence
  SET trend_event_id = p_target_id
  WHERE trend_event_id = p_source_id;

  -- Mark source as not trending (soft delete)
  UPDATE trend_events
  SET
    is_trending = false,
    cluster_id = p_target_id,
    is_cluster_representative = false
  WHERE id = p_source_id;

END;
$$ LANGUAGE plpgsql;
```

---

## Step 4: Create Batch Deduplication Function

### Edge Function: `deduplicate-trends/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();

// Levenshtein distance for string similarity
function levenshteinSimilarity(a: string, b: string): number {
  const matrix: number[][] = [];
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen === 0 ? 1 : 0;
  if (bLen === 0) return 0;

  for (let i = 0; i <= bLen; i++) matrix[i] = [i];
  for (let j = 0; j <= aLen; j++) matrix[0][j] = j;

  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(aLen, bLen);
  return (maxLen - matrix[bLen][aLen]) / maxLen;
}

// Word overlap similarity (Jaccard)
function wordOverlapSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);

  return union.size > 0 ? intersection.length / union.size : 0;
}

// Combined similarity score
function calculateSimilarity(a: string, b: string): number {
  const levenshtein = levenshteinSimilarity(a, b);
  const wordOverlap = wordOverlapSimilarity(a, b);

  // Weighted combination: 60% word overlap, 40% levenshtein
  return 0.6 * wordOverlap + 0.4 * levenshtein;
}

interface TrendEvent {
  id: string;
  event_title: string;
  confidence_score: number;
  is_event_phrase: boolean;
  source_count: number;
  z_score_velocity: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { similarity_threshold = 0.75, dry_run = false } = await req.json().catch(() => ({}));

    // Fetch all trending events
    const { data: trends, error } = await supabase
      .from('trend_events')
      .select('id, event_title, confidence_score, is_event_phrase, source_count, z_score_velocity')
      .eq('is_trending', true)
      .gte('last_seen_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('confidence_score', { ascending: false });

    if (error) throw error;
    if (!trends || trends.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No trends to deduplicate', merged: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find duplicate pairs
    const duplicatePairs: Array<{
      source: TrendEvent;
      target: TrendEvent;
      similarity: number;
    }> = [];

    const processed = new Set<string>();

    for (let i = 0; i < trends.length; i++) {
      if (processed.has(trends[i].id)) continue;

      for (let j = i + 1; j < trends.length; j++) {
        if (processed.has(trends[j].id)) continue;

        const similarity = calculateSimilarity(trends[i].event_title, trends[j].event_title);

        if (similarity >= similarity_threshold) {
          // Determine which to keep (higher quality)
          const isBetter = (a: TrendEvent, b: TrendEvent): boolean => {
            // Prefer event_phrase
            if (a.is_event_phrase && !b.is_event_phrase) return true;
            if (!a.is_event_phrase && b.is_event_phrase) return false;
            // Then prefer higher confidence
            if (a.confidence_score !== b.confidence_score) {
              return a.confidence_score > b.confidence_score;
            }
            // Then prefer more sources
            return a.source_count > b.source_count;
          };

          const target = isBetter(trends[i], trends[j]) ? trends[i] : trends[j];
          const source = isBetter(trends[i], trends[j]) ? trends[j] : trends[i];

          duplicatePairs.push({ source, target, similarity });
          processed.add(source.id);
        }
      }
    }

    // Perform merges (unless dry run)
    const mergeResults: Array<{
      source_title: string;
      target_title: string;
      similarity: number;
      merged: boolean;
    }> = [];

    for (const pair of duplicatePairs) {
      if (!dry_run) {
        // Call merge function
        const { error: mergeError } = await supabase.rpc('merge_trend_into', {
          p_source_id: pair.source.id,
          p_target_id: pair.target.id
        });

        mergeResults.push({
          source_title: pair.source.event_title,
          target_title: pair.target.event_title,
          similarity: Math.round(pair.similarity * 100),
          merged: !mergeError
        });
      } else {
        mergeResults.push({
          source_title: pair.source.event_title,
          target_title: pair.target.event_title,
          similarity: Math.round(pair.similarity * 100),
          merged: false
        });
      }
    }

    return new Response(
      JSON.stringify({
        dry_run,
        similarity_threshold,
        trends_analyzed: trends.length,
        duplicates_found: duplicatePairs.length,
        merges: mergeResults
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Deduplication error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Step 5: Integrate into Trend Detection

### Modify `detect-trend-events/index.ts`

Add deduplication check before inserting new trends:

```typescript
// Before inserting a new trend event
async function insertOrMergeTrend(
  supabase: SupabaseClient,
  newTrend: TrendEventInsert
): Promise<{ id: string; action: 'insert' | 'merge' }> {

  // Check for existing similar trend
  const { data: duplicates } = await supabase
    .rpc('check_trend_duplicate', {
      p_event_title: newTrend.event_title,
      p_similarity_threshold: 0.85
    });

  if (duplicates && duplicates.length > 0) {
    const match = duplicates[0];

    if (match.action === 'EXACT_MERGE' || match.action === 'NEAR_MERGE') {
      // Merge into existing trend
      await supabase.rpc('merge_trend_into', {
        p_source_id: null, // We don't have an ID yet - update existing instead
        p_target_id: match.duplicate_id
      });

      // Update existing trend with new data
      await supabase
        .from('trend_events')
        .update({
          current_1h: newTrend.current_1h,
          last_seen_at: new Date().toISOString(),
          // Keep higher values
          confidence_score: Math.max(newTrend.confidence_score, match.confidence_score),
          z_score_velocity: Math.max(newTrend.z_score_velocity, match.z_score_velocity)
        })
        .eq('id', match.duplicate_id);

      return { id: match.duplicate_id, action: 'merge' };
    }
  }

  // No duplicate found - insert new
  const { data: inserted } = await supabase
    .from('trend_events')
    .insert(newTrend)
    .select('id')
    .single();

  return { id: inserted.id, action: 'insert' };
}
```

---

## Step 6: Schedule Batch Deduplication

Add to `scheduled_jobs`:

```sql
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, description)
VALUES
  ('deduplicate_trends', 'cleanup', '*/15 * * * *',
   '/functions/v1/deduplicate-trends', true,
   'Batch deduplicate similar trending topics')
ON CONFLICT (job_name) DO UPDATE SET
  is_active = true,
  schedule = EXCLUDED.schedule;
```

---

## Verification Queries

### Check Deduplication Effectiveness

```sql
-- Before: Count potential duplicates
SELECT COUNT(*) as duplicate_pairs
FROM (
  SELECT a.id
  FROM trend_events a
  JOIN trend_events b ON a.id < b.id
  WHERE a.is_trending = true AND b.is_trending = true
    AND a.last_seen_at > NOW() - INTERVAL '24 hours'
    AND b.last_seen_at > NOW() - INTERVAL '24 hours'
    AND similarity(a.event_title, b.event_title) > 0.75
) pairs;

-- After: Should be 0 or near 0
```

### Check Merge History

```sql
-- See what was merged
SELECT
  event_title,
  confidence_score,
  merged_from,
  array_length(merged_from, 1) as merge_count
FROM trend_events
WHERE merged_from IS NOT NULL
  AND array_length(merged_from, 1) > 0
ORDER BY array_length(merged_from, 1) DESC
LIMIT 20;
```

---

## Rollback Plan

```sql
-- If deduplication causes issues, restore merged trends
UPDATE trend_events
SET
  is_trending = true,
  is_cluster_representative = true
WHERE is_cluster_representative = false
  AND last_seen_at > NOW() - INTERVAL '24 hours';
```

---

## Verification Checklist

- [ ] pg_trgm extension enabled
- [ ] cluster_id column added
- [ ] check_trend_duplicate function created
- [ ] merge_trend_into function created
- [ ] deduplicate-trends edge function deployed
- [ ] Batch job scheduled
- [ ] Real-time check integrated into detect-trend-events
- [ ] Duplicate pairs reduced to <5

---

## Next Agent

After completing deduplication, proceed to:
→ `29-twitter-like-ux-implementer.md` (Implement article-based drill-down)
