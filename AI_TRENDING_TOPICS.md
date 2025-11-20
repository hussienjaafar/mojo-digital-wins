# AI-Powered Trending Topics Detection

## Overview

This system uses **AI to automatically extract and track trending topics** from news articles in real-time, without relying on pre-defined tags or manual categorization.

## How It Works

### 1. **AI Topic Extraction**

Instead of using article tags, the system analyzes article content using Gemini AI to extract:
- Key topics and themes (2-4 word phrases)
- Related keywords
- Relevance scores

**Example:**
```
Article: "Supreme Court rules on voting rights case affecting millions"
AI Extracts:
- Topic: "voting rights"
- Keywords: ["supreme court", "ruling", "voter access"]
- Relevance: 0.95
```

### 2. **Velocity Calculation**

Topics are ranked by **velocity** (rate of growth), not just total mentions:

```
Velocity = (Current Hour Mentions - Previous Hour Mentions) / Previous Hour Mentions * 100
```

**Example:**
- Topic: "immigration policy"
- Hour 1: 5 mentions
- Hour 2: 15 mentions
- Velocity: +200% ← **This is trending!**

### 3. **Momentum Tracking**

Measures acceleration of growth:

```
Momentum = Change in velocity over time
```

This detects topics that are accelerating (🚀 going viral) vs. slowing down.

### 4. **Real-Time Updates**

- **New articles** → AI extracts topics → Database updated
- **Dashboard** → Shows topics sorted by velocity
- **Auto-extraction** → Runs after 5 articles or 60 seconds
- **Live Mode** → Real-time trending topic updates

## Database Schema

### `trending_topics` Table

```sql
CREATE TABLE trending_topics (
  id UUID PRIMARY KEY,
  topic TEXT NOT NULL,                  -- e.g., "climate policy"
  mention_count INTEGER,                -- Total mentions this hour
  hour_timestamp TIMESTAMPTZ,           -- Hour bucket
  day_date DATE,                        -- Day for daily rollups

  -- What makes it trending
  velocity_score DECIMAL,               -- % growth rate
  momentum DECIMAL,                     -- Acceleration

  -- Sentiment
  avg_sentiment_score DECIMAL,
  positive_count INTEGER,
  neutral_count INTEGER,
  negative_count INTEGER,

  -- Related data
  article_ids TEXT[],                   -- Links to articles
  sample_titles TEXT[],                 -- Example headlines
  related_keywords TEXT[]               -- AI-extracted keywords
);
```

## API / Edge Function

### `extract-trending-topics`

**Endpoint:** `supabase.functions.invoke('extract-trending-topics')`

**Parameters:**
```typescript
{
  hoursBack: number  // How many hours to analyze (default: 1)
}
```

**Process:**
1. Fetches recent articles (last N hours)
2. Batches articles (10 at a time)
3. Sends to AI for topic extraction
4. Aggregates topics across articles
5. Calculates velocity and momentum
6. Stores in `trending_topics` table

**Response:**
```json
{
  "articlesAnalyzed": 45,
  "topicsExtracted": 12,
  "topicsStored": 8,
  "timeRange": "1 hour(s)",
  "topTopics": [
    {
      "topic": "immigration reform",
      "mentions": 15,
      "avgSentiment": "0.45"
    }
  ]
}
```

## Dashboard Features

### Intelligence Snapshot (Analytics Page)

**Location:** `/admin` → Intelligence → Analytics

**Features:**

