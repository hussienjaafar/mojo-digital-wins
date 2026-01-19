/**
 * Political Entities Detection and Matching
 *
 * Provides utilities for detecting and matching political entities
 * (politicians, organizations, legislation) in text.
 */

// ============================================================================
// Types
// ============================================================================

export interface PoliticalEntity {
  canonical_name: string;
  entity_type: 'politician' | 'organization' | 'legislation' | 'agency';
  aliases: string[];
  party?: string;
  state?: string;
  office?: string;
  policy_domains?: string[];
}

export interface EntityMatch {
  entity: PoliticalEntity;
  matchedOn: string;
  position: number;
}

// ============================================================================
// State Patterns
// ============================================================================

export const STATE_PATTERNS: Record<string, string> = {
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
  'puerto rico': 'PR', 'guam': 'GU', 'us virgin islands': 'VI',
};

export const STATE_ABBREVIATIONS = Object.values(STATE_PATTERNS);

// ============================================================================
// International Locations
// ============================================================================

export const INTERNATIONAL_LOCATIONS: Record<string, string[]> = {
  'international': [
    'ukraine', 'russia', 'china', 'israel', 'palestine', 'gaza', 'iran',
    'north korea', 'taiwan', 'mexico', 'canada', 'united kingdom', 'france',
    'germany', 'japan', 'india', 'brazil', 'saudi arabia', 'syria', 'afghanistan',
    'iraq', 'yemen', 'venezuela', 'cuba', 'south korea', 'australia',
    'european union', 'nato', 'un', 'united nations',
  ],
};

// ============================================================================
// Major Cities
// ============================================================================

export const MAJOR_CITIES: Record<string, string> = {
  // Top 50 US cities by population
  'new york city': 'NY', 'nyc': 'NY', 'los angeles': 'CA', 'chicago': 'IL',
  'houston': 'TX', 'phoenix': 'AZ', 'philadelphia': 'PA', 'san antonio': 'TX',
  'san diego': 'CA', 'dallas': 'TX', 'san jose': 'CA', 'austin': 'TX',
  'jacksonville': 'FL', 'fort worth': 'TX', 'columbus': 'OH', 'charlotte': 'NC',
  'san francisco': 'CA', 'indianapolis': 'IN', 'seattle': 'WA', 'denver': 'CO',
  'boston': 'MA', 'detroit': 'MI', 'el paso': 'TX', 'atlanta': 'GA',
  'nashville': 'TN', 'memphis': 'TN', 'portland': 'OR', 'oklahoma city': 'OK',
  'las vegas': 'NV', 'louisville': 'KY', 'baltimore': 'MD', 'milwaukee': 'WI',
  'albuquerque': 'NM', 'tucson': 'AZ', 'fresno': 'CA', 'mesa': 'AZ',
  'sacramento': 'CA', 'atlanta': 'GA', 'kansas city': 'MO', 'colorado springs': 'CO',
  'miami': 'FL', 'raleigh': 'NC', 'omaha': 'NE', 'long beach': 'CA',
  'virginia beach': 'VA', 'oakland': 'CA', 'minneapolis': 'MN', 'tulsa': 'OK',
  'arlington': 'TX', 'new orleans': 'LA', 'wichita': 'KS', 'cleveland': 'OH',
  'tampa': 'FL', 'bakersfield': 'CA', 'aurora': 'CO', 'honolulu': 'HI',
  'anaheim': 'CA', 'santa ana': 'CA', 'corpus christi': 'TX', 'riverside': 'CA',
  'lexington': 'KY', 'st louis': 'MO', 'stockton': 'CA', 'pittsburgh': 'PA',
  'saint paul': 'MN', 'st paul': 'MN', 'anchorage': 'AK', 'cincinnati': 'OH',
  'henderson': 'NV', 'greensboro': 'NC', 'plano': 'TX', 'newark': 'NJ',
  'lincoln': 'NE', 'orlando': 'FL', 'irvine': 'CA', 'toledo': 'OH',
  // DC area
  'washington dc': 'DC', 'washington d.c.': 'DC', 'the district': 'DC',
};

// ============================================================================
// Well-Known Politicians (Hardcoded for quick matching)
// ============================================================================

