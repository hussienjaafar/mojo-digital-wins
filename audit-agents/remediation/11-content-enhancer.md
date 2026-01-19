# Content Enhancement Agent

**Role:** Domain Expert / Political Analyst / Content Specialist
**Focus:** Expand keyword coverage and entity recognition
**Reference:** US Government structure, Policy domain taxonomy

---

## Assigned Issues

| Priority | Issue | File |
|----------|-------|------|
| HIGH | All 12 domains below 50 keyword target | `policyDomainKeywords.ts` |
| HIGH | No cabinet members in entity list | `politicalEntities.ts` |
| HIGH | No state governors in entity list | `politicalEntities.ts` |
| MEDIUM | 6/9 Supreme Court justices missing | `politicalEntities.ts` |
| MEDIUM | Missing 12 top-50 US cities | `politicalEntities.ts` |
| LOW | Missing Healthcare terms (FDA, CDC) | `policyDomainKeywords.ts` |

---

## Task 1: Expand Policy Domain Keywords (HIGH)

### Target: 50+ keywords per domain

### Current State by Domain:
| Domain | Current | Gap |
|--------|---------|-----|
| Healthcare | 34 | +16 |
| Environment | 31 | +19 |
| Labor | 28 | +22 |
| Immigration | 29 | +21 |
| Education | 30 | +20 |
| Housing | 23 | +27 |
| Criminal Justice | 24 | +26 |
| Voting Rights | 24 | +26 |
| Technology | 27 | +23 |
| Economy | 32 | +18 |
| Foreign Policy | 28 | +22 |
| Civil Rights | 26 | +24 |

### Keywords to Add by Domain

#### Healthcare (+20 keywords)
```typescript
// Add to Healthcare domain
'fda', 'cdc', 'nih', 'cms', 'hhs',
'pharmaceutical', 'drug pricing', 'generic drugs',
'clinical trials', 'medical device', 'telehealth',
'mental health parity', 'substance abuse',
'health equity', 'rural health', 'public health emergency',
'vaccine mandate', 'health insurance exchange',
'preexisting conditions', 'medical debt'
```

#### Environment (+20 keywords)
```typescript
// Add to Environment domain
'epa', 'climate crisis', 'net zero',
'carbon capture', 'renewable portfolio',
'environmental justice', 'superfund',
'clean water act', 'endangered species',
'national park', 'wildlife refuge',
'plastic pollution', 'pfas', 'lead pipes',
'offshore drilling', 'pipeline', 'lng export',
'methane emissions', 'deforestation', 'biodiversity'
```

#### Labor (+22 keywords)
```typescript
// Add to Labor domain
'dol', 'nlrb', 'osha', 'eeoc',
'gig economy', 'independent contractor',
'right to work', 'prevailing wage',
'apprenticeship', 'job training',
'workplace safety', 'paid family leave',
'tip credit', 'overtime rule',
'non-compete', 'worker classification',
'child labor', 'farmworker', 'domestic worker',
'project labor agreement', 'joint employer', 'temp worker'
```

#### Immigration (+21 keywords)
```typescript
// Add to Immigration domain
'uscis', 'ice', 'cbp', 'eoir',
'green card', 'naturalization',
'temporary protected status', 'parole',
'expedited removal', 'credible fear',
'unaccompanied minor', 'family separation',
'detention center', 'sanctuary city',
'e-verify', 'public charge',
'diversity visa', 'eb-5', 'h-2a', 'h-2b', 'l-1'
```

#### Education (+20 keywords)
```typescript
// Add to Education domain
'doe', 'title ix', 'idea', 'ferpa',
'school choice', 'charter school',
'common core', 'standardized testing',
'school safety', 'school resource officer',
'head start', 'pell grant', 'student debt',
'affirmative action', 'legacy admission',
'vocational training', 'community college',
'teacher shortage', 'school board', 'curriculum'
```