1. **AI-Extracted Topics**
   - No manual tags needed
   - Automatically discovered from content
   - Ranked by velocity (what's trending NOW)

2. **Velocity Badges**
   - `+150% velocity` = Growing fast
   - Green "TRENDING" badge = High velocity + momentum

3. **Related Keywords**
   - AI-extracted keywords shown for each topic
   - Helps understand topic context

4. **Extract Topics Button**
   - Manually trigger topic extraction
   - Analyzes last 24 hours of articles
   - Shows progress and results

5. **Automatic Extraction**
   - Runs after 5 new articles arrive
   - Or after 60 seconds of new activity
   - Happens in background

## Usage

### Manual Topic Extraction

1. Go to `/admin` → Intelligence → **Analytics**
2. Click **"Extract Topics"** button
3. Wait for AI analysis (10-30 seconds)
4. See extracted topics with velocity scores

### View Trending Topics

Topics are sorted by **velocity** (fastest growing), not total count:

```
#1 immigration reform      📈 +250% velocity    75% sentiment
   15 mentions  |  Keywords: policy, congress, border

#2 climate action          ➡️ +20% velocity     82% sentiment
   23 mentions  |  Keywords: legislation, environment

#3 healthcare debate       📉 -15% velocity     65% sentiment
   18 mentions  |  Keywords: reform, medicare
```

### Automatic Updates

When **Live Mode** is enabled:
- New articles trigger topic analysis
- Topics update every 30 seconds
- New trending topics show toast notifications

## Testing

### 1. Insert Test Articles

```sql
-- Insert articles with related content
INSERT INTO articles (title, description, published_date)
VALUES
  ('Supreme Court Ruling on Voting Access', 'New decision affects voter registration...', NOW()),
  ('Voting Rights Groups Challenge Decision', 'Civil liberties organizations file lawsuit...', NOW() + INTERVAL '5 minutes'),
  ('States React to Voting Ruling', 'Multiple states announce response to court decision...', NOW() + INTERVAL '10 minutes');
```

### 2. Extract Topics

```typescript
const { data } = await supabase.functions.invoke('extract-trending-topics', {
  body: { hoursBack: 1 }
});

console.log(data);
// Expected: Should extract "voting rights" topic with 3 mentions
```

### 3. View on Dashboard

Go to Analytics page → Should see:
- **"voting rights"** as a trending topic
- Keywords: ["supreme court", "ruling", "voter access"]
- Velocity: +100% (new topic)

## Configuration

### Adjust Extraction Frequency

**In Analytics.tsx:**
```typescript
// Change from 5 articles to 10
if (articleBuffer.length >= 10) {
  extractTrendingTopics();
}

// Change from 60 seconds to 120 seconds
}, 120000);
```

### Change Velocity Thresholds

**In Analytics.tsx:**
```typescript
// Currently: velocity > 20 = rising
if (data.velocity > 50 || data.momentum > 0.5) {  // More aggressive
  trend = 'rising';
}
```

### Adjust AI Model

**In extract-trending-topics/index.ts:**
```typescript
model: 'google/gemini-2.5-flash',  // Fast, cheap
// or
model: 'google/gemini-1.5-pro',    // More accurate, slower
```

## Performance

### Extraction Speed

- **10 articles**: ~2-3 seconds
- **50 articles**: ~10-15 seconds
- **100 articles**: ~20-30 seconds

### Database Size

- **1000 topics/day** = ~1MB/day
- **30 days** = ~30MB
- **1 year** = ~365MB (with cleanup)

### Recommended Cleanup

```sql
-- Delete topics older than 30 days
DELETE FROM trending_topics
WHERE hour_timestamp < NOW() - INTERVAL '30 days';
```

## Troubleshooting

### Issue: No topics extracted

**Check:**
1. Are there articles in the last 24 hours?
2. Do articles have content (not just titles)?
3. Check Supabase function logs

**Fix:**
```sql
-- Verify articles exist
SELECT COUNT(*) FROM articles
WHERE published_date > NOW() - INTERVAL '24 hours';

-- Check if articles have content
SELECT id, title, LENGTH(description) as content_length
FROM articles
WHERE published_date > NOW() - INTERVAL '1 hour'
LIMIT 5;
```

### Issue: Topics not showing velocity

**Check:**
```sql
-- Verify velocity is being calculated
SELECT topic, mention_count, velocity_score, momentum
FROM trending_topics
WHERE hour_timestamp > NOW() - INTERVAL '2 hours'
ORDER BY hour_timestamp DESC;
```

If velocity is NULL, the trigger might not be working:
```sql
-- Re-create the trigger
DROP TRIGGER IF EXISTS trigger_calculate_velocity ON trending_topics;
CREATE TRIGGER trigger_calculate_velocity
  BEFORE INSERT OR UPDATE ON trending_topics
  FOR EACH ROW
  EXECUTE FUNCTION calculate_trend_velocity();
```

### Issue: AI extraction fails

**Check Lovable API key:**
```bash
# In Supabase dashboard → Edge Functions → Secrets
LOVABLE_API_KEY=your_key_here
```

**Check function logs:**
1. Supabase Dashboard → Edge Functions
2. Select `extract-trending-topics`
3. View Logs tab

## Future Enhancements

- [ ] Topic clustering (group similar topics)
- [ ] Historical trend charts (topic over time)
- [ ] Peak detection (alert when topic peaks)
- [ ] Topic correlations (which topics appear together)
- [ ] Geographic trending (topics by region)
- [ ] Source diversity (how many sources cover topic)
- [ ] Breaking news detection (rapid velocity spikes)
- [ ] Topic predictions (forecast what will trend)

## Comparison: Tags vs. AI Extraction

| Feature | Manual Tags | AI Extraction |
|---------|-------------|---------------|
| Accuracy | Depends on tagger | AI-powered, consistent |
| Coverage | Only tagged articles | All articles |
| New topics | Must add tag manually | Discovered automatically |
| Flexibility | Fixed tag list | Adapts to news cycle |
| Velocity | Simple count | True velocity tracking |
| Keywords | Not included | AI-extracted keywords |
| Setup time | Hours (manual tagging) | Seconds (automatic) |

## Support

For issues:
1. Check Supabase Edge Function logs
2. Verify `trending_topics` table exists
3. Test with `test-realtime-trending.sql`
4. Check AI Gateway key is set