export const WELL_KNOWN_POLITICIANS: PoliticalEntity[] = [
  // Current Administration
  { canonical_name: 'Joe Biden', entity_type: 'politician', aliases: ['biden', 'president biden'], party: 'D', office: 'President' },
  { canonical_name: 'Kamala Harris', entity_type: 'politician', aliases: ['harris', 'vice president harris'], party: 'D', office: 'Vice President' },

  // Congressional Leadership
  { canonical_name: 'Chuck Schumer', entity_type: 'politician', aliases: ['schumer', 'senator schumer'], party: 'D', state: 'NY', office: 'Senate Majority Leader' },
  { canonical_name: 'Mitch McConnell', entity_type: 'politician', aliases: ['mcconnell', 'senator mcconnell'], party: 'R', state: 'KY', office: 'Senate Minority Leader' },
  { canonical_name: 'Mike Johnson', entity_type: 'politician', aliases: ['speaker johnson'], party: 'R', state: 'LA', office: 'Speaker of the House' },
  { canonical_name: 'Hakeem Jeffries', entity_type: 'politician', aliases: ['jeffries', 'representative jeffries'], party: 'D', state: 'NY', office: 'House Minority Leader' },

  // Former Presidents
  { canonical_name: 'Donald Trump', entity_type: 'politician', aliases: ['trump', 'former president trump'], party: 'R', office: 'Former President' },
  { canonical_name: 'Barack Obama', entity_type: 'politician', aliases: ['obama', 'former president obama'], party: 'D', office: 'Former President' },

  // Supreme Court (all 9 justices)
  { canonical_name: 'John Roberts', entity_type: 'politician', aliases: ['chief justice roberts', 'roberts'], office: 'Chief Justice' },
  { canonical_name: 'Clarence Thomas', entity_type: 'politician', aliases: ['justice thomas', 'thomas'], office: 'Supreme Court Justice' },
  { canonical_name: 'Samuel Alito', entity_type: 'politician', aliases: ['justice alito', 'alito'], office: 'Supreme Court Justice' },
  { canonical_name: 'Sonia Sotomayor', entity_type: 'politician', aliases: ['justice sotomayor', 'sotomayor'], office: 'Supreme Court Justice' },
  { canonical_name: 'Elena Kagan', entity_type: 'politician', aliases: ['justice kagan', 'kagan'], office: 'Supreme Court Justice' },
  { canonical_name: 'Neil Gorsuch', entity_type: 'politician', aliases: ['justice gorsuch', 'gorsuch'], office: 'Supreme Court Justice' },
  { canonical_name: 'Brett Kavanaugh', entity_type: 'politician', aliases: ['justice kavanaugh', 'kavanaugh'], office: 'Supreme Court Justice' },
  { canonical_name: 'Amy Coney Barrett', entity_type: 'politician', aliases: ['justice barrett', 'barrett', 'acb'], office: 'Supreme Court Justice' },
  { canonical_name: 'Ketanji Brown Jackson', entity_type: 'politician', aliases: ['justice jackson', 'jackson', 'kbj'], office: 'Supreme Court Justice' },

  // Prominent Senators
  { canonical_name: 'Bernie Sanders', entity_type: 'politician', aliases: ['bernie', 'senator sanders'], party: 'I', state: 'VT' },
  { canonical_name: 'Elizabeth Warren', entity_type: 'politician', aliases: ['warren', 'senator warren'], party: 'D', state: 'MA' },
  { canonical_name: 'Ted Cruz', entity_type: 'politician', aliases: ['cruz', 'senator cruz'], party: 'R', state: 'TX' },
  { canonical_name: 'Marco Rubio', entity_type: 'politician', aliases: ['rubio', 'senator rubio'], party: 'R', state: 'FL' },

  // Prominent Representatives
  { canonical_name: 'Alexandria Ocasio-Cortez', entity_type: 'politician', aliases: ['aoc', 'ocasio-cortez', 'representative ocasio-cortez'], party: 'D', state: 'NY' },
  { canonical_name: 'Marjorie Taylor Greene', entity_type: 'politician', aliases: ['mtg', 'greene', 'representative greene'], party: 'R', state: 'GA' },
];

// ============================================================================
// Well-Known Organizations
// ============================================================================

