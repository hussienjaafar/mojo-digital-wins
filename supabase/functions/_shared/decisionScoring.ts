/**
 * Decision-Grade Scoring Engine for Suggested Actions
 * 
 * Calculates a composite decision_score (0-100) with sub-scores:
 * - opportunity_score: Why now? (velocity, volume, sentiment change)
 * - fit_score: Why you? (org mission, topics, entities, geography)
 * - risk_score: Compliance and reputational risk (inverted - lower is riskier)
 * - confidence_score: Signal reliability and data quality
 */

import { OrgProfile, OrgInterestTopic, OrgInterestEntity, OrgRelevanceResult } from './orgRelevance.ts';

// ============================================================================
// Types
// ============================================================================

export interface DecisionScoreInput {
  // Alert signals
  entityName: string;
  entityType?: string;
  alertType: string;
  velocity?: number;
  sentiment?: number;
  sentimentChange?: number;
  mentions?: number;
  mentionsChange?: number;
  topics?: string[];
  
  // Existing scores (if available)
  actionableScore?: number;
  orgRelevanceResult?: OrgRelevanceResult;
  
  // Source metadata
  sampleSources?: Array<{ type: string; count?: number }>;
  alertAge?: number; // hours since alert created
}

export interface DecisionScoreResult {
  decision_score: number;      // 0-100 composite score
  opportunity_score: number;   // Why now (0-100)
  fit_score: number;           // Why you (0-100)
  risk_score: number;          // Safety level (0-100, higher = safer)
  confidence_score: number;    // Signal reliability (0-100)
  
  tier: 'act_now' | 'consider' | 'watch';
  
  signals: {
    opportunity: string[];
    fit: string[];
    risk: string[];
    confidence: string[];
  };
}

// ============================================================================
// Sensitive Topics / Risk Patterns
// ============================================================================

const SENSITIVE_TOPICS = [
  'abortion', 'gun', 'firearms', 'second amendment', '2a',
  'lgbtq', 'transgender', 'immigration', 'border',
  'death', 'killed', 'violence', 'terrorism', 'attack',
  'scandal', 'corruption', 'fraud', 'lawsuit', 'indictment',
  'sex', 'sexual', 'assault', 'harassment',
  'race', 'racism', 'racist', 'white supremacy', 'antisemit'
];

const CLAIM_PATTERNS = [
  /\b(guarantee|proven|definitely|always|never|100%|certai)\b/i,
  /\b(breaking|exclusive|just in|urgent)\b/i,
  /\b(save lives?|stop .+ now|urgent action)\b/i,
];

// ============================================================================
// Main Scoring Function
// ============================================================================