#### Housing (+27 keywords)
```typescript
// Add to Housing domain
'hud', 'fha', 'fannie mae', 'freddie mac',
'section 8', 'public housing', 'housing voucher',
'fair housing', 'redlining', 'zoning reform',
'inclusionary zoning', 'rent stabilization',
'eviction moratorium', 'foreclosure',
'first-time homebuyer', 'down payment assistance',
'manufactured housing', 'modular housing',
'homeless shelter', 'permanent supportive housing',
'housing trust fund', 'lihtc', 'cdbg',
'housing discrimination', 'source of income', 'nimby', 'yimby'
```

#### Criminal Justice (+26 keywords)
```typescript
// Add to Criminal Justice domain
'doj', 'fbi', 'atf', 'dea', 'bop',
'qualified immunity', 'consent decree',
'prosecutorial discretion', 'diversion program',
'restorative justice', 'reentry program',
'cash bail', 'pretrial detention',
'solitary confinement', 'private prison',
'juvenile justice', 'death penalty',
'forensic evidence', 'wrongful conviction',
'police union', 'use of force',
'community policing', 'crisis intervention',
'drug court', 'veterans court', 'mental health court'
```

#### Voting Rights (+26 keywords)
```typescript
// Add to Voting Rights domain
'fec', 'eac', 'hava', 'nvra',
'voter registration', 'same-day registration',
'automatic registration', 'voter roll',
'voter purge', 'voter id', 'photo id',
'absentee ballot', 'mail-in voting',
'early voting', 'drop box', 'ballot harvesting',
'election observer', 'poll watcher',
'redistricting commission', 'gerrymandering',
'voting machine', 'paper ballot',
'election security', 'election interference',
'campaign finance', 'super pac', 'dark money'
```

#### Technology (+23 keywords)
```typescript
// Add to Technology domain
'ftc', 'fcc', 'nist', 'cisa',
'artificial intelligence', 'machine learning',
'chatgpt', 'generative ai', 'deepfake',
'algorithm', 'facial recognition',
'cryptocurrency', 'stablecoin', 'cbdc',
'cloud computing', 'quantum computing',
'data broker', 'data localization',
'content moderation', 'platform liability',
'broadband subsidy', 'digital divide',
'right to repair', 'app store'
```

#### Economy (+18 keywords)
```typescript
// Add to Economy domain
'treasury', 'fed', 'cbo', 'gao', 'omb',
'gdp', 'recession', 'inflation rate',
'supply chain', 'reshoring', 'nearshoring',
'industrial policy', 'antitrust',
'merger', 'market concentration',
'small business', 'sba loan',
'municipal bond', 'pension fund'
```

#### Foreign Policy (+22 keywords)
```typescript
// Add to Foreign Policy domain
'state department', 'usaid', 'nsc',
'nato', 'un security council',
'bilateral agreement', 'multilateral',
'diplomatic relations', 'embassy',
'economic sanctions', 'export control',
'foreign aid', 'development assistance',
'human rights', 'refugee resettlement',
'peacekeeping', 'military alliance',
'arms control', 'nuclear proliferation',
'trade agreement', 'tariff', 'wto'
```

#### Civil Rights (+24 keywords)
```typescript
// Add to Civil Rights domain
'eeoc', 'doj civil rights', 'section 1983',
'title vi', 'title vii', 'ada',
'hate crime', 'hate speech',
'religious freedom', 'establishment clause',
'free speech', 'first amendment',
'lgbtq rights', 'marriage equality',
'transgender', 'gender identity',
'racial justice', 'reparations',
'affirmative action', 'dei',
'disability rights', 'accessibility',
'age discrimination', 'equal pay'
```

---

## Task 2: Add Cabinet Members (HIGH)

