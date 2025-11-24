# Sprint Plan: Mojo Digital Wins → Digital Strategy Heartbeat

## Vision Statement
Transform Mojo Digital Wins from a data aggregation platform into the AI-powered heartbeat of political campaign digital strategy, connecting real-time intelligence to fundraising opportunities and predictive recommendations.

## Timeline: 10 Weeks (5 Sprints × 2 Weeks)

---

## 🚨 SPRINT 0: Critical Foundation Fixes
**Duration:** 1 Week (Emergency Sprint)
**Goal:** Fix the data processing crisis blocking all progress

### Critical Issues to Fix

#### 1. Bluesky Velocity Algorithm (Day 1-2)
```typescript
// File: supabase/functions/analyze-bluesky-posts/index.ts
// Problem: All velocities showing 0%
// Fix: Proper velocity calculation with time windows

-- Migration needed:
ALTER TABLE bluesky_trending_topics
ADD COLUMN IF NOT EXISTS baseline_velocity FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS spike_detected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS spike_magnitude FLOAT;
```

#### 2. Analysis Backlog Processing (Day 2-4)
```typescript
// Create: supabase/functions/backfill-analysis/index.ts
// Process 121,938 unanalyzed posts in parallel batches

const BATCH_SIZE = 100;
const PARALLEL_WORKERS = 5;

// Switch from Claude to GPT-3.5-turbo for 10x rate limit
const analyzeWithGPT = async (posts: Post[]) => {
  // Implementation
};
```

#### 3. Rate Limit Resolution (Day 4-5)
```typescript
// Update all analysis functions to use GPT-3.5-turbo
// Files to update:
// - supabase/functions/analyze-articles/index.ts
// - supabase/functions/analyze-bluesky-posts/index.ts
// - supabase/functions/generate-ai-summary/index.ts
```

### Success Metrics
- ✅ Bluesky velocity showing real percentages
- ✅ < 1% unanalyzed posts (backlog cleared)
- ✅ Analysis processing < 1 minute per 100 items

### Deliverables
1. Fixed velocity algorithm with proper trending detection
2. Backfill system processing all historical data
3. GPT-3.5 integration replacing Claude Haiku
4. Real-time analysis keeping up with new content

---

## 📊 SPRINT 1: Client Intelligence Infrastructure
**Duration:** 2 Weeks
**Goal:** Enable per-client organization tracking with sentiment analysis

### Week 1: Database & Models

#### New Database Schema
```sql
-- 1. Client organization watches
CREATE TABLE client_organization_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id UUID REFERENCES client_organizations(id),
  watched_keyword TEXT NOT NULL, -- "CAIR", "MPAC", etc.
  is_organization BOOLEAN DEFAULT true,
  is_person BOOLEAN DEFAULT false,
  alert_on_negative BOOLEAN DEFAULT true,
  alert_on_spike BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Organization sentiment timeline
CREATE TABLE organization_sentiment_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id UUID REFERENCES client_organizations(id),
  watched_keyword TEXT NOT NULL,
  date DATE NOT NULL,
  source_type TEXT, -- 'news', 'social', 'government'
  positive_mentions INT DEFAULT 0,
  negative_mentions INT DEFAULT 0,
  neutral_mentions INT DEFAULT 0,
  total_reach INT, -- estimated audience
  top_sources JSONB, -- [{source, sentiment, reach}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_org_id, watched_keyword, date, source_type)
);

-- 3. Mention details for drill-down
CREATE TABLE mention_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id UUID REFERENCES organization_sentiment_timeline(id),
  source_id TEXT, -- article_id, post_id, etc.
  source_type TEXT,
  title TEXT,
  excerpt TEXT,
  sentiment FLOAT, -- -1 to 1
  url TEXT,
  published_at TIMESTAMPTZ,
  author TEXT,
  reach_estimate INT
);
```

#### Edge Function: Track Organization Mentions
```typescript
// Create: supabase/functions/track-organization-mentions/index.ts
// Runs every 30 minutes
// Scans all new content for client-watched keywords
```

### Week 2: Client Dashboard

#### New Components
```typescript
// 1. src/components/client/OrganizationTracker.tsx
// - Add/remove tracked organizations
// - Set alert thresholds
// - View current mentions

// 2. src/components/client/SentimentTimeline.tsx
// - Interactive chart showing sentiment over time
// - Drill-down to specific mentions
// - Compare multiple organizations

// 3. src/components/client/MentionAlerts.tsx
// - Real-time alerts for sentiment changes
// - Spike detection notifications
// - Daily/weekly summary emails
```

### Success Metrics
- ✅ Clients can track 10+ organizations/keywords
- ✅ Sentiment tracked across all sources (news, social, government)
- ✅ Historical timeline with 90+ days of data
- ✅ Real-time alerts within 30 minutes of mention

