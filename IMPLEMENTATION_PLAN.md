# System Recovery & Enhancement Implementation Plan

## Overview

This plan addresses all 36 issues identified in the Deep System Audit, organized into 4 phases over 2 weeks. Each phase is designed to restore and enhance system functionality with minimal downtime.

**Total Estimated Time**: 80-100 hours (2 weeks with 1 developer)  
**Risk Level**: Medium (core system changes)  
**Rollback Strategy**: Database backups before each migration, feature flags for new code

---

## Phase 1: Emergency Fixes (Days 1-2) - CRITICAL PATH

**Goal**: Restore core AI analysis and job scheduling functionality  
**Duration**: 16 hours  
**Success Criteria**: Articles being analyzed, jobs running on schedule

### Task 1.1: Fix AI Analysis Rate Limiting & Bugs
**Duration**: 3 hours  
**Priority**: 🔴 CRITICAL

**Files to Modify**:
- `supabase/functions/analyze-articles/index.ts`
- `supabase/functions/analyze-bluesky-posts/index.ts`

**Changes Required**:

1. **Fix `.onConflict()` Bug** (Lines 72-74 in analyze-articles)
   ```typescript
   // REPLACE THIS:
   await supabase.from('ai_analysis_cache')
     .insert({ ... })
     .onConflict('content_hash')
     .ignore();

   // WITH THIS:
   await supabase.from('ai_analysis_cache')
     .upsert({ ... }, { 
       onConflict: 'content_hash',
       ignoreDuplicates: true 
     });
   ```

2. **Reduce Batch Size** (Line ~180)
   ```typescript
   // Change from:
   const BATCH_SIZE = 50;
   // To:
   const BATCH_SIZE = 5;
   ```

3. **Add Exponential Backoff for 429 Errors**
   ```typescript
   async function callClaudeWithBackoff(
     content: string, 
     retryCount = 0
   ): Promise<any> {
     const MAX_RETRIES = 5;
     const BASE_DELAY = 1000; // 1 second
     
     try {
       // Add 1 second delay between ALL requests
       await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
       
       const response = await fetch(ANTHROPIC_API_URL, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'x-api-key': ANTHROPIC_API_KEY,
           'anthropic-version': '2023-06-01'
         },
         body: JSON.stringify({
           model: 'claude-3-haiku-20240307',
           max_tokens: 1024,
           messages: [{ role: 'user', content }]
         })
       });
       
       if (response.status === 429) {
         throw new Error('Rate limit exceeded');
       }
       
       if (!response.ok) {
         const errorText = await response.text();
         throw new Error(`API error ${response.status}: ${errorText}`);
       }
       
       return await response.json();
       
     } catch (error) {
       if (error.message.includes('429') || error.message.includes('Rate limit')) {
         if (retryCount < MAX_RETRIES) {
           // Exponential backoff: 2s, 4s, 8s, 16s, 32s
           const delay = BASE_DELAY * Math.pow(2, retryCount);
           console.log(`Rate limited. Waiting ${delay}ms before retry ${retryCount + 1}/${MAX_RETRIES}`);
           
           await new Promise(resolve => setTimeout(resolve, delay));
           return callClaudeWithBackoff(content, retryCount + 1);
         }
       }
       throw error;
     }
   }
   ```

4. **Add Better Error Logging**
   ```typescript
   try {
     // ... analysis code
   } catch (error) {
       console.error('[analyze-articles] Error:', {
         articleId: article.id,
         error: error.message,
         stack: error.stack,
         timestamp: new Date().toISOString()
       });
       
       // Log to job_failures table
       await supabase.from('job_failures').insert({
         function_name: 'analyze-articles',
         error_message: error.message,
         error_stack: error.stack,
         context_data: { article_id: article.id }
       });
   }
   ```

**Testing**:
- Call function with 5 articles manually
- Verify no 429 errors
- Verify `affected_groups` and `relevance_category` populated
- Check job_failures table for errors

---

### Task 1.2: Fix Scheduled Jobs System
**Duration**: 5 hours  
**Priority**: 🔴 CRITICAL

**Files to Create**:
- `supabase/migrations/[timestamp]_fix_scheduled_jobs_system.sql`

**Files to Modify**:
- `supabase/functions/run-scheduled-jobs/index.ts`

**Step 1: Create Database Function for Job Updates**

