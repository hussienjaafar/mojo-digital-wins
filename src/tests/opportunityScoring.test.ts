import { describe, it, expect } from 'vitest';

/**
 * Tests for the opportunity scoring formula used in detect-fundraising-opportunities
 * The formula calculates a score from 0-100 based on:
 * - Velocity (up to 50 points)
 * - Mentions (up to 25 points)
 * - Time sensitivity (up to 20 points)
 * - Historical correlation (up to 25 bonus points)
 */

interface ScoringInputs {
  velocity: number;
  mentions_24h: number;
  hoursTrending: number;
  avgCorrelation: number;
}

// Replicate the scoring formula from detect-fundraising-opportunities
function calculateOpportunityScore(inputs: ScoringInputs): number {
  const { velocity, mentions_24h, hoursTrending, avgCorrelation } = inputs;
  
  // Velocity: up to 50 points
  const velocityPoints = Math.min((velocity / 100) * 50, 50);
  
  // Mentions: up to 25 points
  const mentionsPoints = Math.min(mentions_24h / 5, 25);
  
  // Time sensitivity: up to 20 points (decays by 1 point per hour)
  const timePoints = Math.max(0, 20 - hoursTrending);
  
  // Historical correlation: up to 25 bonus points
  const correlationPoints = avgCorrelation * 25;
  
  return Math.min(100, Math.round(
    velocityPoints + mentionsPoints + timePoints + correlationPoints
  ));
}

describe('Opportunity Scoring Formula', () => {
  describe('determinism', () => {
    it('should produce identical scores for identical inputs', () => {
      const inputs: ScoringInputs = {
        velocity: 75,
        mentions_24h: 50,
        hoursTrending: 5,
        avgCorrelation: 0.5,
      };
      
      const score1 = calculateOpportunityScore(inputs);
      const score2 = calculateOpportunityScore(inputs);
      const score3 = calculateOpportunityScore({ ...inputs });
      
      expect(score1).toBe(score2);
      expect(score2).toBe(score3);
    });
  });

  describe('velocity scoring', () => {
    it('should give 50 points for velocity >= 100', () => {
      const score = calculateOpportunityScore({
        velocity: 150,
        mentions_24h: 0,
        hoursTrending: 20, // No time bonus
        avgCorrelation: 0,
      });
      expect(score).toBe(50);
    });

    it('should scale linearly for velocity < 100', () => {
      const score50 = calculateOpportunityScore({
        velocity: 50,
        mentions_24h: 0,
        hoursTrending: 20,
        avgCorrelation: 0,
      });
      expect(score50).toBe(25); // 50% of 50 = 25
    });
  });

  describe('mentions scoring', () => {
    it('should cap at 25 points for 125+ mentions', () => {
      const score = calculateOpportunityScore({
        velocity: 0,
        mentions_24h: 200,
        hoursTrending: 20,
        avgCorrelation: 0,
      });
      expect(score).toBe(25);
    });

    it('should give 1 point per 5 mentions', () => {
      const score = calculateOpportunityScore({
        velocity: 0,
        mentions_24h: 25,
        hoursTrending: 20,
        avgCorrelation: 0,
      });
      expect(score).toBe(5); // 25/5 = 5
    });
  });

  describe('time sensitivity scoring', () => {
    it('should give 20 points for just-detected trends', () => {
      const score = calculateOpportunityScore({
        velocity: 0,
        mentions_24h: 0,
        hoursTrending: 0,
        avgCorrelation: 0,
      });
      expect(score).toBe(20);
    });

    it('should give 0 points after 20+ hours', () => {
      const score = calculateOpportunityScore({
        velocity: 0,
        mentions_24h: 0,
        hoursTrending: 25,
        avgCorrelation: 0,
      });
      expect(score).toBe(0);
    });
  });

  describe('historical correlation bonus', () => {
    it('should give 25 bonus points for perfect correlation', () => {
      const score = calculateOpportunityScore({
        velocity: 0,
        mentions_24h: 0,
        hoursTrending: 20,
        avgCorrelation: 1.0,
      });
      expect(score).toBe(25);
    });

    it('should scale with correlation strength', () => {
      const score = calculateOpportunityScore({
        velocity: 0,
        mentions_24h: 0,
        hoursTrending: 20,
        avgCorrelation: 0.4,
      });
      expect(score).toBe(10); // 0.4 * 25 = 10
    });
  });

  describe('threshold behavior', () => {
    it('should produce scores >= 45 for reasonably trending entities without history', () => {
      // A moderately trending entity with no historical data
      const score = calculateOpportunityScore({
        velocity: 60,  // Common velocity
        mentions_24h: 30, // Moderate mentions
        hoursTrending: 2, // Recently detected
        avgCorrelation: 0, // No historical data
      });
      
      // velocity: 60/100*50 = 30
      // mentions: 30/5 = 6
      // time: 20-2 = 18
      // correlation: 0
      // Total: 30 + 6 + 18 = 54
      expect(score).toBeGreaterThanOrEqual(45);
      expect(score).toBe(54);
    });

    it('should reject low-activity entities', () => {
      const score = calculateOpportunityScore({
        velocity: 20,
        mentions_24h: 5,
        hoursTrending: 15,
        avgCorrelation: 0,
      });
      
      // velocity: 20/100*50 = 10
      // mentions: 5/5 = 1
      // time: 20-15 = 5
      // Total: 16
      expect(score).toBeLessThan(45);
    });
  });

  describe('score capping', () => {
    it('should never exceed 100', () => {
      const score = calculateOpportunityScore({
        velocity: 200,
        mentions_24h: 500,
        hoursTrending: 0,
        avgCorrelation: 1.0,
      });
      expect(score).toBe(100);
    });

    it('should never go below 0', () => {
      const score = calculateOpportunityScore({
        velocity: 0,
        mentions_24h: 0,
        hoursTrending: 100,
        avgCorrelation: 0,
      });
      expect(score).toBe(0);
    });
  });
});