export function calculateDecisionScore(
  input: DecisionScoreInput,
  profile: OrgProfile | null,
  interestTopics: OrgInterestTopic[],
  interestEntities: OrgInterestEntity[]
): DecisionScoreResult {
  const signals: DecisionScoreResult['signals'] = {
    opportunity: [],
    fit: [],
    risk: [],
    confidence: []
  };

  // 1. OPPORTUNITY SCORE: Why now? (0-100)
  let opportunityScore = 0;
  
  // Velocity component (0-40 points)
  if (input.velocity !== undefined) {
    if (input.velocity >= 200) {
      opportunityScore += 40;
      signals.opportunity.push(`Velocity spike: ${input.velocity.toFixed(0)}% above baseline`);
    } else if (input.velocity >= 100) {
      opportunityScore += 30;
      signals.opportunity.push(`High velocity: ${input.velocity.toFixed(0)}% above baseline`);
    } else if (input.velocity >= 50) {
      opportunityScore += 20;
      signals.opportunity.push(`Moderate velocity: ${input.velocity.toFixed(0)}% above baseline`);
    } else if (input.velocity > 0) {
      opportunityScore += 10;
      signals.opportunity.push(`Trending: ${input.velocity.toFixed(0)}% velocity`);
    }
  }
  
  // Volume/mentions component (0-30 points)
  if (input.mentions !== undefined) {
    if (input.mentions >= 1000) {
      opportunityScore += 30;
      signals.opportunity.push(`High volume: ${input.mentions.toLocaleString()} mentions`);
    } else if (input.mentions >= 500) {
      opportunityScore += 20;
      signals.opportunity.push(`Moderate volume: ${input.mentions.toLocaleString()} mentions`);
    } else if (input.mentions >= 100) {
      opportunityScore += 10;
      signals.opportunity.push(`Growing: ${input.mentions.toLocaleString()} mentions`);
    }
  }
  
  // Sentiment shift component (0-20 points)
  if (input.sentimentChange !== undefined && Math.abs(input.sentimentChange) > 0.2) {
    opportunityScore += Math.min(Math.abs(input.sentimentChange) * 40, 20);
    const direction = input.sentimentChange > 0 ? 'positive' : 'negative';
    signals.opportunity.push(`Sentiment shift: ${direction} (${(input.sentimentChange * 100).toFixed(0)}%)`);
  }
  
  // Recency bonus (0-10 points) - more recent = higher score
  if (input.alertAge !== undefined) {
    if (input.alertAge <= 2) {
      opportunityScore += 10;
      signals.opportunity.push('Breaking: Less than 2 hours old');
    } else if (input.alertAge <= 6) {
      opportunityScore += 7;
      signals.opportunity.push('Fresh: Less than 6 hours old');
    } else if (input.alertAge <= 24) {
      opportunityScore += 3;
    }
  }
  
  opportunityScore = Math.min(opportunityScore, 100);

  // 2. FIT SCORE: Why you? (0-100)
  let fitScore = 0;
  
  // Use existing org relevance if available
  if (input.orgRelevanceResult) {
    fitScore = input.orgRelevanceResult.score;
    signals.fit.push(...input.orgRelevanceResult.reasons);
  } else {
    // Fallback: calculate basic fit
    const inputTopics = input.topics || [];
    
    // Topic matching from interest topics
    const matchedInterestTopics = interestTopics.filter(it => 
      inputTopics.some(t => 
        t.toLowerCase().includes(it.topic.toLowerCase()) ||
        it.topic.toLowerCase().includes(t.toLowerCase())
      ) ||
      input.entityName.toLowerCase().includes(it.topic.toLowerCase())
    );
    
    if (matchedInterestTopics.length > 0) {
      const maxWeight = Math.max(...matchedInterestTopics.map(t => t.weight));
      fitScore += Math.round(maxWeight * 60);
      signals.fit.push(`Topics: ${matchedInterestTopics.map(t => t.topic).slice(0, 3).join(', ')}`);
    }
    
    // Entity allowlist check
    const allowedEntity = interestEntities.find(
      e => e.rule_type === 'allow' && 
      e.entity_name.toLowerCase().includes(input.entityName.toLowerCase())
    );
    if (allowedEntity) {
      fitScore += 25;
      signals.fit.push(`Tracked entity: ${allowedEntity.entity_name}`);
    }
    
    // Profile match
    if (profile) {
      const focusAreas = [...(profile.focus_areas || []), ...(profile.key_issues || [])];
      const matched = focusAreas.filter(fa => 
        inputTopics.some(t => t.toLowerCase().includes(fa.toLowerCase())) ||
        input.entityName.toLowerCase().includes(fa.toLowerCase())
      );
      if (matched.length > 0) {
        fitScore += Math.min(matched.length * 10, 30);
        signals.fit.push(`Mission alignment: ${matched.slice(0, 2).join(', ')}`);
      }
    }
  }
  
  fitScore = Math.min(fitScore, 100);

  // 3. RISK SCORE: Safety level (0-100, higher = safer)
  let riskScore = 85; // Start with assumption of safety
  const riskFlags: string[] = [];
  
  // Check for sensitive topics in entity name and topics
  const allText = [input.entityName, ...(input.topics || [])].join(' ').toLowerCase();
  
  for (const sensitive of SENSITIVE_TOPICS) {
    if (allText.includes(sensitive)) {
      riskScore -= 15;
      riskFlags.push(`Sensitive topic: ${sensitive}`);
      break; // Only flag once
    }
  }
  
  // Check alert type risk
  if (input.alertType === 'controversy' || input.alertType === 'opposition') {
    riskScore -= 10;
    riskFlags.push('Controversial alert type');
  }
  
  // Strong negative sentiment increases risk
  if (input.sentiment !== undefined && input.sentiment < -0.5) {
    riskScore -= 10;
    riskFlags.push('Strong negative sentiment');
  }
  
  riskScore = Math.max(riskScore, 0);
  
  if (riskFlags.length > 0) {
    signals.risk.push(...riskFlags);
  } else {
    signals.risk.push('No significant risk factors detected');
  }

  // 4. CONFIDENCE SCORE: Signal reliability (0-100)
  let confidenceScore = 50; // Start neutral
  
  // Source diversity
  if (input.sampleSources && input.sampleSources.length > 0) {
    const sourceTypes = new Set(input.sampleSources.map(s => s.type));
    if (sourceTypes.size >= 3) {
      confidenceScore += 25;
      signals.confidence.push(`Multi-source: ${sourceTypes.size} source types`);
    } else if (sourceTypes.size >= 2) {
      confidenceScore += 15;
      signals.confidence.push(`Confirmed: ${sourceTypes.size} source types`);
    }
    
    // Total source count
    const totalSources = input.sampleSources.reduce((sum, s) => sum + (s.count || 1), 0);
    if (totalSources >= 10) {
      confidenceScore += 15;
    } else if (totalSources >= 5) {
      confidenceScore += 10;
    }
  }
  
  // Existing actionable score boosts confidence
  if (input.actionableScore && input.actionableScore >= 70) {
    confidenceScore += 10;
    signals.confidence.push(`High actionable score: ${input.actionableScore}`);
  }
  
  // Data freshness
  if (input.alertAge !== undefined && input.alertAge <= 24) {
    confidenceScore += 10;
    signals.confidence.push('Recent data (< 24h)');
  }
  
  confidenceScore = Math.min(confidenceScore, 100);

  // 5. COMPOSITE DECISION SCORE
  // Weighted average: opportunity 30%, fit 35%, risk 20%, confidence 15%
  const decisionScore = Math.round(
    opportunityScore * 0.30 +
    fitScore * 0.35 +
    riskScore * 0.20 +
    confidenceScore * 0.15
  );

  // 6. Determine tier
  let tier: DecisionScoreResult['tier'];
  if (decisionScore >= 65 && riskScore >= 50 && confidenceScore >= 40) {
    tier = 'act_now';
  } else if (decisionScore >= 40 && riskScore >= 30) {
    tier = 'consider';
  } else {
    tier = 'watch';
  }

  return {
    decision_score: decisionScore,
    opportunity_score: opportunityScore,
    fit_score: fitScore,
    risk_score: riskScore,
    confidence_score: confidenceScore,
    tier,
    signals
  };
}

// ============================================================================
// Export scoring thresholds for configuration
// ============================================================================

export const DEFAULT_THRESHOLDS = {
  min_decision_score: 50,
  min_opportunity_for_safe_variant: 60,
  max_risk_for_urgency_variant: 70,
  min_confidence_for_ai: 40
};
