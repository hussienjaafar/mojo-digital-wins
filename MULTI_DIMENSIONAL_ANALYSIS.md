# Multi-Dimensional Political Intelligence System

## Overview

The platform now operates as a **comprehensive political intelligence system** with multi-dimensional filtering capabilities. Instead of narrowly focusing on Muslim/Arab issues, the system:

1. **Collects ALL political content** (broad spectrum)
2. **AI tags affected communities** (Muslim/Arab, LGBTQ+, immigrants, etc.)
3. **Enables cross-group comparisons** (intersectional analysis)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  COLLECTION LAYER (Broad Political Content)            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  - Bluesky: Politics, policy, rights, justice          │
│  - RSS Feeds: ~150 political news sources              │
│  - Congress.gov: All federal legislation               │
│  - State Actions: All state-level policy               │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│  ANALYSIS LAYER (AI-Powered Comprehensive Tagging)     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Claude Sonnet 4.5 extracts:                           │
│  - Affected Groups (13+ communities)                   │
│  - Policy Category (11+ areas)                         │
│  - Sentiment & Threat Level                            │
│  - Intersectional Issues                               │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│  FILTER LAYER (User-Controlled Multi-Dimensional)      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  - Default: Broad political view                       │
│  - Quick filters: Muslim/Arab, LGBTQ+, etc.            │
│  - Policy filters: Civil Rights, Immigration, etc.     │
│  - Cross-group comparison                              │
└─────────────────────────────────────────────────────────┘
```

---

## Affected Groups (Communities)

The AI now tags **13+ demographic groups**:

| Group | Label | Examples |
|-------|-------|----------|
| Muslim American | `muslim_american` | CAIR, MPAC, Islamic community |
| Arab American | `arab_american` | ADC, AAI, Arab diaspora |
| Jewish American | `jewish_american` | Anti-Semitism, Jewish civil rights |
| LGBTQ+ | `lgbtq`, `transgender` | LGBTQ rights, marriage equality |
| Black American | `black_american` | BLM, criminal justice reform |
| Latino/Hispanic | `latino` | Immigration, DREAMers |
| Asian American | `asian_american` | Anti-Asian hate, representation |
| Indigenous | `indigenous` | Tribal sovereignty, land rights |
| Immigrants | `immigrants`, `refugees` | Immigration policy, asylum |
| Women's Rights | `women`, `reproductive_rights` | Abortion, equal pay |
| Disability Rights | `disability` | ADA, accessibility |
| Veterans | `veterans` | VA benefits, military affairs |
| General Public | `general_public` | Broadly applicable issues |

---

## Policy Categories

**11 primary categories** for filtering:

1. **Civil Rights** - Discrimination, voting rights, freedom of speech
2. **Immigration** - Border policy, DACA, asylum, deportation
3. **Healthcare** - Medicare, ACA, prescription drugs
4. **Education** - Student debt, K-12, higher education
5. **Climate & Environment** - Clean energy, pollution, conservation
6. **Economy & Labor** - Jobs, wages, unions, inflation
7. **National Security** - Surveillance, counterterrorism, intelligence
8. **Foreign Policy** - Middle East, Ukraine, China relations
9. **Criminal Justice** - Police reform, sentencing, incarceration
10. **Housing** - Affordable housing, homelessness, zoning
11. **Technology** - Privacy, AI regulation, big tech

---

## Data Collection Changes

### Before (Narrow Focus)
```javascript
// Only Muslim/Arab keywords
const KEYWORDS = [
  'cair', 'mpac', 'muslim american', 'arab american',
  'islamophobia', 'palestine', 'gaza'
];
// Result: 0.11% match rate (99.89% data discarded)
```

### After (Broad Political)
```javascript
// Comprehensive political keywords
const POLITICAL_KEYWORDS = [
  // US Politics: 'congress', 'senate', 'biden', 'trump'...
  // Policy Areas: 'immigration', 'healthcare', 'climate'...
  // Civil Rights: 'discrimination', 'voting rights'...
  // Communities: 'muslim', 'lgbtq', 'black lives matter'...
  // International: 'israel', 'palestine', 'ukraine'...
];
// Result: ~5-10% match rate (collecting 50-100x more data)
```

---

## AI Analysis (Claude Sonnet 4.5)

### Edge Functions

1. **`analyze-articles`** (NEW)
   - Runs: Every 20 minutes
   - Analyzes: News articles from RSS feeds
   - Extracts: Groups, categories, sentiment, topics

2. **`analyze-bluesky-posts`** (UPDATED)
   - Runs: Every 15 minutes
   - Analyzes: Social media posts
   - Extracts: Groups, categories, sentiment, topics

3. **`extract-trending-topics`**
   - Runs: Every 30 minutes
   - Aggregates: Cross-platform topic velocity

### Sample AI Prompt
```
Analyze these articles comprehensively. For each:
1. affected_groups: Which communities are affected?
   (muslim_american, lgbtq, immigrants, etc.)
2. relevance_category: Primary policy category
   (civil_rights, immigration, healthcare, etc.)
