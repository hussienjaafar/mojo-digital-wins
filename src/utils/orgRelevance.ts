/**
 * Org-Specific Relevance Scoring Engine
 * 
 * Calculates personalized relevance scores for opportunities and actions
 * based on org profile, interest topics, and entity preferences.
 */

// ============================================================================
// Types
// ============================================================================

export interface OrgInterestTopic {
  topic: string;
  weight: number;
  source: 'self_declared' | 'learned_implicit' | 'learned_outcome' | 'admin_override';
}

export interface OrgInterestEntity {
  entity_name: string;
  rule_type: 'allow' | 'deny';
  reason?: string;
}

export interface OrgProfile {
  org_type?: string | null;
  display_name?: string | null;
  mission_summary?: string | null;
  focus_areas?: string[] | null;
  key_issues?: string[] | null;
  geographies?: string[] | null;
  primary_goals?: string[] | null;
  audiences?: string[] | null;
}

export interface OrgAlertPreferences {
  min_relevance_score: number;
  min_urgency_score: number;
  max_alerts_per_day: number;
  digest_mode: 'realtime' | 'hourly_digest' | 'daily_digest';
}

export interface OrgRelevanceInput {
  entityName: string;
  entityType?: string;
  topics?: string[];
  velocity?: number;
  sentiment?: number;
  mentions?: number;
}