Create migration file:
```sql
-- Create function to calculate next run time from cron expression
CREATE OR REPLACE FUNCTION calculate_next_run(cron_schedule TEXT)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  next_run TIMESTAMPTZ;
BEGIN
  -- Simple cron parsing for common patterns
  CASE 
    WHEN cron_schedule = '*/2 * * * *' THEN
      next_run := NOW() + INTERVAL '2 minutes';
    WHEN cron_schedule = '*/5 * * * *' THEN
      next_run := NOW() + INTERVAL '5 minutes';
    WHEN cron_schedule = '*/10 * * * *' THEN
      next_run := NOW() + INTERVAL '10 minutes';
    WHEN cron_schedule = '*/15 * * * *' THEN
      next_run := NOW() + INTERVAL '15 minutes';
    WHEN cron_schedule = '*/30 * * * *' THEN
      next_run := NOW() + INTERVAL '30 minutes';
    WHEN cron_schedule = '0 * * * *' THEN
      -- Every hour on the hour
      next_run := DATE_TRUNC('hour', NOW()) + INTERVAL '1 hour';
    WHEN cron_schedule = '0 */6 * * *' THEN
      -- Every 6 hours
      next_run := DATE_TRUNC('hour', NOW()) + INTERVAL '6 hours';
    WHEN cron_schedule = '0 2 * * *' THEN
      -- Daily at 2 AM
      IF EXTRACT(HOUR FROM NOW()) >= 2 THEN
        next_run := DATE_TRUNC('day', NOW()) + INTERVAL '1 day' + INTERVAL '2 hours';
      ELSE
        next_run := DATE_TRUNC('day', NOW()) + INTERVAL '2 hours';
      END IF;
    WHEN cron_schedule = '0 7 * * *' THEN
      -- Daily at 7 AM
      IF EXTRACT(HOUR FROM NOW()) >= 7 THEN
        next_run := DATE_TRUNC('day', NOW()) + INTERVAL '1 day' + INTERVAL '7 hours';
      ELSE
        next_run := DATE_TRUNC('day', NOW()) + INTERVAL '7 hours';
      END IF;
    ELSE
      -- Default: 1 hour from now
      next_run := NOW() + INTERVAL '1 hour';
  END CASE;
  
  RETURN next_run;
END;
$$ LANGUAGE plpgsql;

-- Create function to update job after execution
CREATE OR REPLACE FUNCTION update_job_after_execution(
  p_job_id UUID,
  p_status TEXT,
  p_duration_ms INTEGER,
  p_error TEXT
)
RETURNS VOID AS $$
DECLARE
  v_schedule TEXT;
  v_next_run TIMESTAMPTZ;
  v_consecutive_failures INTEGER;
BEGIN
  -- Get current job info
  SELECT schedule, consecutive_failures
  INTO v_schedule, v_consecutive_failures
  FROM scheduled_jobs
  WHERE id = p_job_id;
  
  -- Calculate next run time
  v_next_run := calculate_next_run(v_schedule);
  
  -- Update job record
  UPDATE scheduled_jobs
  SET 
    last_run_at = NOW(),
    last_run_status = p_status,
    last_run_duration_ms = p_duration_ms,
    last_error = p_error,
    next_run_at = v_next_run,
    consecutive_failures = CASE 
      WHEN p_status = 'success' THEN 0
      ELSE COALESCE(v_consecutive_failures, 0) + 1
    END,
    -- Auto-disable after 5 consecutive failures
    is_active = CASE
      WHEN p_status = 'failed' AND COALESCE(v_consecutive_failures, 0) >= 4 THEN false
      ELSE is_active
    END,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Log if auto-disabled
  IF p_status = 'failed' AND v_consecutive_failures >= 4 THEN
    RAISE NOTICE 'Job % auto-disabled after 5 consecutive failures', p_job_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add missing columns to job_executions
ALTER TABLE job_executions 
ADD COLUMN IF NOT EXISTS items_processed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS items_created INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS execution_log JSONB;

-- Add missing columns to scheduled_jobs
ALTER TABLE scheduled_jobs
ADD COLUMN IF NOT EXISTS last_run_status TEXT,
ADD COLUMN IF NOT EXISTS last_run_duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;

-- Fix existing job types to match code
UPDATE scheduled_jobs SET job_type = 'fetch_rss' WHERE job_name = 'fetch-rss-feeds';
UPDATE scheduled_jobs SET job_type = 'fetch_executive_orders' WHERE job_name = 'fetch-executive-orders';
UPDATE scheduled_jobs SET job_type = 'track_state_actions' WHERE job_name = 'track-state-actions';
UPDATE scheduled_jobs SET job_type = 'send_briefings' WHERE job_name = 'send-daily-briefing';
UPDATE scheduled_jobs SET job_type = 'smart_alerting' WHERE job_name = 'smart-alerting';

-- Initialize next_run_at for all jobs
UPDATE scheduled_jobs 
SET next_run_at = calculate_next_run(schedule)
WHERE next_run_at IS NULL OR next_run_at < NOW();

-- Clean up stuck jobs
UPDATE job_executions
SET 
  status = 'failed',
  error_message = 'Job timeout - marked as failed during cleanup',
  completed_at = NOW(),
  duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER * 1000
WHERE status = 'running' 
  AND started_at < NOW() - INTERVAL '1 hour';
```