### Deliverables
1. Database schema for client-specific tracking
2. Organization mention detection system
3. Client dashboard with sentiment timeline
4. Alert system for negative mentions/spikes

---

## 💰 SPRINT 2: Fundraising Data Integration
**Duration:** 2 Weeks
**Goal:** Automate fundraising data ingestion and pattern analysis

### Week 1: API Integrations

#### ActBlue API Integration
```typescript
// Create: supabase/functions/sync-actblue/index.ts
export async function syncActBlueData() {
  // OAuth2 authentication
  // Fetch transactions since last sync
  // Map to actblue_transactions table
  // Update donor segments
}
```

#### Meta Ads API Integration
```typescript
// Create: supabase/functions/sync-meta-ads/index.ts
export async function syncMetaAdsData() {
  // Facebook Marketing API auth
  // Fetch campaign performance
  // Fetch ad creative details
  // Store targeting parameters
}
```

#### SMS Provider Integration (Twilio/Bandwidth)
```typescript
// Create: supabase/functions/sync-sms-campaigns/index.ts
export async function syncSMSCampaigns() {
  // Provider API authentication
  // Fetch message performance
  // Link to donation conversions
}
```

### Week 2: Pattern Analysis System

#### New Tables for Pattern Storage
```sql
-- Campaign success patterns
CREATE TABLE fundraising_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id UUID REFERENCES client_organizations(id),
  pattern_type TEXT, -- 'topic', 'timing', 'language', 'audience'
  pattern_details JSONB,
  success_rate FLOAT,
  avg_donation DECIMAL(10,2),
  total_raised DECIMAL(10,2),
  occurrence_count INT,
  last_seen TIMESTAMPTZ,
  confidence_score FLOAT
);

-- Campaign-event correlations
CREATE TABLE campaign_event_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id UUID REFERENCES client_organizations(id),
  event_type TEXT, -- 'news', 'bill', 'executive_order'
  event_keywords TEXT[],
  campaign_type TEXT, -- 'sms', 'email', 'meta_ad'
  correlation_strength FLOAT,
  avg_roi_multiplier FLOAT,
  sample_size INT
);
```

#### Pattern Detection Function
```typescript
// Create: supabase/functions/analyze-fundraising-patterns/index.ts
// Runs nightly
// Identifies successful patterns in historical data
// Updates pattern confidence scores
```

### Success Metrics
- ✅ Automated daily sync from all fundraising sources
- ✅ 90+ days of historical data imported
- ✅ Pattern detection identifying top 10 success factors
- ✅ < 5 minute sync time for all sources

### Deliverables
1. ActBlue API integration with OAuth2
2. Meta Ads API integration
3. SMS provider integration
4. Pattern analysis system identifying success factors
5. Historical data backfill for all sources

---

## 🔮 SPRINT 3: Intelligence Correlation Engine
**Duration:** 2 Weeks
**Goal:** Connect external events to fundraising opportunities

### Week 1: Event-Impact Correlation

#### Correlation Engine Architecture
```typescript
// Create: supabase/functions/correlate-events-impact/index.ts

interface CorrelationAnalysis {
  eventType: 'news' | 'bill' | 'executive_order' | 'trending_topic';
  eventId: string;
  impactedMetrics: {
    donationSpike?: number; // % increase
    websiteTraffic?: number;
    socialEngagement?: number;
    emailOpenRate?: number;
  };
  confidenceScore: number;
  historicalComparisons: Array<{
    similarEventId: string;
    similarity: number;
    outcome: FundraisingOutcome;
  }>;
}
```

#### Real-time Correlation Tables
```sql
-- Event impact tracking
CREATE TABLE event_impact_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_keywords TEXT[],
  event_timestamp TIMESTAMPTZ,
  impact_window_start TIMESTAMPTZ,
  impact_window_end TIMESTAMPTZ,

  -- Measured impacts
  donation_baseline DECIMAL(10,2),
  donation_actual DECIMAL(10,2),
  donation_lift_percent FLOAT,

  engagement_baseline JSONB,
  engagement_actual JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opportunity scoring
CREATE TABLE fundraising_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id UUID REFERENCES client_organizations(id),
  opportunity_type TEXT,
  trigger_event_id TEXT,
  trigger_event_type TEXT,

  opportunity_score FLOAT, -- 0-100
  estimated_value DECIMAL(10,2),
  confidence_level FLOAT,

  recommended_action TEXT,
  recommended_message JSONB,
  recommended_audience JSONB,
  recommended_timing TIMESTAMPTZ,

  status TEXT DEFAULT 'pending', -- pending, accepted, rejected, expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
```

