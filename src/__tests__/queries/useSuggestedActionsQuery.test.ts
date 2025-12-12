import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '../test-utils';
import { useSuggestedActionsQuery, suggestedActionsKeys } from '@/queries/useSuggestedActionsQuery';
import { TEST_ORG_ID } from '../mocks/fixtures';

describe('useSuggestedActionsQuery', () => {
  describe('query key factory', () => {
    it('generates correct base key', () => {
      expect(suggestedActionsKeys.all).toEqual(['suggestedActions']);
    });

    it('generates correct list key with org ID', () => {
      expect(suggestedActionsKeys.list(TEST_ORG_ID)).toEqual([
        'suggestedActions',
        'list',
        TEST_ORG_ID,
      ]);
    });

    // Note: stats are calculated from list query data, not a separate key
  });

  describe('query behavior', () => {
    it('returns loading state initially', () => {
      const { result } = renderHookWithClient(() =>
        useSuggestedActionsQuery(TEST_ORG_ID)
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('does not fetch when organizationId is undefined', () => {
      const { result } = renderHookWithClient(() =>
        useSuggestedActionsQuery(undefined)
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('fetches suggested actions data successfully', async () => {
      const { result } = renderHookWithClient(() =>
        useSuggestedActionsQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.actions).toBeInstanceOf(Array);
      expect(result.current.data?.actions.length).toBeGreaterThan(0);
    });

    it('calculates stats correctly', async () => {
      const { result } = renderHookWithClient(() =>
        useSuggestedActionsQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const stats = result.current.data?.stats;
      expect(stats).toBeDefined();
      expect(typeof stats?.total).toBe('number');
      expect(typeof stats?.pending).toBe('number');
      expect(typeof stats?.used).toBe('number');
      expect(typeof stats?.dismissed).toBe('number');
    });

    it('calculates urgency metrics', async () => {
      const { result } = renderHookWithClient(() =>
        useSuggestedActionsQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const stats = result.current.data?.stats;
      expect(typeof stats?.avgUrgency).toBe('number');
      expect(typeof stats?.avgRelevance).toBe('number');
      expect(typeof stats?.highUrgencyCount).toBe('number');
    });

    it('action items have required properties', async () => {
      const { result } = renderHookWithClient(() =>
        useSuggestedActionsQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const action = result.current.data?.actions[0];
      expect(action).toBeDefined();
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('title');
      expect(action).toHaveProperty('description');
      expect(action).toHaveProperty('urgency');
      expect(action).toHaveProperty('status');
    });

    it('exposes dataUpdatedAt timestamp', async () => {
      const { result } = renderHookWithClient(() =>
        useSuggestedActionsQuery(TEST_ORG_ID)
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
        useSuggestedActionsQuery('unknown-org')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.actions).toEqual([]);
    });
  });
});