**Step 2: Update run-scheduled-jobs Edge Function**

Modify `supabase/functions/run-scheduled-jobs/index.ts`:

```typescript
// At the top, add these interface definitions:
interface JobResult {
  processed?: number;
  inserted?: number;
  analyzed?: number;
  fetched?: number;
  created?: number;
  deleted?: number;
  emails_sent?: number;
  topicsExtracted?: number;
  postsCollected?: number;
  anomalies_detected?: number;
  snapshots_created?: number;
  trends_analyzed?: number;
  correlations_found?: number;
  total_fetched?: number;
  total_inserted?: number;
  results?: any;
}

// In the switch statement, add the missing cases:
switch (job.job_type) {
  case 'fetch_rss':
    const rssResponse = await supabase.functions.invoke('fetch-rss-feeds', {
      body: {}
    });
    if (rssResponse.error) throw new Error(rssResponse.error.message);
    result = rssResponse.data;
    itemsProcessed = result?.processed || 0;
    itemsCreated = result?.inserted || 0;
    break;

  case 'fetch_executive_orders':
    const eoResponse = await supabase.functions.invoke('fetch-executive-orders', {
      body: {}
    });
    if (eoResponse.error) throw new Error(eoResponse.error.message);
    result = eoResponse.data;
    itemsProcessed = result?.fetched || 0;
    itemsCreated = result?.inserted || 0;
    break;

  case 'track_state_actions':
    const saResponse = await supabase.functions.invoke('track-state-actions', {
      body: { action: 'fetch_all' }
    });
    if (saResponse.error) throw new Error(saResponse.error.message);
    result = saResponse.data;
    itemsProcessed = result?.total_fetched || 0;
    itemsCreated = result?.total_inserted || 0;
    break;

  case 'smart_alerting':
    const alertResponse = await supabase.functions.invoke('smart-alerting', {
      body: { action: 'full' }
    });
    if (alertResponse.error) throw new Error(alertResponse.error.message);
    result = alertResponse.data;
    itemsProcessed = result?.results?.daily_briefing?.critical || 0;
    break;

  case 'send_briefings':
    const briefingResponse = await supabase.functions.invoke('send-daily-briefing', {
      body: {}
    });
    if (briefingResponse.error) throw new Error(briefingResponse.error.message);
    result = briefingResponse.data;
    itemsProcessed = result?.emails_sent || 0;
    break;

  // ... existing cases remain ...
}
```

**Testing**:
- Manually trigger `run-scheduled-jobs` with `force=true`
- Verify all 11 jobs execute without "Unknown job type" errors
- Check `last_run_at` and `next_run_at` are updated
- Verify job_executions records created with items_processed

---

### Task 1.3: Create Missing Analytics Tables
**Duration**: 2 hours  
**Priority**: 🔴 CRITICAL

**Files to Create**:
- `supabase/migrations/[timestamp]_create_analytics_tables.sql`

**Migration Content**:
```sql
-- Create sentiment_snapshots table
CREATE TABLE IF NOT EXISTS sentiment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  affected_group TEXT NOT NULL,
  article_count INTEGER DEFAULT 0,
  positive_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  avg_sentiment NUMERIC,
  sentiment_trend TEXT, -- 'improving', 'declining', 'stable'
  top_topics JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, affected_group)
);

-- Create indexes
CREATE INDEX idx_sentiment_snapshots_date ON sentiment_snapshots(snapshot_date DESC);
CREATE INDEX idx_sentiment_snapshots_group ON sentiment_snapshots(affected_group);
CREATE INDEX idx_sentiment_snapshots_date_group ON sentiment_snapshots(snapshot_date, affected_group);

-- Enable RLS
ALTER TABLE sentiment_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sentiment snapshots"
  ON sentiment_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Service can manage sentiment snapshots"
  ON sentiment_snapshots FOR ALL
  USING (true)
  WITH CHECK (true);

-- Fix trending_topics table schema
ALTER TABLE trending_topics
ADD COLUMN IF NOT EXISTS sentiment_avg NUMERIC,
ADD COLUMN IF NOT EXISTS sentiment_positive INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sentiment_negative INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sentiment_neutral INTEGER DEFAULT 0;

-- Add missing indexes to trending_topics
CREATE INDEX IF NOT EXISTS idx_trending_topics_velocity ON trending_topics(velocity_score DESC) WHERE velocity_score > 50;
CREATE INDEX IF NOT EXISTS idx_trending_topics_hour ON trending_topics(hour_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_topic_hour ON trending_topics(topic, hour_timestamp DESC);
```

