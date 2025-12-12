import { describe, it, expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '../test-utils';
import { useChannelSummariesQuery } from '@/queries/useChannelSummariesQuery';
import { channelKeys } from '@/queries/queryKeys';
import { TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE } from '../mocks/fixtures';

describe('useChannelSummariesQuery', () => {
  describe('query key factory', () => {
    it('generates correct base key', () => {
      expect(channelKeys.all).toEqual(['channels']);
    });

    it('generates correct summaries key with params', () => {
      expect(channelKeys.summaries(TEST_ORG_ID, { startDate: TEST_START_DATE, endDate: TEST_END_DATE })).toEqual([
        'channels',
        'summaries',
        TEST_ORG_ID,
        { startDate: TEST_START_DATE, endDate: TEST_END_DATE },
      ]);
    });
  });

  describe('query behavior', () => {
    it('returns loading state initially', () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE)
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('does not fetch when organizationId is undefined', () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(undefined, TEST_START_DATE, TEST_END_DATE)
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('does not fetch when dates are empty', () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, '', '')
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('fetches channel summaries data successfully', async () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
    });

    it('includes Meta summary', async () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const meta = result.current.data?.meta;
      expect(meta).toBeDefined();
      expect(typeof meta?.spend).toBe('number');
      expect(typeof meta?.conversions).toBe('number');
      expect(typeof meta?.roas).toBe('number');
      expect(typeof meta?.hasData).toBe('boolean');
    });

    it('includes SMS summary', async () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const sms = result.current.data?.sms;
      expect(sms).toBeDefined();
      expect(typeof sms?.sent).toBe('number');
      expect(typeof sms?.raised).toBe('number');
      expect(typeof sms?.cost).toBe('number');
      expect(typeof sms?.roi).toBe('number');
      expect(typeof sms?.hasData).toBe('boolean');
    });

    it('includes Donations summary', async () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const donations = result.current.data?.donations;
      expect(donations).toBeDefined();
      expect(typeof donations?.totalGross).toBe('number');
      expect(typeof donations?.totalNet).toBe('number');
      expect(typeof donations?.donors).toBe('number');
      expect(typeof donations?.avgNet).toBe('number');
      expect(typeof donations?.hasData).toBe('boolean');
    });

    it('includes aggregate totals', async () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const totals = result.current.data?.totals;
      expect(totals).toBeDefined();
      expect(typeof totals?.totalRevenue).toBe('number');
      expect(typeof totals?.totalSpend).toBe('number');
      expect(typeof totals?.overallRoi).toBe('number');
    });

    it('includes fetchedAt timestamp', async () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.fetchedAt).toBeDefined();
      expect(typeof result.current.data?.fetchedAt).toBe('string');
    });

    it('exposes dataUpdatedAt timestamp', async () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.dataUpdatedAt).toBeGreaterThan(0);
    });
  });

  describe('isDataStale helper', () => {
    it('provides isDataStale function', async () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.isDataStale).toBe('function');
    });

    it('returns false when no data', () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(undefined, TEST_START_DATE, TEST_END_DATE)
      );

      expect(result.current.isDataStale(TEST_END_DATE)).toBe(false);
    });

    it('detects stale data', async () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check if data is stale relative to a future date
      const futureDate = '2025-12-31';
      expect(result.current.isDataStale(futureDate)).toBe(true);
    });
  });

  describe('refund tracking', () => {
    it('includes refund metrics in donations', async () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery(TEST_ORG_ID, TEST_START_DATE, TEST_END_DATE)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const donations = result.current.data?.donations;
      expect(typeof donations?.refundAmount).toBe('number');
      expect(typeof donations?.refundCount).toBe('number');
    });
  });

  describe('empty state', () => {
    it('returns data structure for unknown org', async () => {
      const { result } = renderHookWithClient(() =>
        useChannelSummariesQuery('unknown-org', TEST_START_DATE, TEST_END_DATE)
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should return valid data structure even for unknown org
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.meta).toBeDefined();
      expect(result.current.data?.sms).toBeDefined();
      expect(result.current.data?.donations).toBeDefined();
    });
  });
});