3. sentiment: Overall sentiment (-1.0 to 1.0)
4. threat_level: critical/high/medium/low
5. key_topics: Specific themes
```

---

## Database Schema Updates

### New Columns
```sql
-- Articles & Bluesky Posts
affected_groups TEXT[]       -- Array of community labels
relevance_category TEXT       -- Policy category

-- Indexes for efficient filtering
CREATE INDEX idx_articles_affected_groups 
  ON articles USING GIN (affected_groups);
CREATE INDEX idx_articles_relevance_category 
  ON articles (relevance_category);
```

### Filtering Examples

**Find Muslim/Arab civil rights news:**
```sql
SELECT * FROM articles 
WHERE 'muslim_american' = ANY(affected_groups)
  AND relevance_category = 'civil_rights';
```

**Cross-group analysis (Muslims + LGBTQ+):**
```sql
SELECT * FROM articles 
WHERE affected_groups && ARRAY['muslim_american', 'lgbtq'];
```

**Immigration issues affecting multiple groups:**
```sql
SELECT * FROM articles 
WHERE relevance_category = 'immigration'
  AND cardinality(affected_groups) > 1; -- Intersectional
```

---

## UI Filtering

### NewsFilters Component

**New Dropdowns:**
- **Affected Community**: Filter by demographic group
- **Policy Category**: Filter by policy area

**Quick Filters:**
- "Muslim/Arab Issues" → `affectedGroup: 'muslim_american'`
- "LGBTQ+ Rights" → `affectedGroup: 'lgbtq'`
- "Immigration Policy" → `relevanceCategory: 'immigration'`

### Analytics Dashboard

**Multi-Group Comparison:**
```typescript
// Compare sentiment across groups
const sentimentByGroup = {
  muslim_american: -0.42,  // Negative coverage
  lgbtq: 0.15,             // Slightly positive
  immigrants: -0.38,       // Negative coverage
  general_public: 0.02     // Neutral
};
```

**Cross-Group Trends:**
- Identify shared threats (e.g., surveillance affecting Muslims + immigrants)
- Compare policy impacts (e.g., healthcare reforms affecting women + elderly)
- Track intersectional issues (e.g., Muslim women + reproductive rights)

---

## Benefits

### 1. **Comprehensive Intelligence**
- See the **full political landscape** (not just Muslim/Arab issues)
- Track **all policy areas** (immigration, healthcare, climate, etc.)
- Monitor **all communities** (LGBTQ+, Black Americans, immigrants, etc.)

### 2. **Smart Filtering**
- **Default**: Broad political view
- **Quick filter**: Drill down to Muslim/Arab issues
- **Compare**: How do different groups face similar issues?

### 3. **Intersectional Analysis**
- Find issues affecting **multiple groups** (e.g., Muslim immigrants)
- Track **shared threats** (e.g., surveillance of Muslims + immigrants)
- Identify **coalition opportunities** (e.g., civil rights groups)

### 4. **Predictive Intelligence**
- Catch issues **before they explicitly mention groups**
  - Example: "General immigration bill" → AI tags `muslim_american` if it affects Muslim refugees
- **Early warning** for policy threats
- **Cross-community insights** (e.g., anti-LGBTQ bill also affects religious minorities)

---

## Example Use Cases

### Use Case 1: Muslim/Arab Focus (Original Use Case)
```
Filter: affectedGroup = 'muslim_american' OR 'arab_american'
Result: Traditional focused view, but with richer context
```

### Use Case 2: Broad Political Monitoring
```
Filter: None (show all)
Result: Complete political landscape, all communities, all issues
```

### Use Case 3: Cross-Group Comparison
```
Compare:
- muslim_american civil_rights issues
- lgbtq civil_rights issues
- black_american civil_rights issues
Result: Side-by-side sentiment, threat levels, trending topics
```

### Use Case 4: Policy-Specific Research
```
Filter: relevanceCategory = 'immigration'
Result: All immigration news affecting all groups
Sub-filter: affectedGroup = 'muslim_american'
Result: Immigration news specifically affecting Muslims
```

### Use Case 5: Intersectional Analysis
```
Filter: affected_groups contains BOTH 'muslim_american' AND 'women'
Result: Issues affecting Muslim women specifically
```

---

## Data Flow Example

### Article: "New Executive Order on Refugee Screening"

**Collection:**
```
✅ Broad keywords matched: 'refugee', 'immigration', 'screening'
📥 Article stored in database
```

**AI Analysis:**
```json
{
  "affected_groups": ["immigrants", "refugees", "muslim_american"],
  "relevance_category": "immigration",
  "sentiment": -0.65,
  "threat_level": "high",
  "key_topics": ["refugee ban", "religious screening", "travel restrictions"]
}
```

**User Experience:**
```
Default View: Shows in general immigration feed
Muslim/Arab Filter: Shows in filtered view (tagged as relevant)
LGBTQ+ Filter: Does NOT show (not relevant to LGBTQ+)
Cross-Filter: Shows when comparing immigrant + Muslim issues
```

---

## Performance Metrics

### Collection Efficiency
- **Before**: 0.11% match rate (55 posts / 50,000)
- **After**: ~5-10% match rate (2,500-5,000 posts / 50,000)
- **Data increase**: 50-100x more relevant data

### AI Processing
- **Model**: Claude Sonnet 4.5 (superior reasoning)
- **Batch size**: 20-30 articles per call
- **Frequency**: Every 15-20 minutes
- **Coverage**: 100% of collected content analyzed

### Database Queries
- **Indexed filtering**: Fast group/category lookups
- **GIN indexes**: Efficient array contains queries
- **Multi-dimensional**: Combine filters without performance hit

---

## Migration Path

### Phase 1: ✅ Database Schema (COMPLETE)
- Added `affected_groups` and `relevance_category` columns
- Created indexes for filtering
- Updated edge functions

### Phase 2: ✅ Collection Broadening (COMPLETE)
- Updated Bluesky keywords (50+ political terms)
- Updated RSS keywords (40+ comprehensive topics)
- Maintained existing sources

### Phase 3: ✅ AI Analysis (COMPLETE)
- Created `analyze-articles` edge function
- Updated `analyze-bluesky-posts` for multi-group tagging
- Set up cron jobs (every 15-20 minutes)

### Phase 4: ✅ UI Filtering (COMPLETE)
- Added "Affected Community" dropdown
- Added "Policy Category" dropdown
- Updated filter state management

### Phase 5: 🚧 Next Steps (OPTIONAL)
- Add group comparison view in Analytics
- Create intersectional analysis dashboard
- Add saved filters/presets

---

## Backward Compatibility

**Existing functionality preserved:**
- Original tags still work (`'muslim american'`, `'palestine'`, etc.)
- Threat levels still calculated
- All existing queries continue working
- Default view shows all data (users can filter to Muslim/Arab)

**Enhanced capabilities:**
- Richer metadata (groups, categories)
- More comprehensive data collection
- AI-powered tagging (more accurate than keywords)
- Multi-dimensional filtering (compare groups)

---

## Cost Considerations

### Anthropic API Usage
- **Model**: Claude Sonnet 4.5 ($3 / 1M input tokens, $15 / 1M output tokens)
- **Batch size**: 30 articles × ~500 tokens each = 15K input tokens
- **Response**: ~2K output tokens per batch
- **Frequency**: Every 20 minutes = 72 batches/day

**Daily cost estimate:**
- Input: 72 × 15K × $3 / 1M = $3.24/day
- Output: 72 × 2K × $15 / 1M = $2.16/day
- **Total: ~$5.40/day or ~$162/month**

**Optimization options:**
- Reduce frequency (30 min → $81/month)
- Use Claude Haiku for simpler analysis ($0.25 / 1M)
- Batch larger groups (reduce API calls)

---

## Security & Privacy

**API Key Management:**
- Anthropic API key stored in Supabase secrets
- Never exposed to frontend
- Used only in edge functions

**Data Processing:**
- All analysis happens server-side
- No PII sent to Anthropic
- Article metadata only (titles, descriptions)

**RLS Policies:**
- Public articles remain public
- User-specific data (bookmarks, preferences) protected
- Admin-only access to analytics

---

## Monitoring

**Edge Function Logs:**
```bash
# Check article analysis
supabase functions logs analyze-articles