export interface OrgRelevanceResult {
  score: number;
  reasons: string[];
  isBlocked: boolean;
  priorityBucket: 'high' | 'medium' | 'low';
  matchedTopics: string[];
  matchedGeographies: string[];
  isAllowlisted: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalize entity/topic names for comparison
 */
export function normalizeEntity(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two entity names match (fuzzy)
 */
function entityMatches(a: string, b: string): boolean {
  const normA = normalizeEntity(a);
  const normB = normalizeEntity(b);
  return normA === normB || normA.includes(normB) || normB.includes(normA);
}

/**
 * Check if topic matches any of the input topics/entity
 */
function topicMatchesInput(
  topic: string,
  entityName: string,
  inputTopics: string[]
): boolean {
  const normTopic = normalizeEntity(topic);
  const normEntity = normalizeEntity(entityName);
  
  // Direct entity match
  if (normEntity.includes(normTopic) || normTopic.includes(normEntity)) {
    return true;
  }
  
  // Topic array match
  return inputTopics.some(t => {
    const normT = normalizeEntity(t);
    return normT.includes(normTopic) || normTopic.includes(normT);
  });
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Calculate org-specific relevance score for an entity/opportunity
 * 
 * Scoring breakdown:
 * - Topic match: up to 60 points (based on highest matching topic weight)
 * - Entity allowlist: +20 points bonus
 * - Geography match: +10 points bonus
 * - Velocity/momentum: up to 10 points bonus
 * 
 * Total: 0-100 points
 */
export function calculateOrgRelevance(
  input: OrgRelevanceInput,
  profile: OrgProfile | null,
  interestTopics: OrgInterestTopic[],
  interestEntities: OrgInterestEntity[]
): OrgRelevanceResult {
  const result: OrgRelevanceResult = {
    score: 0,
    reasons: [],
    isBlocked: false,
    priorityBucket: 'low',
    matchedTopics: [],
    matchedGeographies: [],
    isAllowlisted: false,
  };

  const inputTopics = input.topics || [];
  const allTopics = [...inputTopics];
  if (input.entityType) allTopics.push(input.entityType);

  // 1. Check deny list first (hard block)
  const deniedEntity = interestEntities.find(
    e => e.rule_type === 'deny' && entityMatches(e.entity_name, input.entityName)
  );
  
  if (deniedEntity) {
    result.isBlocked = true;
    result.reasons.push(`Blocked: "${deniedEntity.entity_name}" is on deny list${deniedEntity.reason ? ` (${deniedEntity.reason})` : ''}`);
    return result;
  }

  let score = 0;

  // 2. Topic matching (up to 60 points)
  const matchedTopics: { topic: string; weight: number }[] = [];
  
  for (const interestTopic of interestTopics) {
    if (topicMatchesInput(interestTopic.topic, input.entityName, allTopics)) {
      matchedTopics.push(interestTopic);
      result.matchedTopics.push(interestTopic.topic);
    }
  }

  if (matchedTopics.length > 0) {
    const maxWeight = Math.max(...matchedTopics.map(t => t.weight));
    const topicPoints = Math.round(maxWeight * 60);
    score += topicPoints;
    result.reasons.push(
      `Topic match: ${matchedTopics.map(t => t.topic).join(', ')} (+${topicPoints} pts)`
    );
  }

  // Also check profile focus_areas and key_issues if no interest topics defined
  if (matchedTopics.length === 0 && profile) {
    const focusAreas = profile.focus_areas || [];
    const keyIssues = profile.key_issues || [];
    const profileTopics = [...focusAreas, ...keyIssues];
    
    const matchedProfileTopics = profileTopics.filter(pt => 
      topicMatchesInput(pt, input.entityName, allTopics)
    );
    
    if (matchedProfileTopics.length > 0) {
      const profilePoints = Math.min(matchedProfileTopics.length * 15, 40);
      score += profilePoints;
      result.reasons.push(
        `Profile topic match: ${matchedProfileTopics.slice(0, 3).join(', ')} (+${profilePoints} pts)`
      );
      result.matchedTopics.push(...matchedProfileTopics);
    }
  }

  // 3. Entity allowlist bonus (20 points)
  const allowedEntity = interestEntities.find(
    e => e.rule_type === 'allow' && entityMatches(e.entity_name, input.entityName)
  );
  
  if (allowedEntity) {
    score += 20;
    result.isAllowlisted = true;
    result.reasons.push(`Allowlisted entity: "${allowedEntity.entity_name}" (+20 pts)`);
  }

  // 4. Geography match bonus (10 points)
  if (profile?.geographies && profile.geographies.length > 0) {
    const matchedGeos = profile.geographies.filter(geo => {
      const normGeo = normalizeEntity(geo);
      const normEntity = normalizeEntity(input.entityName);
      const topicsMatch = allTopics.some(t => normalizeEntity(t).includes(normGeo));
      return normEntity.includes(normGeo) || topicsMatch;
    });
    
    if (matchedGeos.length > 0) {
      score += 10;
      result.matchedGeographies = matchedGeos;
      result.reasons.push(`Geographic relevance: ${matchedGeos.join(', ')} (+10 pts)`);
    }
  }

  // 5. Velocity/momentum bonus (up to 10 points)
  if (input.velocity && input.velocity > 50) {
    const velocityBonus = Math.min(Math.round(input.velocity / 50), 10);
    score += velocityBonus;
    result.reasons.push(`High velocity: ${input.velocity.toFixed(0)}% (+${velocityBonus} pts)`);
  }

  // Cap at 100
  result.score = Math.min(Math.round(score), 100);
  
  // Determine priority bucket
  if (result.score >= 70) {
    result.priorityBucket = 'high';
  } else if (result.score >= 40) {
    result.priorityBucket = 'medium';
  } else {
    result.priorityBucket = 'low';
  }

  // Add default reason if no matches
  if (result.reasons.length === 0) {
    result.reasons.push('No specific topic or entity matches found');
  }

  return result;
}

/**
 * Check if an opportunity/action passes org threshold filters
 */
export function passesOrgThresholds(
  relevanceScore: number,
  urgencyScore: number,
  preferences: OrgAlertPreferences | null
): { passes: boolean; reason?: string } {
  if (!preferences) {
    return { passes: true };
  }

  if (relevanceScore < preferences.min_relevance_score) {
    return {
      passes: false,
      reason: `Relevance score ${relevanceScore} below threshold ${preferences.min_relevance_score}`,
    };
  }

  if (urgencyScore < preferences.min_urgency_score) {
    return {
      passes: false,
      reason: `Urgency score ${urgencyScore} below threshold ${preferences.min_urgency_score}`,
    };
  }

  return { passes: true };
}

/**
 * Get default topics based on org type
 */
export function getDefaultTopicsForOrgType(orgType: string): OrgInterestTopic[] {
  const defaults: Record<string, { topic: string; weight: number }[]> = {
    foreign_policy: [
      { topic: 'ukraine', weight: 0.8 },
      { topic: 'gaza', weight: 0.8 },
      { topic: 'israel', weight: 0.7 },
      { topic: 'china', weight: 0.7 },
      { topic: 'russia', weight: 0.7 },
      { topic: 'nato', weight: 0.6 },
      { topic: 'sanctions', weight: 0.6 },
      { topic: 'diplomacy', weight: 0.5 },
    ],
    human_rights: [
      { topic: 'police brutality', weight: 0.8 },
      { topic: 'civil rights', weight: 0.8 },
      { topic: 'voting rights', weight: 0.7 },
      { topic: 'immigration', weight: 0.7 },
      { topic: 'refugees', weight: 0.6 },
      { topic: 'discrimination', weight: 0.6 },
      { topic: 'incarceration', weight: 0.5 },
    ],
    candidate: [
      { topic: 'election', weight: 0.9 },
      { topic: 'campaign', weight: 0.8 },
      { topic: 'polls', weight: 0.7 },
      { topic: 'endorsement', weight: 0.7 },
      { topic: 'debate', weight: 0.6 },
      { topic: 'fundraising', weight: 0.6 },
    ],
    labor: [
      { topic: 'unions', weight: 0.9 },
      { topic: 'strikes', weight: 0.8 },
      { topic: 'wages', weight: 0.8 },
      { topic: 'workers rights', weight: 0.7 },
      { topic: 'collective bargaining', weight: 0.7 },
      { topic: 'nlrb', weight: 0.6 },
    ],
    climate: [
      { topic: 'climate change', weight: 0.9 },
      { topic: 'renewable energy', weight: 0.8 },
      { topic: 'fossil fuels', weight: 0.8 },
      { topic: 'emissions', weight: 0.7 },
      { topic: 'environmental justice', weight: 0.7 },
      { topic: 'green new deal', weight: 0.6 },
    ],
    civil_rights: [
      { topic: 'equality', weight: 0.8 },
      { topic: 'discrimination', weight: 0.8 },
      { topic: 'lgbtq', weight: 0.7 },
      { topic: 'voting rights', weight: 0.7 },
      { topic: 'affirmative action', weight: 0.6 },
      { topic: 'dei', weight: 0.6 },
    ],
  };

  const topics = defaults[orgType] || [];
  return topics.map(t => ({
    ...t,
    source: 'self_declared' as const,
  }));
}

/**
 * Get all available org types with labels
 */
export const ORG_TYPES = [
  { value: 'foreign_policy', label: 'Foreign Policy & International Affairs' },
  { value: 'human_rights', label: 'Human Rights & Social Justice' },
  { value: 'candidate', label: 'Political Campaign / Candidate' },
  { value: 'labor', label: 'Labor & Workers Rights' },
  { value: 'climate', label: 'Climate & Environment' },
  { value: 'civil_rights', label: 'Civil Rights & Equality' },
  { value: 'other', label: 'Other' },
] as const;

export type OrgType = typeof ORG_TYPES[number]['value'];
