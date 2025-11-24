# 🧪 Sprint 0 Testing Guide

## Quick Test Process (5 minutes)

### Step 1: Run Quick Test
Open your Supabase Dashboard → SQL Editor and run:

```sql
-- Copy contents of QUICK_TEST_SPRINT_0.sql
```

**Expected Results:**
- ✅ Sprint 0 migrations APPLIED (or ❌ if not deployed)
- Velocity working status
- Processing activity check
- Backlog completion percentage

### Step 2: Interpret Results

#### If you see "❌ Sprint 0 migrations NOT APPLIED":
The fixes haven't been deployed yet. You need to:
1. Run the migrations (see Deployment section below)
2. Deploy the edge functions
3. Test again

#### If you see "✅ Sprint 0 migrations APPLIED" but "❌ BROKEN - All velocities are 0":
The database functions exist but the edge function needs updating:
1. Deploy the fixed analyze-bluesky-posts function
2. Wait 10 minutes for it to run
3. Test again

#### If everything shows ✅:
Sprint 0 is fully deployed and working! 🎉

## Detailed Testing Process (15 minutes)

### Test 1: Database Infrastructure
Run `TEST_SPRINT_0_COMPLETE.sql` in SQL Editor for comprehensive checks:
- Velocity functions existence
- Backfill infrastructure
- Actual velocity calculations
- Processing activity
- Scheduled jobs
- Recent errors

### Test 2: Manual Velocity Test
Run `MANUAL_TEST_VELOCITY.sql` to:
- Insert test data if needed
- Calculate velocities manually
- Compare expected vs actual
- Test the update_bluesky_trends() function

### Test 3: Check Processing Rate
```sql
-- Monitor posts being processed
SELECT
    DATE_TRUNC('hour', ai_processed_at) as hour,
    COUNT(*) as posts_processed
FROM bluesky_posts
WHERE ai_processed = true
    AND ai_processed_at >= now() - interval '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

## If Sprint 0 is NOT Deployed

### Quick Deployment Steps:

#### 1. Apply Migrations
In Supabase Dashboard → SQL Editor, run each file:
- `20251123100000_fix_bluesky_velocity_algorithm.sql`
- `20251123101000_create_backfill_scheduler.sql`

#### 2. Add OpenAI API Key
Supabase Dashboard → Settings → Edge Functions → Secrets:
```
OPENAI_API_KEY = sk-...your-key...
```

#### 3. Deploy Edge Functions
```bash
# In your terminal
cd C:\Users\Husse\mojo-digital-wins

# Copy fixed version to main file
copy supabase\functions\analyze-bluesky-posts\index_fixed.ts supabase\functions\analyze-bluesky-posts\index.ts

# Deploy functions
npx supabase functions deploy analyze-bluesky-posts
npx supabase functions deploy backfill-bluesky-posts
```

#### 4. Trigger Initial Processing
```bash
# Manually trigger backfill
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/backfill-bluesky-posts \
  -H "Authorization: Bearer YOUR-SERVICE-ROLE-KEY" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 500, "maxBatches": 10}'
```

## Monitoring Dashboard

After deployment, monitor progress with this query:

```sql
-- Real-time monitoring dashboard
SELECT
    '📊 PROCESSING STATUS' as section,
    (SELECT COUNT(*) FROM bluesky_posts WHERE ai_processed = true) as processed,
    (SELECT COUNT(*) FROM bluesky_posts WHERE ai_processed = false AND ai_relevance_score >= 0.1) as unprocessed,
    (SELECT COUNT(*) FROM bluesky_posts WHERE ai_processed = true AND ai_processed_at >= now() - interval '1 hour') as last_hour,
    (SELECT COUNT(*) FROM bluesky_trends WHERE velocity > 0) as trending_topics,
    (SELECT MAX(velocity) FROM bluesky_trends) || '%' as max_velocity;
```

## Success Criteria Checklist

Sprint 0 is working when:

- [ ] `update_bluesky_trends` function exists in database
- [ ] At least 1 topic shows velocity > 0%
- [ ] Posts are being processed (check ai_processed_at timestamps)
- [ ] Backfill completion > 50%
- [ ] No critical errors in last hour
- [ ] Trending topics appear in Analytics dashboard

## Troubleshooting

### Problem: All velocities still showing 0%
**Solution**:
1. Manually run: `SELECT update_bluesky_trends();`
2. Check if posts have ai_topics populated
3. Verify posts exist in multiple time windows (1h, 6h, 24h)

### Problem: No posts being processed
**Solution**:
1. Check if OPENAI_API_KEY is set
2. Check edge function logs: `npx supabase functions logs analyze-bluesky-posts`
3. Manually trigger: Call analyze-bluesky-posts via dashboard

### Problem: Migration errors
**Solution**:
1. Check for existing functions: `SELECT proname FROM pg_proc WHERE proname LIKE '%bluesky%';`
2. Drop and recreate if needed
3. Ensure pg_cron extension is enabled

## Expected Timeline

- **Test execution**: 5 minutes
- **If not deployed - deployment**: 30 minutes
- **Backfill completion**: 2-4 hours
- **Full verification**: 4-5 hours total

## Next Steps

Once all tests pass:
1. Monitor for 24 hours
2. Verify data quality
3. Proceed to Sprint 1: Client Intelligence Infrastructure

---

**Quick Command Reference:**
```bash
# Check logs
npx supabase functions logs analyze-bluesky-posts --tail

# Monitor backfill
npx supabase db execute --sql "SELECT * FROM backfill_monitoring"

# Check trends
npx supabase db execute --sql "SELECT * FROM bluesky_trending_topics LIMIT 5"
```

🤖 Generated with Claude Code