# Check Bluesky analysis
supabase functions logs analyze-bluesky-posts

# Check trending topics
supabase functions logs extract-trending-topics
```

**Database Queries:**
```sql
-- Check analysis coverage
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE topics_extracted = true) as analyzed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE topics_extracted = true) / COUNT(*), 2) as coverage_pct
FROM articles
WHERE published_date >= NOW() - INTERVAL '7 days';

-- Top affected groups (last 7 days)
SELECT 
  unnest(affected_groups) as group_name,
  COUNT(*) as mentions
FROM articles
WHERE published_date >= NOW() - INTERVAL '7 days'
  AND affected_groups IS NOT NULL
GROUP BY group_name
ORDER BY mentions DESC;

-- Policy category breakdown
SELECT 
  relevance_category,
  COUNT(*) as articles,
  AVG(sentiment_score) as avg_sentiment
FROM articles
WHERE published_date >= NOW() - INTERVAL '7 days'
  AND relevance_category IS NOT NULL
GROUP BY relevance_category
ORDER BY articles DESC;
```

---

## Summary

The platform has evolved from a **narrow Muslim/Arab focus** to a **comprehensive political intelligence system**:

✅ **Collects**: All political content (50-100x more data)  
✅ **Analyzes**: 13+ demographic groups, 11+ policy categories  
✅ **Filters**: Multi-dimensional (group + category + sentiment)  
✅ **Compares**: Cross-group trends and intersectional issues  
✅ **Predicts**: Early warnings for policy threats  

**Default behavior**: Broad political view  
**Quick filter**: Muslim/Arab issues (original focus)  
**Advanced**: Compare groups, track intersectional issues  

This architecture provides **both breadth and depth** while maintaining backward compatibility with the original Muslim/Arab American civil rights focus.
