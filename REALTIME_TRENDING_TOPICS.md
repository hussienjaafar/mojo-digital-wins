# Real-Time Trending Topics - Intelligence Dashboard

## Overview

The Intelligence Dashboard now features **real-time trending topics** that automatically update as new articles are published. This provides instant insights into breaking news and emerging trends in the political/civil liberties space.

## Features Implemented

### 1. **Real-Time Article Subscriptions**
- Uses Supabase Realtime to listen for new article inserts
- Automatically triggers trending topic recalculation when new articles arrive
- Zero polling - event-driven architecture for efficiency

### 2. **Live Mode Toggle**
- **Live Mode (Default)**: Auto-updates every 30 seconds + instant updates on new articles
- **Static Mode**: Manual refresh only, useful for analysis of specific time periods
- Toggle button with visual indicator (pulsing icon)

### 3. **Visual Indicators**
- **LIVE badge**: Animated red badge with pulsing dot shows when live mode is active
- **Trending badges**: Green "TRENDING" labels on topics with rising sentiment
- **New article counter**: Blue badge showing count of new articles since page load
- **Last updated timestamp**: Shows exact time of last data refresh
- **Rising topic highlights**: Green background on topics with upward trends

### 4. **Smart Notifications**
- Toast notification when new articles are detected
- Alert when new topics enter the top 15 trending list
- Shows article titles in notifications (truncated to 50 chars)

### 5. **Enhanced Trending Analysis**
- 15 top trending topics ranked by mention count
- Sentiment breakdown (positive/neutral/negative) for each topic
- Trend direction: 📈 Rising, ➡️ Stable, 📉 Falling
- Real-time sentiment percentages
- Visual sentiment breakdown bars

## How It Works

### Architecture

```
┌─────────────────────┐
│   New Article       │
│   Inserted to DB    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Supabase Realtime   │
│ Postgres Changes    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ React Component     │
│ (Analytics.tsx)     │
└──────────┬──────────┘
           │
           ├─► Show Toast Notification
           ├─► Increment Article Counter
           └─► Trigger fetchAnalytics()
                      │
                      ▼
              ┌───────────────────┐
              │ Recalculate       │
              │ Trending Topics   │
              └───────┬───────────┘
                      │
                      ├─► Detect New Topics
                      ├─► Calculate Sentiment
                      ├─► Determine Trends
                      └─► Update UI
```

### Auto-Refresh Mechanism

When Live Mode is enabled:
1. **Event-driven**: New article INSERT triggers immediate refresh
2. **Time-based**: Backup 30-second interval for drift prevention
3. **Manual**: "Analyze Articles" button for sentiment re-analysis

## Testing the Feature

### Test 1: Insert a New Article

```sql
-- Run this in Supabase SQL Editor to test real-time updates
INSERT INTO articles (
  title,
  url,
  source_name,
  published_date,
  tags,
  sentiment_label,
  sentiment_score,
  threat_level,
  content_summary
) VALUES (
  'Breaking: New Immigration Policy Announced',
  'https://example.com/immigration-policy',
  'Test Source',
  NOW(),
  ARRAY['immigration', 'policy', 'civil rights'],
  'negative',
  0.35,
  'high',
  'New immigration policy impacts civil liberties organizations'
);
```

**Expected Behavior:**
1. Toast notification appears: "New article: Breaking: New Immigration Policy Announced..."
2. "New articles" counter increments (+1 new)
3. Trending topics automatically refresh
4. "immigration", "policy", and "civil rights" topics may appear or move up in rankings
5. Last updated timestamp updates

### Test 2: Create Multiple Articles with Same Topic

```sql
-- This will make a topic "trending"
INSERT INTO articles (title, url, source_name, published_date, tags, sentiment_label, sentiment_score)
VALUES
  ('Climate Action Bill Introduced', 'https://example.com/1', 'Source A', NOW(), ARRAY['climate', 'environment'], 'positive', 0.8),
  ('Environmental Groups Support Climate Bill', 'https://example.com/2', 'Source B', NOW(), ARRAY['climate', 'environment'], 'positive', 0.75),
  ('Climate Policy Debate Heats Up', 'https://example.com/3', 'Source C', NOW(), ARRAY['climate', 'policy'], 'neutral', 0.5);
```

**Expected Behavior:**
1. Three toast notifications appear
2. "climate" and "environment" topics rise in rankings
3. These topics get green "TRENDING" badges if sentiment is rising
4. Mention counts increase for these topics
5. If "climate" or "environment" are new to top 15, special notification appears

### Test 3: Toggle Live Mode

1. **Disable Live Mode**: Click "Live Mode" button to switch to "Static Mode"
   - LIVE badge disappears
   - Auto-refresh stops
   - New articles won't trigger automatic updates

2. **Insert Test Article**: Run Test 1 SQL
   - Toast notification still appears
   - But trending topics DON'T update automatically

3. **Re-enable Live Mode**: Click "Static Mode" to return to "Live Mode"
   - LIVE badge reappears
   - Auto-refresh resumes
   - Next new article will trigger update

