# News & Trends System Overhaul Plan
## Version 2.0 - Profile-First with Anti-Filter-Bubble Mechanisms

---

# 🤖 AUTONOMOUS EXECUTION GUIDE

**FOR CLAUDE: READ THIS FIRST AND EXECUTE ALL PHASES**

The user has authorized autonomous implementation of this entire plan. Work through all phases without waiting for approval. The user is asleep and will review your work when they wake up.

## Permissions Granted
- Edit files in `supabase/functions/**`, `src/**`, `docs/**`
- Write new files in `supabase/functions/**`, `supabase/migrations/**`, `src/**`
- Run `npm`, `npx supabase`, and git commands

## Execution Order

### PHASE 1: Database Migrations (Do First)
1. Create migration file: `supabase/migrations/[timestamp]_news_trends_overhaul.sql`
2. Include ALL schema changes from the "Database Schema Changes" section below
3. This enables all subsequent work

### PHASE 2: Tag RSS Sources with Policy Domains
1. Create a data file or migration to tag all existing RSS sources
2. Map each source to its policy domains using the SOURCE_POLICY_MAPPING in Agent 1 section
3. Update the `rss_sources` table with policy_domains for each source

### PHASE 3: Create Shared Utility Functions
1. Create `/supabase/functions/_shared/policyDomainKeywords.ts` - keyword lists
2. Create `/supabase/functions/_shared/orgRelevanceV3.ts` - 70/30 scoring
3. Create `/supabase/functions/_shared/trendDiversity.ts` - diversity function
4. Create `/supabase/functions/_shared/politicalEntities.ts` - entity detection

### PHASE 4: Create New Supabase Functions
1. `tag-trend-policy-domains/index.ts`
2. `tag-trend-geographies/index.ts`
3. `extract-trend-entities/index.ts`
4. `get-trends-for-org/index.ts` (main API)
5. `extract-campaign-topics/index.ts`
6. `correlate-trends-campaigns/index.ts`
7. `update-org-affinities/index.ts`
8. `decay-stale-affinities/index.ts`

### PHASE 5: Update Existing Functions
1. Update `detect-trend-events/index.ts` to call tagging functions
2. Update `bluesky-stream/index.ts` to use broad keywords
3. Update `compute-org-relevance/index.ts` to use V3 scoring

### PHASE 6: Frontend Updates
1. Update `src/components/client/TrendCard.tsx` with badges
2. Add "Why am I seeing this?" collapsible
3. Create `src/components/client/TrendDomainFilters.tsx`

### PHASE 7: Update Types
1. Update `src/integrations/supabase/types.ts` with new table types
2. Create `src/types/trends.ts` for enhanced trend types

## Progress Tracking
As you complete each phase, update this section:

- [ ] Phase 1: Database Migrations
- [ ] Phase 2: Tag RSS Sources
- [ ] Phase 3: Shared Utilities
- [ ] Phase 4: New Supabase Functions
- [ ] Phase 5: Update Existing Functions
- [ ] Phase 6: Frontend Updates
- [ ] Phase 7: Update Types

## If You Get Stuck
- Skip the problematic item and continue with the next
- Document what you skipped and why in a new file: `docs/implementation-notes.md`
- The user will help resolve blockers when they wake up

## When Done
- Run `git status` to show all changes
- Create `docs/implementation-notes.md` summarizing what was done
- Do NOT commit - let the user review first

---

## Executive Summary

Transform the current **hardcoded, single-demographic system** into a **broad collection, per-org personalized platform** that serves diverse advocacy organizations and political campaigns with high-quality, actionable political intelligence.

### Key Principles

1. **Profile-First (70%)**: What the client SAYS they care about (onboarding) always outweighs what they've DONE (campaign history)
2. **Learning-Second (30%)**: Campaign history informs but doesn't dominate recommendations
3. **Exploration Over Exploitation**: Actively surface new opportunities in declared-but-untried domains
4. **Diversity Guaranteed**: Ensure variety across all declared policy domains
5. **Transparency**: Flag "New Opportunity" vs "Proven Topic" so clients understand WHY they're seeing each trend

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAYER 1: BROAD DATA COLLECTION                      │
│  RSS Sources: 400+ (tagged by policy domain)                                │
│  Bluesky: Broad political keywords (500+)                                   │
│  All 12 policy domains covered equally                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAYER 2: GLOBAL TREND DETECTION                     │
│  Detect ALL political trends (org-agnostic)                                 │
│  Tag each trend with: policy_domains[], geographies[], entities[]           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 3: PER-ORG PERSONALIZATION                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              RELEVANCE SCORING (70/30 SPLIT)                        │   │
│  │                                                                     │   │
│  │  PROFILE-BASED (70%):                                               │   │
│  │    • Policy Domain Match (35 pts) - from onboarding                 │   │
│  │    • Focus Areas Match (20 pts) - from onboarding                   │   │
│  │    • Watchlist Entity Match (15 pts) - from onboarding              │   │
│  │                                                                     │   │
│  │  LEARNING-BASED (30%):                                              │   │
│  │    • Learned Affinity (20 pts) - from campaign history, CAPPED     │   │
│  │    • Exploration Bonus (10 pts) - declared but UNTRIED domains     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              ANTI-FILTER-BUBBLE SAFEGUARDS                          │   │
│  │                                                                     │   │
│  │  • Affinity Decay: Old successes decay 5%/week if not reinforced   │   │
│  │  • Diversity Requirement: At least 1 trend per declared domain     │   │
│  │  • Exploration Bonus: +10 pts for untried declared domains         │   │
│  │  • UI Flagging: "New Opportunity" vs "Proven Topic" badges         │   │
│  │  • Filter Logging: Track what's filtered for debugging             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAYER 4: OUTCOME LEARNING                           │
│  Learn from campaign performance (with safeguards)                          │
│  Update affinities with decay and caps                                      │
│  Never let learned data exceed 30% of scoring weight                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The 5 Specialized Agents

---

### Agent 1: Data Tagging Engineer

**Mission:** Tag all data sources with policy domains so pipeline can filter per-org

#### Responsibilities

1. **Tag All 240+ RSS Sources with Policy Domains**

```sql
-- Migration to add policy domains column
ALTER TABLE rss_sources ADD COLUMN policy_domains TEXT[] DEFAULT '{}';
CREATE INDEX idx_rss_sources_domains ON rss_sources USING GIN(policy_domains);
```

2. **Create Comprehensive Source-to-Domain Mapping**

```typescript
const SOURCE_POLICY_MAPPING: Record<string, string[]> = {
  // Civil Rights / Human Rights
  'ACLU': ['Civil Rights', 'Criminal Justice', 'Immigration'],
  'SPLC': ['Civil Rights', 'Criminal Justice'],
  'Human Rights Watch': ['Civil Rights', 'Foreign Policy'],
  'NAACP': ['Civil Rights', 'Voting Rights'],
  'Lambda Legal': ['Civil Rights'],

  // Environment
  'Sierra Club': ['Environment'],
  'Grist': ['Environment'],
  'E&E News': ['Environment', 'Economic Justice'],
  'Carbon Brief': ['Environment'],

  // Healthcare
  'KFF': ['Healthcare'],
  'Health Affairs': ['Healthcare'],
  'STAT News': ['Healthcare'],

  // Labor
  'Labor Notes': ['Labor & Workers Rights'],
  'Payday Report': ['Labor & Workers Rights'],

  // Education
  'Education Week': ['Education'],
  'Chalkbeat': ['Education'],
  'Inside Higher Ed': ['Education'],

  // Housing
  'Shelterforce': ['Housing', 'Economic Justice'],
  'Next City': ['Housing', 'Economic Justice'],

  // Criminal Justice
  'The Marshall Project': ['Criminal Justice'],
  'The Appeal': ['Criminal Justice'],

  // Immigration
  'Migration Policy Institute': ['Immigration'],
  'American Immigration Council': ['Immigration'],

  // Economic Justice
  'Economic Policy Institute': ['Economic Justice'],
  'Center on Budget': ['Economic Justice', 'Healthcare'],

  // Foreign Policy
  'Foreign Policy': ['Foreign Policy'],
  'Carnegie Endowment': ['Foreign Policy'],
  'Council on Foreign Relations': ['Foreign Policy'],

  // Technology
  'Ars Technica': ['Technology'],
  'The Verge': ['Technology'],
  'Wired': ['Technology'],

  // Voting Rights
  'Brennan Center': ['Voting Rights', 'Criminal Justice'],

  // Broad Political (all domains)
  'Politico': ['Healthcare', 'Economic Justice', 'Foreign Policy', 'Voting Rights', 'Immigration'],
  'The Hill': ['Healthcare', 'Economic Justice', 'Foreign Policy', 'Voting Rights', 'Immigration'],
  'NPR Politics': ['Healthcare', 'Economic Justice', 'Foreign Policy', 'Voting Rights'],
  'Reuters Politics': ['Foreign Policy', 'Economic Justice'],
  'Associated Press': ['Foreign Policy', 'Economic Justice', 'Healthcare'],
};
```

