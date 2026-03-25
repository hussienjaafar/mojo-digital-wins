/**
 * Trend Diversity Functions
 *
 * Anti-filter-bubble safeguards that ensure variety across declared domains
 * and prevent recommendation echo chambers.
 */

import type { OrgProfile, RelevanceResult, EnhancedTrendEvent } from './orgRelevanceV3.ts';

// ============================================================================
// Types
// ============================================================================

export interface OrgTrend extends EnhancedTrendEvent, RelevanceResult {
  org_relevance_score: number;
}

export interface DiversityConfig {
  maxTrends: number;
  minDomainsRepresented: number;
  newOpportunityBoost: boolean;
  prioritizeBreaking: boolean;
}

const DEFAULT_CONFIG: DiversityConfig = {
  maxTrends: 15,
  minDomainsRepresented: 3,
  newOpportunityBoost: true,
  prioritizeBreaking: true,
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Ensure daily recommendations include variety across declared domains
 * Prevents filter bubble by guaranteeing representation
 */
export function ensureDomainDiversity(
  trends: OrgTrend[],
  profile: OrgProfile,
  maxTrends = 15
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

/**
 * Advanced diversity selection with configurable parameters
 */
export function selectDiverseTrends(
  trends: OrgTrend[],
  profile: OrgProfile,
  config: Partial<DiversityConfig> = {}
): OrgTrend[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const declaredDomains = profile.policy_domains || profile.interest_topics || [];

  if (trends.length === 0) return [];

  const selectedTrends: OrgTrend[] = [];
  const usedTrendIds = new Set<string>();
  const domainCoverage = new Map<string, number>();

  // Initialize domain coverage tracking
  for (const domain of declaredDomains) {
    domainCoverage.set(domain.toLowerCase(), 0);
  }

  // Phase 1: Breaking news (if enabled and highly relevant)
  if (cfg.prioritizeBreaking) {
    const breakingTrends = trends.filter(t =>
      t.flags?.includes('BREAKING') && t.score >= 40
    );
    for (const trend of breakingTrends.slice(0, 3)) {
      if (!usedTrendIds.has(trend.id)) {
        selectedTrends.push(trend);
        usedTrendIds.add(trend.id);
        updateDomainCoverage(trend, domainCoverage);
      }
    }
  }

  // Phase 2: Ensure minimum domain coverage
  for (const domain of declaredDomains) {
    const currentCoverage = domainCoverage.get(domain.toLowerCase()) || 0;
    if (currentCoverage < 1 && selectedTrends.length < cfg.maxTrends) {
      const domainTrend = trends.find(t =>
        !usedTrendIds.has(t.id) &&
        t.matchedDomains?.some(d => d.toLowerCase() === domain.toLowerCase())
      );
      if (domainTrend) {
        selectedTrends.push(domainTrend);
        usedTrendIds.add(domainTrend.id);
        updateDomainCoverage(domainTrend, domainCoverage);
      }
    }
  }

  // Phase 3: New opportunities (if enabled)
  if (cfg.newOpportunityBoost) {
    const newOpps = trends
      .filter(t => !usedTrendIds.has(t.id) && t.isNewOpportunity)
      .slice(0, Math.floor(cfg.maxTrends * 0.2)); // Up to 20% new opportunities

    for (const trend of newOpps) {
      if (selectedTrends.length >= cfg.maxTrends) break;
      selectedTrends.push(trend);
      usedTrendIds.add(trend.id);
      updateDomainCoverage(trend, domainCoverage);
    }
  }

  // Phase 4: Fill with highest scoring
  const remaining = trends
    .filter(t => !usedTrendIds.has(t.id))
    .sort((a, b) => b.score - a.score);

  for (const trend of remaining) {
    if (selectedTrends.length >= cfg.maxTrends) break;
    selectedTrends.push(trend);
    usedTrendIds.add(trend.id);
  }

  return selectedTrends.sort((a, b) => b.score - a.score);
}

function updateDomainCoverage(trend: OrgTrend, coverage: Map<string, number>): void {
  for (const domain of trend.matchedDomains || []) {
    const key = domain.toLowerCase();
    if (coverage.has(key)) {
      coverage.set(key, (coverage.get(key) || 0) + 1);
    }
  }
}

/**
 * Calculate diversity metrics for a set of trends
 */
export function calculateDiversityMetrics(
  trends: OrgTrend[],
  declaredDomains: string[]
): {
  totalTrends: number;
  uniqueDomains: number;
  domainsRepresented: string[];
  domainsMissing: string[];
  newOpportunityCount: number;
  provenTopicCount: number;
  diversityScore: number;
} {
  const domainsInTrends = new Set<string>();
  let newOpportunityCount = 0;
  let provenTopicCount = 0;

  for (const trend of trends) {
    for (const domain of trend.matchedDomains || []) {
      domainsInTrends.add(domain.toLowerCase());
    }
    if (trend.isNewOpportunity) newOpportunityCount++;
    if (trend.isProvenTopic) provenTopicCount++;
  }

  const declaredLower = declaredDomains.map(d => d.toLowerCase());
  const represented = declaredLower.filter(d => domainsInTrends.has(d));
  const missing = declaredLower.filter(d => !domainsInTrends.has(d));

  // Diversity score: higher is better (0-100)
  // Factors: domain coverage, new opportunity ratio, balance
  const coverageRatio = declaredDomains.length > 0
    ? represented.length / declaredDomains.length
    : 1;
  const newOppRatio = trends.length > 0
    ? Math.min(newOpportunityCount / trends.length, 0.3) / 0.3  // Cap at 30%
    : 0;
  const balanceScore = calculateBalanceScore(trends, declaredDomains);

  const diversityScore = Math.round(
    (coverageRatio * 0.5 + newOppRatio * 0.2 + balanceScore * 0.3) * 100
  );

  return {
    totalTrends: trends.length,
    uniqueDomains: domainsInTrends.size,
    domainsRepresented: represented,
    domainsMissing: missing,
    newOpportunityCount,
    provenTopicCount,
    diversityScore,
  };
}

function calculateBalanceScore(trends: OrgTrend[], declaredDomains: string[]): number {
  if (declaredDomains.length === 0 || trends.length === 0) return 1;

  const domainCounts = new Map<string, number>();
  for (const d of declaredDomains) {
    domainCounts.set(d.toLowerCase(), 0);
  }

  for (const trend of trends) {
    for (const domain of trend.matchedDomains || []) {
      const key = domain.toLowerCase();
      if (domainCounts.has(key)) {
        domainCounts.set(key, (domainCounts.get(key) || 0) + 1);
      }
    }
  }

  const counts = Array.from(domainCounts.values());
  if (counts.every(c => c === 0)) return 0;

  const max = Math.max(...counts);
  const min = Math.min(...counts);

  // Perfect balance = 1, complete imbalance = 0
  if (max === 0) return 0;
  return 1 - (max - min) / max;
}