**Testing**:
- Query sentiment_snapshots (should be empty but queryable)
- Query trending_topics with new columns
- Verify indexes exist

---

### Task 1.4: Add Missing Columns to Support Tables
**Duration**: 1 hour  
**Priority**: 🔴 CRITICAL

**Files to Create**:
- `supabase/migrations/[timestamp]_add_support_table_columns.sql`

**Migration Content**:
```sql
-- Add columns to rss_sources for health tracking
ALTER TABLE rss_sources
ADD COLUMN IF NOT EXISTS fetch_frequency_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_fetch_status TEXT,
ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- Create index for error tracking
CREATE INDEX IF NOT EXISTS idx_rss_sources_errors ON rss_sources(consecutive_errors DESC) WHERE is_active = true;

-- Add columns to job_failures for better tracking
ALTER TABLE job_failures
ADD COLUMN IF NOT EXISTS job_name TEXT;

-- Backfill job_name from function_name
UPDATE job_failures SET job_name = function_name WHERE job_name IS NULL;
```

**Testing**:
- Query rss_sources with new columns
- Verify indexes exist

---

### Task 1.5: Deploy and Test Phase 1
**Duration**: 2 hours  
**Priority**: 🔴 CRITICAL

**Steps**:
1. Create database backup
2. Run all migrations in order
3. Deploy edge function changes
4. Manually test each job type
5. Monitor logs for 30 minutes
6. Verify no stuck jobs
7. Check AI analysis working

**Success Criteria**:
- [ ] All migrations applied successfully
- [ ] No "Unknown job type" errors
- [ ] Jobs updating last_run_at and next_run_at
- [ ] AI analysis completing without rate limit errors
- [ ] affected_groups and relevance_category being populated
- [ ] job_executions recording items_processed

---

### Task 1.6: Emergency Hotfix for Immediate Relief
**Duration**: 1 hour  
**Priority**: 🔴 CRITICAL

While waiting for full fixes, apply quick relief:

**Quick Fix Script** (run via supabase insert tool):
```sql
-- Clear stuck jobs
UPDATE job_executions
SET status = 'failed', 
    error_message = 'Cleared during emergency maintenance',
    completed_at = NOW()
WHERE status = 'running' AND started_at < NOW() - INTERVAL '30 minutes';

-- Reset job schedules
UPDATE scheduled_jobs
SET next_run_at = NOW() + INTERVAL '5 minutes'
WHERE next_run_at < NOW() AND is_active = true;

-- Clear rate limit failures to allow retry
DELETE FROM job_failures 
WHERE error_message LIKE '%429%' 
  AND created_at < NOW() - INTERVAL '1 hour';
```

---

## Phase 2: Core Functionality Restoration (Days 3-5)

**Goal**: Restore filtering, alerting, and data backfill  
**Duration**: 24 hours  
**Success Criteria**: Users can filter by demographics, alerts are generated

### Task 2.1: Run Data Backfill
**Duration**: 2 hours setup + 24-48 hours automated  
**Priority**: 🔴 CRITICAL

**Files to Modify**:
- `supabase/functions/backfill-analysis/index.ts`

**Changes**:
1. Add progress tracking
2. Add batch status reporting
3. Add pause/resume capability