export const WELL_KNOWN_ORGANIZATIONS: PoliticalEntity[] = [
  { canonical_name: 'ACLU', entity_type: 'organization', aliases: ['american civil liberties union'], policy_domains: ['Civil Rights'] },
  { canonical_name: 'NAACP', entity_type: 'organization', aliases: ['national association for the advancement of colored people'], policy_domains: ['Civil Rights'] },
  { canonical_name: 'Planned Parenthood', entity_type: 'organization', aliases: [], policy_domains: ['Healthcare', 'Civil Rights'] },
  { canonical_name: 'NRA', entity_type: 'organization', aliases: ['national rifle association'], policy_domains: ['Civil Rights'] },
  { canonical_name: 'AFL-CIO', entity_type: 'organization', aliases: ['afl cio'], policy_domains: ['Labor & Workers Rights'] },
  { canonical_name: 'AARP', entity_type: 'organization', aliases: [], policy_domains: ['Healthcare', 'Economic Justice'] },
  { canonical_name: 'Sierra Club', entity_type: 'organization', aliases: [], policy_domains: ['Environment'] },
  { canonical_name: 'Greenpeace', entity_type: 'organization', aliases: [], policy_domains: ['Environment'] },
  { canonical_name: 'Human Rights Campaign', entity_type: 'organization', aliases: ['hrc'], policy_domains: ['Civil Rights'] },
  { canonical_name: 'Heritage Foundation', entity_type: 'organization', aliases: [], policy_domains: ['Economic Justice', 'Foreign Policy'] },
  { canonical_name: 'Brookings Institution', entity_type: 'organization', aliases: ['brookings'], policy_domains: ['Economic Justice', 'Foreign Policy'] },
];

// ============================================================================
// Government Agencies
// ============================================================================

