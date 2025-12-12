import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '../test-utils';
import { useWatchlistQuery, watchlistKeys } from '@/queries/useWatchlistQuery';
import { TEST_ORG_ID } from '../mocks/fixtures';

describe('useWatchlistQuery', () => {
  describe('query key factory', () => {
    it('generates correct base key', () => {
      expect(watchlistKeys.all).toEqual(['watchlist']);
    });

    it('generates correct list key with org ID', () => {
      expect(watchlistKeys.list(TEST_ORG_ID)).toEqual([
        'watchlist',
        'list',
        TEST_ORG_ID,
      ]);
    });

    // Note: stats are calculated from list query data, not a separate key
  });

  describe('query behavior', () => {
    it('returns loading state initially', () => {
      const { result } = renderHookWithClient(() =>
        useWatchlistQuery(TEST_ORG_ID)
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('does not fetch when organizationId is undefined', () => {
      const { result } = renderHookWithClient(() =>
        useWatchlistQuery(undefined)
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('fetches watchlist data successfully', async () => {
      const { result } = renderHookWithClient(() =>
        useWatchlistQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.entities).toBeInstanceOf(Array);
      expect(result.current.data?.entities.length).toBeGreaterThan(0);
    });

    it('calculates stats correctly', async () => {
      const { result } = renderHookWithClient(() =>
        useWatchlistQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const stats = result.current.data?.stats;
      expect(stats).toBeDefined();
      expect(typeof stats?.totalEntities).toBe('number');
      expect(typeof stats?.sentimentAlertsEnabled).toBe('number');
      expect(typeof stats?.averageThreshold).toBe('number');
    });

    it('includes byType breakdown', async () => {
      const { result } = renderHookWithClient(() =>
        useWatchlistQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const byType = result.current.data?.stats.byType;
      expect(byType).toBeDefined();
      expect(typeof byType).toBe('object');
    });

    it('entity items have required properties', async () => {
      const { result } = renderHookWithClient(() =>
        useWatchlistQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const entity = result.current.data?.entities[0];
      expect(entity).toBeDefined();
      expect(entity).toHaveProperty('id');
      expect(entity).toHaveProperty('entity_type');
      expect(entity).toHaveProperty('entity_name');
      expect(entity).toHaveProperty('threshold');
      expect(entity).toHaveProperty('sentiment_alerts_enabled');
    });

    it('exposes dataUpdatedAt timestamp', async () => {
      const { result } = renderHookWithClient(() =>
        useWatchlistQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.dataUpdatedAt).toBeGreaterThan(0);
    });

    it('provides refetch function', async () => {
      const { result } = renderHookWithClient(() =>
        useWatchlistQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('entity types', () => {
    it('handles multiple entity types', async () => {
      const { result } = renderHookWithClient(() =>
        useWatchlistQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const entities = result.current.data?.entities || [];
      const types = [...new Set(entities.map((e) => e.entity_type))];

      // Our mock data has politician, topic, and competitor
      expect(types.length).toBeGreaterThan(1);
    });
  });

  describe('empty state', () => {
    it('returns empty array for unknown org', async () => {
      const { result } = renderHookWithClient(() =>
        useWatchlistQuery('unknown-org')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.entities).toEqual([]);
    });
  });
});
