# Debug Real-Time Trending Topics

## 🎯 Access the Feature

1. **URL**: Go to `/admin` in your browser
2. **Login**: Make sure you're logged in as admin
3. **Sidebar Navigation**:
   - Expand **"Intelligence"** section
   - Click **"Analytics"** (📊 icon)
   - You should see "Intelligence Snapshot" as the page title

## ✅ Verify It's Working

### Visual Checks:
- [ ] Page title says "Intelligence Snapshot" (not "Dashboard Overview")
- [ ] Red **LIVE** badge is visible and pulsing
- [ ] "Live Mode" button exists in top toolbar
- [ ] "Last updated: [time]" shows at top
- [ ] Tabs show: Trending Topics, Sentiment Timeline, Threat Trends, etc.

### Browser Console (F12):

Open browser console and look for:

```javascript
// When page loads:
"Realtime channel subscribed: analytics-articles"

// Every 30 seconds (if Live Mode is on):
"Auto-refreshing analytics (live mode)"
```

## 🧪 Test Real-Time Updates

### Method 1: Via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/nuclmzoasgydubdshtab/editor
2. Run this query:

```sql
INSERT INTO articles (
  title, url, source_name, published_date, tags,
  sentiment_label, sentiment_score, threat_level
) VALUES (
  'TEST: Real-Time Update at ' || NOW()::text,
  'https://example.com/test-' || extract(epoch from NOW())::text,
  'Debug Test',
  NOW(),
  ARRAY['test', 'debug', 'realtime'],
  'positive',
  0.8,
  'low'
);
```

3. **Expected on Dashboard** (within 1-2 seconds):
   - ✅ Toast notification pops up: "New article: TEST: Real-Time Update..."
   - ✅ Blue "+1 new" badge appears
   - ✅ "test", "debug", "realtime" topics appear in trending list
   - ✅ "Last updated" timestamp refreshes

### Method 2: Via Lovable

Ask Lovable:
```
Insert a test article into the articles table with these values:
- title: "Test Real-Time Feature"
- tags: ["test", "immigration", "breaking"]
- sentiment_score: 0.7
- published_date: NOW()
```

## ❌ Troubleshooting

### Issue: No LIVE badge visible

**Check:**
1. Are you on `/admin` → Intelligence → **Analytics** (not Overview)?
2. Is the page title "Intelligence Snapshot"?
3. Try hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### Issue: No toast notifications

**Check Console for Errors:**

```javascript
// Good signs:
✅ "New article detected: {..."
✅ Subscription status: "SUBSCRIBED"

// Bad signs:
❌ "Subscription failed"
❌ "Realtime not enabled"
❌ "Permission denied"
```

**Fix:**
Run this in Supabase SQL Editor:
```sql
-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE articles;

-- Verify
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'articles';
```

### Issue: "Trending topics not updating"

**Check:**
1. Is **Live Mode** enabled? (button should say "Live Mode", not "Static Mode")
2. Is your date range set to include today? (default: last 7 days)
3. Are there any articles in the database?

**Verify Articles Exist:**
```sql
SELECT COUNT(*) FROM articles
WHERE published_date > NOW() - INTERVAL '7 days';
```

If count is 0, insert test data from `test-realtime-trending.sql`.

### Issue: Console shows "Permission denied"

**RLS Policy Missing:**

```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'articles';

-- Add policy (if missing)
CREATE POLICY "Allow authenticated read" ON articles
  FOR SELECT TO authenticated USING (true);
```

## 🔍 Advanced Debugging

### Check Supabase Realtime Status:

```javascript
// In browser console on Analytics page:
const channel = supabase.channel('analytics-articles');
console.log('Channel state:', channel.state);
// Should show: "joined" or "subscribed"
```

### Monitor Realtime Messages:

```javascript
// Add to Analytics.tsx temporarily for debugging:
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'articles',
}, (payload) => {
  console.log('📡 Realtime event received:', payload);
  console.log('Article data:', payload.new);
})
```

### Check Network Tab:

1. Open DevTools → Network
2. Filter by "WS" (WebSocket)
3. Look for connection to Supabase Realtime
4. Should see messages flowing when articles inserted

## 📊 Success Indicators

When working correctly, you should see:

1. **On Page Load:**
   - LIVE badge appears
   - Console: "Realtime channel subscribed"
   - WebSocket connection established (Network tab)

2. **Every 30 Seconds:**
   - Console: "Auto-refreshing analytics (live mode)"
   - "Last updated" timestamp changes

3. **When New Article Inserted:**
   - Toast notification within 1-2 seconds
   - Console: "New article detected: {..."
   - Counter increments: "+1 new" → "+2 new" → etc.
   - Trending topics recalculate
   - Page doesn't reload (updates in place)

## 📸 Expected Screenshots

### What You Should See:

```
┌─────────────────────────────────────────────┐
│ Intelligence Snapshot  [🔴 LIVE] [+2 new]  │
│ Real-time updates enabled • Auto-refresh... │
├─────────────────────────────────────────────┤
│ [Last 7 days ▼] [Live Mode] [Analyze] [⬇]│
│ Last updated: 1:45:23 PM                    │
├─────────────────────────────────────────────┤
│ Trending Topics (tab)                       │
│                                             │
│ #1 immigration 📈 [TRENDING]        75%     │
│    ▓▓▓▓▓░░░░ 15 mentions                   │
│                                             │
│ #2 climate 📈                       82%     │
│    ▓▓▓▓▓▓▓░░ 12 mentions                   │
└─────────────────────────────────────────────┘
```

## 🆘 Still Not Working?

1. **Verify you're on the right page:**
   - URL should be `/admin`
   - Sidebar "Analytics" should be highlighted
   - Page title: "Intelligence Snapshot"

2. **Check Lovable deployment:**
   - Go to Lovable project
   - Click "Share" → "Publish"
   - Wait for deployment to complete

3. **Hard reset:**
   ```bash
   # Clear browser cache
   # Close all tabs
   # Re-open /admin
   ```

4. **Contact support:**
   - Provide browser console logs
   - Screenshot of the page
   - Which browser/version you're using
