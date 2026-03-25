/**
 * Policy Domain Keywords
 *
 * Comprehensive keyword lists for all 12 policy domains.
 * Used for broad collection and trend classification.
 */

export const POLICY_DOMAINS = [
  'Healthcare',
  'Environment',
  'Labor & Workers Rights',
  'Immigration',
  'Civil Rights',
  'Criminal Justice',
  'Voting Rights',
  'Education',
  'Housing',
  'Economic Justice',
  'Foreign Policy',
  'Technology',
] as const;

export type PolicyDomain = typeof POLICY_DOMAINS[number];

export const POLICY_DOMAIN_KEYWORDS: Record<PolicyDomain, string[]> = {
  'Healthcare': [
    // Core terms
    'medicare', 'medicaid', 'aca', 'affordable care act', 'obamacare',
    'health insurance', 'prescription drugs', 'drug prices', 'hospital',
    'public option', 'single payer', 'universal healthcare', 'mental health',
    'abortion', 'reproductive health', 'roe v wade', 'planned parenthood',
    'nursing home', 'long term care', 'health care costs', 'uninsured',
    'pharmaceutical', 'vaccine', 'pandemic', 'public health', 'health crisis',
    'medical debt', 'preexisting conditions', 'health coverage', 'hhs',
    // Agency terms
    'fda', 'cdc', 'nih', 'cms', 'food and drug administration',
    'centers for disease control', 'national institutes of health',
    // Expanded terms
    'drug pricing', 'generic drugs', 'clinical trials', 'medical device',
    'telehealth', 'mental health parity', 'substance abuse', 'opioid',
    'health equity', 'rural health', 'public health emergency', 'vaccine mandate',
    'health insurance exchange', 'healthcare marketplace', 'cobra', 'chip',
    'children health insurance', 'maternity care', 'prenatal care',
    'drug manufacturer', 'pharmacy benefit', 'pbm', 'insulin prices',
    'healthcare worker', 'nurse shortage', 'doctor shortage', 'hospital bed',
    'emergency room', 'urgent care', 'primary care', 'specialist',
  ],
  'Environment': [
    // Core terms
    'climate change', 'global warming', 'renewable energy', 'solar', 'wind',
    'fossil fuels', 'oil', 'gas', 'pipeline', 'carbon emissions', 'epa',
    'green new deal', 'paris agreement', 'environmental justice', 'pollution',
    'clean energy', 'electric vehicle', 'conservation', 'endangered species',
    'carbon tax', 'net zero', 'emissions', 'greenhouse gas', 'wildfire',
    'drought', 'flood', 'hurricane', 'climate crisis', 'sustainability',
    'deforestation', 'plastic pollution', 'clean water', 'air quality',
    // Expanded terms
    'climate crisis', 'carbon capture', 'renewable portfolio',
    'superfund', 'clean water act', 'clean air act', 'endangered species act',
    'national park', 'wildlife refuge', 'public lands', 'offshore drilling',
    'lng export', 'methane emissions', 'biodiversity', 'habitat destruction',
    'pfas', 'lead pipes', 'toxic waste', 'hazardous materials',
    'environmental protection', 'soil contamination', 'water pollution',
    'sea level rise', 'ocean acidification', 'coral reef', 'ecosystem',
    'renewable standard', 'solar panel', 'wind turbine', 'geothermal',
    'battery storage', 'ev charging', 'fuel efficiency', 'mpg standard',
  ],
  'Labor & Workers Rights': [
    // Core terms
    'union', 'strike', 'labor', 'workers', 'minimum wage', 'wage theft',
    'collective bargaining', 'nlrb', 'right to work', 'gig economy',
    'amazon union', 'starbucks union', 'teacher strike', 'uaw',
    'paid leave', 'sick leave', 'overtime', 'workplace safety', 'osha',
    'worker organizing', 'labor movement', 'unionize', 'contract negotiation',
    'picket line', 'labor dispute', 'employee rights', 'fair wages',
    // Agency terms
    'dol', 'department of labor', 'eeoc', 'equal employment opportunity',
    // Expanded terms
    'independent contractor', 'worker classification', 'prevailing wage',
    'apprenticeship', 'job training', 'workforce development',
    'paid family leave', 'parental leave', 'tip credit', 'overtime rule',
    'non-compete', 'non-compete agreement', 'child labor', 'farmworker',
    'domestic worker', 'project labor agreement', 'joint employer',
    'temp worker', 'staffing agency', 'union election', 'card check',
    'union busting', 'unfair labor practice', 'labor board', 'arbitration',
    'pension', 'retirement benefits', '401k', 'employee stock',
    'healthcare benefits', 'workers compensation', 'disability leave',
  ],
  'Immigration': [
    // Core terms
    'immigration', 'border', 'migrants', 'refugees', 'asylum', 'daca',
    'dreamers', 'ice', 'deportation', 'sanctuary city', 'visa',
    'green card', 'citizenship', 'undocumented', 'border wall',
    'immigration reform', 'path to citizenship', 'family separation',
    'cbp', 'immigration court', 'detention', 'migrant children',
    'title 42', 'immigration policy', 'work permit', 'immigration enforcement',
    // Agency terms
    'uscis', 'eoir', 'immigration services',
    // Expanded terms
    'naturalization', 'temporary protected status', 'tps', 'parole',
    'expedited removal', 'credible fear', 'asylum seeker',
    'unaccompanied minor', 'detention center', 'immigration detention',
    'e-verify', 'public charge', 'diversity visa', 'visa lottery',
    'eb-5', 'h-1b', 'h-2a', 'h-2b', 'l-1 visa', 'student visa',
    'work authorization', 'employment authorization', 'border security',
    'border crossing', 'port of entry', 'customs', 'immigration judge',
    'deportation order', 'removal proceedings', 'immigration attorney',
    'immigrant rights', 'migrant worker', 'seasonal worker', 'bracero',
  ],
  'Civil Rights': [
    // Core terms
    'civil rights', 'discrimination', 'equality', 'racial justice',
    'lgbtq', 'transgender', 'gay rights', 'same sex marriage',
    'hate crime', 'affirmative action', 'dei', 'title ix',
    'police reform', 'racial profiling', 'stop and frisk',
    'voting discrimination', 'religious freedom', 'free speech',
    'disability rights', 'ada', 'gender equality', 'title vii',
    'equal protection', 'civil liberties', 'aclu', 'naacp',
    // Expanded terms
    'section 1983', 'title vi', 'americans with disabilities act',
    'hate speech', 'establishment clause', 'first amendment',
    'marriage equality', 'gender identity', 'sexual orientation',
    'racial justice', 'reparations', 'redress', 'systemic racism',
    'institutional racism', 'implicit bias', 'structural inequality',
    'disparate impact', 'disparate treatment', 'protected class',
    'age discrimination', 'equal pay', 'pay equity', 'glass ceiling',
    'accessibility', 'reasonable accommodation', 'segregation', 'integration',
    'voting rights act', 'fair housing act', 'civil rights act',
    'section 504', 'rehabilitation act', 'employment discrimination',
  ],
  'Criminal Justice': [
    // Core terms
    'prison reform', 'mass incarceration', 'bail reform', 'police',
    'defund police', 'qualified immunity', 'death penalty', 'sentencing',
    'parole', 'probation', 'juvenile justice', 'wrongful conviction',
    'private prison', 'solitary confinement', 'reentry', 'clemency',
    'police brutality', 'excessive force', 'body camera', 'police shooting',
    'criminal justice reform', 'recidivism', 'drug offense', 'mandatory minimum',
    // Agency terms
    'doj', 'fbi', 'atf', 'dea', 'bop', 'bureau of prisons',
    // Expanded terms
    'consent decree', 'prosecutorial discretion', 'diversion program',
    'restorative justice', 'reentry program', 'expungement', 'record sealing',
    'cash bail', 'pretrial detention', 'pretrial release',
    'forensic evidence', 'innocence project', 'exoneration',
    'police union', 'use of force', 'choke hold', 'no knock warrant',
    'community policing', 'crisis intervention', 'mental health response',
    'drug court', 'veterans court', 'mental health court', 'specialty court',
    'prison overcrowding', 'prison conditions', 'inmates', 'corrections',
    'federal prison', 'state prison', 'county jail', 'detention facility',
  ],
  'Voting Rights': [
    // Core terms
    'voting rights', 'voter suppression', 'gerrymandering', 'redistricting',
    'election', 'ballot', 'mail-in voting', 'voter id', 'election integrity',
    'poll workers', 'early voting', 'voter registration', 'electoral college',
    'voting access', 'election security', 'campaign finance',
    'dark money', 'citizens united', 'election law', 'voting machines',
    'absentee ballot', 'ballot drop box', 'voter fraud', 'election fraud',
    // Agency terms
    'fec', 'eac', 'election assistance commission', 'federal election commission',
    // Expanded terms
    'hava', 'help america vote act', 'nvra', 'motor voter',
    'same-day registration', 'automatic registration', 'voter roll',
    'voter purge', 'photo id', 'strict voter id', 'provisional ballot',
    'ballot harvesting', 'ballot curing', 'election observer', 'poll watcher',
    'redistricting commission', 'independent redistricting', 'fair maps',
    'voting machine', 'paper ballot', 'hand count', 'audit',
    'election interference', 'foreign interference', 'cyber attack',
    'campaign finance reform', 'super pac', 'political action committee',
    'disclosure', 'donor disclosure', 'political spending', 'soft money',
  ],
  'Education': [
    // Core terms
    'education', 'schools', 'teachers', 'students', 'college', 'university',
    'student loans', 'student debt', 'charter schools', 'school choice',
    'curriculum', 'school board', 'title i', 'pell grant', 'k-12',
    'higher education', 'community college', 'vocational training',
    'school funding', 'book ban', 'critical race theory', 'sex education',
    'special education', 'teacher pay', 'school voucher', 'public schools',
    // Agency terms
    'department of education', 'doe',
    // Expanded terms
    'title ix', 'idea', 'individuals with disabilities education act',
    'ferpa', 'family educational rights', 'school safety', 'school resource officer',
    'head start', 'pre-k', 'early childhood education', 'child care',
    'student loan forgiveness', 'student debt cancellation', 'income-driven repayment',
    'affirmative action', 'legacy admission', 'college admission',
    'standardized testing', 'sat', 'act', 'common core', 'state standards',
    'teacher shortage', 'teacher certification', 'tenure', 'union',
    'private school', 'religious school', 'home school', 'online learning',
    'stem education', 'career technical', 'apprenticeship', 'trade school',
  ],
  'Housing': [
    // Core terms
    'housing', 'rent', 'affordable housing', 'homelessness', 'eviction',
    'mortgage', 'section 8', 'public housing', 'zoning', 'nimby', 'yimby',
    'housing crisis', 'rent control', 'tenant rights', 'fair housing',
    'foreclosure', 'housing voucher', 'shelter', 'housing first',
    'housing discrimination', 'redlining', 'housing shortage', 'housing costs',
    // Agency terms
    'hud', 'department of housing', 'fha', 'federal housing administration',
    'fannie mae', 'freddie mac', 'ginnie mae',
    // Expanded terms
    'housing choice voucher', 'project-based voucher', 'lihtc',
    'low income housing tax credit', 'cdbg', 'community development block grant',
    'inclusionary zoning', 'rent stabilization', 'rent increase', 'rent cap',
    'eviction moratorium', 'eviction protection', 'tenant protection',
    'first-time homebuyer', 'down payment assistance', 'closing costs',
    'manufactured housing', 'mobile home', 'modular housing', 'prefab',
    'homeless shelter', 'permanent supportive housing', 'transitional housing',
    'housing trust fund', 'housing authority', 'public housing authority',
    'source of income discrimination', 'housing stability', 'housing insecurity',
  ],
  'Economic Justice': [
    // Core terms
    'economy', 'inflation', 'recession', 'jobs', 'unemployment',
    'inequality', 'wealth gap', 'billionaire', 'tax', 'corporate tax',
    'minimum wage', 'living wage', 'poverty', 'food stamps', 'snap',
    'child tax credit', 'wealth tax', 'income inequality', 'unions',
    'social security', 'medicare', 'unemployment benefits', 'stimulus',
    'economic relief', 'cost of living', 'wage stagnation', 'middle class',
    // Agency terms
    'treasury', 'federal reserve', 'the fed', 'cbo', 'gao', 'omb',
    // Expanded terms
    'gdp', 'gross domestic product', 'economic growth', 'interest rate',
    'supply chain', 'reshoring', 'nearshoring', 'onshoring', 'manufacturing',
    'industrial policy', 'antitrust', 'monopoly', 'merger', 'acquisition',
    'market concentration', 'small business', 'sba loan', 'ppp',
    'municipal bond', 'pension fund', 'retirement savings', '401k',
    'consumer protection', 'cfpb', 'predatory lending', 'payday loan',
    'credit score', 'financial literacy', 'banking desert', 'unbanked',
    'progressive tax', 'regressive tax', 'tax bracket', 'capital gains',
    'estate tax', 'inheritance tax', 'tax loophole', 'tax haven', 'offshore',
  ],
  'Foreign Policy': [
    // Core terms
    'foreign policy', 'diplomacy', 'sanctions', 'war', 'military',
    'ukraine', 'russia', 'china', 'israel', 'palestine', 'gaza',
    'nato', 'un', 'trade', 'tariffs', 'treaty', 'embassy',
    'arms deal', 'nuclear', 'terrorism', 'state department',
    'international relations', 'defense spending', 'peacekeeping', 'humanitarian aid',
    'ceasefire', 'peace talks', 'military aid', 'foreign aid', 'alliance',
    // Agency terms
    'usaid', 'nsc', 'national security council',
    // Expanded terms
    'un security council', 'general assembly', 'bilateral agreement',
    'multilateral', 'diplomatic relations', 'ambassador', 'consulate',
    'economic sanctions', 'export control', 'embargo', 'trade ban',
    'development assistance', 'human rights', 'refugee resettlement',
    'arms control', 'nuclear proliferation', 'non-proliferation',
    'trade agreement', 'free trade', 'wto', 'world trade organization',
    'iran deal', 'jcpoa', 'north korea', 'taiwan', 'south china sea',
    'middle east', 'afghanistan', 'iraq', 'syria', 'yemen', 'venezuela',
    'european union', 'brexit', 'g7', 'g20', 'brics', 'asean',
  ],
  'Technology': [
    // Core terms
    'tech', 'ai', 'artificial intelligence', 'social media', 'privacy',
    'data', 'surveillance', 'encryption', 'section 230', 'antitrust',
    'big tech', 'facebook', 'google', 'amazon', 'apple', 'tiktok',
    'cybersecurity', 'net neutrality', 'broadband', 'digital divide',
    'data protection', 'algorithm', 'facial recognition', 'tech regulation',
    'platform moderation', 'content moderation', 'data breach', 'hacking',
    // Agency terms
    'ftc', 'fcc', 'nist', 'cisa', 'federal communications commission',
    // Expanded terms
    'machine learning', 'chatgpt', 'generative ai', 'deepfake', 'llm',
    'large language model', 'neural network', 'autonomous vehicle',
    'cryptocurrency', 'bitcoin', 'ethereum', 'stablecoin', 'cbdc',
    'digital currency', 'blockchain', 'nft', 'web3', 'metaverse',
    'cloud computing', 'quantum computing', 'semiconductor', 'chip',
    'data broker', 'data localization', 'cross-border data', 'gdpr',
    'app store', 'platform monopoly', 'right to repair', 'interoperability',
    'broadband subsidy', 'rural broadband', 'affordable connectivity',
    'online safety', 'child safety online', 'age verification', 'kosa',
  ],
};

