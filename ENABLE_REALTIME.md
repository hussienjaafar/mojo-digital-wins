# Enable Supabase Realtime for Articles Table

Follow these steps to ensure Realtime updates work for the Intelligence Dashboard.

## Step 1: Check if Realtime is Already Enabled

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `nuclmzoasgydubdshtab`
3. Navigate to **Database** → **Replication**
4. Look for the `articles` table in the list
5. Check if there's a toggle switch enabled next to it

If it's already enabled, you're done! If not, continue to Step 2.

## Step 2: Enable Realtime via Dashboard

### Method A: Using the Dashboard (Recommended)

1. Go to **Database** → **Replication**
2. Find the `articles` table
3. Toggle the switch to **ON**
4. You should see a green checkmark or "Enabled" status

### Method B: Using SQL Editor

If the dashboard method doesn't work, use SQL:

```sql
-- Enable realtime for articles table
ALTER PUBLICATION supabase_realtime ADD TABLE articles;
```

Run this in: **SQL Editor** → New query → Execute

## Step 3: Verify Realtime is Working

### Test via SQL Editor

1. Open the Intelligence Dashboard in your browser
2. Navigate to the Analytics page (should show "LIVE" badge)
3. Open Supabase **SQL Editor** in a new tab
4. Run this query:

```sql
INSERT INTO articles (
  title,
  url,
  source_name,
  published_date,
  tags,
  sentiment_label,
  sentiment_score
) VALUES (
  'Test Real-Time Article',
  'https://example.com/test',
  'Test Source',
  NOW(),
  ARRAY['test', 'realtime'],
  'positive',
  0.8
);
```

5. **Check the dashboard** - you should see:
   - A toast notification appear
   - The "+1 new" counter increment
   - Trending topics update within seconds

### Check Browser Console

If it's not working, check the browser console (F12):

```
# Should see this when subscription connects:
New article detected: { id: ..., title: "Test Real-Time Article", ... }

# Should NOT see errors like:
Realtime channel error: ...
Subscription failed: ...
```

## Step 4: Configure RLS Policies (if needed)

If you can read articles but Realtime isn't working, check Row Level Security:

```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'articles';

-- Add policy for anonymous read access (development)
CREATE POLICY IF NOT EXISTS "Allow public read access" ON articles
  FOR SELECT USING (true);

-- OR for authenticated users only (production)
CREATE POLICY IF NOT EXISTS "Allow authenticated read" ON articles
  FOR SELECT TO authenticated USING (true);
```

## Troubleshooting

### Issue: "Subscription failed" error

**Solution:**
Check if the Supabase client is up to date:

```json
// package.json should have:
"@supabase/supabase-js": "^2.81.1"
```

If older, update:
```bash
npm install @supabase/supabase-js@latest
```

### Issue: Realtime works but no updates appear

**Check:**
1. Is "Live Mode" enabled? (button should say "Live Mode", not "Static Mode")
2. Are you on the "Trending Topics" tab?
3. Is your date range set to include today? (last 7 days is default)

### Issue: Too many connections warning

This happens if you have many tabs open. Close unused tabs or add connection management:

```typescript
// In Analytics.tsx, add cleanup on unmount
useEffect(() => {
  const channel = supabase.channel('analytics-articles');
  // ... subscription code ...

  return () => {
    supabase.removeChannel(channel); // This is already included
  };
}, [isLive]);
```

### Issue: Dashboard not responding after enabling Realtime

1. Hard refresh the page: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Check Supabase project status: https://status.supabase.com/

## Advanced: Realtime Limits and Optimization

### Connection Limits

- **Free tier**: 200 concurrent connections
- **Pro tier**: 500 concurrent connections

Each browser tab = 1 connection. If you exceed limits:

1. Close unused tabs
2. Implement connection pooling
3. Upgrade your Supabase plan

### Performance Optimization

If you have high article volume (1000+ inserts/day):

1. **Increase refresh interval** (default 30s):
   ```typescript
   // In Analytics.tsx, line ~86
   }, 60000); // Change from 30000 to 60000 (1 minute)
   ```

2. **Add debouncing** to prevent too-frequent updates:
   ```typescript
   let debounceTimer: NodeJS.Timeout;

   // In realtime callback
   clearTimeout(debounceTimer);
   debounceTimer = setTimeout(() => {
     if (isLive) fetchAnalytics();
   }, 2000); // Wait 2s after last insert
   ```

3. **Filter realtime events** to only critical articles:
   ```typescript
   .on('postgres_changes', {
     event: 'INSERT',
     schema: 'public',
     table: 'articles',
     filter: 'threat_level=eq.critical' // Only critical articles
   })
   ```

## Monitoring Realtime Health

Check Supabase logs to monitor realtime performance:

1. Go to **Logs** → **Database** → Filter by "realtime"
2. Look for:
   - Connection counts
   - Subscription errors
   - Message delivery failures

## Production Checklist

- [ ] Realtime enabled for `articles` table
- [ ] RLS policies configured for authenticated access
- [ ] Connection limits monitored
- [ ] Error tracking set up (e.g., Sentry)
- [ ] Realtime reconnection logic implemented
- [ ] Load testing completed for high-volume scenarios
- [ ] Fallback to polling if realtime fails
- [ ] User notification preferences configured

## Support

If issues persist:

1. **Supabase Discord**: https://discord.supabase.com/
2. **Supabase Docs**: https://supabase.com/docs/guides/realtime
3. **GitHub Issues**: Check if it's a known issue

## Quick Reference

```bash
# Check Realtime status
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

# Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE articles;

# Disable Realtime (if needed)
ALTER PUBLICATION supabase_realtime DROP TABLE articles;

# Check active connections
SELECT * FROM pg_stat_activity WHERE application_name = 'supabase_realtime';
```