### Test 4: Sentiment Tracking

```sql
-- Insert articles with varying sentiment for same topic
INSERT INTO articles (title, url, source_name, published_date, tags, sentiment_label, sentiment_score)
VALUES
  ('Positive Development in Healthcare', 'https://example.com/1', 'News A', NOW(), ARRAY['healthcare'], 'positive', 0.9),
  ('Healthcare Crisis Deepens', 'https://example.com/2', 'News B', NOW(), ARRAY['healthcare'], 'negative', 0.2),
  ('Healthcare Policy Update', 'https://example.com/3', 'News C', NOW(), ARRAY['healthcare'], 'neutral', 0.5);
```

**Expected Behavior:**
1. "healthcare" topic appears with mixed sentiment
2. Sentiment breakdown bar shows: Green (1) + Gray (1) + Red (1)
3. Overall sentiment percentage shows ~53% (average of 0.9, 0.2, 0.5)
4. Sentiment color indicator adjusts based on average

## Configuration

### Supabase Realtime Requirements

Ensure Realtime is enabled for the `articles` table:

```sql
-- Check if realtime is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'articles';

-- Enable realtime (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE articles;
```

### RLS Policies

The articles table should have appropriate RLS policies. For development/testing:

```sql
-- Allow anonymous read access (development only)
CREATE POLICY "Allow public read access" ON articles
  FOR SELECT USING (true);

-- For production, use authenticated access:
CREATE POLICY "Allow authenticated read" ON articles
  FOR SELECT TO authenticated USING (true);
```

### Auto-Refresh Interval

To change the 30-second auto-refresh interval, modify `Analytics.tsx`:

```typescript
// Line ~86 in Analytics.tsx
const interval = setInterval(() => {
  console.log('Auto-refreshing analytics (live mode)');
  fetchAnalytics();
}, 30000); // Change this value (in milliseconds)
```

## Troubleshooting

### Issue: Real-time updates not working

**Solution:**
1. Check Supabase Realtime is enabled: Dashboard → Database → Replication → Enable for `articles`
2. Verify RLS policies allow your user to read articles
3. Check browser console for subscription errors
4. Ensure you're using Supabase client v2.81.1 or higher

### Issue: Too many notifications

**Solution:**
Adjust notification frequency in `Analytics.tsx`:

```typescript
// Limit notifications to one per topic
const notifiedTopics = new Set<string>();

if (!notifiedTopics.has(topic)) {
  toast.info(`🔥 New trending topic: ${topic}`);
  notifiedTopics.add(topic);
}
```

### Issue: Performance concerns with frequent updates

**Solution:**
1. Increase auto-refresh interval from 30s to 60s or 120s
2. Implement debouncing for rapid-fire article inserts
3. Add a "Pause Updates" button for intensive analysis sessions

## Future Enhancements

- [ ] Trending topic change velocity (rate of rise/fall)
- [ ] Historical trending data visualization
- [ ] Alert webhooks for critical trending topics
- [ ] Customizable auto-refresh intervals in UI
- [ ] Topic clusters and related topic suggestions
- [ ] Sentiment momentum tracking (accelerating positive/negative trends)
- [ ] Regional trending topics (if location data available)
- [ ] Push notifications via Web Push API

## Technical Details

### Component: `src/pages/Analytics.tsx`

**New State Variables:**
- `isLive`: Boolean for live mode toggle
- `newArticleCount`: Counter for new articles since page load
- `lastUpdated`: Timestamp of last data refresh
- `previousTopics`: Array of previous top 15 topics for comparison

**New Hooks:**
- Realtime subscription hook (lines 48-77)
- Auto-refresh interval hook (lines 80-89)

**Modified Functions:**
- `fetchAnalytics()`: Now tracks previous topics and detects new entries
- Enhanced trending topic detection with "rising" indicator logic

### Dependencies

- `@supabase/supabase-js`: ^2.81.1 (Realtime channels)
- `sonner`: ^1.7.4 (Toast notifications)
- `date-fns`: ^3.6.0 (Timestamp formatting)
- `recharts`: ^2.15.4 (Charts)

## Production Checklist

- [ ] Enable Supabase Realtime for production database
- [ ] Configure proper RLS policies (authenticated users only)
- [ ] Set up monitoring for subscription connection health
- [ ] Implement rate limiting on article inserts (if user-generated)
- [ ] Add error boundaries for subscription failures
- [ ] Test with high-volume article insertion scenarios
- [ ] Configure notification preferences in user settings
- [ ] Add loading states during initial connection
- [ ] Implement reconnection logic for dropped connections
- [ ] Add analytics tracking for live mode usage

## Support

For issues or questions:
1. Check Supabase dashboard → Logs → Edge Functions logs
2. Review browser console for client-side errors
3. Test with `console.log()` in subscription callback
4. Verify network requests in browser DevTools → Network tab
5. Check Supabase project status page for outages