```typescript
// Add to FEDERAL_POLITICIANS array
// Current Cabinet (2026 - verify positions)
export const CABINET_MEMBERS = [
  { name: 'Secretary of State', pattern: /secretary of state/i },
  { name: 'Secretary of Defense', pattern: /secretary of defense|defense secretary/i },
  { name: 'Secretary of Treasury', pattern: /treasury secretary|secretary of the treasury/i },
  { name: 'Attorney General', pattern: /attorney general/i },
  { name: 'Secretary of Homeland Security', pattern: /homeland security secretary|dhs secretary/i },
  { name: 'Secretary of HHS', pattern: /hhs secretary|health and human services/i },
  { name: 'Secretary of Education', pattern: /education secretary|secretary of education/i },
  { name: 'Secretary of HUD', pattern: /hud secretary|housing secretary/i },
  { name: 'Secretary of Transportation', pattern: /transportation secretary|dot secretary/i },
  { name: 'Secretary of Energy', pattern: /energy secretary|doe secretary/i },
  { name: 'Secretary of Agriculture', pattern: /agriculture secretary|usda secretary/i },
  { name: 'Secretary of Commerce', pattern: /commerce secretary/i },
  { name: 'Secretary of Labor', pattern: /labor secretary|dol secretary/i },
  { name: 'Secretary of Interior', pattern: /interior secretary/i },
  { name: 'Secretary of Veterans Affairs', pattern: /va secretary|veterans affairs secretary/i },
  { name: 'EPA Administrator', pattern: /epa administrator/i },
  { name: 'OMB Director', pattern: /omb director|budget director/i },
  { name: 'UN Ambassador', pattern: /un ambassador|ambassador to the united nations/i },
];
```

---

## Task 3: Add State Governors (HIGH)

```typescript
// Add to politicalEntities.ts
export const STATE_GOVERNORS = [
  { state: 'Alabama', title: 'Governor of Alabama' },
  { state: 'Alaska', title: 'Governor of Alaska' },
  { state: 'Arizona', title: 'Governor of Arizona' },
  { state: 'Arkansas', title: 'Governor of Arkansas' },
  { state: 'California', title: 'Governor of California' },
  { state: 'Colorado', title: 'Governor of Colorado' },
  { state: 'Connecticut', title: 'Governor of Connecticut' },
  { state: 'Delaware', title: 'Governor of Delaware' },
  { state: 'Florida', title: 'Governor of Florida' },
  { state: 'Georgia', title: 'Governor of Georgia' },
  { state: 'Hawaii', title: 'Governor of Hawaii' },
  { state: 'Idaho', title: 'Governor of Idaho' },
  { state: 'Illinois', title: 'Governor of Illinois' },
  { state: 'Indiana', title: 'Governor of Indiana' },
  { state: 'Iowa', title: 'Governor of Iowa' },
  { state: 'Kansas', title: 'Governor of Kansas' },
  { state: 'Kentucky', title: 'Governor of Kentucky' },
  { state: 'Louisiana', title: 'Governor of Louisiana' },
  { state: 'Maine', title: 'Governor of Maine' },
  { state: 'Maryland', title: 'Governor of Maryland' },
  { state: 'Massachusetts', title: 'Governor of Massachusetts' },
  { state: 'Michigan', title: 'Governor of Michigan' },
  { state: 'Minnesota', title: 'Governor of Minnesota' },
  { state: 'Mississippi', title: 'Governor of Mississippi' },
  { state: 'Missouri', title: 'Governor of Missouri' },
  { state: 'Montana', title: 'Governor of Montana' },
  { state: 'Nebraska', title: 'Governor of Nebraska' },
  { state: 'Nevada', title: 'Governor of Nevada' },
  { state: 'New Hampshire', title: 'Governor of New Hampshire' },
  { state: 'New Jersey', title: 'Governor of New Jersey' },
  { state: 'New Mexico', title: 'Governor of New Mexico' },
  { state: 'New York', title: 'Governor of New York' },
  { state: 'North Carolina', title: 'Governor of North Carolina' },
  { state: 'North Dakota', title: 'Governor of North Dakota' },
  { state: 'Ohio', title: 'Governor of Ohio' },
  { state: 'Oklahoma', title: 'Governor of Oklahoma' },
  { state: 'Oregon', title: 'Governor of Oregon' },
  { state: 'Pennsylvania', title: 'Governor of Pennsylvania' },
  { state: 'Rhode Island', title: 'Governor of Rhode Island' },
  { state: 'South Carolina', title: 'Governor of South Carolina' },
  { state: 'South Dakota', title: 'Governor of South Dakota' },
  { state: 'Tennessee', title: 'Governor of Tennessee' },
  { state: 'Texas', title: 'Governor of Texas' },
  { state: 'Utah', title: 'Governor of Utah' },
  { state: 'Vermont', title: 'Governor of Vermont' },
  { state: 'Virginia', title: 'Governor of Virginia' },
  { state: 'Washington', title: 'Governor of Washington' },
  { state: 'West Virginia', title: 'Governor of West Virginia' },
  { state: 'Wisconsin', title: 'Governor of Wisconsin' },
  { state: 'Wyoming', title: 'Governor of Wyoming' },
];
```