**Enhanced Backfill Function**:
```typescript
// Add to backfill-analysis/index.ts
interface BackfillStatus {
  total_articles: number;
  total_posts: number;
  articles_processed: number;
  posts_processed: number;
  articles_remaining: number;
  posts_remaining: number;
  started_at: string;
  estimated_completion: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      daysBack = 7, 
      batchSize = 100,
      action = 'start' // 'start', 'status', 'pause'
    } = await req.json().catch(() => ({}));

    if (action === 'status') {
      // Return current backfill status
      const { data: pending_articles } = await supabase
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('processing_status', 'pending');
      
      const { data: pending_posts } = await supabase
        .from('bluesky_posts')
        .select('id', { count: 'exact', head: true })
        .eq('ai_processed', false);
      
      // Calculate estimated completion (5 articles per minute)
      const total_items = (pending_articles?.length || 0) + (pending_posts?.length || 0);
      const minutes_remaining = Math.ceil(total_items / 5);
      
      return new Response(JSON.stringify({
        articles_remaining: pending_articles?.length || 0,
        posts_remaining: pending_posts?.length || 0,
        estimated_minutes: minutes_remaining
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mark items for reanalysis
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const { data: articlesToFix, error: queryError } = await supabase
      .from('articles')
      .update({ 
        processing_status: 'pending',
        ai_summary: null,
        affected_groups: null,
        relevance_category: null
      })
      .gte('published_date', cutoffDate.toISOString())
      .or('affected_groups.is.null,relevance_category.is.null')
      .select('id');

    if (queryError) throw queryError;

    const { data: postsToFix, error: postsQueryError } = await supabase
      .from('bluesky_posts')
      .update({ 
        ai_processed: false,
        ai_topics: null,
        affected_groups: null,
        relevance_category: null
      })
      .gte('created_at', cutoffDate.toISOString())
      .or('affected_groups.is.null,relevance_category.is.null')
      .select('id');

    if (postsQueryError) throw postsQueryError;

    console.log(`[backfill] Marked ${articlesToFix?.length || 0} articles and ${postsToFix?.length || 0} posts for reanalysis`);

    // Trigger analysis (will be picked up by scheduled jobs)
    if (articlesToFix && articlesToFix.length > 0) {
      supabase.functions.invoke('analyze-articles').catch(console.error);
    }
    
    if (postsToFix && postsToFix.length > 0) {
      supabase.functions.invoke('analyze-bluesky-posts').catch(console.error);
    }

    return new Response(JSON.stringify({
      success: true,
      articles_marked: articlesToFix?.length || 0,
      posts_marked: postsToFix?.length || 0,
      message: 'Backfill initiated. Monitor progress using action=status'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[backfill] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

**Files to Modify**:
- `src/components/admin/DataBackfillPanel.tsx` - Add status polling

**Testing**:
- Start backfill for 7 days
- Check status every 5 minutes
- Verify articles getting affected_groups populated
- Monitor for rate limit errors

---

### Task 2.2: Enable Anomaly Detection & Alerting
**Duration**: 4 hours  
**Priority**: 🟠 HIGH

**Files to Modify**:
- `supabase/functions/detect-anomalies/index.ts`

**Changes Required**:
1. Ensure alert creation working
2. Add more anomaly types
3. Improve z-score calculations

**Enhanced Anomaly Detection**:
```typescript
// In detect-anomalies/index.ts

// Add new anomaly types
const ANOMALY_TYPES = {
  TOPIC_VELOCITY_SPIKE: 'topic_velocity_spike',
  SENTIMENT_SHIFT: 'sentiment_shift',
  MENTION_SPIKE: 'mention_spike',
  SOURCE_FAILURE: 'source_failure',
  ANALYSIS_SLOWDOWN: 'analysis_slowdown'
};

// After detecting anomalies, create alerts for critical/high severity
async function createAlertsForAnomalies(supabase: any, anomalies: any[]) {
  const criticalAnomalies = anomalies.filter(a => 
    a.severity === 'critical' || a.severity === 'high'
  );

  for (const anomaly of criticalAnomalies) {
    let title = '';
    let message = '';
    
    switch (anomaly.anomaly_type) {
      case ANOMALY_TYPES.TOPIC_VELOCITY_SPIKE:
        title = `⚡ Trending Topic Spike: ${anomaly.entity_name}`;
        message = `Topic "${anomaly.entity_name}" is trending ${Math.round(anomaly.z_score)}x above normal. Current velocity: ${anomaly.current_value}, Baseline: ${anomaly.baseline_value}`;
        break;
      
      case ANOMALY_TYPES.SENTIMENT_SHIFT:
        title = `😟 Sentiment Shift: ${anomaly.entity_name}`;
        message = `Sentiment for ${anomaly.entity_name} has shifted significantly. Z-score: ${anomaly.z_score.toFixed(2)}`;
        break;
      
      case ANOMALY_TYPES.MENTION_SPIKE:
        title = `📢 Mention Spike: ${anomaly.entity_name}`;
        message = `Mentions of ${anomaly.entity_name} spiked to ${anomaly.current_value} (${Math.round(anomaly.z_score)}x normal)`;
        break;
      
      default:
        title = `⚠️ Anomaly Detected: ${anomaly.entity_name}`;
        message = `${anomaly.anomaly_type} detected with z-score ${anomaly.z_score.toFixed(2)}`;
    }

    // Create alert in queue
    await supabase.from('alert_queue').insert({
      alert_type: anomaly.anomaly_type,
      title,
      message,
      severity: anomaly.severity,
      data: {
        anomaly_id: anomaly.id,
        entity_type: anomaly.entity_type,
        entity_id: anomaly.entity_id,
        z_score: anomaly.z_score,
        current_value: anomaly.current_value,
        baseline_value: anomaly.baseline_value,
        metadata: anomaly.metadata
      }
    });

    console.log(`[detect-anomalies] Created ${anomaly.severity} alert: ${title}`);
  }

  return criticalAnomalies.length;
}
```

**Testing**:
- Manually run detect-anomalies function
- Verify alerts created in alert_queue
- Check CriticalAlerts component shows alerts
- Test with mock anomaly data

---

### Task 2.3: Fix Bluesky Collection Errors
**Duration**: 4 hours  
**Priority**: 🟠 HIGH

**Files to Modify**:
- `supabase/functions/bluesky-stream/index.ts`

**Changes Required**:
1. Add better error handling
2. Add retry logic for network errors
3. Add cursor validation

**Testing**:
- Monitor bluesky-stream job execution
- Verify posts being collected
- Check for "Edge Function returned a non-2xx status code" errors
- Validate cursor updates

---

### Task 2.4: Add Topic Extraction to Scheduled Jobs
**Duration**: 2 hours  
**Priority**: 🟠 HIGH

**Files to Modify**:
- Database: Add job to scheduled_jobs
- `supabase/functions/run-scheduled-jobs/index.ts`

**SQL to Add Job**:
```sql
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active)
VALUES (
  'Extract Trending Topics',
  'extract_trending_topics',
  '0 */1 * * *', -- Every hour
  'extract-trending-topics',
  true
)
ON CONFLICT (job_name) DO NOTHING;
```

**Add to switch case**:
```typescript
case 'extract_trending_topics':
  const topicsResponse = await supabase.functions.invoke('extract-trending-topics', {
    body: {}
  });
  if (topicsResponse.error) throw new Error(topicsResponse.error.message);
  result = topicsResponse.data;
  itemsProcessed = result?.topicsExtracted || 0;
  break;
