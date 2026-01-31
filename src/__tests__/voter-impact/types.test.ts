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
        (d) => d.cd_code === 'CA-45'
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

      // Scores should be equal since population is capped at 50k
      expect(calculateImpactScore(at50k)).toBe(calculateImpactScore(above50k));
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
    it('MI-11 has high impact score (close race, high population)', () => {
      const mi11 = mockVoterImpactDistricts.find((d) => d.cd_code === 'MI-11');
      expect(mi11).toBeDefined();
      const score = calculateImpactScore(mi11!);
      expect(score).toBeGreaterThan(0.5);
    });

    it('MI-08 has highest impact (very close, low turnout)', () => {
      const mi08 = mockVoterImpactDistricts.find((d) => d.cd_code === 'MI-08');
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
  it('returns 0 for empty districts array', () => {
    const state = createMockState({});
    expect(calculateStateImpactScore(state, [])).toBe(0);
  });

  it('returns average of district impact scores', () => {
    const state = mockVoterImpactStates[0]; // Michigan
    const miDistricts = mockVoterImpactDistricts.filter(
      (d) => d.state_code === 'MI'
    );

    const stateScore = calculateStateImpactScore(state, miDistricts);
    const manualAvg =
      miDistricts.reduce((sum, d) => sum + calculateImpactScore(d), 0) /
      miDistricts.length;

    expect(stateScore).toBe(manualAvg);
  });

  it('returns 0 when all districts have can_impact=false', () => {
    const state = createMockState({});
    const districts = [
      createMockDistrict({ can_impact: false }),
      createMockDistrict({ can_impact: false, cd_code: 'TS-02' }),
    ];

    expect(calculateStateImpactScore(state, districts)).toBe(0);
  });

  it('correctly averages mixed impactable districts', () => {
    const state = createMockState({});
    const districts = [
      createMockDistrict({
        can_impact: true,
        margin_pct: 0.02,
        muslim_voters: 40000,
        turnout_pct: 0.60,
      }),
      createMockDistrict({
        can_impact: false, // Should contribute 0
        cd_code: 'TS-02',
      }),
    ];

    const stateScore = calculateStateImpactScore(state, districts);
    const firstDistrictScore = calculateImpactScore(districts[0]);

    // Average of (firstDistrictScore + 0) / 2
    expect(stateScore).toBe(firstDistrictScore / 2);
  });
});

// ============================================================================
// getImpactColor Tests
// ============================================================================

describe('getImpactColor', () => {
  it('returns gray (#374151) for score <= 0', () => {
    expect(getImpactColor(0)).toBe('#374151');
    expect(getImpactColor(-0.5)).toBe('#374151');
  });

  it('returns red (#ef4444) for score < 0.33', () => {
    expect(getImpactColor(0.1)).toBe('#ef4444');
    expect(getImpactColor(0.32)).toBe('#ef4444');
  });

  it('returns yellow (#eab308) for score >= 0.33 and < 0.66', () => {
    expect(getImpactColor(0.33)).toBe('#eab308');
    expect(getImpactColor(0.5)).toBe('#eab308');
    expect(getImpactColor(0.65)).toBe('#eab308');
  });

  it('returns green (#22c55e) for score >= 0.66', () => {
    expect(getImpactColor(0.66)).toBe('#22c55e');
    expect(getImpactColor(0.8)).toBe('#22c55e');
    expect(getImpactColor(1.0)).toBe('#22c55e');
  });

  it('handles edge cases at boundaries', () => {
    // Right at boundaries
    expect(getImpactColor(0.329999)).toBe('#ef4444');
    expect(getImpactColor(0.33)).toBe('#eab308');
    expect(getImpactColor(0.659999)).toBe('#eab308');
    expect(getImpactColor(0.66)).toBe('#22c55e');
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

    it('filters to high impact districts (score >= 0.66)', () => {
      const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, impact: 'high' };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      result.forEach((d) => {
        expect(calculateImpactScore(d)).toBeGreaterThanOrEqual(0.66);
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

      // PA-12 has only 2500 voters, should be excluded
      const pa12 = result.find((d) => d.cd_code === 'PA-12');
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
        searchQuery: 'MI-11',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      expect(result.length).toBe(1);
      expect(result[0].cd_code).toBe('MI-11');
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
        searchQuery: 'pa-07',
      };
      const result = applyFilters(mockVoterImpactDistricts, filters);

      expect(result.length).toBe(1);
      expect(result[0].cd_code).toBe('PA-07');
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