export const GOVERNMENT_AGENCIES: PoliticalEntity[] = [
  // Departments
  { canonical_name: 'Department of Justice', entity_type: 'agency', aliases: ['doj', 'justice department'], policy_domains: ['Criminal Justice', 'Civil Rights'] },
  { canonical_name: 'Department of Homeland Security', entity_type: 'agency', aliases: ['dhs'], policy_domains: ['Immigration'] },
  { canonical_name: 'Department of Education', entity_type: 'agency', aliases: ['doe', 'ed'], policy_domains: ['Education'] },
  { canonical_name: 'Department of Health and Human Services', entity_type: 'agency', aliases: ['hhs'], policy_domains: ['Healthcare'] },
  { canonical_name: 'Department of Housing and Urban Development', entity_type: 'agency', aliases: ['hud'], policy_domains: ['Housing'] },
  { canonical_name: 'Department of Energy', entity_type: 'agency', aliases: ['doe'], policy_domains: ['Environment', 'Technology'] },
  { canonical_name: 'Department of Transportation', entity_type: 'agency', aliases: ['dot'], policy_domains: ['Economic Justice'] },
  { canonical_name: 'Department of Labor', entity_type: 'agency', aliases: ['dol'], policy_domains: ['Labor & Workers Rights'] },
  { canonical_name: 'Department of Agriculture', entity_type: 'agency', aliases: ['usda'], policy_domains: ['Environment', 'Economic Justice'] },
  { canonical_name: 'Department of Commerce', entity_type: 'agency', aliases: ['doc'], policy_domains: ['Economic Justice', 'Technology'] },
  { canonical_name: 'Department of Interior', entity_type: 'agency', aliases: ['doi'], policy_domains: ['Environment'] },
  { canonical_name: 'Department of Veterans Affairs', entity_type: 'agency', aliases: ['va'], policy_domains: ['Healthcare'] },
  { canonical_name: 'Department of State', entity_type: 'agency', aliases: ['state department'], policy_domains: ['Foreign Policy'] },
  { canonical_name: 'Department of Treasury', entity_type: 'agency', aliases: ['treasury'], policy_domains: ['Economic Justice'] },
  { canonical_name: 'Department of Defense', entity_type: 'agency', aliases: ['dod', 'pentagon'], policy_domains: ['Foreign Policy'] },

  // Major Agencies
  { canonical_name: 'Environmental Protection Agency', entity_type: 'agency', aliases: ['epa'], policy_domains: ['Environment'] },
  { canonical_name: 'Federal Bureau of Investigation', entity_type: 'agency', aliases: ['fbi'], policy_domains: ['Criminal Justice'] },
  { canonical_name: 'Immigration and Customs Enforcement', entity_type: 'agency', aliases: ['ice'], policy_domains: ['Immigration'] },
  { canonical_name: 'Customs and Border Protection', entity_type: 'agency', aliases: ['cbp', 'border patrol'], policy_domains: ['Immigration'] },
  { canonical_name: 'Federal Trade Commission', entity_type: 'agency', aliases: ['ftc'], policy_domains: ['Technology', 'Economic Justice'] },
  { canonical_name: 'Securities and Exchange Commission', entity_type: 'agency', aliases: ['sec'], policy_domains: ['Economic Justice'] },
  { canonical_name: 'National Labor Relations Board', entity_type: 'agency', aliases: ['nlrb'], policy_domains: ['Labor & Workers Rights'] },

  // Healthcare Agencies
  { canonical_name: 'Food and Drug Administration', entity_type: 'agency', aliases: ['fda'], policy_domains: ['Healthcare'] },
  { canonical_name: 'Centers for Disease Control and Prevention', entity_type: 'agency', aliases: ['cdc'], policy_domains: ['Healthcare'] },
  { canonical_name: 'National Institutes of Health', entity_type: 'agency', aliases: ['nih'], policy_domains: ['Healthcare'] },
  { canonical_name: 'Centers for Medicare and Medicaid Services', entity_type: 'agency', aliases: ['cms'], policy_domains: ['Healthcare'] },

  // Other Important Agencies
  { canonical_name: 'Federal Communications Commission', entity_type: 'agency', aliases: ['fcc'], policy_domains: ['Technology'] },
  { canonical_name: 'Federal Reserve', entity_type: 'agency', aliases: ['the fed', 'federal reserve board'], policy_domains: ['Economic Justice'] },
  { canonical_name: 'Consumer Financial Protection Bureau', entity_type: 'agency', aliases: ['cfpb'], policy_domains: ['Economic Justice'] },
  { canonical_name: 'Social Security Administration', entity_type: 'agency', aliases: ['ssa', 'social security'], policy_domains: ['Economic Justice'] },
  { canonical_name: 'Small Business Administration', entity_type: 'agency', aliases: ['sba'], policy_domains: ['Economic Justice'] },
  { canonical_name: 'Federal Emergency Management Agency', entity_type: 'agency', aliases: ['fema'], policy_domains: ['Environment'] },
  { canonical_name: 'Bureau of Alcohol, Tobacco, Firearms and Explosives', entity_type: 'agency', aliases: ['atf'], policy_domains: ['Criminal Justice'] },
  { canonical_name: 'Drug Enforcement Administration', entity_type: 'agency', aliases: ['dea'], policy_domains: ['Criminal Justice', 'Healthcare'] },
  { canonical_name: 'Bureau of Prisons', entity_type: 'agency', aliases: ['bop'], policy_domains: ['Criminal Justice'] },
  { canonical_name: 'Equal Employment Opportunity Commission', entity_type: 'agency', aliases: ['eeoc'], policy_domains: ['Labor & Workers Rights', 'Civil Rights'] },
  { canonical_name: 'Occupational Safety and Health Administration', entity_type: 'agency', aliases: ['osha'], policy_domains: ['Labor & Workers Rights'] },
  { canonical_name: 'National Security Agency', entity_type: 'agency', aliases: ['nsa'], policy_domains: ['Technology', 'Foreign Policy'] },
  { canonical_name: 'Central Intelligence Agency', entity_type: 'agency', aliases: ['cia'], policy_domains: ['Foreign Policy'] },
  { canonical_name: 'Cybersecurity and Infrastructure Security Agency', entity_type: 'agency', aliases: ['cisa'], policy_domains: ['Technology'] },
  { canonical_name: 'Federal Election Commission', entity_type: 'agency', aliases: ['fec'], policy_domains: ['Voting Rights'] },
  { canonical_name: 'U.S. Citizenship and Immigration Services', entity_type: 'agency', aliases: ['uscis'], policy_domains: ['Immigration'] },
];

// ============================================================================
// Cabinet Positions (for pattern matching)
// ============================================================================