3. **Expand Sources to Cover All 12 Policy Domains**

| Domain | Current | Target | Priority Sources to Add |
|--------|---------|--------|-------------------------|
| Healthcare | ~5 | 20+ | KFF, Health Affairs, STAT, Modern Healthcare |
| Education | ~3 | 15+ | Ed Week, Chalkbeat, Inside Higher Ed, The 74 |
| Labor | ~2 | 15+ | Labor Notes, Payday Report, Union feeds |
| Housing | ~2 | 10+ | Shelterforce, Next City, urban policy |
| Technology | ~3 | 15+ | Ars Technica, Wired, The Verge, Protocol |
| Environment | ~5 | 20+ | Grist, E&E News, Carbon Brief, Inside Climate |
| Economic Justice | ~5 | 15+ | EPI, CBPP, ProPublica |
| Criminal Justice | ~5 | 15+ | Marshall Project, The Appeal |
| Voting Rights | ~3 | 10+ | Brennan Center, election law blogs |
| Foreign Policy | ~8 | 20+ | CFR, Carnegie, Foreign Affairs |
| Civil Rights | ~15 | 25+ | Balance with other domains |
| Immigration | ~8 | 15+ | MPI, AIC, NILC |

4. **Remove Demographic Bias from Source Selection**
   - Keep all existing sources (they're legitimate)
   - Add equivalent sources for ALL demographics
   - Ensure no single demographic dominates

#### Deliverables
- [ ] Policy domain tags for all 240+ existing sources
- [ ] 150+ new sources to fill coverage gaps
- [ ] Migration script for `policy_domains` column
- [ ] Source coverage audit report by domain

---

### Agent 2: Keyword & Bias Removal Engineer

**Mission:** Remove hardcoded demographic bias, create generic keyword system

#### Responsibilities

1. **Create Policy Domain Keyword Lists**

```typescript
const POLICY_DOMAIN_KEYWORDS: Record<string, string[]> = {
  'Healthcare': [
    'medicare', 'medicaid', 'aca', 'affordable care act', 'obamacare',
    'health insurance', 'prescription drugs', 'drug prices', 'hospital',
    'public option', 'single payer', 'universal healthcare', 'mental health',
    'abortion', 'reproductive health', 'roe v wade', 'planned parenthood',
    'nursing home', 'long term care', 'health care costs', 'uninsured',
  ],
  'Environment': [
    'climate change', 'global warming', 'renewable energy', 'solar', 'wind',
    'fossil fuels', 'oil', 'gas', 'pipeline', 'carbon emissions', 'epa',
    'green new deal', 'paris agreement', 'environmental justice', 'pollution',
    'clean energy', 'electric vehicle', 'conservation', 'endangered species',
  ],
  'Labor & Workers Rights': [
    'union', 'strike', 'labor', 'workers', 'minimum wage', 'wage theft',
    'collective bargaining', 'nlrb', 'right to work', 'gig economy',
    'amazon union', 'starbucks union', 'teacher strike', 'uaw',
    'paid leave', 'sick leave', 'overtime', 'workplace safety', 'osha',
  ],
  'Immigration': [
    'immigration', 'border', 'migrants', 'refugees', 'asylum', 'daca',
    'dreamers', 'ice', 'deportation', 'sanctuary city', 'visa',
    'green card', 'citizenship', 'undocumented', 'border wall',
    'immigration reform', 'path to citizenship', 'family separation',
  ],
  'Civil Rights': [
    'civil rights', 'discrimination', 'equality', 'racial justice',
    'lgbtq', 'transgender', 'gay rights', 'same sex marriage',
    'hate crime', 'affirmative action', 'dei', 'title ix',
    'police reform', 'racial profiling', 'stop and frisk',
  ],
  'Criminal Justice': [
    'prison reform', 'mass incarceration', 'bail reform', 'police',
    'defund police', 'qualified immunity', 'death penalty', 'sentencing',
    'parole', 'probation', 'juvenile justice', 'wrongful conviction',
    'private prison', 'solitary confinement', 'reentry', 'clemency',
  ],
  'Voting Rights': [
    'voting rights', 'voter suppression', 'gerrymandering', 'redistricting',
    'election', 'ballot', 'mail-in voting', 'voter id', 'election integrity',
    'poll workers', 'early voting', 'voter registration', 'electoral college',
    'voting access', 'election security', 'campaign finance',
  ],
  'Education': [
    'education', 'schools', 'teachers', 'students', 'college', 'university',
    'student loans', 'student debt', 'charter schools', 'school choice',
    'curriculum', 'school board', 'title i', 'pell grant', 'k-12',
    'higher education', 'community college', 'vocational training',
  ],
  'Housing': [
    'housing', 'rent', 'affordable housing', 'homelessness', 'eviction',
    'mortgage', 'section 8', 'public housing', 'zoning', 'nimby', 'yimby',
    'housing crisis', 'rent control', 'tenant rights', 'fair housing',
    'foreclosure', 'housing voucher', 'shelter', 'housing first',
  ],
  'Economic Justice': [
    'economy', 'inflation', 'recession', 'jobs', 'unemployment',
    'inequality', 'wealth gap', 'billionaire', 'tax', 'corporate tax',
    'minimum wage', 'living wage', 'poverty', 'food stamps', 'snap',
    'child tax credit', 'wealth tax', 'income inequality', 'unions',
  ],
  'Foreign Policy': [
    'foreign policy', 'diplomacy', 'sanctions', 'war', 'military',
    'ukraine', 'russia', 'china', 'israel', 'palestine', 'gaza',
    'nato', 'un', 'trade', 'tariffs', 'treaty', 'embassy',
    'arms deal', 'nuclear', 'terrorism', 'state department',
  ],
  'Technology': [
    'tech', 'ai', 'artificial intelligence', 'social media', 'privacy',
    'data', 'surveillance', 'encryption', 'section 230', 'antitrust',
    'big tech', 'facebook', 'google', 'amazon', 'apple', 'tiktok',
    'cybersecurity', 'net neutrality', 'broadband', 'digital divide',
  ],
};
```

2. **Create Generic Threat Indicators (Not Demographic-Specific)**

```typescript
const GENERIC_THREAT_INDICATORS = {
  legal_threats: [
    'lawsuit', 'indictment', 'charges filed', 'investigation',
    'subpoena', 'court ruling', 'injunction', 'restraining order',
    'grand jury', 'arraignment', 'plea deal', 'settlement',
  ],
  regulatory_threats: [
    'revoked', 'suspended', 'audit', 'violation', 'fine', 'penalty',
    'banned', 'prohibited', 'restricted', 'sanctioned', 'compliance',
  ],
  reputational_threats: [
    'scandal', 'controversy', 'accused', 'alleged', 'exposed',
    'leaked', 'whistleblower', 'misconduct', 'ethics violation',
  ],
  funding_threats: [
    'funding cut', 'defunded', 'grant denied', 'donor withdrawal',
    'budget cut', 'financial trouble', 'bankruptcy', 'layoffs',
  ],
  political_threats: [
    'opposition', 'attacked', 'criticized', 'condemned', 'targeted',
    'under fire', 'backlash', 'protest against', 'boycott',
  ],
};
```

3. **Update Bluesky Stream for Broad Collection**

```typescript
// File: /supabase/functions/bluesky-stream/index.ts

// OLD: Hardcoded keywords (140, biased)
// NEW: Broad collection using all policy domain keywords

async function shouldCollectPost(post: BlueskyPost): Promise<boolean> {
  const text = post.text.toLowerCase();

  // Collect if matches ANY policy domain keyword
  for (const [domain, keywords] of Object.entries(POLICY_DOMAIN_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return true;
    }
  }

  // Also collect if mentions tracked entities (aggregated across all orgs)
  const globalWatchlistEntities = await getGlobalWatchlistEntities();
  if (globalWatchlistEntities.some(entity =>
    text.includes(entity.toLowerCase())
  )) {
    return true;
  }

  return false;
}

// Cache global watchlist entities (refresh every 5 min)
let cachedGlobalEntities: string[] = [];
let cacheTime = 0;

async function getGlobalWatchlistEntities(): Promise<string[]> {
  if (Date.now() - cacheTime < 5 * 60 * 1000) {
    return cachedGlobalEntities;
  }

  const { data } = await supabase
    .from('entity_watchlist')
    .select('entity_name')
    .eq('is_active', true);

  cachedGlobalEntities = [...new Set(data?.map(d => d.entity_name) || [])];
  cacheTime = Date.now();
  return cachedGlobalEntities;
}
```

#### Deliverables
- [ ] Policy domain keyword lists (500+ keywords across 12 domains)
- [ ] Generic threat indicator system
- [ ] Updated Bluesky stream function (broad collection)
- [ ] Audit report documenting removed bias

---

### Agent 3: Trend Tagging Engineer

**Mission:** Tag every detected trend with policy domains, entities, and geographies

#### Responsibilities

1. **Add Tagging Fields to Trend Events**

```sql
-- Migration to enhance trend_events table
ALTER TABLE trend_events
ADD COLUMN policy_domains TEXT[] DEFAULT '{}',
ADD COLUMN geographies TEXT[] DEFAULT '{}',
ADD COLUMN geo_level TEXT DEFAULT 'national',
ADD COLUMN politicians_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN organizations_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN legislation_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN evidence_by_domain JSONB DEFAULT '{}';

-- Indexes for filtering
CREATE INDEX idx_trend_events_domains ON trend_events USING GIN(policy_domains);
CREATE INDEX idx_trend_events_geos ON trend_events USING GIN(geographies);
CREATE INDEX idx_trend_events_politicians ON trend_events USING GIN(politicians_mentioned);
```

2. **Policy Domain Classification Function**

```typescript
// File: /supabase/functions/tag-trend-policy-domains/index.ts

async function classifyTrendPolicyDomains(trend: TrendEvent): Promise<string[]> {
  const domains = new Set<string>();

  // Method 1: From source policy domains (most reliable)
  for (const evidence of trend.evidence || []) {
    const source = await getSource(evidence.source_id);
    if (source?.policy_domains) {
      source.policy_domains.forEach(d => domains.add(d));
    }
  }

  // Method 2: From keyword matching
  const trendText = `${trend.event_title} ${trend.top_headline || ''} ${(trend.context_terms || []).join(' ')}`.toLowerCase();

  for (const [domain, keywords] of Object.entries(POLICY_DOMAIN_KEYWORDS)) {
    const matchCount = keywords.filter(kw => trendText.includes(kw)).length;
    if (matchCount >= 2) {  // Require 2+ keyword matches for confidence
      domains.add(domain);
    }
  }

  // Method 3: AI classification (for ambiguous cases)
  if (domains.size === 0) {
    const aiDomains = await classifyWithAI(trend);
    aiDomains.forEach(d => domains.add(d));
  }

  return Array.from(domains);
}

async function classifyWithAI(trend: TrendEvent): Promise<string[]> {
  const response = await analyzeWithGemini({
    content: `${trend.event_title}\n${trend.top_headline}`,
    prompt: `Classify this political news into one or more policy domains from this list:
      ${Object.keys(POLICY_DOMAIN_KEYWORDS).join(', ')}

      Return only the domain names as a JSON array, e.g., ["Healthcare", "Economic Justice"]
      If none match, return ["Other"]`
  });

  return JSON.parse(response);
}
```

3. **Geographic Detection Function**

```typescript
// File: /supabase/functions/tag-trend-geographies/index.ts

const STATE_PATTERNS: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
};

const INTERNATIONAL_COUNTRIES = [
  'ukraine', 'russia', 'china', 'israel', 'palestine', 'gaza', 'iran',
  'north korea', 'taiwan', 'mexico', 'canada', 'united kingdom', 'france',
  'germany', 'japan', 'india', 'brazil', 'saudi arabia', 'syria', 'afghanistan',
];

async function detectTrendGeographies(trend: TrendEvent): Promise<{
  geographies: string[];
  geo_level: string;
}> {
  const geos = new Set<string>();
  let geo_level = 'national';

  const trendText = `${trend.event_title} ${(trend.context_terms || []).join(' ')}`.toLowerCase();

  // State detection
  for (const [stateName, abbrev] of Object.entries(STATE_PATTERNS)) {
    if (trendText.includes(stateName) || trendText.includes(abbrev.toLowerCase())) {
      geos.add(abbrev);
      geo_level = 'state';
    }
  }

  // International detection
  for (const country of INTERNATIONAL_COUNTRIES) {
    if (trendText.includes(country)) {
      geos.add('international');
      geo_level = 'international';
    }
  }

  // City detection (major cities)
  const MAJOR_CITIES: Record<string, string> = {
    'new york city': 'NY', 'nyc': 'NY', 'los angeles': 'CA', 'chicago': 'IL',
    'houston': 'TX', 'phoenix': 'AZ', 'philadelphia': 'PA', 'san antonio': 'TX',
    'san diego': 'CA', 'dallas': 'TX', 'san jose': 'CA', 'austin': 'TX',
    'san francisco': 'CA', 'seattle': 'WA', 'denver': 'CO', 'boston': 'MA',
    'detroit': 'MI', 'atlanta': 'GA', 'miami': 'FL', 'minneapolis': 'MN',
  };

  for (const [city, state] of Object.entries(MAJOR_CITIES)) {
    if (trendText.includes(city)) {
      geos.add(state);
      geo_level = 'local';
    }
  }

  // Default to national if no specific geography
  if (geos.size === 0) {
    geos.add('US');
    geo_level = 'national';
  }

  return { geographies: Array.from(geos), geo_level };
}
```

4. **Entity Extraction Enhancement**

```typescript
// File: /supabase/functions/extract-trend-entities/index.ts

async function extractTrendEntities(trend: TrendEvent): Promise<{
  politicians: string[];
  organizations: string[];
  legislation: string[];
}> {
  // Load political knowledge base
  const { data: politicians } = await supabase
    .from('political_entities')
    .select('canonical_name, aliases')
    .eq('entity_type', 'politician')
    .eq('active', true);

  const { data: organizations } = await supabase
    .from('political_entities')
    .select('canonical_name, aliases')
    .eq('entity_type', 'organization')
    .eq('active', true);

  const { data: legislation } = await supabase
    .from('political_entities')
    .select('canonical_name, aliases')
    .eq('entity_type', 'legislation')
    .eq('active', true);

  const trendText = `${trend.event_title} ${trend.top_headline || ''}`.toLowerCase();

  const matchedPoliticians = (politicians || [])
    .filter(p => {
      const names = [p.canonical_name, ...(p.aliases || [])].map(n => n.toLowerCase());
      return names.some(n => trendText.includes(n));
    })
    .map(p => p.canonical_name);

  const matchedOrganizations = (organizations || [])
    .filter(o => {
      const names = [o.canonical_name, ...(o.aliases || [])].map(n => n.toLowerCase());
      return names.some(n => trendText.includes(n));
    })
    .map(o => o.canonical_name);

  const matchedLegislation = (legislation || [])
    .filter(l => {
      const names = [l.canonical_name, ...(l.aliases || [])].map(n => n.toLowerCase());
      return names.some(n => trendText.includes(n));
    })
    .map(l => l.canonical_name);

  return {
    politicians: matchedPoliticians,
    organizations: matchedOrganizations,
    legislation: matchedLegislation,
  };
}
```

#### Deliverables
- [ ] Policy domain classification for trends
- [ ] Geographic detection system
- [ ] Enhanced entity extraction with political knowledge base
- [ ] Migration to add new fields to `trend_events` table

---

### Agent 4: Per-Org Filtering Engine (with Anti-Filter-Bubble)

**Mission:** Build the per-org filtering layer with 70/30 split and exploration bonuses

#### Core Principle: 70/30 Split

```
Final Relevance Score = Profile Match (70%) + Learned Affinity (30%)

Profile Match (70%):
  - Policy Domain Match: 35 pts (from onboarding)
  - Focus Areas Match: 20 pts (from onboarding)
  - Watchlist Entity Match: 15 pts (from onboarding)

Learned + Exploration (30%):
  - Learned Affinity: 20 pts (from campaign history, CAPPED)
  - Exploration Bonus: 10 pts (declared but UNTRIED domains)
```

#### Responsibilities

1. **Profile-First Relevance Scoring (V3)**

```typescript
// File: /supabase/functions/_shared/orgRelevanceV3.ts

interface RelevanceResult {
  score: number;
  reasons: string[];
  flags: string[];  // 'NEW_OPPORTUNITY', 'PROVEN_TOPIC', 'BREAKING', 'WATCHLIST_MATCH'
  isNewOpportunity: boolean;
  isProvenTopic: boolean;
  matchedDomains: string[];
  matchedWatchlist: string[];
  priorityBucket: 'high' | 'medium' | 'low';
}

export function calculateOrgRelevanceV3(
  trend: EnhancedTrendEvent,
  profile: OrgProfile,
  watchlist: WatchlistEntity[],
  affinities: OrgTopicAffinity[]
): RelevanceResult {
  let score = 0;
  const reasons: string[] = [];
  const flags: string[] = [];
  const matchedDomains: string[] = [];
  const matchedWatchlist: string[] = [];

  // ============================================================
  // SECTION 1: PROFILE-BASED SCORING (70% weight = 70 pts max)
  // These come from ONBOARDING - what client SAYS they care about
  // ============================================================

  // 1A. Policy Domain Match (0-35 pts) - PRIMARY FILTER
  const declaredDomains = profile.policy_domains || profile.interest_topics || [];
  const trendDomains = trend.policy_domains || [];
  const domainOverlap = trendDomains.filter(d =>
    declaredDomains.some(dd => dd.toLowerCase() === d.toLowerCase())
  );

  if (domainOverlap.length > 0) {
    const domainScore = Math.min(domainOverlap.length * 12, 35);
    score += domainScore;
    reasons.push(`Policy domain: ${domainOverlap.join(', ')} (+${domainScore})`);
    matchedDomains.push(...domainOverlap);
  }

  // 1B. Focus Areas Match (0-20 pts) - FROM AI-EXTRACTED OR MANUAL
  const focusAreas = profile.focus_areas || [];
  const trendText = `${trend.event_title} ${(trend.context_terms || []).join(' ')}`.toLowerCase();

  const focusMatches = focusAreas.filter(fa =>
    trendText.includes(fa.toLowerCase())
  );

  if (focusMatches.length > 0) {
    const focusScore = Math.min(focusMatches.length * 10, 20);
    score += focusScore;
    reasons.push(`Focus area: ${focusMatches.slice(0, 3).join(', ')} (+${focusScore})`);
  }

  // 1C. Watchlist Entity Match (0-15 pts) - EXPLICIT TRACKING
  const watchlistNames = watchlist.map(w => w.entity_name.toLowerCase());
  const trendEntities = [
    ...(trend.politicians_mentioned || []),
    ...(trend.organizations_mentioned || []),
    ...(trend.context_terms || []),
  ].map(e => e.toLowerCase());

  const watchlistMatches = watchlistNames.filter(w =>
    trendEntities.some(e => e.includes(w) || w.includes(e))
  );

  if (watchlistMatches.length > 0) {
    const watchlistScore = Math.min(watchlistMatches.length * 8, 15);
    score += watchlistScore;
    reasons.push(`Watchlist: ${watchlistMatches.join(', ')} (+${watchlistScore})`);
    matchedWatchlist.push(...watchlistMatches);
    flags.push('WATCHLIST_MATCH');
  }

  // ============================================================
  // SECTION 2: LEARNED AFFINITY (20% weight = 20 pts max, CAPPED)
  // This comes from CAMPAIGN HISTORY - what client has DONE
  // ============================================================

  const relevantAffinities = affinities.filter(a =>
    trendDomains.some(td => td.toLowerCase() === a.topic.toLowerCase()) ||
    (trend.context_terms || []).some(t =>
      t.toLowerCase().includes(a.topic.toLowerCase())
    )
  );

  if (relevantAffinities.length > 0) {
    // Use AVERAGE affinity, not MAX - prevents single topic domination
    const avgAffinity = relevantAffinities.reduce((sum, a) => sum + a.affinity_score, 0)
                        / relevantAffinities.length;

    // Cap at 20 points - learned behavior should NEVER dominate
    const affinityScore = Math.min(Math.round(avgAffinity * 25), 20);
    score += affinityScore;
    reasons.push(`Proven topic: past campaigns succeeded (+${affinityScore})`);
    flags.push('PROVEN_TOPIC');
  }

  // ============================================================
  // SECTION 3: EXPLORATION BONUS (10% weight = 10 pts max)
  // Boost topics client DECLARED but HASN'T ACTED ON yet
  // ============================================================

  // Find topics client has tried (used in 2+ campaigns)
  const triedTopics = affinities
    .filter(a => a.times_used >= 2)
    .map(a => a.topic.toLowerCase());

  // Check if trend matches a declared domain that hasn't been tried
  const isNewOpportunity = domainOverlap.some(domain =>
    !triedTopics.includes(domain.toLowerCase())
  );

  if (isNewOpportunity && domainOverlap.length > 0) {
    score += 10;
    reasons.push(`New opportunity: matches declared interest but untried (+10)`);
    flags.push('NEW_OPPORTUNITY');
  }

  // ============================================================
  // SECTION 4: MODIFIERS (situational adjustments)
  // ============================================================

  // 4A. Geographic Relevance (+5 pts)
  if (profile.geographies && profile.geographies.length > 0) {
    const trendGeos = trend.geographies || [];
    const geoMatch = profile.geographies.some(og => trendGeos.includes(og)) ||
                     (trendGeos.includes('US') && profile.sensitivity_redlines?.geo_level === 'national');

    if (geoMatch) {
      score += 5;
      reasons.push(`Geographic match (+5)`);
    }
  }

  // 4B. Breaking News Boost (+5 pts, only if somewhat relevant)
  if (trend.is_breaking && score >= 20) {
    score += 5;
    reasons.push(`Breaking news (+5)`);
    flags.push('BREAKING');
  }

  // ============================================================
  // FINAL RESULT
  // ============================================================

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    score: finalScore,
    reasons,
    flags,
    isNewOpportunity: flags.includes('NEW_OPPORTUNITY'),
    isProvenTopic: flags.includes('PROVEN_TOPIC'),
    matchedDomains,
    matchedWatchlist,
    priorityBucket: finalScore >= 55 ? 'high' : finalScore >= 30 ? 'medium' : 'low',
  };
}
```

2. **Diversity Requirement Function**

```typescript
// File: /supabase/functions/_shared/trendDiversity.ts

/**
 * Ensure daily recommendations include variety across declared domains
 * Prevents filter bubble by guaranteeing representation
 */
export function ensureDomainDiversity(
  trends: OrgTrend[],
  profile: OrgProfile,
  maxTrends: number = 15
): OrgTrend[] {
  const declaredDomains = profile.policy_domains || profile.interest_topics || [];

  if (declaredDomains.length === 0) {
    // No declared domains - just return top scoring
    return trends.slice(0, maxTrends);
  }

  const selectedTrends: OrgTrend[] = [];
  const usedTrendIds = new Set<string>();

  // Phase 1: Ensure at least 1 trend from each declared domain (if available)
  for (const domain of declaredDomains) {
    const domainTrend = trends.find(t =>
      !usedTrendIds.has(t.id) &&
      t.matchedDomains?.some(d => d.toLowerCase() === domain.toLowerCase())
    );

    if (domainTrend) {
      selectedTrends.push(domainTrend);
      usedTrendIds.add(domainTrend.id);
    }
  }

  // Phase 2: Prioritize NEW_OPPORTUNITY trends (exploration)
  const newOpportunities = trends.filter(t =>
    !usedTrendIds.has(t.id) && t.isNewOpportunity
  );

  for (const trend of newOpportunities) {
    if (selectedTrends.length >= maxTrends) break;
    selectedTrends.push(trend);
    usedTrendIds.add(trend.id);
  }

  // Phase 3: Fill remaining with highest scoring
  const remaining = trends
    .filter(t => !usedTrendIds.has(t.id))
    .sort((a, b) => b.org_relevance_score - a.org_relevance_score);

  for (const trend of remaining) {
    if (selectedTrends.length >= maxTrends) break;
    selectedTrends.push(trend);
    usedTrendIds.add(trend.id);
  }

  // Sort final list by score
  return selectedTrends.sort((a, b) => b.org_relevance_score - a.org_relevance_score);
}
```

3. **Main Trend Fetching Function**

```typescript
// File: /supabase/functions/get-trends-for-org/index.ts

import { calculateOrgRelevanceV3 } from '../_shared/orgRelevanceV3';
import { ensureDomainDiversity } from '../_shared/trendDiversity';

interface GetTrendsOptions {
  limit?: number;
  minRelevance?: number;
  includeFilterLog?: boolean;
}

export async function getTrendsForOrganization(
  orgId: string,
  options: GetTrendsOptions = {}
): Promise<OrgTrend[]> {
  const { limit = 20, minRelevance = 25, includeFilterLog = false } = options;

  // 1. Get org profile data
  const [profile, watchlist, affinities] = await Promise.all([
    getOrgProfile(orgId),
    getOrgWatchlist(orgId),
    getOrgTopicAffinities(orgId),
  ]);

  if (!profile) {
    throw new Error(`Organization profile not found: ${orgId}`);
  }

  // 2. Get all recent trends (last 24-48h)
  const allTrends = await getRecentTrends({ hours: 48 });

  // 3. Score each trend for this org
  const scoredTrends = allTrends.map(trend => {
    const relevance = calculateOrgRelevanceV3(trend, profile, watchlist, affinities);
    return {
      ...trend,
      org_relevance_score: relevance.score,
      org_relevance_reasons: relevance.reasons,
      org_relevance_flags: relevance.flags,
      isNewOpportunity: relevance.isNewOpportunity,
      isProvenTopic: relevance.isProvenTopic,
      matchedDomains: relevance.matchedDomains,
      matchedWatchlist: relevance.matchedWatchlist,
      priorityBucket: relevance.priorityBucket,
    };
  });

  // 4. Filter by minimum relevance
  const relevantTrends = scoredTrends.filter(t => t.org_relevance_score >= minRelevance);
  const filteredOut = scoredTrends.filter(t => t.org_relevance_score < minRelevance);

  // 5. Apply diversity requirement
  const diverseTrends = ensureDomainDiversity(relevantTrends, profile, limit);

  // 6. Log filtered trends (for debugging filter bubbles)
  if (includeFilterLog && filteredOut.length > 0) {
    await logFilteredTrends(orgId, diverseTrends, filteredOut);
  }

  return diverseTrends;
}

async function logFilteredTrends(
  orgId: string,
  shown: OrgTrend[],
  filtered: OrgTrend[]
): Promise<void> {
  const logs = filtered.slice(0, 50).map(trend => ({
    organization_id: orgId,
    trend_event_id: trend.id,
    relevance_score: trend.org_relevance_score,
    filter_reason: trend.org_relevance_score < 25 ? 'below_threshold' : 'lower_priority',
    matched_domains: trend.matchedDomains,
    was_new_opportunity: trend.isNewOpportunity,
    logged_at: new Date().toISOString(),
  }));

  await supabase.from('trend_filter_log').insert(logs);
}
```

4. **Relevance Cache for Performance**

```sql
-- Pre-computed relevance scores for fast lookups
CREATE TABLE org_trend_relevance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  trend_event_id UUID REFERENCES trend_events(id) ON DELETE CASCADE,
  relevance_score INTEGER NOT NULL,
  relevance_reasons JSONB DEFAULT '[]',
  relevance_flags TEXT[] DEFAULT '{}',
  is_new_opportunity BOOLEAN DEFAULT false,
  is_proven_topic BOOLEAN DEFAULT false,
  matched_domains TEXT[] DEFAULT '{}',
  matched_watchlist TEXT[] DEFAULT '{}',
  priority_bucket TEXT DEFAULT 'low',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, trend_event_id)
);

CREATE INDEX idx_org_trend_cache_lookup
ON org_trend_relevance_cache(organization_id, relevance_score DESC);

CREATE INDEX idx_org_trend_cache_new_opp
ON org_trend_relevance_cache(organization_id, is_new_opportunity)
WHERE is_new_opportunity = true;
```

#### Deliverables
- [ ] `calculateOrgRelevanceV3()` with 70/30 split
- [ ] `ensureDomainDiversity()` function
- [ ] `getTrendsForOrganization()` main API function
- [ ] Relevance caching system
- [ ] Filter logging for debugging

---

### Agent 5: Feedback Loop Engineer (with Safeguards)

**Mission:** Learn from campaign outcomes WITHOUT creating filter bubbles

#### Key Safeguards

1. **Affinity scores are CAPPED at 20% influence** (max 20 pts out of 100)
2. **Affinities DECAY over time** if not reinforced (prevents stale dominance)
3. **Affinity is AVERAGED** not MAX'd (prevents single topic domination)
4. **Exploration bonus INCREASES** for untried declared domains

#### Responsibilities

1. **Campaign Topic Extraction**

```typescript
// File: /supabase/functions/extract-campaign-topics/index.ts

interface CampaignTopicExtraction {
  campaign_id: string;
  campaign_type: 'sms' | 'meta_ad';
  organization_id: string;
  policy_domains: string[];
  topics: string[];
  entities: string[];
  emotional_appeals: string[];
  raw_content: string;
  extracted_at: string;
}

export async function extractCampaignTopics(
  campaign: Campaign
): Promise<CampaignTopicExtraction> {
  let content = '';

  if (campaign.type === 'sms') {
    content = campaign.sms_copy || '';
  } else if (campaign.type === 'meta_ad') {
    content = [
      campaign.ad_headline,
      campaign.ad_body,
      campaign.video_transcript,
    ].filter(Boolean).join(' ');
  }

  // Use AI to extract topics
  const extraction = await analyzeWithGemini({
    content,
    prompt: `Analyze this political campaign content and extract:

      1. policy_domains: Which of these domains does it address?
         ${Object.keys(POLICY_DOMAIN_KEYWORDS).join(', ')}

      2. topics: Specific issues or topics mentioned (e.g., "Medicare expansion", "climate bill")

      3. entities: Politicians, organizations, or legislation mentioned by name

      4. emotional_appeals: What emotional triggers are used?
         (urgency, fear, hope, anger, solidarity, etc.)

      Return as JSON: { policy_domains: [], topics: [], entities: [], emotional_appeals: [] }`
  });

  const parsed = JSON.parse(extraction);

  return {
    campaign_id: campaign.id,
    campaign_type: campaign.type,
    organization_id: campaign.organization_id,
    policy_domains: parsed.policy_domains || [],
    topics: parsed.topics || [],
    entities: parsed.entities || [],
    emotional_appeals: parsed.emotional_appeals || [],
    raw_content: content.substring(0, 1000),
    extracted_at: new Date().toISOString(),
  };
}
```

2. **Trend-Campaign Correlation**

```typescript
// File: /supabase/functions/correlate-trends-campaigns/index.ts

interface TrendCampaignCorrelation {
  trend_event_id: string;
  campaign_id: string;
  organization_id: string;
  correlation_score: number;
  domain_overlap: string[];
  topic_overlap: string[];
  time_delta_hours: number;
  campaign_performance: CampaignPerformance;
  performance_vs_baseline: number;
  outcome_label: 'high_performer' | 'performer' | 'neutral' | 'underperformer';
}

export async function correlateTrendsWithCampaign(
  campaign: Campaign,
  performance: CampaignPerformance
): Promise<TrendCampaignCorrelation[]> {
  // Get campaign topics
  const campaignTopics = await getCampaignTopics(campaign.id);
  if (!campaignTopics) {
    // Extract if not already done
    const extracted = await extractCampaignTopics(campaign);
    await saveCampaignTopics(extracted);
  }

  const topics = campaignTopics || await getCampaignTopics(campaign.id);

  // Find trends that were active 0-48h before campaign sent
  const activeTrends = await supabase
    .from('trend_events')
    .select('*')
    .lte('first_seen_at', campaign.sent_at)
    .gte('last_seen_at', new Date(new Date(campaign.sent_at).getTime() - 48 * 60 * 60 * 1000).toISOString())
    .order('confidence_score', { ascending: false })
    .limit(100);

  // Score correlation between campaign topics and each trend
  const correlations: TrendCampaignCorrelation[] = [];

  for (const trend of activeTrends.data || []) {
    const domainOverlap = (trend.policy_domains || []).filter(d =>
      topics.policy_domains.includes(d)
    );

    const topicOverlap = (trend.context_terms || []).filter(t =>
      topics.topics.some(ct =>
        t.toLowerCase().includes(ct.toLowerCase()) ||
        ct.toLowerCase().includes(t.toLowerCase())
      )
    );

    // Only create correlation if there's meaningful overlap
    if (domainOverlap.length === 0 && topicOverlap.length === 0) {
      continue;
    }

    const correlationScore = (
      domainOverlap.length * 0.4 +
      topicOverlap.length * 0.3 +
      (trend.is_breaking ? 0.2 : 0) +
      (performance.performance_vs_baseline > 0 ? 0.1 : 0)
    );

    const timeDelta = Math.round(
      (new Date(campaign.sent_at).getTime() - new Date(trend.first_seen_at).getTime())
      / (1000 * 60 * 60)
    );

    correlations.push({
      trend_event_id: trend.id,
      campaign_id: campaign.id,
      organization_id: campaign.organization_id,
      correlation_score: Math.min(correlationScore, 1),
      domain_overlap: domainOverlap,
      topic_overlap: topicOverlap,
      time_delta_hours: timeDelta,
      campaign_performance: performance,
      performance_vs_baseline: performance.performance_vs_baseline,
      outcome_label:
        performance.performance_vs_baseline > 30 ? 'high_performer' :
        performance.performance_vs_baseline > 0 ? 'performer' :
        performance.performance_vs_baseline > -20 ? 'neutral' : 'underperformer',
    });
  }

  return correlations.filter(c => c.correlation_score > 0.2);
}
```

3. **Update Org Topic Affinities (with Safeguards)**

```typescript
// File: /supabase/functions/update-org-affinities/index.ts

interface OrgTopicAffinity {
  organization_id: string;
  topic: string;
  affinity_score: number;      // 0-1, used for scoring (but capped at 20% influence)
  times_used: number;          // Number of campaigns using this topic
  avg_performance: number;     // Average performance delta
  best_performance: number;    // Best performance achieved
  last_used_at: string;
  source: 'learned_outcome' | 'self_declared' | 'admin_override';
}

export async function updateOrgTopicAffinities(
  orgId: string,
  correlations: TrendCampaignCorrelation[]
): Promise<void> {
  for (const correlation of correlations) {
    const trend = await getTrend(correlation.trend_event_id);
    if (!trend) continue;

    // Update affinity for each policy domain in the correlated trend
    for (const domain of trend.policy_domains || []) {
      await updateSingleAffinity(
        orgId,
        domain,
        correlation.campaign_performance,
        correlation.outcome_label
      );
    }

    // Also update affinity for matched specific topics
    for (const topic of correlation.topic_overlap || []) {
      await updateSingleAffinity(
        orgId,
        topic,
        correlation.campaign_performance,
        correlation.outcome_label
      );
    }
  }
}

async function updateSingleAffinity(
  orgId: string,
  topic: string,
  performance: CampaignPerformance,
  outcomeLabel: string
): Promise<void> {
  // Get existing affinity
  const { data: existing } = await supabase
    .from('org_topic_affinities')
    .select('*')
    .eq('organization_id', orgId)
    .eq('topic', topic)
    .single();

  const currentScore = existing?.affinity_score || 0.5;  // Start neutral
  const currentCount = existing?.times_used || 0;
  const currentAvgPerf = existing?.avg_performance || 0;
  const currentBestPerf = existing?.best_performance || -100;

  // Exponential moving average for affinity score
  // Alpha = 0.3 means new data has 30% influence, history has 70%
  const alpha = 0.3;

  // Convert performance delta to 0-1 signal
  // +50% performance → 1.0, 0% → 0.5, -50% → 0.0
  const performanceSignal = Math.max(0, Math.min(1,
    0.5 + (performance.performance_vs_baseline / 100)
  ));

  const newScore = currentScore * (1 - alpha) + performanceSignal * alpha;

  // Clamp to reasonable bounds
  const clampedScore = Math.max(0.2, Math.min(0.95, newScore));

  // Update
  await supabase
    .from('org_topic_affinities')
    .upsert({
      organization_id: orgId,
      topic: topic,
      affinity_score: clampedScore,
      times_used: currentCount + 1,
      avg_performance: ((currentAvgPerf * currentCount) + performance.performance_vs_baseline) / (currentCount + 1),
      best_performance: Math.max(currentBestPerf, performance.performance_vs_baseline),
      last_used_at: new Date().toISOString(),
      source: 'learned_outcome',
    }, {
      onConflict: 'organization_id,topic',
    });
}
```

4. **Affinity Decay Function (Critical Anti-Filter-Bubble)**

```typescript
// File: /supabase/functions/decay-stale-affinities/index.ts

/**
 * Decay affinities that haven't been reinforced recently
 * This prevents old successes from dominating forever
 *
 * Run weekly via scheduled job
 */
export async function decayStaleAffinities(): Promise<{
  decayed: number;
  total: number;
}> {
  const DECAY_RATE = 0.95;           // Lose 5% per week
  const MIN_SCORE = 0.3;             // Never decay below this
  const STALE_THRESHOLD_DAYS = 30;   // Consider stale after 30 days

  const staleDate = new Date(Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  // Find all affinities that haven't been used recently
  const { data: staleAffinities, count } = await supabase
    .from('org_topic_affinities')
    .select('*', { count: 'exact' })
    .lt('last_used_at', staleDate.toISOString())
    .gt('affinity_score', MIN_SCORE)
    .eq('source', 'learned_outcome');  // Only decay learned, not self-declared

  let decayedCount = 0;

  for (const affinity of staleAffinities || []) {
    const newScore = Math.max(MIN_SCORE, affinity.affinity_score * DECAY_RATE);

    await supabase
      .from('org_topic_affinities')
      .update({
        affinity_score: newScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', affinity.id);

    decayedCount++;
  }

  // Log decay run
  await supabase.from('job_executions').insert({
    job_name: 'decay_stale_affinities',
    status: 'success',
    records_processed: decayedCount,
    metadata: {
      decay_rate: DECAY_RATE,
      min_score: MIN_SCORE,
      stale_threshold_days: STALE_THRESHOLD_DAYS,
      total_checked: count,
    },
  });

  return { decayed: decayedCount, total: count || 0 };
}
```

5. **Daily Learning Pipeline**

```typescript
// File: /supabase/functions/run-learning-pipeline/index.ts

/**
 * Daily job to process campaign outcomes and update affinities
 * Run at 6 AM daily
 */
export async function runLearningPipeline(): Promise<{
  campaignsProcessed: number;
  correlationsCreated: number;
  affinitiesUpdated: number;
}> {
  const stats = {
    campaignsProcessed: 0,
    correlationsCreated: 0,
    affinitiesUpdated: 0,
  };

  // 1. Get campaigns from last 48h with performance data
  const { data: recentCampaigns } = await supabase
    .from('campaigns_with_performance')  // View joining campaigns + performance
    .select('*')
    .gte('sent_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .not('performance_vs_baseline', 'is', null)
    .is('learning_processed', null);  // Not yet processed

  for (const campaign of recentCampaigns || []) {
    try {
      // 2. Extract topics from campaign (if not already done)
      let topics = await getCampaignTopics(campaign.id);
      if (!topics) {
        topics = await extractCampaignTopics(campaign);
        await saveCampaignTopics(topics);
      }

      // 3. Correlate with active trends
      const correlations = await correlateTrendsWithCampaign(campaign, campaign.performance);
      await saveCorrelations(correlations);
      stats.correlationsCreated += correlations.length;

      // 4. Update org topic affinities
      await updateOrgTopicAffinities(campaign.organization_id, correlations);
      stats.affinitiesUpdated += correlations.length;

      // 5. Mark campaign as processed
      await supabase
        .from('campaigns')
        .update({ learning_processed: true, learning_processed_at: new Date().toISOString() })
        .eq('id', campaign.id);

      stats.campaignsProcessed++;
    } catch (error) {
      console.error(`Error processing campaign ${campaign.id}:`, error);
      // Continue with next campaign
    }
  }

  // 6. Log pipeline run
  await supabase.from('job_executions').insert({
    job_name: 'learning_pipeline',
    status: 'success',
    records_processed: stats.campaignsProcessed,
    metadata: stats,
  });

  return stats;
}
```

#### Deliverables
- [ ] Campaign topic extraction function
- [ ] Trend-campaign correlation system
- [ ] Org topic affinity updates with safeguards
- [ ] Affinity decay function (weekly job)
- [ ] Daily learning pipeline
- [ ] Learning dashboard for admins

---

## Database Schema Changes

```sql
-- ============================================================================
-- 1. RSS SOURCES - ADD POLICY DOMAINS
-- ============================================================================

ALTER TABLE rss_sources ADD COLUMN policy_domains TEXT[] DEFAULT '{}';
CREATE INDEX idx_rss_sources_domains ON rss_sources USING GIN(policy_domains);

-- ============================================================================
-- 2. TREND EVENTS - ADD TAGGING FIELDS
-- ============================================================================

ALTER TABLE trend_events
ADD COLUMN policy_domains TEXT[] DEFAULT '{}',
ADD COLUMN geographies TEXT[] DEFAULT '{}',
ADD COLUMN geo_level TEXT DEFAULT 'national',
ADD COLUMN politicians_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN organizations_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN legislation_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN evidence_by_domain JSONB DEFAULT '{}';

CREATE INDEX idx_trend_events_domains ON trend_events USING GIN(policy_domains);
CREATE INDEX idx_trend_events_geos ON trend_events USING GIN(geographies);

-- ============================================================================
-- 3. ORG TOPIC AFFINITIES (LEARNING WITH SAFEGUARDS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_topic_affinities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  affinity_score DECIMAL(4,3) NOT NULL DEFAULT 0.5,  -- 0-1 scale
  times_used INTEGER DEFAULT 0,
  avg_performance DECIMAL(6,2) DEFAULT 0,
  best_performance DECIMAL(6,2) DEFAULT -100,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'learned_outcome',  -- 'learned_outcome', 'self_declared', 'admin_override'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, topic)
);

CREATE INDEX idx_affinities_org ON org_topic_affinities(organization_id);
CREATE INDEX idx_affinities_score ON org_topic_affinities(organization_id, affinity_score DESC);
CREATE INDEX idx_affinities_stale ON org_topic_affinities(last_used_at, affinity_score)
  WHERE source = 'learned_outcome';

-- ============================================================================
-- 4. ORG TREND RELEVANCE CACHE
-- ============================================================================

CREATE TABLE org_trend_relevance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  trend_event_id UUID REFERENCES trend_events(id) ON DELETE CASCADE,
  relevance_score INTEGER NOT NULL,
  relevance_reasons JSONB DEFAULT '[]',
  relevance_flags TEXT[] DEFAULT '{}',
  is_new_opportunity BOOLEAN DEFAULT false,
  is_proven_topic BOOLEAN DEFAULT false,
  matched_domains TEXT[] DEFAULT '{}',
  matched_watchlist TEXT[] DEFAULT '{}',
  priority_bucket TEXT DEFAULT 'low',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, trend_event_id)
);

CREATE INDEX idx_org_trend_cache_lookup
  ON org_trend_relevance_cache(organization_id, relevance_score DESC);
CREATE INDEX idx_org_trend_cache_new_opp
  ON org_trend_relevance_cache(organization_id) WHERE is_new_opportunity = true;

-- ============================================================================
-- 5. CAMPAIGN TOPIC EXTRACTIONS
-- ============================================================================

CREATE TABLE campaign_topic_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  campaign_type TEXT NOT NULL,
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  policy_domains TEXT[] DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',
  entities TEXT[] DEFAULT '{}',
  emotional_appeals TEXT[] DEFAULT '{}',
  raw_content TEXT,
  extracted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_topics_org ON campaign_topic_extractions(organization_id);
CREATE INDEX idx_campaign_topics_campaign ON campaign_topic_extractions(campaign_id);

-- ============================================================================
-- 6. TREND-CAMPAIGN CORRELATIONS
-- ============================================================================

CREATE TABLE trend_campaign_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_event_id UUID REFERENCES trend_events(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL,
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  correlation_score DECIMAL(4,3) NOT NULL,
  domain_overlap TEXT[] DEFAULT '{}',
  topic_overlap TEXT[] DEFAULT '{}',
  time_delta_hours INTEGER,
  campaign_performance JSONB,
  performance_vs_baseline DECIMAL(6,2),
  outcome_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_correlations_trend ON trend_campaign_correlations(trend_event_id);
CREATE INDEX idx_correlations_org ON trend_campaign_correlations(organization_id);
CREATE INDEX idx_correlations_outcome ON trend_campaign_correlations(outcome_label);

-- ============================================================================
-- 7. TREND FILTER LOG (DEBUGGING FILTER BUBBLES)
-- ============================================================================

CREATE TABLE trend_filter_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  trend_event_id UUID REFERENCES trend_events(id) ON DELETE CASCADE,
  relevance_score INTEGER,
  filter_reason TEXT,
  matched_domains TEXT[] DEFAULT '{}',
  was_new_opportunity BOOLEAN DEFAULT false,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_filter_log_org ON trend_filter_log(organization_id, logged_at DESC);

-- Automatically clean up old logs (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_filter_logs() RETURNS void AS $$
BEGIN
  DELETE FROM trend_filter_log WHERE logged_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. POLITICAL ENTITIES KNOWLEDGE BASE
-- ============================================================================

CREATE TABLE political_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL,  -- 'politician', 'organization', 'legislation', 'agency'
  aliases TEXT[] DEFAULT '{}',
  party TEXT,
  state TEXT,
  office TEXT,
  policy_domains TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_political_entities_type ON political_entities(entity_type);
CREATE INDEX idx_political_entities_aliases ON political_entities USING GIN(aliases);

-- ============================================================================
-- 9. POLICY DOMAIN KEYWORDS REFERENCE
-- ============================================================================

CREATE TABLE policy_domain_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  keyword TEXT NOT NULL,
  weight DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, keyword)
);

CREATE INDEX idx_domain_keywords ON policy_domain_keywords(domain);
```

---

## New Supabase Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `tag-source-policy-domains` | Tag RSS sources with policy domains | One-time + new sources |
| `tag-trend-policy-domains` | Tag trends with policy domains | On trend detection |
| `tag-trend-geographies` | Detect and tag trend geographies | On trend detection |
| `extract-trend-entities` | Extract politicians/orgs from trends | On trend detection |
| `get-trends-for-org` | Fetch org-filtered trends with 70/30 scoring | API endpoint |
| `compute-org-relevance-v3` | Calculate relevance with anti-filter-bubble | On request / cache |
| `refresh-relevance-cache` | Pre-compute relevance for active orgs | Hourly |
| `extract-campaign-topics` | Extract topics from campaign content | On campaign creation |
| `correlate-trends-campaigns` | Link trends to campaign outcomes | Daily |
| `update-org-affinities` | Update learned topic affinities | Daily |
| `decay-stale-affinities` | Decay old affinities to prevent dominance | Weekly |
| `run-learning-pipeline` | Orchestrate daily learning jobs | Daily 6 AM |

---

## Scheduled Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `refresh-relevance-cache` | Hourly | Pre-compute org relevance scores |
| `correlate-trends-campaigns` | Daily 6 AM | Link campaigns to trends |
| `run-learning-pipeline` | Daily 6 AM | Process campaign outcomes |
| `decay-stale-affinities` | Weekly Sunday | Decay old learned affinities |
| `cleanup-filter-logs` | Daily | Remove filter logs > 30 days |

---

## Frontend UI Changes

### Trend Card Badges

```typescript
// File: /src/components/client/TrendCard.tsx

interface TrendCardProps {
  trend: OrgTrend;
}

export function TrendCard({ trend }: TrendCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        {/* Opportunity Badges */}
        <div className="flex flex-wrap gap-2 mb-2">
          {trend.isNewOpportunity && (
            <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">
              <Sparkles className="w-3 h-3 mr-1" />
              New Opportunity
            </Badge>
          )}
          {trend.isProvenTopic && (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
              <TrendingUp className="w-3 h-3 mr-1" />
              Proven Topic
            </Badge>
          )}
          {trend.org_relevance_flags?.includes('WATCHLIST_MATCH') && (
            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
              <Eye className="w-3 h-3 mr-1" />
              Watchlist
            </Badge>
          )}
          {trend.org_relevance_flags?.includes('BREAKING') && (
            <Badge variant="destructive">
              <Zap className="w-3 h-3 mr-1" />
              Breaking
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-lg leading-tight">
          {trend.canonical_label || trend.event_title}
        </h3>
      </CardHeader>

      <CardContent>
        {/* Relevance Score */}
        <div className="flex items-center gap-2 mb-3">
          <div className="text-sm font-medium">
            Relevance: {trend.org_relevance_score}%
          </div>
          <Badge variant="outline" className={
            trend.priorityBucket === 'high' ? 'border-green-500 text-green-600' :
            trend.priorityBucket === 'medium' ? 'border-yellow-500 text-yellow-600' :
            'border-gray-500 text-gray-600'
          }>
            {trend.priorityBucket}
          </Badge>
        </div>

        {/* Why You're Seeing This */}
        <Collapsible>
          <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Info className="w-3 h-3" />
            Why am I seeing this?
            <ChevronDown className="w-3 h-3" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 text-xs text-muted-foreground space-y-1">
            {trend.org_relevance_reasons?.map((reason, i) => (
              <div key={i} className="flex items-start gap-1">
                <span>•</span>
                <span>{reason}</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
```

### Domain Filter Chips

```typescript
// File: /src/components/client/TrendDomainFilters.tsx

interface TrendDomainFiltersProps {
  declaredDomains: string[];
  activeDomain: string | null;
  onDomainChange: (domain: string | null) => void;
  domainCounts: Record<string, number>;
}

export function TrendDomainFilters({
  declaredDomains,
  activeDomain,
  onDomainChange,
  domainCounts,
}: TrendDomainFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Button
        variant={activeDomain === null ? 'default' : 'outline'}
        size="sm"
        onClick={() => onDomainChange(null)}
      >
        All
      </Button>
      {declaredDomains.map(domain => (
        <Button
          key={domain}
          variant={activeDomain === domain ? 'default' : 'outline'}
          size="sm"
          onClick={() => onDomainChange(domain)}
          className="gap-1"
        >
          {domain}
          <Badge variant="secondary" className="ml-1 text-xs">
            {domainCounts[domain] || 0}
          </Badge>
        </Button>
      ))}
    </div>
  );
}
```

---

## Implementation Timeline

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           WEEK 1-2: DATA FOUNDATION                         │
├────────────────────────────────────────────────────────────────────────────┤
│  Agent 1: Tag all 240+ RSS sources with policy domains                     │
│  Agent 2: Create policy domain keyword lists (500+)                        │
│  Agent 2: Remove demographic bias from Bluesky keywords                    │
│  DATABASE: Run migrations for new tables                                   │
│  DELIVERABLE: All sources tagged, broad keyword system ready               │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           WEEK 2-3: TREND TAGGING                           │
├────────────────────────────────────────────────────────────────────────────┤
│  Agent 3: Policy domain detection for trends                               │
│  Agent 3: Geographic detection for trends                                  │
│  Agent 3: Entity extraction with political knowledge base                  │
│  DELIVERABLE: All trends tagged with domains, geos, entities               │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           WEEK 3-4: PER-ORG FILTERING                       │
├────────────────────────────────────────────────────────────────────────────┤
│  Agent 4: Implement calculateOrgRelevanceV3() with 70/30 split             │
│  Agent 4: Build ensureDomainDiversity() function                           │
│  Agent 4: Create getTrendsForOrganization() API                            │
│  Agent 4: Build relevance caching system                                   │
│  DELIVERABLE: Each org sees personalized trends                            │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           WEEK 4-5: FEEDBACK LOOP                           │
├────────────────────────────────────────────────────────────────────────────┤
│  Agent 5: Campaign topic extraction                                        │
│  Agent 5: Trend-campaign correlation                                       │
│  Agent 5: Affinity updates with safeguards                                 │
│  Agent 5: Affinity decay function                                          │
│  DELIVERABLE: Learning loop with anti-filter-bubble safeguards             │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           WEEK 5-6: UI & INTEGRATION                        │
├────────────────────────────────────────────────────────────────────────────┤
│  FRONTEND: Update TrendCard with badges                                    │
│  FRONTEND: Add "Why am I seeing this?" explanations                        │
│  FRONTEND: Domain filter chips                                             │
│  TESTING: End-to-end with multiple org profiles                            │
│  MONITORING: Dashboards for relevance scoring                              │
│  DELIVERABLE: Production-ready system                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Success Metrics

| Metric | Before | Target | How to Measure |
|--------|--------|--------|----------------|
| **Domain Coverage** | 1 (biased) | 12 (all) | Audit source distribution |
| **Relevance Precision** | ~10% | >50% | % trends acted upon |
| **New Opportunity Exposure** | 0% | >20% | % trends with NEW_OPPORTUNITY flag |
| **Diversity Score** | Low | High | # domains represented per day |
| **Filter Bubble Risk** | High | Low | Variance in recommended domains |
| **Learning Influence** | N/A | <30% | Affinity contribution to score |
| **Affinity Decay Working** | N/A | Yes | Stale affinities decrease |

---

## Anti-Filter-Bubble Checklist

- [ ] Profile-based scoring accounts for 70% of relevance (35+20+15 pts)
- [ ] Learned affinity is CAPPED at 20 pts maximum
- [ ] Exploration bonus gives +10 pts for declared-but-untried domains
- [ ] Domain diversity ensures representation across all declared domains
- [ ] Affinity decay runs weekly (5% per week for stale topics)
- [ ] Affinity scores are AVERAGED not MAX'd
- [ ] UI shows "New Opportunity" vs "Proven Topic" badges
- [ ] "Why am I seeing this?" explains relevance breakdown
- [ ] Filter logs track what's being filtered (debugging)
- [ ] Admin dashboard shows diversity metrics per org
