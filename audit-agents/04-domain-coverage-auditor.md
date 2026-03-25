# Domain Coverage Auditor

**Role:** Domain Expert / Political Analyst / Taxonomy Specialist
**Audit Type:** Content Classification Accuracy
**Reference:** [Auditing Algorithms - Auditability Checklist](https://www.auditingalgorithms.net/AuditabilityChecklist.html), [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)

## Audit Objectives

1. Verify policy domain keyword completeness
2. Identify missing topic coverage gaps
3. Validate entity recognition accuracy
4. Check geographic tagging precision
5. Ensure balanced representation across domains

## Audit Checklist

### 1. Policy Domain Keyword Completeness

**Files to Examine:**
- `supabase/functions/_shared/policyDomainKeywords.ts`

**Checks:**
- [ ] All 12 policy domains have sufficient keywords (target: 50+ per domain)
- [ ] Keywords are specific enough to avoid false positives
- [ ] Keywords are broad enough to capture relevant content
- [ ] No critical terms missing from each domain
- [ ] Keywords avoid political bias (left/right balance)
- [ ] Emerging terms are included (e.g., AI regulation, climate tech)

**Keyword Coverage Analysis:**
```typescript
// For each domain, check:
const MINIMUM_KEYWORDS = 50;
const domains = Object.keys(POLICY_DOMAIN_KEYWORDS);
domains.forEach(domain => {
  const count = POLICY_DOMAIN_KEYWORDS[domain].length;
  console.log(`${domain}: ${count} keywords ${count < MINIMUM_KEYWORDS ? '(INSUFFICIENT)' : '(OK)'}`);
});
```

**Missing Keyword Categories to Check:**

| Domain | Must-Have Categories |
|--------|---------------------|
| Healthcare | ACA, Medicare, Medicaid, mental health, drug pricing, telehealth, pandemic |
| Environment | Climate, EPA, renewable, pollution, conservation, water, emissions |
| Labor & Workers Rights | Union, minimum wage, OSHA, gig economy, remote work, benefits |
| Immigration | Border, visa, DACA, asylum, deportation, citizenship, refugees |
| Civil Rights | Discrimination, LGBTQ+, disability, accessibility, equality, DEI |
| Criminal Justice | Police, prison, sentencing, bail, juvenile, death penalty, parole |
| Voting Rights | Election, ballot, gerrymandering, voter ID, registration, polling |
| Education | K-12, college, student loans, teachers, curriculum, charter schools |
| Housing | Rent, mortgage, affordable, homelessness, zoning, eviction, HUD |
| Economic Justice | Poverty, inequality, wealth gap, social safety net, food security |
| Foreign Policy | NATO, China, Russia, trade, sanctions, diplomacy, treaties |
| Technology | AI, privacy, data, cybersecurity, antitrust, social media, crypto |

### 2. Keyword Collision Detection

**Problem:** Same keyword appearing in multiple domains causes ambiguous classification

**Checks:**
- [ ] Identify keywords that appear in 3+ domains
- [ ] Verify ambiguous keywords have context-based disambiguation
- [ ] Check if domain priority rules exist for collisions

**Collision Detection Query:**
```typescript
// Find keywords in multiple domains
const allKeywords: Record<string, string[]> = {};
Object.entries(POLICY_DOMAIN_KEYWORDS).forEach(([domain, keywords]) => {
  keywords.forEach(kw => {
    if (!allKeywords[kw]) allKeywords[kw] = [];
    allKeywords[kw].push(domain);
  });
});

const collisions = Object.entries(allKeywords)
  .filter(([_, domains]) => domains.length > 2)
  .sort((a, b) => b[1].length - a[1].length);

console.log('Keywords in 3+ domains:', collisions);
```

**Expected:** Collisions should be < 5% of total keywords

### 3. Entity Recognition Accuracy

**Files to Examine:**
- `supabase/functions/_shared/politicalEntities.ts`
- `supabase/functions/extract-trend-entities/index.ts`

**Checks:**
- [ ] All current federal politicians are included
- [ ] Key state-level politicians (governors, AGs) are included
- [ ] Major political organizations are covered
- [ ] Government agencies are complete
- [ ] Entity names handle variations (e.g., "AOC" vs "Alexandria Ocasio-Cortez")

**Entity Coverage Test:**
```sql
-- Check which politicians are actually being detected
SELECT
  unnest(politicians_mentioned) as politician,
  COUNT(*) as mention_count
FROM trend_events
WHERE politicians_mentioned IS NOT NULL AND politicians_mentioned != '{}'
GROUP BY politician
ORDER BY mention_count DESC
LIMIT 50;

-- Check for common names NOT being detected (manual review needed)
SELECT headline
FROM trend_events
WHERE headline ILIKE '%Biden%'
  AND (politicians_mentioned IS NULL OR NOT 'Joe Biden' = ANY(politicians_mentioned))
LIMIT 20;
```

**Politician Coverage Checklist:**
- [ ] All US Senators (100)
- [ ] Key House members (leadership, committee chairs)
- [ ] President, VP, Cabinet
- [ ] Supreme Court Justices
- [ ] State Governors (50)
- [ ] Major candidates for upcoming elections

### 4. Geographic Tagging Accuracy

**Files to Examine:**
- `supabase/functions/_shared/politicalEntities.ts` (STATE_PATTERNS)
- `supabase/functions/tag-trend-geographies/index.ts`

**Checks:**
- [ ] All 50 states + DC are in STATE_PATTERNS
- [ ] US territories are included (Puerto Rico, Guam, etc.)
- [ ] State abbreviations work (TX, NY, CA, etc.)
- [ ] Major cities are mapped to correct states
- [ ] "National" vs "State" level inference is accurate
- [ ] International geographic detection works

**State Pattern Completeness Check:**
```typescript
const REQUIRED_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'
];

const REQUIRED_TERRITORIES = [
  'Puerto Rico', 'Guam', 'US Virgin Islands', 'American Samoa', 'Northern Mariana Islands'
];
```

**Geographic Tagging Validation:**
```sql
-- Distribution of geo_level
SELECT
  geo_level,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM trend_events
WHERE geo_level IS NOT NULL
GROUP BY geo_level
ORDER BY count DESC;

-- States with most coverage
SELECT
  unnest(geographies) as geography,
  COUNT(*) as trend_count
FROM trend_events
WHERE geographies IS NOT NULL AND geographies != '{}'
GROUP BY geography
ORDER BY trend_count DESC
LIMIT 20;

-- Check for state name variations being missed
SELECT headline, geographies
FROM trend_events
WHERE headline ILIKE '%California%'
  AND (geographies IS NULL OR NOT 'California' = ANY(geographies))
LIMIT 10;
```

### 5. Source-to-Domain Mapping Accuracy

**Files to Examine:**
- `supabase/migrations/20260119034329_tag_rss_sources_policy_domains.sql`
- `rss_sources` table

**Checks:**
- [ ] Major advocacy orgs are correctly tagged
- [ ] News sources have appropriate domain coverage
- [ ] No source has more than 5 domains (over-tagging)
- [ ] No legitimate source has 0 domains (under-tagging)

**Validation Query:**
```sql
-- Check source tagging distribution
SELECT
  name,
  policy_domains,
  array_length(policy_domains, 1) as domain_count
FROM rss_sources
ORDER BY domain_count DESC NULLS LAST;

-- Find untagged sources
SELECT name, feed_url, category
FROM rss_sources
WHERE policy_domains IS NULL OR policy_domains = '{}';

-- Find over-tagged sources (>5 domains)
SELECT name, policy_domains, array_length(policy_domains, 1) as count
FROM rss_sources
WHERE array_length(policy_domains, 1) > 5;
```

### 6. Trend Tagging Effectiveness

**Checks:**
- [ ] What percentage of trends have at least one domain?
- [ ] What percentage have geographic tags?
- [ ] What percentage have entity mentions?
- [ ] Are multi-domain trends appropriately tagged?

**Validation Queries:**
```sql
-- Overall tagging rates
SELECT
  COUNT(*) as total_trends,
  COUNT(*) FILTER (WHERE policy_domains IS NOT NULL AND policy_domains != '{}') as has_domains,
  COUNT(*) FILTER (WHERE geographies IS NOT NULL AND geographies != '{}') as has_geo,
  COUNT(*) FILTER (WHERE politicians_mentioned IS NOT NULL AND politicians_mentioned != '{}') as has_politicians,
  ROUND(100.0 * COUNT(*) FILTER (WHERE policy_domains IS NOT NULL AND policy_domains != '{}') / COUNT(*), 2) as domain_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE geographies IS NOT NULL AND geographies != '{}') / COUNT(*), 2) as geo_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE politicians_mentioned IS NOT NULL AND politicians_mentioned != '{}') / COUNT(*), 2) as politician_rate
FROM trend_events
WHERE created_at > NOW() - INTERVAL '7 days';

-- Domain co-occurrence (trends with multiple domains)
SELECT
  array_length(policy_domains, 1) as domain_count,
  COUNT(*) as trend_count
FROM trend_events
WHERE policy_domains IS NOT NULL AND policy_domains != '{}'
GROUP BY domain_count
ORDER BY domain_count;
```

**Expected Targets:**
- Domain tagging rate: > 80%
- Geographic tagging rate: > 60%
- Politician mention rate: > 30% (varies by news cycle)

### 7. False Positive/Negative Sampling

**Manual Verification Required**

**False Positive Test (Over-tagging):**
```sql
-- Sample trends tagged with "Healthcare" - verify accuracy
SELECT id, headline, policy_domains
FROM trend_events
WHERE 'Healthcare' = ANY(policy_domains)
ORDER BY RANDOM()
LIMIT 20;
-- MANUAL: Review each headline - does it actually relate to Healthcare?
-- Target: < 10% false positive rate
```

**False Negative Test (Under-tagging):**
```sql
-- Find trends with healthcare keywords but not tagged
SELECT id, headline, policy_domains
FROM trend_events
WHERE headline ILIKE ANY(ARRAY['%medicare%', '%hospital%', '%doctor%', '%vaccine%'])
  AND (policy_domains IS NULL OR NOT 'Healthcare' = ANY(policy_domains))
LIMIT 20;
-- MANUAL: Should these have been tagged?
-- Target: < 15% false negative rate
```

## Findings Template

### Finding: [TITLE]
**Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO
**Category:** Missing Keywords | False Positives | False Negatives | Entity Gap | Geographic Gap
**Domain(s) Affected:** [Which policy domains]

**Evidence:**
- Sample size: N
- Error rate: X%
- Specific examples: [list]

**Description:**
[What was found]

**Impact:**
[How this affects trend matching and user experience]

**Recommendation:**
[Specific keywords to add, patterns to fix, entities to include]

**Effort:** Low | Medium | High

---

## Red Flags to Watch For

1. **Domain with <30 keywords** - Insufficient coverage
2. **Tagging rate <70%** - Content going unclassified
3. **False positive rate >15%** - Noisy recommendations
4. **False negative rate >20%** - Missing relevant content
5. **State with 0 trend matches** - Geographic gap
6. **High-profile politician not detected** - Entity recognition failure
7. **Keyword collision rate >10%** - Classification ambiguity

## Audit Execution Instructions

1. Run keyword count analysis for all 12 domains
2. Execute collision detection script
3. Sample 20 trends per domain for false positive check
4. Search for obvious keywords missing from tagged content
5. Verify all 50 states + DC are detectable
6. Check that current political figures are recognized
7. Calculate overall tagging rates and compare to targets
8. Document all findings with specific remediation steps

## Emerging Topics to Add

Keep keyword lists current with emerging issues:

**2026 Priority Additions:**
- AI regulation and governance
- Climate tech and clean energy transition
- Cryptocurrency and digital assets regulation
- Remote/hybrid work policies
- Student debt relief programs
- Abortion access (post-Dobbs)
- Social media platform regulation
- Election integrity measures
- Gun violence prevention
- Immigration reform proposals
