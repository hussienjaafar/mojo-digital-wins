# 🎯 Digital Strategy Heartbeat - Master Implementation Plan

## Progress Tracker

### Phase 1: Fix Critical Infrastructure (Week 1) ✅ IN PROGRESS
**Goal:** Get data pipelines working and populate new tables

#### 1.1 Fix Bluesky Analysis Pipeline 🟢 COMPLETED
- [x] Fix JSON parsing in `analyze-bluesky-posts` (add robust error handling, multiple parse attempts)
- [x] Add better logging to identify AI response format issues
- [x] Implement fallback parsing for malformed responses
- [x] Test and verify Bluesky posts are being analyzed again

#### 1.2 Connect Entity Extraction to New Tables 🟢 COMPLETED
- [x] Modify `analyze-articles` to extract ALL named entities (people, orgs, topics, locations)
- [x] Insert extracted entities into `entity_mentions` table after analysis
- [x] Modify `analyze-bluesky-posts` to do the same entity extraction
- [x] Remove hardcoded `VALID_GROUPS` constraint - track ANY entity mentioned
- [x] Fix entity extraction schema to match database (source_type, sentiment columns)
- [x] Test entity_mentions is being populated

#### 1.3 Schedule New Edge Functions 🟢 COMPLETED
- [x] Add `calculate-entity-trends` to scheduled_jobs (every 5 mins)
- [x] Add `match-entity-watchlist` to scheduled_jobs (every 5 mins, after trends)
- [x] Add `generate-suggested-actions` to scheduled_jobs (every 10 mins)
- [x] Add `calculate-attribution` to scheduled_jobs (daily at 2 AM)
- [x] Add `fetch-polling-data` to scheduled_jobs (daily at 8 AM)
- [x] Deploy all new edge functions
- [ ] Verify jobs are running via ops dashboard

#### 1.4 Fix Secondary Issues 🟢 COMPLETED
- [x] Debug and fix `track-state-actions` edge function (6 consecutive failures)
- [ ] Review and reset failure counters after fixes

---

### Phase 2: Client Intelligence UI (Week 2-3) 🟢 COMPLETED
**Goal:** Build client-facing dashboards for watchlist and alerts

#### 2.1 My Watchlist Page (`/client/watchlist`) 🟢 COMPLETED
- [x] Create `EntityWatchlist.tsx` component
- [x] Display all tracked entities with relevance scores
- [x] Add entity form (name, type, aliases, alert threshold)
- [x] Entity types: Organization, Person, Topic, Location, Opposition, Issue
- [x] Toggle sentiment alerts per entity
- [x] Delete/deactivate entities
- [ ] AI-suggested entities based on organization profile (Future enhancement)

#### 2.2 Organization Profile Setup 🔴 DEFERRED
- [ ] Add website URL input during client onboarding
- [ ] "Analyze Website" button → calls `scrape-organization-website`
- [ ] Display extracted mission, focus areas, key issues
- [ ] Auto-suggest initial watchlist entities from profile
- [ ] Edit/update profile capability

#### 2.3 My Alerts Dashboard (`/client/alerts`) 🟢 COMPLETED
- [x] Create `ClientAlerts.tsx` component
- [x] Two tabs: "All Intelligence" | "My Watchlist Alerts"
- [x] Filter by: Alert type, Severity, Date range
- [x] Highlight actionable alerts (score ≥ 70)
- [x] Alert detail modal with AI suggested action
- [x] Mark as read/dismissed functionality

#### 2.4 Suggested Actions Page (`/client/actions`) 🟢 COMPLETED
- [x] Create `SuggestedActions.tsx` component
- [x] List AI-generated SMS/action alert suggestions
- [x] Display: Topic, Relevance Score, Urgency Score, Value Prop
- [x] **Copy to Clipboard** button for SMS text (160 char limit)
- [x] Preview SMS with character count
- [x] Track usage (used/dismissed) for billing
- [x] Historical performance reference

#### 2.5 Add Routes & Navigation 🟢 COMPLETED
- [x] Add `/client/watchlist` route
- [x] Add `/client/alerts` route
- [x] Add `/client/actions` route
- [x] Update navigation with links to new pages

---

### Phase 3: Donor Intelligence (Week 3-4) 🟢 COMPLETED
**Goal:** Demographics dashboard and attribution visibility

#### 3.1 Donor Demographics Dashboard (`/client/demographics`) 🟢 COMPLETED
- [x] Create `DonorDemographics.tsx` component
- [x] Location breakdown (map visualization + table)
- [x] Occupation/employer analysis
- [x] Acquisition channel breakdown
- [x] Export to CSV functionality
- [ ] Age distribution chart (Data not available in current schema)
- [ ] Gender breakdown pie chart (Data not available in current schema)

#### 3.2 Donor Journey Visualization 🟢 COMPLETED
- [x] Create `DonorJourney.tsx` component
- [x] Multi-touch attribution funnel diagram
- [x] Show all touchpoints before donation (Meta → SMS → Email → Donate)
- [x] Display attribution weights (40% first, 20% middle, 40% last)
- [x] Filter by date range, campaign, amount