```

---

## Phase 3: Quality & Performance (Days 6-8)

**Goal**: Implement monitoring, optimize performance  
**Duration**: 24 hours  
**Success Criteria**: System stable, performant, observable

### Task 3.1: Create System Health Dashboard
**Duration**: 6 hours  
**Priority**: 🟡 MEDIUM

**Files to Create**:
- `src/components/admin/SystemHealthDashboard.tsx`
- `src/pages/SystemHealth.tsx`

**Dashboard Components**:
1. **Job Status Panel**
   - Last run time for each job
   - Success/failure rate (last 24h)
   - Average duration
   - Next scheduled run
   
2. **API Health Panel**
   - Claude API success rate
   - Average response time
   - Rate limit status
   - Errors in last hour

3. **Data Quality Panel**
   - % articles with affected_groups
   - % articles with relevance_category
   - Average AI confidence score
   - Analysis lag (time from ingestion to analysis)

4. **System Metrics Panel**
   - Articles ingested per hour
   - Bluesky posts per hour
   - Active RSS sources
   - Alerts generated today

**Implementation**:
```typescript
// src/components/admin/SystemHealthDashboard.tsx
export function SystemHealthDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  
  useEffect(() => {
    const fetchMetrics = async () => {
      // Fetch from multiple sources
      const [jobs, failures, articles, posts] = await Promise.all([
        supabase.from('scheduled_jobs').select('*'),
        supabase.from('job_failures')
          .select('*')
          .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString()),
        supabase.from('articles')
          .select('id, affected_groups, relevance_category, ai_confidence_score', 
                  { count: 'exact' })
          .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString()),
        supabase.from('bluesky_posts')
          .select('id', { count: 'exact' })
          .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString())
      ]);
      
      setMetrics({
        jobs: jobs.data,
        failures: failures.data?.length || 0,
        articlesProcessed: articles.count || 0,
        postsCollected: posts.count || 0
      });
    };
    
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // ... render dashboard
}
```

---

### Task 3.2: Implement Circuit Breakers
**Duration**: 4 hours  
**Priority**: 🟡 MEDIUM

**Files to Modify**:
- All edge functions

**Pattern to Add**:
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.lastFailureTime || 0) > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      console.error(`Circuit breaker opened after ${this.failures} failures`);
    }
  }
}

// Usage in edge functions:
const claudeCircuitBreaker = new CircuitBreaker(5, 60000);

const analysis = await claudeCircuitBreaker.call(() => 
  callClaudeAPI(article)
);
```

---

### Task 3.3: Add Request Queuing for AI Calls
**Duration**: 4 hours  
**Priority**: 🟡 MEDIUM

**Files to Create**:
- `supabase/functions/_shared/rate-limiter.ts`

**Implementation**:
```typescript
// _shared/rate-limiter.ts
export class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestsPerSecond: number;
  
  constructor(requestsPerSecond: number = 1) {
    this.requestsPerSecond = requestsPerSecond;
  }
  
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  private async processQueue() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        await new Promise(resolve => 
          setTimeout(resolve, 1000 / this.requestsPerSecond)
        );
      }
    }
    
    this.processing = false;
  }
}

// Usage:
const rateLimiter = new RateLimiter(1); // 1 request per second

const results = await Promise.all(
  articles.map(article => 
    rateLimiter.enqueue(() => analyzeArticle(article))
  )
);
```