describe('SMS Compliance', () => {
  const OPT_OUT_TEXT = "\n\nReply STOP to unsubscribe.";
  const MAX_SMS_LENGTH = 160;
  const MAX_COPY_LENGTH = MAX_SMS_LENGTH - OPT_OUT_TEXT.length;

  it('opt-out text should be under 30 characters', () => {
    expect(OPT_OUT_TEXT.length).toBeLessThanOrEqual(30);
  });

  it('should leave at least 130 characters for message content', () => {
    expect(MAX_COPY_LENGTH).toBeGreaterThanOrEqual(130);
  });

  it('full message with opt-out should fit in 160 chars', () => {
    const content = "X".repeat(MAX_COPY_LENGTH);
    const fullMessage = content + OPT_OUT_TEXT;
    expect(fullMessage.length).toBe(MAX_SMS_LENGTH);
  });
});

describe('UPSERT Idempotency', () => {
  it('should maintain unique constraint logic', () => {
    // This test documents the expected uniqueness behavior
    const opportunities = [
      { organization_id: 'org-1', entity_name: 'Topic A' },
      { organization_id: 'org-1', entity_name: 'Topic A' }, // Duplicate
      { organization_id: 'org-1', entity_name: 'Topic B' }, // Different entity
      { organization_id: 'org-2', entity_name: 'Topic A' }, // Different org
    ];

    // Create a set of unique keys
    const uniqueKeys = new Set(
      opportunities.map(o => `${o.organization_id}:${o.entity_name}`)
    );

    expect(uniqueKeys.size).toBe(3); // Only 3 unique combinations
  });

  it('suggested_actions should dedupe on org+alert', () => {
    const actions = [
      { organization_id: 'org-1', alert_id: 'alert-1' },
      { organization_id: 'org-1', alert_id: 'alert-1' }, // Duplicate
      { organization_id: 'org-1', alert_id: 'alert-2' }, // Different alert
      { organization_id: 'org-2', alert_id: 'alert-1' }, // Different org
    ];

    const uniqueKeys = new Set(
      actions.map(a => `${a.organization_id}:${a.alert_id}`)
    );

    expect(uniqueKeys.size).toBe(3); // Only 3 unique combinations
  });
});