export const CABINET_POSITIONS: PoliticalEntity[] = [
  { canonical_name: 'Secretary of State', entity_type: 'politician', aliases: ['state secretary'], office: 'Cabinet', policy_domains: ['Foreign Policy'] },
  { canonical_name: 'Secretary of Defense', entity_type: 'politician', aliases: ['defense secretary', 'secdef'], office: 'Cabinet', policy_domains: ['Foreign Policy'] },
  { canonical_name: 'Secretary of Treasury', entity_type: 'politician', aliases: ['treasury secretary'], office: 'Cabinet', policy_domains: ['Economic Justice'] },
  { canonical_name: 'Attorney General', entity_type: 'politician', aliases: ['ag'], office: 'Cabinet', policy_domains: ['Criminal Justice', 'Civil Rights'] },
  { canonical_name: 'Secretary of Homeland Security', entity_type: 'politician', aliases: ['homeland security secretary', 'dhs secretary'], office: 'Cabinet', policy_domains: ['Immigration'] },
  { canonical_name: 'Secretary of Health and Human Services', entity_type: 'politician', aliases: ['hhs secretary', 'health secretary'], office: 'Cabinet', policy_domains: ['Healthcare'] },
  { canonical_name: 'Secretary of Education', entity_type: 'politician', aliases: ['education secretary'], office: 'Cabinet', policy_domains: ['Education'] },
  { canonical_name: 'Secretary of Housing and Urban Development', entity_type: 'politician', aliases: ['hud secretary', 'housing secretary'], office: 'Cabinet', policy_domains: ['Housing'] },
  { canonical_name: 'Secretary of Transportation', entity_type: 'politician', aliases: ['transportation secretary', 'dot secretary'], office: 'Cabinet', policy_domains: ['Economic Justice'] },
  { canonical_name: 'Secretary of Energy', entity_type: 'politician', aliases: ['energy secretary', 'doe secretary'], office: 'Cabinet', policy_domains: ['Environment', 'Technology'] },
  { canonical_name: 'Secretary of Agriculture', entity_type: 'politician', aliases: ['agriculture secretary', 'usda secretary'], office: 'Cabinet', policy_domains: ['Environment'] },
  { canonical_name: 'Secretary of Commerce', entity_type: 'politician', aliases: ['commerce secretary'], office: 'Cabinet', policy_domains: ['Economic Justice', 'Technology'] },
  { canonical_name: 'Secretary of Labor', entity_type: 'politician', aliases: ['labor secretary', 'dol secretary'], office: 'Cabinet', policy_domains: ['Labor & Workers Rights'] },
  { canonical_name: 'Secretary of Interior', entity_type: 'politician', aliases: ['interior secretary'], office: 'Cabinet', policy_domains: ['Environment'] },
  { canonical_name: 'Secretary of Veterans Affairs', entity_type: 'politician', aliases: ['va secretary', 'veterans affairs secretary'], office: 'Cabinet', policy_domains: ['Healthcare'] },
  { canonical_name: 'EPA Administrator', entity_type: 'politician', aliases: ['epa head', 'environmental protection agency administrator'], office: 'Cabinet', policy_domains: ['Environment'] },
  { canonical_name: 'OMB Director', entity_type: 'politician', aliases: ['budget director', 'office of management and budget director'], office: 'Cabinet', policy_domains: ['Economic Justice'] },
  { canonical_name: 'UN Ambassador', entity_type: 'politician', aliases: ['ambassador to the united nations', 'us ambassador to the un'], office: 'Cabinet', policy_domains: ['Foreign Policy'] },
];

// ============================================================================
// Governor Patterns (for state-level detection)
// ============================================================================

export const GOVERNOR_PATTERNS = Object.entries(STATE_PATTERNS).map(([stateName, abbrev]) => ({
  canonical_name: `Governor of ${stateName.charAt(0).toUpperCase() + stateName.slice(1)}`,
  entity_type: 'politician' as const,
  aliases: [`${abbrev.toLowerCase()} governor`, `governor of ${stateName}`],
  office: 'Governor',
  state: abbrev,
}));

// ============================================================================
// Matching Functions
// ============================================================================

/**
 * Check if text contains a state abbreviation as a standalone word
 * Uses word boundaries to avoid false positives like "any" matching NY
 */
