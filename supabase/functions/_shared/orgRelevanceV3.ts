/**
 * Org-Specific Relevance Scoring Engine V3
 *
 * Profile-First (70%) + Learning-Second (30%) with Anti-Filter-Bubble Safeguards
 *
 * Scoring Breakdown:
 *   PROFILE-BASED (70 pts max):
 *     - Policy Domain Match: 35 pts (from onboarding)
 *     - Focus Areas Match: 20 pts (from onboarding)
 *     - Watchlist Entity Match: 15 pts (from onboarding)
 *
 *   LEARNED + EXPLORATION (30 pts max):
 *     - Learned Affinity: 20 pts (from campaign history, CAPPED)
 *     - Exploration Bonus: 10 pts (declared but UNTRIED domains)
 */

// ============================================================================
// Types
// ============================================================================

export interface EnhancedTrendEvent {
  id: string;
  event_key: string;
  event_title: string;
  policy_domains?: string[];
  geographies?: string[];
  geo_level?: string;
  politicians_mentioned?: string[];
  organizations_mentioned?: string[];
  legislation_mentioned?: string[];
  context_terms?: string[];
  is_breaking?: boolean;
  confidence_score?: number;
  top_headline?: string;
}

export interface OrgProfile {
  id: string;
  organization_id: string;
  org_type?: string | null;
  display_name?: string | null;
  mission_summary?: string | null;
  focus_areas?: string[] | null;
  key_issues?: string[] | null;
  geographies?: string[] | null;
  primary_goals?: string[] | null;
  audiences?: string[] | null;
  policy_domains?: string[] | null;
  interest_topics?: string[] | null;
  sensitivity_redlines?: {
    geo_level?: string;
  } | null;
}

export interface WatchlistEntity {
  entity_name: string;
  entity_type: string;
  is_active: boolean;
}

export interface OrgTopicAffinity {
  topic: string;
  affinity_score: number;  // 0-1 scale
  times_used: number;
  avg_performance: number;
  source: 'learned_outcome' | 'self_declared' | 'admin_override';
}

export interface RelevanceResult {
  score: number;
  reasons: string[];
  flags: string[];  // 'NEW_OPPORTUNITY', 'PROVEN_TOPIC', 'BREAKING', 'WATCHLIST_MATCH'
  isNewOpportunity: boolean;
  isProvenTopic: boolean;
  matchedDomains: string[];
  matchedWatchlist: string[];
  priorityBucket: 'high' | 'medium' | 'low';
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeString(s: string): string {
  return s.toLowerCase().trim();
}

function stringsMatch(a: string, b: string): boolean {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  return normA === normB || normA.includes(normB) || normB.includes(normA);
}

// ============================================================================
// Main Scoring Function
// ============================================================================

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
    declaredDomains.some(dd => normalizeString(dd) === normalizeString(d))
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
    trendText.includes(normalizeString(fa))
  );

  if (focusMatches.length > 0) {
    const focusScore = Math.min(focusMatches.length * 10, 20);
    score += focusScore;
    reasons.push(`Focus area: ${focusMatches.slice(0, 3).join(', ')} (+${focusScore})`);
  }

  // 1C. Watchlist Entity Match (0-15 pts) - EXPLICIT TRACKING
  const activeWatchlist = watchlist.filter(w => w.is_active);
  const watchlistNames = activeWatchlist.map(w => normalizeString(w.entity_name));
  const trendEntities = [
    ...(trend.politicians_mentioned || []),
    ...(trend.organizations_mentioned || []),
    ...(trend.context_terms || []),
  ].map(e => normalizeString(e));

  const watchlistMatches = watchlistNames.filter(w =>
    trendEntities.some(e => stringsMatch(e, w))
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
    trendDomains.some(td => normalizeString(td) === normalizeString(a.topic)) ||
    (trend.context_terms || []).some(t =>
      normalizeString(t).includes(normalizeString(a.topic))
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
    .map(a => normalizeString(a.topic));

  // Check if trend matches a declared domain that hasn't been tried
  const isNewOpportunity = domainOverlap.some(domain =>
    !triedTopics.includes(normalizeString(domain))
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
    const geoMatch = profile.geographies.some(og =>
      trendGeos.some(tg => stringsMatch(og, tg))
    ) || (trendGeos.includes('US') && profile.sensitivity_redlines?.geo_level === 'national');

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

/**
 * Batch calculate relevance for multiple trends
 */
export function calculateBatchRelevance(
  trends: EnhancedTrendEvent[],
  profile: OrgProfile,
  watchlist: WatchlistEntity[],
  affinities: OrgTopicAffinity[]
): Array<EnhancedTrendEvent & RelevanceResult> {
  return trends.map(trend => ({
    ...trend,
    ...calculateOrgRelevanceV3(trend, profile, watchlist, affinities),
  }));
}
