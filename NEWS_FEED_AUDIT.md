# News Feed Comprehensive Audit Report
**Date:** November 23, 2025  
**Goal:** Build the definitive political news feed across the entire U.S. political spectrum

---

## 🔍 CURRENT STATE ANALYSIS

### ✅ **What's Working Well**

1. **Freshness is EXCELLENT**
   - 9 articles in last hour
   - 95 articles in last 6 hours  
   - 322 articles in last 24 hours
   - Most recent article: **19 minutes ago**
   - **Automated fetching every 15 minutes** via pg_cron ✓

2. **Good Source Diversity**
   - 50+ active RSS sources
   - Categories: specialized (158/24h), independent (64/24h), mainstream (56/24h), conservative (34/24h), state_government (10/24h)

3. **Robust Filtering Infrastructure**
   - 4 geographic scopes: international, local, national, state
   - 18 relevance categories: civil_rights, climate, criminal_justice, economy, education, foreign_policy, healthcare, immigration, etc.
   - 6 source categories: civil_rights, conservative, independent, mainstream, specialized, state_government

---

## ❌ **Critical Gaps Identified**

### 1. **MISSING Political Spectrum Coverage**

**Problem:** No `political_leaning` field in database!
- Cannot filter by left/center/right perspectives
- Users can't see balanced coverage across political spectrum
- Impossible to detect bias bubbles

**Impact:** This is a MAJOR gap for achieving "go-to newsfeed across political spectrum"

### 2. **Limited Conservative Sources**
- Only 34 conservative articles/24h vs 64 independent, 158 specialized
- Conservative category exists but underdeveloped
- Missing: Fox News, National Review, Washington Examiner, Daily Caller, Breitbart, Federalist, etc.

### 3. **Weak State Government Coverage**
- Only 10 state articles in last 24h
- Have state sources but low activity/output
- State politics is crucial for domestic coverage

### 4. **No Mainstream Major Outlets**
- Missing: CNN, NBC News, CBS News, ABC News, Washington Post, NY Times
- Only 56 mainstream articles/24h
- The Hill is main mainstream source

### 5. **Limited International/Foreign Policy Sources**
- Specialized category dominates (158 articles)
- But missing major international outlets
- Missing: Reuters, AP, BBC, Guardian, Financial Times

---

## 📊 **Recommended Database Enhancement**

### Add `political_leaning` Column

```sql
-- Add political_leaning to rss_sources
ALTER TABLE rss_sources 
ADD COLUMN political_leaning TEXT CHECK (political_leaning IN ('left', 'center-left', 'center', 'center-right', 'right', 'nonpartisan'));

-- Add index for filtering
CREATE INDEX idx_rss_sources_political_leaning ON rss_sources(political_leaning);

-- Add to articles for denormalization (faster queries)
ALTER TABLE articles
ADD COLUMN political_leaning TEXT;
```

### Political Leaning Classification
- **Left:** Jacobin, Democracy Now, The Nation, Mother Jones
- **Center-Left:** Salon, AlterNet, Raw Story, MSNBC
- **Center:** The Hill, Reuters, AP, NPR, PBS
- **Center-Right:** Wall Street Journal, The Economist
- **Right:** Fox News, National Review, Washington Examiner, Daily Wire
- **Nonpartisan:** FactCheck.org, PolitiFact, SCOTUSblog, ProPublica

---

## 🎯 **Critical Sources to Add**

### **Major Mainstream (Center)**
1. ✅ Reuters - https://www.reuters.com/rssFeed/news
2. ✅ Associated Press - https://rsshub.app/ap/topics/politics
3. ✅ NPR Politics - https://feeds.npr.org/1014/rss.xml
4. ✅ PBS NewsHour - https://www.pbs.org/newshour/feeds/rss/politics
5. ❌ CNN Politics - (No public RSS, need scraping or API)
6. ❌ NBC News Politics - (No public RSS)

### **Center-Right / Conservative**
1. ✅ Fox News Politics - https://moxie.foxnews.com/google-publisher/politics.xml
2. ✅ National Review - https://www.nationalreview.com/feed/
3. ✅ Washington Examiner - https://www.washingtonexaminer.com/feed
4. ✅ The Federalist - https://thefederalist.com/feed/
5. ✅ Daily Wire - https://www.dailywire.com/feeds/rss.xml
6. ✅ Washington Times - https://www.washingtontimes.com/rss/headlines/news/politics/

### **Major International**
1. ✅ BBC News US - https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml
2. ✅ The Guardian US - https://www.theguardian.com/us-news/rss
3. ✅ Financial Times - https://www.ft.com/news-feed?format=rss

### **Left-Leaning**
1. ✅ The Nation - https://www.thenation.com/feed/
2. ✅ Mother Jones - https://www.motherjones.com/feed/
3. ✅ MSNBC - https://www.msnbc.com/feeds/latest
4. ✅ HuffPost Politics - https://www.huffpost.com/section/politics/feed

---

## 🚀 **Implementation Priorities**

### **Phase 1: Database Migration (CRITICAL)**
Add `political_leaning` column to enable spectrum filtering

### **Phase 2: Source Expansion**
1. Add top 15 critical missing sources
2. Backfill political_leaning for existing sources
3. Update articles table with political_leaning from source

### **Phase 3: UI/UX Enhancements**
1. Add "Political Spectrum" filter in NewsFilters component
2. Visual indicator of source leaning (color badges)
3. "Balanced View" toggle - show equal mix of perspectives
4. Spectrum distribution chart in analytics

### **Phase 4: Quality & Monitoring**
1. Alert if any political leaning drops below threshold
2. Daily report on spectrum balance
3. User preference for preferred balance (e.g., "show me 40% center, 30% left, 30% right")

---

## 📈 **Success Metrics**

After implementation, target:
- **500+ articles per 24 hours** (current: 322)
- **Balanced distribution:**
  - Left: 20-25%
  - Center-Left: 15-20%
  - Center: 25-30%
  - Center-Right: 15-20%
  - Right: 15-20%
- **All 50 states** represented in state_government category
- **Fresh articles every hour** from each major source
- **User satisfaction:** "This is my one-stop political news hub"

---

## ⚡ **Quick Wins**

1. ✅ **RSS fetching every 15 min** - Already working perfectly
2. ✅ **Good filter infrastructure** - Just needs political_leaning
3. ✅ **Strong independent/specialized coverage** - Keep building
4. ❌ **Need political_leaning** - Top priority
5. ❌ **Need conservative balance** - Add 6 major sources
6. ❌ **Need mainstream giants** - Add Reuters, AP, NPR

---

## 🎬 **Next Steps**

1. **Approve database migration** to add political_leaning
2. **Add 15 critical sources** with political leaning tags
3. **Update NewsFilters component** to include spectrum filter
4. **Test balanced view** with real users
5. **Monitor and iterate** based on usage patterns
