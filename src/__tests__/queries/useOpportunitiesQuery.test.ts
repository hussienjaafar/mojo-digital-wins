import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '../test-utils';
import {
  useOpportunitiesQuery,
  opportunitiesKeys,
  getPriorityLevel,
} from '@/queries/useOpportunitiesQuery';
import { TEST_ORG_ID } from '../mocks/fixtures';

describe('useOpportunitiesQuery', () => {
  describe('query key factory', () => {
    it('generates correct base key', () => {
      expect(opportunitiesKeys.all).toEqual(['opportunities']);
    });

    it('generates correct list key with org ID', () => {
      expect(opportunitiesKeys.list(TEST_ORG_ID)).toEqual([
        'opportunities',
        'list',
        TEST_ORG_ID,
      ]);
    });

    // Note: stats are calculated from list query data, not a separate key
  });

  describe('getPriorityLevel helper', () => {
    it('returns high for scores >= 80', () => {
      expect(getPriorityLevel(80)).toBe('high');
      expect(getPriorityLevel(100)).toBe('high');
      expect(getPriorityLevel(85)).toBe('high');
    });

    it('returns medium for scores 50-79', () => {
      expect(getPriorityLevel(50)).toBe('medium');
      expect(getPriorityLevel(79)).toBe('medium');
      expect(getPriorityLevel(65)).toBe('medium');
    });

    it('returns low for scores < 50', () => {
      expect(getPriorityLevel(49)).toBe('low');
      expect(getPriorityLevel(0)).toBe('low');
      expect(getPriorityLevel(25)).toBe('low');
    });
  });

  describe('query behavior', () => {
    it('returns loading state initially', () => {
      const { result } = renderHookWithClient(() =>
        useOpportunitiesQuery(TEST_ORG_ID)
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('does not fetch when organizationId is undefined', () => {
      const { result } = renderHookWithClient(() =>
        useOpportunitiesQuery(undefined)
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('fetches opportunities data successfully', async () => {
      const { result } = renderHookWithClient(() =>
        useOpportunitiesQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.opportunities).toBeInstanceOf(Array);
      expect(result.current.data?.opportunities.length).toBeGreaterThan(0);
    });

    it('calculates stats correctly', async () => {
      const { result } = renderHookWithClient(() =>
        useOpportunitiesQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const stats = result.current.data?.stats;
      expect(stats).toBeDefined();
      expect(typeof stats?.total).toBe('number');
      expect(typeof stats?.active).toBe('number');
      expect(typeof stats?.highPriority).toBe('number');
      expect(typeof stats?.avgScore).toBe('number');
    });

    it('includes byStatus breakdown', async () => {
      const { result } = renderHookWithClient(() =>
        useOpportunitiesQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const byStatus = result.current.data?.stats.byStatus;
      expect(byStatus).toBeDefined();
      expect(typeof byStatus?.active).toBe('number');
      expect(typeof byStatus?.completed).toBe('number');
      expect(typeof byStatus?.dismissed).toBe('number');
    });

    it('includes byType breakdown', async () => {
      const { result } = renderHookWithClient(() =>
        useOpportunitiesQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const byType = result.current.data?.stats.byType;
      expect(byType).toBeDefined();
      expect(typeof byType).toBe('object');
    });

    it('opportunity items have required properties', async () => {
      const { result } = renderHookWithClient(() =>
        useOpportunitiesQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const opportunity = result.current.data?.opportunities[0];
      expect(opportunity).toBeDefined();
      expect(opportunity).toHaveProperty('id');
      expect(opportunity).toHaveProperty('title');
      expect(opportunity).toHaveProperty('description');
      expect(opportunity).toHaveProperty('score');
      expect(opportunity).toHaveProperty('status');
      expect(opportunity).toHaveProperty('potential_value');
    });

    it('exposes dataUpdatedAt timestamp', async () => {
      const { result } = renderHookWithClient(() =>
        useOpportunitiesQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.dataUpdatedAt).toBeGreaterThan(0);
    });
  });

  describe('empty state', () => {
    it('returns empty array for unknown org', async () => {
      const { result } = renderHookWithClient(() =>
        useOpportunitiesQuery('unknown-org')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.opportunities).toEqual([]);
    });
  });
});