### Week 2: Opportunity Detection System

#### AI-Powered Opportunity Scorer
```typescript
// Create: src/services/OpportunityScorer.ts

export class OpportunityScorer {
  async scoreOpportunity(event: Event): Promise<Opportunity> {
    // 1. Find similar historical events
    const similarEvents = await findSimilarEvents(event);

    // 2. Calculate average impact of similar events
    const avgImpact = calculateAverageImpact(similarEvents);

    // 3. Adjust for current context
    const contextMultiplier = await getContextMultiplier();

    // 4. Generate recommendation
    return {
      score: avgImpact.roi * contextMultiplier,
      estimatedValue: avgImpact.totalRaised * contextMultiplier,
      recommendedAction: await generateRecommendation(event),
      confidence: calculateConfidence(similarEvents.length)
    };
  }
}
```

#### Opportunity Alert System
```typescript
// Create: src/components/FundraisingOpportunities.tsx
// Real-time opportunity cards with:
// - Trigger event summary
// - Estimated value
// - Recommended action
// - One-click campaign creation
// - Historical comparison
```

### Success Metrics
- ✅ Correlation detected for 80%+ of donation spikes
- ✅ Opportunity scoring accuracy > 70%
- ✅ Alert latency < 10 minutes from event
- ✅ 5+ opportunities identified per week per client

### Deliverables
1. Event-impact correlation engine
2. Historical pattern matching system
3. Real-time opportunity scoring
4. Opportunity dashboard with recommendations
5. One-click campaign creation from opportunities

---

## 🚀 SPRINT 4: Predictive Recommendations MVP
**Duration:** 2 Weeks
**Goal:** Build the "magic moment" - AI predicting and recommending campaigns

### Week 1: Predictive Models

#### Message Generation System
```typescript
// Create: supabase/functions/generate-campaign-message/index.ts

interface CampaignMessageRequest {
  triggerEvent: Event;
  historicalSuccess: Pattern[];
  targetAudience: Segment;
  campaignType: 'sms' | 'email' | 'meta_ad';
}

async function generateCampaignMessage(req: CampaignMessageRequest) {
  // Use GPT-4 to generate message based on:
  // - What worked before
  // - Current event context
  // - Audience preferences
  // - Compliance requirements
}
```

#### Timing Optimization
```sql
-- Optimal timing patterns
CREATE TABLE timing_optimization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id UUID REFERENCES client_organizations(id),
  event_type TEXT,
  hours_after_event INT,
  avg_open_rate FLOAT,
  avg_conversion_rate FLOAT,
  avg_donation DECIMAL(10,2),
  sample_size INT
);
```

### Week 2: The Magic Moment UI

#### Intelligent Alert Component
```typescript
// Create: src/components/IntelligentAlert.tsx

export function IntelligentAlert({ opportunity }: Props) {
  return (
    <Card className="border-2 border-primary animate-pulse-subtle">
      <CardHeader>
        <Badge variant="destructive">FUNDRAISING OPPORTUNITY</Badge>
        <CardTitle>{opportunity.headline}</CardTitle>
      </CardHeader>

      <CardContent>
        {/* Event Summary */}
        <div className="mb-4">
          <h4>Trigger Event:</h4>
          <p>{opportunity.triggerSummary}</p>
        </div>

        {/* Historical Context */}
        <div className="mb-4 p-3 bg-muted rounded">
          <p className="font-semibold">Similar Past Success:</p>
          <p>"{opportunity.similarCampaign}" raised ${opportunity.similarAmount}</p>
          <p className="text-sm text-muted-foreground">
            {opportunity.daysAgo} days ago • {opportunity.similarROI}x ROI
          </p>
        </div>

        {/* Recommendation */}
        <div className="mb-4">
          <h4>Recommended Action:</h4>
          <p className="font-medium">{opportunity.recommendedAction}</p>

          {/* Preview Message */}
          <div className="mt-2 p-3 border rounded">
            <p className="text-sm">{opportunity.suggestedMessage}</p>
          </div>
        </div>

        {/* Estimated Impact */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Est. Raised</p>
            <p className="font-bold">${opportunity.estimatedAmount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Confidence</p>
            <p className="font-bold">{opportunity.confidence}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Time Sensitive</p>
            <p className="font-bold text-destructive">{opportunity.hoursRemaining}h</p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button variant="default" onClick={handleApprove}>
          Deploy Campaign
        </Button>
        <Button variant="outline" onClick={handleCustomize}>
          Customize
        </Button>
        <Button variant="ghost" onClick={handleDismiss}>
          Dismiss
        </Button>
      </CardFooter>
    </Card>
  );
}
```