/**
 * Generic Threat Indicators (Not Demographic-Specific)
 * Used for detecting actionable situations across all policy domains
 */
export const GENERIC_THREAT_INDICATORS = {
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

/**
 * Check if text matches any keyword in a domain
 */
export function matchesDomain(text: string, domain: PolicyDomain): boolean {
  const lowerText = text.toLowerCase();
  const keywords = POLICY_DOMAIN_KEYWORDS[domain];
  return keywords.some(kw => lowerText.includes(kw));
}

/**
 * Get all matching domains for a piece of text
 */
export function getMatchingDomains(text: string, minMatches = 1): PolicyDomain[] {
  const lowerText = text.toLowerCase();
  const matches: PolicyDomain[] = [];

  for (const domain of POLICY_DOMAINS) {
    const keywords = POLICY_DOMAIN_KEYWORDS[domain];
    const matchCount = keywords.filter(kw => lowerText.includes(kw)).length;
    if (matchCount >= minMatches) {
      matches.push(domain);
    }
  }

  return matches;
}

/**
 * Get all keywords across all domains (for broad collection)
 */
export function getAllKeywords(): string[] {
  const all: string[] = [];
  for (const keywords of Object.values(POLICY_DOMAIN_KEYWORDS)) {
    all.push(...keywords);
  }
  return [...new Set(all)];
}

/**
 * Check for threat indicators in text
 */
export function detectThreats(text: string): { category: string; indicators: string[] }[] {
  const lowerText = text.toLowerCase();
  const threats: { category: string; indicators: string[] }[] = [];

  for (const [category, indicators] of Object.entries(GENERIC_THREAT_INDICATORS)) {
    const matched = indicators.filter(ind => lowerText.includes(ind));
    if (matched.length > 0) {
      threats.push({ category, indicators: matched });
    }
  }

  return threats;
}