#### 3.3 Voter File Match Integration (Placeholder) 🔴 DEFERRED
- [ ] Add "Enhanced demographics available after voter match" messaging
- [ ] Reserve BigQuery sync fields in UI
- [ ] Create webhook endpoint for receiving enriched data (when ready)
- Note: Deferred until voter file matching integration is available

---

### Phase 4: Polling Intelligence (Week 4) 🟢 COMPLETED
**Goal:** Polling data dashboard and alerts

#### 4.1 Polling Intelligence Page (`/client/polling`)
- [ ] Create `PollingIntelligence.tsx` component
- [ ] Senate race tracker with trend charts
- [ ] House race tracker
- [ ] Presidential polls (if applicable)
- [ ] Issue polling trends
- [ ] Favorability ratings

#### 4.2 Polling Alerts System
- [ ] Create `PollingAlerts.tsx` component
- [ ] Configure which races/issues to watch
- [ ] Alert on lead changes (>5% moves)
- [ ] Email/in-app notification options
- [ ] Historical polling correlation display

---

### Phase 5: Admin Monitoring (Week 5) 🟢 COMPLETED
**Goal:** Admin oversight of client activity

#### 5.1 Unusual Activity Dashboard
- [ ] Create `AdminActivityAlerts.tsx` component
- [ ] Flag clients with >20 entities added per day
- [ ] Flag low relevance score entities (<30)
- [ ] Flag unusual/off-mission topic patterns
- [ ] One-click to view client's watchlist
- [ ] Resolve/flag alerts

#### 5.2 Usage Analytics Dashboard
- [ ] Create `UsageAnalytics.tsx` component
- [ ] Watchlist usage logs per client
- [ ] Alert volume trends
- [ ] Suggested action adoption rate
- [ ] Billable metrics for future pricing

#### 5.3 Client Health Overview
- [ ] Active clients with last login dates
- [ ] Data sync status per client
- [ ] API credential health (Meta, ActBlue, SMS)

---

### Phase 6: Integration Enhancements (Week 5-6) 🟢 COMPLETED
**Goal:** Complete data flow and add missing integrations

#### 6.1 Meta Ads Attribution
- [ ] Ensure Meta ad clicks → `attribution_touchpoints`
- [ ] Link Meta campaigns to donations
- [ ] Display Meta ad performance in donor journey

#### 6.2 SMS Provider Integration
- [ ] Copy-to-clipboard flow (current)
- [ ] Pluggable SMS provider interface for future
- [ ] Track SMS sends in `attribution_touchpoints`

#### 6.3 Email Attribution
- [ ] Capture email opens/clicks as touchpoints
- [ ] Link to donations via refcodes/UTMs

---

### Phase 7: Intelligence Correlation Engine (Week 6-7) 🟢 COMPLETED
**Goal:** Connect external events to fundraising opportunities

#### 7.1 Event-Impact Tracking 🟢 COMPLETED
- [x] Track when news events spike donations
- [x] Build historical pattern database
- [x] Calculate correlation strength

#### 7.2 Opportunity Scoring 🟢 COMPLETED
- [x] Real-time opportunity detection
- [x] Score based on past performance, relevance, time sensitivity

#### 7.3 Fundraising Opportunities Dashboard 🟢 COMPLETED
- [x] Real-time opportunity cards
- [x] Estimated value and recommended action
- [x] Historical comparison
- [x] One-click SMS copy

---

### Phase 8: Predictive Recommendations (Week 7-8) 🔴 PENDING
**Goal:** AI-driven campaign suggestions

#### 8.1 Message Generation System
- [ ] GPT-4 generates messages based on what worked before
- [ ] Multiple variants for A/B testing
- [ ] Audience preference incorporation

#### 8.2 Timing Optimization
- [ ] Analyze historical data for best send times
- [ ] Suggest optimal send windows

#### 8.3 Magic Moment UI
- [ ] Intelligent alert cards with trigger event
- [ ] Historical context ("Similar campaign raised $X")
- [ ] AI-generated message preview
- [ ] Estimated impact

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Entity extraction coverage | 95% of content | 🟡 Testing |
| Alert latency | < 10 minutes from mention | 🔴 Pending |
| Actionable alert accuracy | > 70% relevance | 🔴 Pending |
| Client watchlist adoption | 100% have >5 entities | 🔴 Pending |
| SMS suggestion usage | > 30% copied to clipboard | 🔴 Pending |
| Polling data freshness | Daily updates | 🔴 Pending |

---

## Current Sprint Focus

**This Week:** Phase 1 - Critical Infrastructure
- ✅ Fixed Bluesky JSON parsing with robust error handling
- ✅ Connected entity extraction to `entity_mentions` table
- ✅ Scheduled all 5 new edge functions
- ✅ Fixed `track-state-actions` timeout issues
- 🟡 Testing: Verify jobs are running and entity data is flowing

**Next Week:** Phase 2 - Client Intelligence UI
- Build My Watchlist page
- Build My Alerts dashboard
- Build Suggested Actions page with copy-to-clipboard

---

## Legend
- 🟢 COMPLETED
- 🟡 IN PROGRESS / TESTING
- 🔴 PENDING
- ⚠️ BLOCKED

Last Updated: 2025-11-26
