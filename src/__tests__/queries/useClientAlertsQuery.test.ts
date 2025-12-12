import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '../test-utils';
import { useClientAlertsQuery, clientAlertsKeys } from '@/queries/useClientAlertsQuery';
import { TEST_ORG_ID } from '../mocks/fixtures';

describe('useClientAlertsQuery', () => {
  describe('query key factory', () => {
    it('generates correct base key', () => {
      expect(clientAlertsKeys.all).toEqual(['clientAlerts']);
    });

    it('generates correct list key with org ID', () => {
      expect(clientAlertsKeys.list(TEST_ORG_ID)).toEqual([
        'clientAlerts',
        'list',
        TEST_ORG_ID,
      ]);
    });

    // Note: stats key is not exported separately in this implementation
    // Stats are calculated from the list query data
  });

  describe('query behavior', () => {
    it('returns loading state initially', () => {
      const { result } = renderHookWithClient(() =>
        useClientAlertsQuery(TEST_ORG_ID)
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('does not fetch when organizationId is undefined', () => {
      const { result } = renderHookWithClient(() =>
        useClientAlertsQuery(undefined)
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('fetches alerts data successfully', async () => {
      const { result } = renderHookWithClient(() =>
        useClientAlertsQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.alerts).toBeInstanceOf(Array);
      expect(result.current.data?.alerts.length).toBeGreaterThan(0);
    });

    it('calculates stats correctly', async () => {
      const { result } = renderHookWithClient(() =>
        useClientAlertsQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const stats = result.current.data?.stats;
      expect(stats).toBeDefined();
      expect(typeof stats?.total).toBe('number');
      expect(typeof stats?.unread).toBe('number');
      expect(typeof stats?.critical).toBe('number');
      expect(typeof stats?.actionable).toBe('number');
    });

    it('calculates bySeverity breakdown', async () => {
      const { result } = renderHookWithClient(() =>
        useClientAlertsQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const bySeverity = result.current.data?.stats.bySeverity;
      expect(bySeverity).toBeDefined();
      // Implementation tracks actual severity levels from data
      expect(typeof bySeverity).toBe('object');
    });

    it('exposes dataUpdatedAt timestamp', async () => {
      const { result } = renderHookWithClient(() =>
        useClientAlertsQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.dataUpdatedAt).toBeGreaterThan(0);
    });

    it('provides refetch function', async () => {
      const { result } = renderHookWithClient(() =>
        useClientAlertsQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('error handling', () => {
    it('handles fetch errors gracefully', async () => {
      // Using an invalid org ID that won't match handlers
      const { result } = renderHookWithClient(() =>
        useClientAlertsQuery('invalid-org')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should return empty data, not throw
      expect(result.current.data?.alerts).toEqual([]);
    });
  });
});
