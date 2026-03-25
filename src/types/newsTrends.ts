/**
 * News Trends V2 Types
 *
 * Shared types for the profile-first trend system with policy domain filtering
 * and anti-filter-bubble mechanisms.
 */

// ============================================================================
// Policy Domains (12 total)
// ============================================================================

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

// ============================================================================
// Geography Types
// ============================================================================

export type GeoLevel = 'local' | 'state' | 'national' | 'international';

export interface TrendGeography {
  geographies: string[];
  geo_level: GeoLevel;
}

// ============================================================================
// Org Relevance Types
// ============================================================================

export interface OrgRelevanceResult {
  score: number;
  reasons: string[];
  flags: RelevanceFlag[];
  isNewOpportunity: boolean;
  isProvenTopic: boolean;
  matchedDomains: string[];
  matchedWatchlist: string[];
  priorityBucket: 'high' | 'medium' | 'low';
}

export type RelevanceFlag =
  | 'NEW_OPPORTUNITY'
  | 'PROVEN_TOPIC'
  | 'BREAKING'
  | 'WATCHLIST_MATCH'
  | 'HIGH_VELOCITY';

// ============================================================================
// Filter Types
// ============================================================================

export interface TrendFilters {
  timeWindow: '1h' | '6h' | '24h' | '7d';
  sources: { news: boolean; social: boolean };
  highConfidenceOnly: boolean;
  geography: 'all' | 'federal' | 'state' | 'global';
  topics: string[];
  policyDomains: PolicyDomain[];
  showNewOpportunities: boolean;
  showProvenTopics: boolean;
  minRelevance: number;
}

export const DEFAULT_TREND_FILTERS: TrendFilters = {
  timeWindow: '24h',
  sources: { news: true, social: true },
  highConfidenceOnly: false,
  geography: 'all',
  topics: [],
  policyDomains: [],
  showNewOpportunities: false,
  showProvenTopics: false,
  minRelevance: 0,
};

// ============================================================================
// Topic Affinity Types (Learning)
// ============================================================================

export interface OrgTopicAffinity {
  id: string;
  organization_id: string;
  topic: string;
  affinity_score: number;
  times_used: number;
  avg_performance: number;
  best_performance: number;
  last_used_at: string;
  source: 'learned_outcome' | 'self_declared' | 'admin_override';
}

// ============================================================================
// Trend-Campaign Correlation Types
// ============================================================================

export interface TrendCampaignCorrelation {
  id: string;
  trend_event_id: string;
  campaign_id: string;
  organization_id: string;
  correlation_score: number;
  domain_overlap: string[];
  topic_overlap: string[];
  time_delta_hours: number;
  campaign_performance: {
    performance_vs_baseline: number;
  };
  performance_vs_baseline: number;
  outcome_label: 'high_performer' | 'performer' | 'neutral' | 'underperformer';
  created_at: string;
}

// ============================================================================
// Diversity Metrics Types
// ============================================================================

export interface DiversityMetrics {
  totalTrends: number;
  uniqueDomains: number;
  domainsRepresented: string[];
  domainsMissing: string[];
  newOpportunityCount: number;
  provenTopicCount: number;
  diversityScore: number;
}

// ============================================================================
// Domain Color Mapping (for UI)
// ============================================================================

export const DOMAIN_COLORS: Record<PolicyDomain, string> = {
  'Healthcare': 'bg-red-500/10 text-red-600 border-red-500/30',
  'Environment': 'bg-green-500/10 text-green-600 border-green-500/30',
  'Labor & Workers Rights': 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  'Immigration': 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  'Civil Rights': 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  'Criminal Justice': 'bg-slate-500/10 text-slate-600 border-slate-500/30',
  'Voting Rights': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  'Education': 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  'Housing': 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  'Economic Justice': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  'Foreign Policy': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  'Technology': 'bg-purple-500/10 text-purple-600 border-purple-500/30',
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getDomainColor(domain: string): string {
  return DOMAIN_COLORS[domain as PolicyDomain] || 'bg-muted text-muted-foreground';
}

export function isPolicyDomain(domain: string): domain is PolicyDomain {
  return POLICY_DOMAINS.includes(domain as PolicyDomain);
}