---

## Task 4: Add Supreme Court Justices (MEDIUM)

```typescript
// Current Supreme Court (2026 - verify)
export const SUPREME_COURT_JUSTICES = [
  'Chief Justice',
  'John Roberts',
  'Clarence Thomas',
  'Samuel Alito',
  'Sonia Sotomayor',
  'Elena Kagan',
  'Neil Gorsuch',
  'Brett Kavanaugh',
  'Amy Coney Barrett',
  'Ketanji Brown Jackson',
];
```

---

## Task 5: Add Missing Major Cities (MEDIUM)

```typescript
// Add to MAJOR_CITIES array
const MISSING_CITIES = [
  'Oklahoma City',
  'Louisville',
  'Memphis',
  'Baltimore',
  'Milwaukee',
  'Albuquerque',
  'Tucson',
  'Fresno',
  'Mesa',
  'Sacramento',
  'Kansas City',
  'Long Beach',
];
```

---

## Task 6: Add Federal Agencies (LOW)

```typescript
// Add to FEDERAL_AGENCIES array
const ADDITIONAL_AGENCIES = [
  { name: 'FDA', full: 'Food and Drug Administration' },
  { name: 'CDC', full: 'Centers for Disease Control and Prevention' },
  { name: 'NIH', full: 'National Institutes of Health' },
  { name: 'HUD', full: 'Department of Housing and Urban Development' },
  { name: 'DOE', full: 'Department of Energy' },
  { name: 'DOT', full: 'Department of Transportation' },
  { name: 'USDA', full: 'United States Department of Agriculture' },
  { name: 'SBA', full: 'Small Business Administration' },
  { name: 'SSA', full: 'Social Security Administration' },
  { name: 'FEMA', full: 'Federal Emergency Management Agency' },
  { name: 'TSA', full: 'Transportation Security Administration' },
  { name: 'NTSB', full: 'National Transportation Safety Board' },
  { name: 'FTC', full: 'Federal Trade Commission' },
  { name: 'FCC', full: 'Federal Communications Commission' },
  { name: 'SEC', full: 'Securities and Exchange Commission' },
  { name: 'CFTC', full: 'Commodity Futures Trading Commission' },
  { name: 'CFPB', full: 'Consumer Financial Protection Bureau' },
  { name: 'NLRB', full: 'National Labor Relations Board' },
  { name: 'EEOC', full: 'Equal Employment Opportunity Commission' },
  { name: 'OSHA', full: 'Occupational Safety and Health Administration' },
];
```

---

## Execution Checklist

- [ ] Task 1: Expand all 12 policy domain keyword lists to 50+
- [ ] Task 2: Add cabinet members to entity recognition
- [ ] Task 3: Add all 50 state governors
- [ ] Task 4: Add all current Supreme Court justices
- [ ] Task 5: Add missing major cities
- [ ] Task 6: Add federal agencies

## Post-Fix Verification

Run Domain Coverage Audit:
```bash
claude -p "Run audit-agents/04-domain-coverage-auditor.md on the News & Trends system"
```

Expected Results:
- Average keywords per domain: 50+
- Entity coverage (Politicians): 80%+
- Entity coverage (Agencies): 90%+
