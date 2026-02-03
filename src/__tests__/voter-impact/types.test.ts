/**
 * Voter Impact Type Utility Tests
 *
 * Tests for the utility functions in src/types/voter-impact.ts:
 * - calculateImpactScore
 * - calculateStateImpactScore
 * - getImpactColor
 * - applyFilters
 */

import { describe, it, expect } from 'vitest';
import {
  calculateImpactScore,
  calculateStateImpactScore,
  getImpactColor,
  applyFilters,
  DEFAULT_MAP_FILTERS,
  IMPACT_THRESHOLDS,
  IMPACT_COLORS,
  type MapFilters,
} from '@/types/voter-impact';
import {
  mockVoterImpactDistricts,
  mockVoterImpactStates,
  createMockDistrict,
  createMockState,
} from './setup';

// ============================================================================
// calculateImpactScore Tests
// ============================================================================

describe('calculateImpactScore', () => {
  describe('basic behavior', () => {
    it('returns 0 for districts where can_impact is false', () => {
      const district = createMockDistrict({
        can_impact: false,
        margin_pct: 0.01, // Very close race
        muslim_voters: 100000, // Large population
        turnout_pct: 0.30, // Low turnout
      });

      expect(calculateImpactScore(district)).toBe(0);
    });

    it('returns 0 for safe district from fixtures', () => {
      const safeDistrict = mockVoterImpactDistricts.find(
        (d) => d.cd_code === 'CA-045'
      );
      expect(safeDistrict).toBeDefined();
      expect(calculateImpactScore(safeDistrict!)).toBe(0);
    });

    it('returns positive score for impactable districts', () => {
      const district = createMockDistrict({
        can_impact: true,
        margin_pct: 0.03,
        muslim_voters: 30000,
        turnout_pct: 0.60,
      });

      const score = calculateImpactScore(district);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('margin scoring', () => {
    it('gives higher scores for closer margins', () => {
      const closeRace = createMockDistrict({
        can_impact: true,
        margin_pct: 0.01, // 1%
        muslim_voters: 25000,
        turnout_pct: 0.65,
      });

      const moderateRace = createMockDistrict({
        can_impact: true,
        margin_pct: 0.05, // 5%
        muslim_voters: 25000,
        turnout_pct: 0.65,
      });

      const widerRace = createMockDistrict({
        can_impact: true,
        margin_pct: 0.08, // 8%
        muslim_voters: 25000,
        turnout_pct: 0.65,
      });

      const closeScore = calculateImpactScore(closeRace);
      const moderateScore = calculateImpactScore(moderateRace);
      const widerScore = calculateImpactScore(widerRace);

      expect(closeScore).toBeGreaterThan(moderateScore);
      expect(moderateScore).toBeGreaterThan(widerScore);
    });

    it('handles null margin_pct by treating it as 100%', () => {
      const district = createMockDistrict({
        can_impact: true,
        margin_pct: null,
        muslim_voters: 50000,
        turnout_pct: 0.60,
      });

      // With margin_pct = 1 (null default), margin score should be 0
      // Score should still be positive from population and turnout
      const score = calculateImpactScore(district);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('population scoring', () => {
    it('gives higher scores for larger Muslim populations', () => {
      const largePopulation = createMockDistrict({
        can_impact: true,
        margin_pct: 0.03,
        muslim_voters: 60000, // Above 50k threshold
        turnout_pct: 0.65,
      });

      const smallPopulation = createMockDistrict({
        can_impact: true,
        margin_pct: 0.03,
        muslim_voters: 10000,
        turnout_pct: 0.65,
      });

      expect(calculateImpactScore(largePopulation)).toBeGreaterThan(
        calculateImpactScore(smallPopulation)
      );
    });

    it('caps population score at 50000 (score of 1)', () => {
      const at50k = createMockDistrict({
        can_impact: true,
        margin_pct: 0.03,
        muslim_voters: 50000,
        turnout_pct: 0.65,
      });

      const above50k = createMockDistrict({
        can_impact: true,
        margin_pct: 0.03,
        muslim_voters: 100000,
        turnout_pct: 0.65,
      });

      // Larger population has more non-voters to mobilize, so score should be higher
      // (new algorithm bases score on mobilizable pool vs margin)
      expect(calculateImpactScore(above50k)).toBeGreaterThan(
        calculateImpactScore(at50k)
      );
    });
  });

  describe('turnout scoring', () => {
    it('gives higher scores for lower turnout (more opportunity)', () => {
      const lowTurnout = createMockDistrict({
        can_impact: true,
        margin_pct: 0.03,
        muslim_voters: 30000,
        turnout_pct: 0.40, // 40% turnout
      });

      const highTurnout = createMockDistrict({
        can_impact: true,
        margin_pct: 0.03,
        muslim_voters: 30000,
        turnout_pct: 0.85, // 85% turnout
      });

      expect(calculateImpactScore(lowTurnout)).toBeGreaterThan(
        calculateImpactScore(highTurnout)
      );
    });

    it('handles null turnout_pct by treating it as 100%', () => {
      const district = createMockDistrict({
        can_impact: true,
        margin_pct: 0.03,
        muslim_voters: 30000,
        turnout_pct: null as unknown as number, // Force null for test
      });

      // With turnout = 1 (null default), turnout score should be 0
      const score = calculateImpactScore(district);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('score boundaries', () => {
    it('never returns a score greater than 1', () => {
      const optimalDistrict = createMockDistrict({
        can_impact: true,
        margin_pct: 0.001, // 0.1% margin
        muslim_voters: 100000, // Huge population
        turnout_pct: 0.20, // Very low turnout
      });

      expect(calculateImpactScore(optimalDistrict)).toBeLessThanOrEqual(1);
    });

    it('never returns a negative score', () => {
      const district = createMockDistrict({
        can_impact: true,
        margin_pct: 0.50, // 50% margin
        muslim_voters: 100,
        turnout_pct: 0.95,
      });

      expect(calculateImpactScore(district)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('fixture data validation', () => {
    it('MI-011 has high impact score (close race, high population)', () => {
      const mi11 = mockVoterImpactDistricts.find((d) => d.cd_code === 'MI-011');
      expect(mi11).toBeDefined();
      const score = calculateImpactScore(mi11!);
      expect(score).toBeGreaterThan(0.5);
    });

    it('MI-008 has highest impact (very close, low turnout)', () => {
      const mi08 = mockVoterImpactDistricts.find((d) => d.cd_code === 'MI-008');
      expect(mi08).toBeDefined();
      const score = calculateImpactScore(mi08!);
      // Very close race (0.5%) + low turnout (45%) should give high score
      expect(score).toBeGreaterThan(0.6);
    });
  });
});

// ============================================================================
// calculateStateImpactScore Tests
// ============================================================================

describe('calculateStateImpactScore', () => {
  it('returns fallback score for states with no district data', () => {
    // For at-large states with no district data, uses state-level turnout gap
    const state = createMockState({ muslim_voters: 100000, vote_2024_pct: 0.70 });
    const score = calculateStateImpactScore(state, []);
    // Should return a positive fallback score based on population and turnout gap
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns weighted average of district impact scores', () => {
    const state = mockVoterImpactStates[0]; // Michigan
    const miDistricts = mockVoterImpactDistricts.filter(
      (d) => d.state_code === 'MI'
    );

    const stateScore = calculateStateImpactScore(state, miDistricts);

    // Calculate expected weighted average (weighted by muslim_voters)
    // Also accounts for flippable ratio (20% weight) vs avg impact (80% weight)
    const districtsWithData = miDistricts.filter(
      (d) => d.muslim_voters > 0 && d.margin_votes && d.margin_votes > 0
    );

    let totalWeight = 0;
    let weightedSum = 0;
    for (const d of districtsWithData) {
      const districtImpact = calculateImpactScore(d);
      weightedSum += districtImpact * d.muslim_voters;
      totalWeight += d.muslim_voters;
    }
    const avgImpact = totalWeight > 0 ? weightedSum / totalWeight : 0;

    const flippable = districtsWithData.filter(
      (d) => (d.didnt_vote_2024 || 0) >= (d.margin_votes || Infinity)
    );
    const flippableRatio = flippable.length / districtsWithData.length;

    const expectedScore = Math.min(1, flippableRatio * 0.2 + avgImpact * 0.8);
    expect(stateScore).toBeCloseTo(expectedScore, 5);
  });

  it('returns 0 when all districts have can_impact=false', () => {
    const state = createMockState({});
    const districts = [
      createMockDistrict({ can_impact: false }),
      createMockDistrict({ can_impact: false, cd_code: 'TS-02' }),
    ];

    expect(calculateStateImpactScore(state, districts)).toBe(0);
  });

  it('correctly calculates weighted state score with mixed districts', () => {
    const state = createMockState({});
    const districts = [
      createMockDistrict({
        can_impact: true,
        margin_pct: 0.02,
        muslim_voters: 40000,
        turnout_pct: 0.60,
      }),
      createMockDistrict({
        can_impact: false, // Should contribute 0 to impact score
        cd_code: 'TS-002',
        muslim_voters: 20000,
      }),
    ];

    const stateScore = calculateStateImpactScore(state, districts);
    const firstDistrictScore = calculateImpactScore(districts[0]);
    const secondDistrictScore = calculateImpactScore(districts[1]); // 0 because can_impact=false

    // Weighted average = (score1 * 40000 + 0 * 20000) / (40000 + 20000) = score1 * 40000/60000
    const weightedAvg = (firstDistrictScore * 40000 + secondDistrictScore * 20000) / 60000;

    // First district is flippable, second is not -> flippable ratio = 0.5
    // Final score = flippableRatio * 0.2 + weightedAvg * 0.8
    const expectedScore = 0.5 * 0.2 + weightedAvg * 0.8;

    expect(stateScore).toBeCloseTo(expectedScore, 5);
  });
});

// ============================================================================
// getImpactColor Tests
// ============================================================================

describe('getImpactColor', () => {
  // Tests use colorblind-safe palette: Blue (high), Orange (medium), Purple (low), Gray (none)
  // Based on IMPACT_THRESHOLDS: HIGH=0.15, MEDIUM=0.07, LOW=0.02

  it('returns gray (IMPACT_COLORS.NONE) for score < LOW threshold', () => {
    expect(getImpactColor(0)).toBe(IMPACT_COLORS.NONE);
    expect(getImpactColor(-0.5)).toBe(IMPACT_COLORS.NONE);
    expect(getImpactColor(0.01)).toBe(IMPACT_COLORS.NONE);
  });

  it('returns purple (IMPACT_COLORS.LOW) for score >= LOW and < MEDIUM', () => {
    expect(getImpactColor(0.02)).toBe(IMPACT_COLORS.LOW);
    expect(getImpactColor(0.05)).toBe(IMPACT_COLORS.LOW);
    expect(getImpactColor(0.069)).toBe(IMPACT_COLORS.LOW);
  });

  it('returns orange (IMPACT_COLORS.MEDIUM) for score >= MEDIUM and < HIGH', () => {
    expect(getImpactColor(0.07)).toBe(IMPACT_COLORS.MEDIUM);
    expect(getImpactColor(0.1)).toBe(IMPACT_COLORS.MEDIUM);
    expect(getImpactColor(0.149)).toBe(IMPACT_COLORS.MEDIUM);
  });

  it('returns blue (IMPACT_COLORS.HIGH) for score >= HIGH', () => {
    expect(getImpactColor(0.15)).toBe(IMPACT_COLORS.HIGH);
    expect(getImpactColor(0.5)).toBe(IMPACT_COLORS.HIGH);
    expect(getImpactColor(1.0)).toBe(IMPACT_COLORS.HIGH);
  });

  it('handles edge cases at IMPACT_THRESHOLDS boundaries', () => {
    // Just below LOW threshold
    expect(getImpactColor(IMPACT_THRESHOLDS.LOW - 0.001)).toBe(IMPACT_COLORS.NONE);
    // At LOW threshold
    expect(getImpactColor(IMPACT_THRESHOLDS.LOW)).toBe(IMPACT_COLORS.LOW);
    // Just below MEDIUM threshold
    expect(getImpactColor(IMPACT_THRESHOLDS.MEDIUM - 0.001)).toBe(IMPACT_COLORS.LOW);
    // At MEDIUM threshold
    expect(getImpactColor(IMPACT_THRESHOLDS.MEDIUM)).toBe(IMPACT_COLORS.MEDIUM);
    // Just below HIGH threshold
    expect(getImpactColor(IMPACT_THRESHOLDS.HIGH - 0.001)).toBe(IMPACT_COLORS.MEDIUM);
    // At HIGH threshold
    expect(getImpactColor(IMPACT_THRESHOLDS.HIGH)).toBe(IMPACT_COLORS.HIGH);
  });
});

// ============================================================================
// applyFilters Tests
// ============================================================================

describe('applyFilters', () => {
  describe('party filter', () => {
    it('returns all districts when party is "all"', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, party: 'all' };
      const result = applyFilters(mockVoterImpactDistricts, filters);
      expect(result.length).toBe(mockVoterImpactDistricts.length);
    });

    it('filters to only Democrat winners', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, party: 'democrat' };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((d) => {
        expect(d.winner_party).toBe('D');
      });
    });

    it('filters to only Republican winners', () => {
      const filters: MapFilters = {
        ...DEFAULT_MAP_FILTERS,
        party: 'republican',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((d) => {
        expect(d.winner_party).toBe('R');
      });
    });

    it('filters to close races (margin < 5%)', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, party: 'close' };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((d) => {
        expect(d.margin_pct).toBeLessThan(0.05);
      });
    });
  });

  describe('impact filter', () => {
    it('returns all districts when impact is "all"', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, impact: 'all' };
      const result = applyFilters(mockVoterImpactDistricts, filters);
      expect(result.length).toBe(mockVoterImpactDistricts.length);
    });

    it('filters to only impactable districts', () => {
      const filters: MapFilters = {
        ...DEFAULT_MAP_FILTERS,
        impact: 'can-impact',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((d) => {
        expect(d.can_impact).toBe(true);
      });
    });

    it('filters to non-impactable districts', () => {
      const filters: MapFilters = {
        ...DEFAULT_MAP_FILTERS,
        impact: 'no-impact',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((d) => {
        expect(d.can_impact).toBe(false);
      });
    });

    it('filters to high impact districts (score >= IMPACT_THRESHOLDS.HIGH)', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, impact: 'high' };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      result.forEach((d) => {
        expect(calculateImpactScore(d)).toBeGreaterThanOrEqual(IMPACT_THRESHOLDS.HIGH);
      });
    });
  });

  describe('minVoters filter', () => {
    it('returns all when minVoters is 0', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, minVoters: 0 };
      const result = applyFilters(mockVoterImpactDistricts, filters);
      expect(result.length).toBe(mockVoterImpactDistricts.length);
    });

    it('filters districts below minimum voter threshold', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, minVoters: 20000 };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      result.forEach((d) => {
        expect(d.muslim_voters).toBeGreaterThanOrEqual(20000);
      });
    });

    it('excludes small population districts', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, minVoters: 5000 };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      // PA-012 has only 2500 voters, should be excluded
      const pa12 = result.find((d) => d.cd_code === 'PA-012');
      expect(pa12).toBeUndefined();
    });
  });

  describe('searchQuery filter', () => {
    it('returns all when searchQuery is empty', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, searchQuery: '' };
      const result = applyFilters(mockVoterImpactDistricts, filters);
      expect(result.length).toBe(mockVoterImpactDistricts.length);
    });

    it('filters by district code (cd_code)', () => {
      const filters: MapFilters = {
        ...DEFAULT_MAP_FILTERS,
        searchQuery: 'MI-011',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      expect(result.length).toBe(1);
      expect(result[0].cd_code).toBe('MI-011');
    });

    it('filters by state code (partial match)', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, searchQuery: 'MI' };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((d) => {
        expect(d.state_code).toBe('MI');
      });
    });

    it('is case insensitive', () => {
      const filters: MapFilters = {
        ...DEFAULT_MAP_FILTERS,
        searchQuery: 'pa-007',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      expect(result.length).toBe(1);
      expect(result[0].cd_code).toBe('PA-007');
    });

    it('trims whitespace from query', () => {
      const filters: MapFilters = {
        ...DEFAULT_MAP_FILTERS,
        searchQuery: '  CA  ',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((d) => {
        expect(d.state_code).toBe('CA');
      });
    });
  });

  describe('preset filters', () => {
    it('swing preset returns close races that can be impacted', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, preset: 'swing' };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      result.forEach((d) => {
        expect(d.can_impact).toBe(true);
        expect(d.margin_pct).toBeLessThan(0.05);
      });
    });

    it('high-roi preset filters to districts with cost estimates and sorts by cost', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, preset: 'high-roi' };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      result.forEach((d) => {
        expect(d.can_impact).toBe(true);
        expect(d.cost_estimate).not.toBeNull();
      });

      // Should be sorted by cost (ascending)
      for (let i = 1; i < result.length; i++) {
        expect(result[i].cost_estimate).toBeGreaterThanOrEqual(
          result[i - 1].cost_estimate!
        );
      }
    });

    it('low-turnout preset filters to turnout < 50%', () => {
      const filters: MapFilters = {
        ...DEFAULT_MAP_FILTERS,
        preset: 'low-turnout',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      result.forEach((d) => {
        expect(d.turnout_pct).toBeLessThan(0.5);
      });
    });

    it('top-population preset sorts by muslim_voters descending', () => {
      const filters: MapFilters = {
        ...DEFAULT_MAP_FILTERS,
        preset: 'top-population',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      // Should be sorted by population (descending)
      for (let i = 1; i < result.length; i++) {
        expect(result[i].muslim_voters).toBeLessThanOrEqual(
          result[i - 1].muslim_voters
        );
      }
    });
  });

  describe('combined filters', () => {
    it('applies multiple filters together', () => {
      const filters: MapFilters = {
        party: 'democrat',
        impact: 'can-impact',
        minVoters: 10000,
        preset: 'none',
        searchQuery: '',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      result.forEach((d) => {
        expect(d.winner_party).toBe('D');
        expect(d.can_impact).toBe(true);
        expect(d.muslim_voters).toBeGreaterThanOrEqual(10000);
      });
    });

    it('applies search with other filters', () => {
      const filters: MapFilters = {
        party: 'all',
        impact: 'can-impact',
        minVoters: 0,
        preset: 'none',
        searchQuery: 'MI',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      result.forEach((d) => {
        expect(d.state_code).toBe('MI');
        expect(d.can_impact).toBe(true);
      });
    });

    it('returns empty array when no districts match all filters', () => {
      const filters: MapFilters = {
        party: 'democrat',
        impact: 'no-impact', // This combo may not exist
        minVoters: 100000,
        preset: 'none',
        searchQuery: 'XY', // Non-existent state
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);
      expect(result.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty input array', () => {
      const result = applyFilters([], DEFAULT_MAP_FILTERS);
      expect(result).toEqual([]);
    });

    it('does not mutate the original array', () => {
      const original = [...mockVoterImpactDistricts];
      const filters: MapFilters = {
        ...DEFAULT_MAP_FILTERS,
        preset: 'top-population',
      };

      applyFilters(mockVoterImpactDistricts, filters);

      // Original should be unchanged
      expect(mockVoterImpactDistricts).toEqual(original);
    });
  });
});