function containsStateAbbreviation(text: string, abbrev: string): boolean {
  // Create regex with word boundaries (case-insensitive)
  const pattern = new RegExp(`\\b${abbrev}\\b`, 'i');

  // Additional check: Avoid common false positives for short abbreviations
  const falsePositivePatterns: Record<string, RegExp> = {
    'NY': /\b(any|many|zany|rainy)\b/i,
    'TX': /\b(text|next|sext)\b/i,
    'IN': /\b(in\s+(the|a|an|this|that|which|my|your|our|their))\b/i,
    'OR': /\b(or\s+(a|an|the|not|if|when|else))\b/i,
    'ME': /\b(me\s+(too|a|the|to|up|down)|give\s+me|tell\s+me|help\s+me)\b/i,
    'OK': /\b(ok|okay)\b/i,
    'HI': /\b(hi\s|hi,|hi!|\bhi\b(?!\s*\d))/i,
    'MA': /\b(ma'am|mama)\b/i,
    'PA': /\b(papa)\b/i,
    'LA': /\b(la\s+(la|vie|times))\b/i,
    'DE': /\b(de\s+la|de\s+facto|de\s+jure)\b/i,
    'AL': /\b(al\s+\w+|et\s+al)\b/i,
  };

  // Check for false positive patterns first
  const fpPattern = falsePositivePatterns[abbrev.toUpperCase()];
  if (fpPattern && fpPattern.test(text)) {
    // If false positive pattern matches, also check if the actual state context exists
    // e.g., "New York, NY" should still match even with false positive text nearby
    const stateContextPattern = new RegExp(
      `\\b(${abbrev}\\s*\\d{5}|,\\s*${abbrev}\\b|\\b${abbrev}\\s*(state|governor|senator|representative))`,
      'i'
    );
    if (!stateContextPattern.test(text)) {
      return false;
    }
  }

  return pattern.test(text);
}

/**
 * Detect geographies mentioned in text
 */
export function detectGeographies(text: string): {
  geographies: string[];
  geo_level: 'local' | 'state' | 'national' | 'international';
} {
  const geos = new Set<string>();
  let geo_level: 'local' | 'state' | 'national' | 'international' = 'national';
  const lowerText = text.toLowerCase();

  // State detection - full name matching (always reliable)
  for (const [stateName, abbrev] of Object.entries(STATE_PATTERNS)) {
    if (lowerText.includes(stateName)) {
      geos.add(abbrev);
      geo_level = 'state';
    }
  }

  // State abbreviation matching (with word boundary checks to avoid false positives)
  for (const [stateName, abbrev] of Object.entries(STATE_PATTERNS)) {
    if (!geos.has(abbrev) && containsStateAbbreviation(text, abbrev)) {
      geos.add(abbrev);
      geo_level = 'state';
    }
  }

  // City detection (major cities)
  for (const [city, state] of Object.entries(MAJOR_CITIES)) {
    if (lowerText.includes(city)) {
      geos.add(state);
      geo_level = 'local';
    }
  }

  // International detection
  for (const country of INTERNATIONAL_LOCATIONS['international']) {
    if (lowerText.includes(country)) {
      geos.add('international');
      geo_level = 'international';
    }
  }

  // Default to national if no specific geography
  if (geos.size === 0) {
    geos.add('US');
    geo_level = 'national';
  }

  return { geographies: Array.from(geos), geo_level };
}

/**
 * Match entities in text against known politicians, orgs, agencies
 */
export function matchEntities(
  text: string,
  entities: PoliticalEntity[]
): EntityMatch[] {
  const matches: EntityMatch[] = [];
  const lowerText = text.toLowerCase();

  for (const entity of entities) {
    const namesToCheck = [entity.canonical_name, ...entity.aliases];

    for (const name of namesToCheck) {
      const lowerName = name.toLowerCase();
      const position = lowerText.indexOf(lowerName);

      if (position !== -1) {
        // Check for word boundary (avoid partial matches)
        const before = position > 0 ? lowerText[position - 1] : ' ';
        const after = position + lowerName.length < lowerText.length
          ? lowerText[position + lowerName.length]
          : ' ';

        if (/\W/.test(before) && /\W/.test(after)) {
          matches.push({ entity, matchedOn: name, position });
          break; // Only match once per entity
        }
      }
    }
  }

  return matches;
}

/**
 * Extract all entity types from text
 */
export function extractAllEntities(text: string): {
  politicians: string[];
  organizations: string[];
  agencies: string[];
  legislation: string[];
  cabinetPositions: string[];
} {
  const politicianMatches = matchEntities(text, WELL_KNOWN_POLITICIANS);
  const orgMatches = matchEntities(text, WELL_KNOWN_ORGANIZATIONS);
  const agencyMatches = matchEntities(text, GOVERNMENT_AGENCIES);
  const cabinetMatches = matchEntities(text, CABINET_POSITIONS);

  return {
    politicians: politicianMatches.map(m => m.entity.canonical_name),
    organizations: orgMatches.map(m => m.entity.canonical_name),
    agencies: agencyMatches.map(m => m.entity.canonical_name),
    legislation: [], // Would need external lookup
    cabinetPositions: cabinetMatches.map(m => m.entity.canonical_name),
  };
}

/**
 * Get policy domains associated with matched entities
 */
export function getDomainsFromEntities(entities: PoliticalEntity[]): string[] {
  const domains = new Set<string>();

  for (const entity of entities) {
    if (entity.policy_domains) {
      for (const domain of entity.policy_domains) {
        domains.add(domain);
      }
    }
  }

  return Array.from(domains);
}