---

### Task 3.4: Database Connection Pooling
**Duration**: 2 hours  
**Priority**: 🟡 MEDIUM

**Changes**: Already handled by Supabase client, but optimize usage:

```typescript
// Create single client instance per function, reuse across requests
let supabaseClient: any = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
  }
  return supabaseClient;
}

// Use in all edge functions
serve(async (req) => {
  const supabase = getSupabaseClient();
  // ... rest of function
});
```

---

### Task 3.5: Add Job Timeout & Cleanup
**Duration**: 2 hours  
**Priority**: 🟡 MEDIUM

**Files to Create**:
- New scheduled job for cleanup

**SQL**:
```sql
-- Add cleanup job
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active)
VALUES (
  'Cleanup Stuck Jobs',
  'cleanup_stuck_jobs',
  '*/5 * * * *', -- Every 5 minutes
  'cleanup-stuck-jobs',
  true
);
```

**Files to Create**:
- `supabase/functions/cleanup-stuck-jobs/index.ts`

```typescript
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Mark jobs running > 1 hour as failed
  const { data: stuckJobs } = await supabase
    .from('job_executions')
    .update({
      status: 'failed',
      error_message: 'Job timeout - exceeded 1 hour',
      completed_at: new Date().toISOString()
    })
    .eq('status', 'running')
    .lt('started_at', new Date(Date.now() - 60*60*1000).toISOString())
    .select('id');

  console.log(`Cleaned up ${stuckJobs?.length || 0} stuck jobs`);

  return new Response(JSON.stringify({
    cleaned: stuckJobs?.length || 0
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

---

## Phase 4: Advanced Features (Days 9-14)

**Goal**: Implement improvements for better UX and performance  
**Duration**: 32 hours  
**Success Criteria**: All 15 improvements completed

### Task 4.1: Hot/Cold Analysis Paths
**Duration**: 6 hours

**Files to Modify**:
- `supabase/functions/analyze-articles/index.ts`

**Implementation**:
```typescript
// Prioritize recent articles
const { data: recentArticles } = await supabase
  .from('articles')
  .select('*')
  .eq('processing_status', 'pending')
  .gte('published_date', new Date(Date.now() - 60*60*1000).toISOString())
  .order('published_date', { ascending: false })
  .limit(10);

const { data: olderArticles } = await supabase
  .from('articles')
  .select('*')
  .eq('processing_status', 'pending')
  .lt('published_date', new Date(Date.now() - 60*60*1000).toISOString())
  .limit(5);

// Process recent first
const allArticles = [...(recentArticles || []), ...(olderArticles || [])];
```

---

### Task 4.2: Confidence Scoring System
**Duration**: 4 hours

**Files to Modify**:
- All AI analysis functions

**Add confidence thresholds**:
```typescript
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.5
};

function classifyConfidence(score: number): string {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  if (score >= CONFIDENCE_THRESHOLDS.LOW) return 'low';
  return 'very_low';
}

// Flag low confidence for review
if (confidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
  await supabase.from('review_queue').insert({
    article_id: article.id,
    reason: 'low_confidence',
    confidence_score: confidence
  });
}
```

---

### Task 4.3: Progressive Loading UI
**Duration**: 4 hours

**Files to Modify**:
- `src/components/news/NewsFeed.tsx`

**Changes**:
```typescript
// Load first 10 immediately, then progressively load more
const [visibleArticles, setVisibleArticles] = useState(10);

useEffect(() => {
  const timer = setTimeout(() => {
    if (visibleArticles < articles.length) {
      setVisibleArticles(prev => Math.min(prev + 10, articles.length));
    }
  }, 100);

  return () => clearTimeout(timer);
}, [visibleArticles, articles.length]);

// Render only visible articles
{articles.slice(0, visibleArticles).map(article => (
  <NewsCard key={article.id} article={article} />
))}
```

---

### Task 4.4: Data Validation Layer
**Duration**: 4 hours

**Files to Create**:
- `supabase/functions/_shared/validators.ts`

**Implementation**:
```typescript
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

