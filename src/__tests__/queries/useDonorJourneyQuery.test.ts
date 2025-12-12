import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '../test-utils';
import { useDonorJourneyQuery, donorJourneyKeys } from '@/queries/useDonorJourneyQuery';
import { TEST_ORG_ID } from '../mocks/fixtures';

describe('useDonorJourneyQuery', () => {
  describe('query key factory', () => {
    it('generates correct base key', () => {
      expect(donorJourneyKeys.all).toEqual(['donorJourney']);
    });

    it('generates correct list key with org ID', () => {
      expect(donorJourneyKeys.list(TEST_ORG_ID)).toEqual([
        'donorJourney',
        'list',
        TEST_ORG_ID,
        0, // default minAmount
      ]);
    });

    it('generates correct list key with minAmount', () => {
      expect(donorJourneyKeys.list(TEST_ORG_ID, 100)).toEqual([
        'donorJourney',
        'list',
        TEST_ORG_ID,
        100,
      ]);
    });

    it('generates correct segments key', () => {
      expect(donorJourneyKeys.segments(TEST_ORG_ID)).toEqual([
        'donorJourney',
        'segments',
        TEST_ORG_ID,
      ]);
    });

    it('generates correct funnel key', () => {
      expect(donorJourneyKeys.funnel(TEST_ORG_ID)).toEqual([
        'donorJourney',
        'funnel',
        TEST_ORG_ID,
      ]);
    });
  });

  describe('query behavior', () => {
    it('returns loading state initially', () => {
      const { result } = renderHookWithClient(() =>
        useDonorJourneyQuery(TEST_ORG_ID)
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('does not fetch when organizationId is undefined', () => {
      const { result } = renderHookWithClient(() =>
        useDonorJourneyQuery(undefined)
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('fetches journey data successfully', async () => {
      const { result } = renderHookWithClient(() =>
        useDonorJourneyQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      expect(result.current.data).toBeDefined();
    });

    it('includes journey stats', async () => {
      const { result } = renderHookWithClient(() =>
        useDonorJourneyQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      const stats = result.current.data?.stats;
      expect(stats).toBeDefined();
      expect(typeof stats?.totalDonors).toBe('number');
      expect(typeof stats?.newDonors).toBe('number');
      expect(typeof stats?.returningDonors).toBe('number');
      expect(typeof stats?.totalRevenue).toBe('number');
    });

    it('includes retention metrics', async () => {
      const { result } = renderHookWithClient(() =>
        useDonorJourneyQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      const retentionMetrics = result.current.data?.stats.retentionMetrics;
      expect(retentionMetrics).toBeDefined();
      expect(typeof retentionMetrics?.retentionRate).toBe('number');
      expect(typeof retentionMetrics?.churnRate).toBe('number');
      expect(typeof retentionMetrics?.ltv90).toBe('number');
    });

    it('includes funnel stages', async () => {
      const { result } = renderHookWithClient(() =>
        useDonorJourneyQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      const funnel = result.current.data?.funnel;
      expect(funnel).toBeInstanceOf(Array);

      if (funnel && funnel.length > 0) {
        const stage = funnel[0];
        expect(stage).toHaveProperty('stage');
        expect(stage).toHaveProperty('label');
        expect(stage).toHaveProperty('count');
        expect(stage).toHaveProperty('percentage');
      }
    });

    it('includes segment summaries', async () => {
      const { result } = renderHookWithClient(() =>
        useDonorJourneyQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      const segments = result.current.data?.segments;
      expect(segments).toBeInstanceOf(Array);

      if (segments && segments.length > 0) {
        const segment = segments[0];
        expect(segment).toHaveProperty('id');
        expect(segment).toHaveProperty('name');
        expect(segment).toHaveProperty('tier');
        expect(segment).toHaveProperty('count');
        expect(segment).toHaveProperty('health');
      }
    });

    it('exposes dataUpdatedAt timestamp', async () => {
      const { result } = renderHookWithClient(() =>
        useDonorJourneyQuery(TEST_ORG_ID)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      expect(result.current.dataUpdatedAt).toBeGreaterThan(0);
    });
  });

  describe('minAmount parameter', () => {
    it('accepts minAmount filter', async () => {
      const { result } = renderHookWithClient(() =>
        useDonorJourneyQuery(TEST_ORG_ID, 100)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      expect(result.current.data).toBeDefined();
    });
  });

  describe('empty state', () => {
    it('returns data structure for unknown org', async () => {
      const { result } = renderHookWithClient(() =>
        useDonorJourneyQuery('unknown-org')
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 5000 });

      // Should still return valid data structure
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.journeys).toBeInstanceOf(Array);
      expect(result.current.data?.segments).toBeInstanceOf(Array);
    });
  });
});