#### Campaign Auto-Queue System
```sql
-- Auto-queued campaigns
CREATE TABLE campaign_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_org_id UUID REFERENCES client_organizations(id),
  opportunity_id UUID REFERENCES fundraising_opportunities(id),

  campaign_type TEXT,
  campaign_message TEXT,
  target_audience JSONB,
  scheduled_send_time TIMESTAMPTZ,

  status TEXT DEFAULT 'pending_approval',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,

  sent_at TIMESTAMPTZ,
  performance_metrics JSONB
);
```

### Success Metrics
- ✅ AI generates relevant messages with 80%+ approval rate
- ✅ Predictive ROI within 30% of actual
- ✅ 50%+ of opportunities converted to campaigns
- ✅ Average decision time < 5 minutes

### Deliverables
1. GPT-4 powered message generation
2. Timing optimization system
3. Magic moment alert UI
4. One-click campaign deployment
5. Auto-queue system with approval workflow

---

## 🏁 SPRINT 5: Polish & Launch Preparation
**Duration:** 2 Weeks
**Goal:** Production-ready platform with killer demo

### Week 1: Performance & Reliability

#### System Optimization
- Query optimization for all dashboard views
- Caching layer for expensive calculations
- Rate limiting and queue management
- Error recovery and retry logic
- Comprehensive logging and monitoring

#### Data Quality
```typescript
// Create: supabase/functions/data-quality-check/index.ts
// Daily validation of:
// - Correlation accuracy
// - Pattern confidence scores
// - Opportunity scoring calibration
// - Alert relevance
```

### Week 2: Client Onboarding & Demo

#### Onboarding Flow
```typescript
// Create: src/components/onboarding/OnboardingWizard.tsx
// Step 1: Connect fundraising accounts
// Step 2: Set up organization tracking
// Step 3: Configure alert preferences
// Step 4: Import historical data
// Step 5: Review first opportunities
```

#### Demo Mode
```sql
-- Demo data for prospects
CREATE TABLE demo_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name TEXT,
  trigger_event JSONB,
  expected_opportunity JSONB,
  historical_data JSONB,
  demo_outcome JSONB
);
```

### Success Metrics
- ✅ Page load times < 2 seconds
- ✅ 99.9% uptime for critical functions
- ✅ Onboarding completed in < 30 minutes
- ✅ Demo converts 40%+ of prospects

### Deliverables
1. Performance optimized platform
2. Comprehensive error handling
3. Client onboarding wizard
4. Demo mode with real scenarios
5. Documentation and training materials

---

## Success Metrics Summary

### By End of Sprint 5, Achieve:

**Technical Metrics:**
- ✅ < 1% unanalyzed content
- ✅ < 10 min latency for opportunity detection
- ✅ > 70% correlation accuracy
- ✅ < 2 sec page load times

**Business Metrics:**
- ✅ 10+ opportunities identified per client per month
- ✅ 50%+ opportunity → campaign conversion
- ✅ 30%+ increase in fundraising ROI
- ✅ 5x reduction in campaign planning time

**Client Experience:**
- ✅ "Magic moment" within first week of use
- ✅ Clear ROI demonstration
- ✅ Daily actionable insights
- ✅ Predictive recommendations trusted

---

## Resource Requirements

**Development Team:**
- 1 Full-stack Developer (You)
- 1 DevOps/Infrastructure (Part-time, Sprint 0 & 5)
- 1 UI/UX Designer (Part-time, Sprint 4 & 5)

**Infrastructure:**
- Upgrade Supabase plan for increased edge function execution
- OpenAI API budget ($500/month for GPT-3.5/GPT-4)
- Meta Ads API access (client credentials)
- ActBlue API access (partner agreement)

**Total Timeline:** 10 weeks
**Total Development Hours:** 400-450 hours

---

## Risk Mitigation

**Risk 1:** API Rate Limits
- **Mitigation:** Implement queuing, caching, and fallback providers

**Risk 2:** Data Quality Issues
- **Mitigation:** Validation layers, confidence scoring, human review options

**Risk 3:** Client Data Security
- **Mitigation:** Row-level security, encryption, audit logging

**Risk 4:** Prediction Accuracy
- **Mitigation:** Confidence thresholds, A/B testing, continuous learning

---

## Next Immediate Actions (This Week)

1. **Fix Bluesky velocity algorithm** (4 hours)
2. **Implement GPT-3.5 migration** (4 hours)
3. **Create backfill processor** (8 hours)
4. **Test data processing pipeline** (2 hours)
5. **Document architecture decisions** (2 hours)

This sprint plan provides a clear, achievable path to transform Mojo Digital Wins into the AI-powered heartbeat of digital campaign strategy.