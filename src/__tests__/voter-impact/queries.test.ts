/**
 * Voter Impact Query Hook Tests
 *
 * Tests for the query hooks in src/queries/useVoterImpactQueries.ts:
 * - useVoterImpactStates
 * - useVoterImpactDistricts
 * - useDistrictsByState
 * - useVoterImpactDistrict
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '../test-utils';
import {
  useVoterImpactStates,
  useVoterImpactDistricts,
  useDistrictsByState,
  useVoterImpactDistrict,
} from '@/queries/useVoterImpactQueries';
import { voterImpactKeys } from '@/queries/queryKeys';
import {
  mockVoterImpactStates,
  mockVoterImpactDistricts,
} from './setup';

// ============================================================================
// Mock Supabase Client
// ============================================================================

// Mock the Supabase client module
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'voter_impact_states') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockVoterImpactStates,
              error: null,
            }),
          }),
        };
      }
      if (table === 'voter_impact_districts') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockVoterImpactDistricts,
              error: null,
            }),
            eq: vi.fn().mockImplementation((field: string, value: string) => {
              if (field === 'state_code') {
                const filtered = mockVoterImpactDistricts.filter(
                  (d) => d.state_code === value
                );
                return {
                  order: vi.fn().mockResolvedValue({
                    data: filtered,
                    error: null,
                  }),
                };
              }
              if (field === 'cd_code') {
                const found = mockVoterImpactDistricts.find(
                  (d) => d.cd_code === value
                );
                return {
                  single: vi.fn().mockResolvedValue({
                    data: found || null,
                    error: found ? null : { code: 'PGRST116' },
                  }),
                };
              }
              return {
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
                single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              };
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      };
    }),
  },
}));

// ============================================================================
// Query Key Tests
// ============================================================================

describe('voterImpactKeys', () => {
  it('generates correct base key', () => {
    expect(voterImpactKeys.all).toEqual(['voter-impact']);
  });

  it('generates correct states key', () => {
    expect(voterImpactKeys.states()).toEqual(['voter-impact', 'states']);
  });

  it('generates correct districts key', () => {
    expect(voterImpactKeys.districts()).toEqual(['voter-impact', 'districts']);
  });

  it('generates correct districtsByState key', () => {
    expect(voterImpactKeys.districtsByState('MI')).toEqual([
      'voter-impact',
      'districts',
      'MI',
    ]);
  });

  it('generates correct district key', () => {
    expect(voterImpactKeys.district('MI-11')).toEqual([
      'voter-impact',
      'district',
      'MI-11',
    ]);
  });
});

// ============================================================================
// useVoterImpactStates Tests
// ============================================================================

describe('useVoterImpactStates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading state initially', () => {
    const { result } = renderHookWithClient(() => useVoterImpactStates());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches states data successfully', async () => {
    const { result } = renderHookWithClient(() => useVoterImpactStates());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data).toHaveLength(mockVoterImpactStates.length);
  });

  it('returns states with correct properties', async () => {
    const { result } = renderHookWithClient(() => useVoterImpactStates());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const firstState = result.current.data?.[0];
    expect(firstState).toBeDefined();
    expect(firstState).toHaveProperty('id');
    expect(firstState).toHaveProperty('state_code');
    expect(firstState).toHaveProperty('state_name');
    expect(firstState).toHaveProperty('muslim_voters');
    expect(firstState).toHaveProperty('registered');
    expect(firstState).toHaveProperty('registered_pct');
    expect(firstState).toHaveProperty('vote_2024');
    expect(firstState).toHaveProperty('vote_2024_pct');
  });

  it('provides refetch function', async () => {
    const { result } = renderHookWithClient(() => useVoterImpactStates());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');
  });
});

// ============================================================================
// useVoterImpactDistricts Tests
// ============================================================================

describe('useVoterImpactDistricts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading state initially', () => {
    const { result } = renderHookWithClient(() => useVoterImpactDistricts());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches districts data successfully', async () => {
    const { result } = renderHookWithClient(() => useVoterImpactDistricts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data).toHaveLength(mockVoterImpactDistricts.length);
  });

  it('returns districts with correct properties', async () => {
    const { result } = renderHookWithClient(() => useVoterImpactDistricts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const firstDistrict = result.current.data?.[0];
    expect(firstDistrict).toBeDefined();
    expect(firstDistrict).toHaveProperty('id');
    expect(firstDistrict).toHaveProperty('cd_code');
    expect(firstDistrict).toHaveProperty('state_code');
    expect(firstDistrict).toHaveProperty('district_num');
    expect(firstDistrict).toHaveProperty('muslim_voters');
    expect(firstDistrict).toHaveProperty('can_impact');
    expect(firstDistrict).toHaveProperty('margin_pct');
    expect(firstDistrict).toHaveProperty('turnout_pct');
  });

  it('includes election result properties', async () => {
    const { result } = renderHookWithClient(() => useVoterImpactDistricts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const district = result.current.data?.[0];
    expect(district).toHaveProperty('winner');
    expect(district).toHaveProperty('winner_party');
    expect(district).toHaveProperty('runner_up');
    expect(district).toHaveProperty('runner_up_party');
    expect(district).toHaveProperty('margin_votes');
  });

  it('includes cost and impact estimates', async () => {
    const { result } = renderHookWithClient(() => useVoterImpactDistricts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Find a district that can be impacted
    const impactableDistrict = result.current.data?.find((d) => d.can_impact);
    expect(impactableDistrict).toBeDefined();
    expect(impactableDistrict).toHaveProperty('votes_needed');
    expect(impactableDistrict).toHaveProperty('cost_estimate');
  });
});

// ============================================================================
// useDistrictsByState Tests
// ============================================================================

describe('useDistrictsByState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when stateCode is null', () => {
    const { result } = renderHookWithClient(() => useDistrictsByState(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches districts for a specific state', async () => {
    const { result } = renderHookWithClient(() => useDistrictsByState('MI'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    result.current.data?.forEach((district) => {
      expect(district.state_code).toBe('MI');
    });
  });

  it('returns only districts for the specified state', async () => {
    const { result } = renderHookWithClient(() => useDistrictsByState('PA'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBeGreaterThan(0);
    result.current.data?.forEach((district) => {
      expect(district.state_code).toBe('PA');
    });
  });

  it('returns empty array for state with no districts', async () => {
    const { result } = renderHookWithClient(() => useDistrictsByState('XX'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });
});

// ============================================================================
// useVoterImpactDistrict Tests
// ============================================================================

describe('useVoterImpactDistrict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch when cdCode is null', () => {
    const { result } = renderHookWithClient(() => useVoterImpactDistrict(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches a single district by cd_code', async () => {
    const { result } = renderHookWithClient(() =>
      useVoterImpactDistrict('MI-11')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.cd_code).toBe('MI-11');
  });

  it('returns null for non-existent district', async () => {
    const { result } = renderHookWithClient(() =>
      useVoterImpactDistrict('XX-99')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
  });

  it('returns complete district data', async () => {
    const { result } = renderHookWithClient(() =>
      useVoterImpactDistrict('PA-07')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const district = result.current.data;
    expect(district).toBeDefined();
    expect(district?.cd_code).toBe('PA-07');
    expect(district?.state_code).toBe('PA');
    expect(typeof district?.muslim_voters).toBe('number');
    expect(typeof district?.can_impact).toBe('boolean');
  });
});

// ============================================================================
// Integration-like Tests
// ============================================================================

describe('Query Hook Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('states and districts data are compatible', async () => {
    const { result: statesResult } = renderHookWithClient(() =>
      useVoterImpactStates()
    );
    const { result: districtsResult } = renderHookWithClient(() =>
      useVoterImpactDistricts()
    );

    await waitFor(() => {
      expect(statesResult.current.isLoading).toBe(false);
      expect(districtsResult.current.isLoading).toBe(false);
    });

    const states = statesResult.current.data || [];
    const districts = districtsResult.current.data || [];

    // Every district should have a state_code that exists in states
    const stateCodes = new Set(states.map((s) => s.state_code));

    districts.forEach((district) => {
      expect(stateCodes.has(district.state_code)).toBe(true);
    });
  });

  it('districts by state matches filtered all districts', async () => {
    const { result: allDistrictsResult } = renderHookWithClient(() =>
      useVoterImpactDistricts()
    );
    const { result: miDistrictsResult } = renderHookWithClient(() =>
      useDistrictsByState('MI')
    );

    await waitFor(() => {
      expect(allDistrictsResult.current.isLoading).toBe(false);
      expect(miDistrictsResult.current.isLoading).toBe(false);
    });

    const allMiDistricts =
      allDistrictsResult.current.data?.filter((d) => d.state_code === 'MI') ||
      [];
    const stateDistricts = miDistrictsResult.current.data || [];

    expect(stateDistricts.length).toBe(allMiDistricts.length);

    // Both should contain the same district codes
    const allCodes = new Set(allMiDistricts.map((d) => d.cd_code));
    stateDistricts.forEach((d) => {
      expect(allCodes.has(d.cd_code)).toBe(true);
    });
  });

  it('single district query returns same data as from all districts', async () => {
    const { result: allDistrictsResult } = renderHookWithClient(() =>
      useVoterImpactDistricts()
    );
    const { result: singleDistrictResult } = renderHookWithClient(() =>
      useVoterImpactDistrict('MI-11')
    );

    await waitFor(() => {
      expect(allDistrictsResult.current.isLoading).toBe(false);
      expect(singleDistrictResult.current.isLoading).toBe(false);
    });

    const fromAll = allDistrictsResult.current.data?.find(
      (d) => d.cd_code === 'MI-11'
    );
    const single = singleDistrictResult.current.data;

    expect(fromAll).toBeDefined();
    expect(single).toBeDefined();
    expect(single?.id).toBe(fromAll?.id);
    expect(single?.muslim_voters).toBe(fromAll?.muslim_voters);
    expect(single?.can_impact).toBe(fromAll?.can_impact);
  });
});

// ============================================================================
// Cache Behavior Tests
// ============================================================================

describe('Query Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses correct query key for states', () => {
    const { queryClient } = renderHookWithClient(() => useVoterImpactStates());

    const cache = queryClient.getQueryCache();
    const queries = cache.findAll({ queryKey: voterImpactKeys.states() });

    expect(queries.length).toBe(1);
  });

  it('uses correct query key for districts', () => {
    const { queryClient } = renderHookWithClient(() =>
      useVoterImpactDistricts()
    );

    const cache = queryClient.getQueryCache();
    const queries = cache.findAll({ queryKey: voterImpactKeys.districts() });

    expect(queries.length).toBe(1);
  });

  it('uses correct query key for districts by state', () => {
    const { queryClient } = renderHookWithClient(() =>
      useDistrictsByState('MI')
    );

    const cache = queryClient.getQueryCache();
    const queries = cache.findAll({
      queryKey: voterImpactKeys.districtsByState('MI'),
    });

    expect(queries.length).toBe(1);
  });

  it('uses correct query key for single district', () => {
    const { queryClient } = renderHookWithClient(() =>
      useVoterImpactDistrict('MI-11')
    );

    const cache = queryClient.getQueryCache();
    const queries = cache.findAll({
      queryKey: voterImpactKeys.district('MI-11'),
    });

    expect(queries.length).toBe(1);
  });
});
