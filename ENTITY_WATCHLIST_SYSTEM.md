# Dynamic Political Intelligence + Client Entity Watchlist System
## Implementation Summary

## ✅ COMPLETED - Phase 1: Database Foundation

### Database Tables Created
1. **Enhanced `actblue_transactions`** - Now captures ALL ActBlue webhook fields:
   - Full donor demographics (name, address, phone, employer, occupation)
   - A/B test tracking (`ab_test_name`, `ab_test_variation`)
   - Refcodes (`refcode`, `refcode2`, `refcode_custom`)
   - Mobile/Express flags
   - Custom fields, recurring details, lineitem IDs

2. **`organization_profiles`** - AI-scraped org data for context:
   - Mission, focus areas, key issues
   - Used to score entity relevance and suggest watchlist items

3. **`entity_watchlist`** - Client-specific entities to track:
   - Flexible types: organization, person, topic, location, opposition, issue
   - Alert thresholds per entity
   - AI-calculated relevance scores

4. **`entity_mentions`** - Universal mention storage across all platforms:
   - Indexed by entity name + time for fast trend calculation
   - Captures sentiment + context snippet

5. **`entity_trends`** - Real-time aggregated metrics (updated every 5 mins):
   - Mentions: 1h, 6h, 24h, 7d windows
   - Velocity calculation
   - Sentiment tracking

6. **`client_entity_alerts`** - Watchlist-triggered actionable alerts:
   - Actionable score (0-100) based on:
     - 25% Velocity (spiking now?)
     - 25% Client match (their org/mission?)
     - 20% Time sensitivity (breaking?)
     - 15% Sentiment shift
     - 15% Historical SMS performance

7. **`suggested_actions`** - AI-generated SMS/action alert copy:
   - Topic relevance + urgency scoring
   - Historical performance data
   - Copy-to-clipboard flow (Switchboard API is read-only)

8. **`attribution_touchpoints`** - All donor interactions pre-donation:
   - Captures Meta ads, SMS, email, organic touches
   - Links UTMs, refcodes, campaigns

9. **`transaction_attribution`** - Multi-touch attribution model:
   - **40% first touch** (acquisition credit)
   - **20% middle touches** (nurture credit)
   - **40% last touch** (conversion credit)

10. **`donor_demographics`** - Comprehensive donor profiles:
    - ActBlue data populated immediately
    - Voter file match fields ready (age, gender, party, score)
    - BigQuery sync fields reserved

11. **`polling_data`** - Aggregated polling from 538 + RCP:
    - Senate, House, Presidential, Issue, Favorability polls
    - Daily fetches with lead margin tracking

12. **`polling_alerts`** - Significant poll changes:
    - Lead changes, significant moves

13. **`watchlist_usage_log`** - Usage tracking for future billing

14. **`admin_activity_alerts`** - Flags unusual client behavior:
    - Excessive topics (>20/day)
    - Low relevance scores (<30)

---

## 🚀 NEXT STEPS - Phase 2: Edge Functions

### Critical Edge Functions to Build:
1. **`calculate-entity-trends`** (runs every 5 mins)
   - Aggregate entity mentions → entity_trends table
   - Calculate velocity, detect spikes
   - Lovable AI for sentiment analysis

2. **`match-entity-watchlist`** (runs after trends)
   - Compare trending entities vs client watchlists
   - Generate client_entity_alerts with actionable scores
   - Fuzzy matching for aliases

3. **`generate-suggested-actions`** (triggered by high-score alerts)
   - Lovable AI generates SMS fundraising copy
   - Pulls historical SMS performance
   - Creates suggested_actions records

4. **`calculate-attribution`** (nightly batch)
   - For each transaction, find all touchpoints
   - Apply 40-20-40 weighting model
   - Populate transaction_attribution table

5. **`fetch-polling-data`** (daily at 8 AM)
   - Scrape FiveThirtyEight GitHub
   - Scrape RealClearPolitics
   - Detect significant changes → polling_alerts

6. **`scrape-organization-website`** (on-demand)
   - Uses Firecrawl to scrape client website
   - Lovable AI extracts mission, focus areas, issues
   - Suggests initial watchlist entities

---

## 📊 CLIENT DASHBOARDS TO BUILD

### 1. "My Watchlist" Page
- Add/remove entities with AI suggestions
- Set alert thresholds per entity
- View relevance scores

### 2. "My Alerts" Dashboard
- Filter: All alerts | Actionable only
- Click alert → See suggested SMS copy
- Mark as read/dismissed

### 3. "Suggested Actions" Page
- List AI-generated SMS/action alerts
- Topic relevance + urgency scores
- **Copy to Clipboard** button for SMS text
- Track usage (mark as used/dismissed)

### 4. "Donor Demographics" Dashboard
- Demographics breakdown (location, age, occupation)
- Acquisition channel breakdown
- Multi-touch attribution funnel
- Export to CSV

### 5. "Polling Intelligence" Page
- Senate/House race tracker
- Issue polling trends
- Favorability ratings
- Alert on significant changes

---

## 🔧 ADMIN FEATURES TO BUILD

### 1. Unusual Activity Dashboard
- View clients with:
  - >20 entities/day added
  - Low relevance entities (<30 score)
  - Suspicious patterns

### 2. Usage Analytics
- Watchlist usage logs per client
- Alert volume trends
- Suggested action conversion rates

---

## 💡 KEY IMPLEMENTATION DETAILS

### SMS Provider Strategy
- **Current**: Copy-to-clipboard (Switchboard API is read-only)
- **Future**: Pluggable SMS provider interface
  - Twilio integration when ready
  - Any SMS API can be added

### Polling Sources
- **FiveThirtyEight**: Free, daily updates via GitHub
- **RealClearPolitics**: Web scraping, broader coverage
- **Premium APIs**: Can add PredictIt/Polymarket later

### Attribution Model
Multi-touch with weighting:
```
Example: Donor sees Meta ad (day 1), gets SMS (day 3), donates via email (day 5)

Attribution:
- Meta ad: 40% (first touch)
- SMS: 20% (middle touch)  
- Email: 40% (last touch)
```

### BigQuery Integration (Deferred)
- Tables ready with reserved fields
- `bigquery_synced_at`, `bigquery_id`
- Voter file match fields ready
- Will implement once you provide schema

---

## 🎯 IMMEDIATE PRIORITIES

1. ✅ Database schema (DONE)
2. ✅ Enhanced ActBlue webhook (DONE)
3. 🔄 Build `calculate-entity-trends` edge function
4. 🔄 Build `match-entity-watchlist` edge function  
5. 🔄 Build `generate-suggested-actions` edge function
6. 🔄 Create client "My Watchlist" UI
7. 🔄 Create "Suggested Actions" UI with copy-to-clipboard

---

## 📝 NOTES

- **No hardcoded entities**: System tracks ANY entity mentioned in content
- **AI-driven suggestions**: Lovable AI scores relevance to org mission
- **Actionable score formula**: Proven scoring = higher client engagement
- **Multi-touch attribution**: Industry standard 40-20-40 model
- **Billing-ready**: Usage logs track everything for future pricing tiers
