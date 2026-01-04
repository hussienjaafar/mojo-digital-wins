/**
 * Org-Specific Relevance Scoring Engine (Deno/Edge Function version)
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

export function normalizeEntity(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function entityMatches(a: string, b: string): boolean {
  const normA = normalizeEntity(a);
  const normB = normalizeEntity(b);
  return normA === normB || normA.includes(normB) || normB.includes(normA);
}

function topicMatchesInput(
  topic: string,
  entityName: string,
  inputTopics: string[]
): boolean {
  const normTopic = normalizeEntity(topic);
  const normEntity = normalizeEntity(entityName);
  
  if (normEntity.includes(normTopic) || normTopic.includes(normEntity)) {
    return true;
  }
  
  return inputTopics.some(t => {
    const normT = normalizeEntity(t);
    return normT.includes(normTopic) || normTopic.includes(normT);
  });
}

// ============================================================================
// Main Scoring Function
// ============================================================================

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
    result.reasons.push(`Blocked: "${deniedEntity.entity_name}" is on deny list`);
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

  // Check profile focus_areas/key_issues if no interest topics
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

  // 5. Velocity bonus (up to 10 points)
  if (input.velocity && input.velocity > 50) {
    const velocityBonus = Math.min(Math.round(input.velocity / 50), 10);
    score += velocityBonus;
    result.reasons.push(`High velocity: ${input.velocity.toFixed(0)}% (+${velocityBonus} pts)`);
  }

  result.score = Math.min(Math.round(score), 100);
  
  if (result.score >= 70) {
    result.priorityBucket = 'high';
  } else if (result.score >= 40) {
    result.priorityBucket = 'medium';
  } else {
    result.priorityBucket = 'low';
  }

  if (result.reasons.length === 0) {
    result.reasons.push('No specific topic or entity matches found');
  }

  return result;
}

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