export function validateArticleAnalysis(analysis: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let confidence = 1.0;

  // Required fields
  if (!analysis.affected_groups || !Array.isArray(analysis.affected_groups)) {
    errors.push('Missing affected_groups');
    confidence = 0;
  }

  if (!analysis.relevance_category) {
    errors.push('Missing relevance_category');
    confidence *= 0.7;
  }

  // Data quality checks
  if (analysis.affected_groups && analysis.affected_groups.length === 0) {
    warnings.push('No affected groups identified');
    confidence *= 0.8;
  }

  if (analysis.ai_summary && analysis.ai_summary.length < 50) {
    warnings.push('Summary too short');
    confidence *= 0.9;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    confidence
  };
}
```

---

### Task 4.5-4.15: Additional Improvements
**Duration**: 14 hours total

Remaining improvements to implement:
- Add health check endpoint
- Implement distributed tracing
- Add alerting system (email/webhook)
- Optimize database queries
- Add caching layer
- Implement job orchestration (DAG)
- Add human-in-the-loop review queue
- Create metrics dashboard API
- Add performance monitoring
- Implement auto-scaling for jobs
- Add A/B testing framework

---

## Testing Strategy

### Unit Tests
- Test each edge function independently
- Mock external API calls
- Test error handling paths

### Integration Tests
- Test job scheduling end-to-end
- Test AI analysis pipeline
- Test alerting flow
- Test data backfill process

### Performance Tests
- Load test with 1000 articles
- Measure analysis throughput
- Test under rate limits
- Measure database query performance

### User Acceptance Tests
- Test filtering by demographics
- Test real-time updates
- Test alert notifications
- Test dashboard accuracy

---

## Rollback Plan

**If Phase 1 Fails**:
1. Restore database from backup
2. Revert edge function deployments
3. Clear stuck jobs manually
4. Restart from beginning

**If Phase 2 Fails**:
1. Stop backfill process
2. Keep Phase 1 changes (they're stable)
3. Debug specific failing component
4. Retry once fixed

**If Phase 3/4 Fails**:
1. Keep Phases 1-2 (core functionality)
2. Disable new features via feature flags
3. Debug in staging environment
4. Redeploy when fixed

---

## Monitoring During Rollout

**Metrics to Watch**:
- Job success rate (should be >95%)
- API error rate (should be <5%)
- Analysis lag (should be <30 minutes)
- Alert generation (should be >5/day)
- User complaints (should be 0)

**Alert Thresholds**:
- Job failure rate >10% → Page on-call
- Analysis lag >2 hours → Investigate
- No articles in 1 hour → Check RSS feeds
- Rate limit errors >100/hour → Reduce batch size

---

## Success Metrics

**After Phase 1**:
- [ ] 0% of jobs failing with "Unknown job type"
- [ ] All jobs updating last_run_at
- [ ] AI analysis succeeding at >95% rate
- [ ] affected_groups populating for new articles

**After Phase 2**:
- [ ] 90%+ of articles have affected_groups
- [ ] 90%+ of articles have relevance_category
- [ ] Alerts being generated
- [ ] Filtering by demographics works

**After Phase 3**:
- [ ] System health dashboard operational
- [ ] Circuit breakers preventing cascade failures
- [ ] All metrics green on dashboard
- [ ] Response time <500ms for queries

**After Phase 4**:
- [ ] All 15 improvements implemented
- [ ] System stable for 7 days
- [ ] User satisfaction >90%
- [ ] Zero critical bugs

---

## Resources Required

**Personnel**:
- 1 Full-stack developer (80-100 hours)
- 1 DevOps engineer (8 hours for monitoring setup)
- 1 QA tester (16 hours for testing)

**Infrastructure**:
- Database backup storage (50GB)
- Staging environment for testing
- Log aggregation service

**Budget**:
- Claude API costs: ~$50-100 for backfill
- Infrastructure: $0 (using existing Supabase)
- Monitoring tools: $0 (using built-in)

---

## Communication Plan

**Daily Standups**:
- Progress update
- Blockers discussion
- Next day plan

**Stakeholder Updates**:
- End of each phase
- When metrics hit targets
- If issues arise

**User Communication**:
- Pre-launch: "System improvements coming"
- During backfill: "Enhancing data quality"
- Post-launch: "New features available"

---

## Risk Mitigation

**Risk: API rate limits during backfill**
- Mitigation: Throttle to 1 req/sec, run for 48 hours
- Contingency: Pause and resume if needed

**Risk: Database migrations fail**
- Mitigation: Test in staging first
- Contingency: Rollback script ready

**Risk: Jobs don't schedule correctly**
- Mitigation: Manual testing before automation
- Contingency: Manual triggers available

**Risk: User impact during rollout**
- Mitigation: Deploy during low-traffic hours
- Contingency: Immediate rollback capability

---

## Next Steps After Plan Approval

1. **Get stakeholder sign-off** on plan
2. **Create staging environment** for testing
3. **Set up monitoring** before changes
4. **Create database backups**
5. **Begin Phase 1** implementation

**Estimated Start Date**: Immediately upon approval  
**Estimated Completion**: 14 days from start  
**First Milestone**: Phase 1 complete (Day 2)
