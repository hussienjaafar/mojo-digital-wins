// IMPROVED THREAT SCORING ALGORITHM
// Differentiates between source (who published) and target (who's threatened)
// Looks for threat context, not just keyword presence

// Threat indicators - show something BAD is happening TO an organization
const THREAT_INDICATORS = {
  critical: [
    'designated as terrorist',
    'terrorist designation',
    'sanctions against',
    'banned',
    'asset freeze',
    'criminal charges',
    'indictment',
    'sued for',
    'investigation into',
    'crackdown on',
    'shutdown',
    'dissolved',
  ],
  high: [
    'accused of',
    'alleged',
    'controversy',
    'criticism',
    'protest against',
    'opposition to',
    'concerns about',
    'questioned',
    'challenged',
    'scrutiny',
    'under fire',
    'backlash',
  ],
  medium: [
    'debate over',
    'discussion about',
    'focus on',
    'attention to',
  ]
};

// Issue keywords - topics that are relevant to monitor
const ISSUE_KEYWORDS = {
  high_priority: [
    'surveillance',
    'profiling',
    'discrimination lawsuit',
    'hate crime',
    'civil rights violation',
    'religious freedom violation',
    'deportation',
    'immigration enforcement',
    'travel ban',
    'refugee ban',
  ],
  medium_priority: [
    'immigration',
    'border security',
    'national security',
    'counterterrorism',
    'religious freedom',
    'civil liberties',
    'first amendment',
  ]
};

// Organizations to track
const TRACKED_ORGS = {
  'cair': 'CAIR',
  'council on american-islamic relations': 'CAIR',
  'mpac': 'MPAC',
  'muslim public affairs council': 'MPAC',
  'isna': 'ISNA',
  'islamic society of north america': 'ISNA',
  'adc': 'ADC',
  'american-arab anti-discrimination committee': 'ADC',
  'aai': 'AAI',
  'arab american institute': 'AAI',
  'mas': 'MAS',
  'muslim american society': 'MAS',
  'icna': 'ICNA',
  'islamic circle of north america': 'ICNA',
  'aclu': 'ACLU',
};

function calculateThreatLevel(
  text: string,
  sourceName: string
): { level: string; score: number; affectedOrgs: string[] } {
  const lowerText = text.toLowerCase();
  const lowerSource = sourceName.toLowerCase();
  const affectedOrgs: string[] = [];
  let score = 0;

  // 1. IDENTIFY AFFECTED ORGANIZATIONS
  const mentionedOrgs = new Set<string>();
  for (const [pattern, orgName] of Object.entries(TRACKED_ORGS)) {
    if (lowerText.includes(pattern)) {
      mentionedOrgs.add(orgName);
      if (!affectedOrgs.includes(orgName)) {
        affectedOrgs.push(orgName);
      }
    }
  }

  // 2. CHECK IF ARTICLE IS FROM A TRACKED ORG
  let isFromTrackedOrg = false;
  for (const [pattern, orgName] of Object.entries(TRACKED_ORGS)) {
    if (lowerSource.includes(pattern)) {
      isFromTrackedOrg = true;
      break;
    }
  }

  // 3. SCORE BASED ON THREAT INDICATORS
  // Critical threats (things happening TO organizations)
  for (const indicator of THREAT_INDICATORS.critical) {
    if (lowerText.includes(indicator)) {
      // Only score if an org is mentioned (threat must target someone)
      if (mentionedOrgs.size > 0) {
        score += 50;
        break; // One critical indicator is enough
      }
    }
  }

  // High threat indicators
  for (const indicator of THREAT_INDICATORS.high) {
    if (lowerText.includes(indicator)) {
      if (mentionedOrgs.size > 0) {
        score += 20;
        break; // One high indicator is enough
      }
    }
  }

  // Medium threat indicators
  for (const indicator of THREAT_INDICATORS.medium) {
    if (lowerText.includes(indicator)) {
      if (mentionedOrgs.size > 0) {
        score += 10;
        break;
      }
    }
  }

  // 4. SCORE BASED ON ISSUE RELEVANCE
  // High priority issues
  for (const issue of ISSUE_KEYWORDS.high_priority) {
    if (lowerText.includes(issue)) {
      score += 15;
      break; // One mention is enough
    }
  }

  // Medium priority issues
  for (const issue of ISSUE_KEYWORDS.medium_priority) {
    if (lowerText.includes(issue)) {
      score += 5;
      break;
    }
  }

  // 5. BONUS POINTS IF ARTICLE IS ABOUT (NOT FROM) A TRACKED ORG
  if (mentionedOrgs.size > 0 && !isFromTrackedOrg) {
    // Article mentions tracked org but isn't from that org
    // This means outside coverage, which could be significant
    score += 10;
  }

  // 6. IF ARTICLE IS FROM TRACKED ORG, ONLY SCORE ON CONTENT
  // Articles FROM CAIR should be scored based on what they're ABOUT
  // Not because they mention CAIR
  // (Already handled above - we don't give points just for org mentions)

  // 7. DETERMINE THREAT LEVEL
  let level = 'low';
  if (score >= 50) {
    level = 'critical';
  } else if (score >= 25) {
    level = 'high';
  } else if (score >= 10) {
    level = 'medium';
  }

  return { level, score: Math.min(score, 100), affectedOrgs };
}

// EXAMPLES OF HOW THIS WORKS:

// Example 1: CAIR press release about festival
// Text: "CAIR-Philadelphia to Present Muslim Communities Arts Festival"
// Source: "CAIR"
// Scoring:
// - Mentions CAIR: tracked org identified
// - Source is CAIR: isFromTrackedOrg = true
// - No threat indicators: 0 points
// - No high-priority issues: 0 points
// - "muslim" is medium issue: +5 points
// - Is from tracked org, so no bonus: 0
// Total: 5 = LOW ✅

// Example 2: News article about CAIR being sued
// Text: "CAIR Accused of Financial Irregularities in Lawsuit"
// Source: "Fox News"
// Scoring:
// - Mentions CAIR: tracked org identified
// - Source is NOT CAIR: isFromTrackedOrg = false
// - "accused of" is high threat indicator: +20 points
// - Mentions tracked org from outside source: +10 bonus
// Total: 30 = HIGH ✅

// Example 3: Government designating CAIR as terrorist org
// Text: "Trump Administration Moves to Designate CAIR as Terrorist Organization"
// Source: "Reuters"
// Scoring:
// - Mentions CAIR: tracked org identified
// - "designated as terrorist" is CRITICAL threat: +50 points
// - Mentions tracked org from outside: +10 bonus
// Total: 60 = CRITICAL ✅

// Example 4: Article about immigration enforcement
// Text: "DHS Launching Massive Immigration Operation in Louisiana"
// Source: "Fox News"
// Scoring:
// - No org mentions: affectedOrgs = []
// - No threat indicators (nothing targeting an org)
// - "immigration enforcement" is high-priority issue: +15
// Total: 15 = MEDIUM ✅

// Example 5: CAIR condemning hate crime
// Text: "CAIR Calls for Hate Crime Investigation After Mosque Vandalism"
// Source: "CAIR"
// Scoring:
// - Mentions CAIR: tracked org
// - Source is CAIR: isFromTrackedOrg = true
// - "hate crime" is high-priority issue: +15
// - No threat TO CAIR specifically: 0
// Total: 15 = MEDIUM ✅
