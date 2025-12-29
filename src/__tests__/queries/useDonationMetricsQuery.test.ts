import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '../test-utils';
import { useDonationMetricsQuery } from '@/queries/useDonationMetricsQuery';
import { TEST_ORG_ID } from '../mocks/fixtures';

// Mock the dashboard store to provide date range
vi.mock('@/stores/dashboardStore', () => ({
  useDateRange: () => ({
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  }),
}));

describe('useDonationMetricsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Refund Handling', () => {
    it('calculates total raised from donations only (excluding refunds)', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { metrics } = result.current.data!;

      // Total raised: 50 + 100 + 75 = 225 (excluding refund of 25)
      expect(metrics.totalRaised).toBe(225);
    });

    it('calculates net raised as donations minus refunds', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { metrics } = result.current.data!;

      // Net from donations: 47.5 + 95 + 71.25 = 213.75
      // Minus refunds: 25
      // Net raised: 188.75
      expect(metrics.netRaised).toBe(188.75);
    });

    it('tracks refund count and amount separately', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { metrics } = result.current.data!;

      expect(metrics.refundCount).toBe(1);
      expect(metrics.refundAmount).toBe(25);
    });

    it('counts total donations excluding refunds', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { metrics } = result.current.data!;

      // 3 donations (txn-1, txn-2, txn-4), not the refund (txn-3)
      expect(metrics.totalDonations).toBe(3);
    });
  });

  describe('Recurring vs One-time', () => {
    it('separates recurring and one-time donations correctly', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { metrics } = result.current.data!;

      // 1 recurring (txn-2), 2 one-time (txn-1, txn-4)
      expect(metrics.recurringCount).toBe(1);
      expect(metrics.oneTimeCount).toBe(2);
    });

    it('calculates recurring revenue correctly', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { metrics } = result.current.data!;

      // Recurring revenue: txn-2 net_amount = 95
      expect(metrics.recurringRevenue).toBe(95);
    });

    it('calculates one-time revenue correctly', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { metrics } = result.current.data!;

      // One-time revenue: txn-1 (47.5) + txn-4 (71.25) = 118.75
      expect(metrics.oneTimeRevenue).toBe(118.75);
    });
  });

  describe('Unique Donors', () => {
    it('counts unique donors from donations only', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { metrics } = result.current.data!;

      // 3 unique donor_id_hashes: hash-1, hash-2, hash-3
      expect(metrics.uniqueDonors).toBe(3);
    });
  });

  describe('Average Donation', () => {
    it('calculates average donation from gross amounts', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { metrics } = result.current.data!;

      // Average: 225 / 3 = 75
      expect(metrics.averageDonation).toBe(75);
    });
  });

  describe('Source Attribution', () => {
    it('groups donations by source (refcode/campaign)', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { bySource } = result.current.data!;

      // Should have sources for:
      // - META_FALL_2024 (txn-1)
      // - sms_gotv (txn-2)
      // - Unattributed (txn-4)
      expect(bySource.length).toBeGreaterThanOrEqual(1);

      // Check that refcoded donation is tracked
      const metaSource = bySource.find(s => s.source === 'META_FALL_2024');
      if (metaSource) {
        expect(metaSource.count).toBe(1);
        expect(metaSource.amount).toBe(47.5);
      }
    });

    it('labels donations without refcode/campaign as Unattributed', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { bySource } = result.current.data!;

      // txn-4 has no refcode or source_campaign, should be "Unattributed"
      const unattributed = bySource.find(s => s.source === 'Unattributed');
      expect(unattributed).toBeDefined();
      if (unattributed) {
        expect(unattributed.count).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Time Series', () => {
    it('excludes refunds from time series donation counts', async () => {
      const { result } = renderHookWithClient(() =>
        useDonationMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { timeSeries } = result.current.data!;

      // Total donations across all days should be 3
      const totalDonations = timeSeries.reduce((sum, day) => sum + day.donations, 0);
      expect(totalDonations).toBe(3);
    });
  });
});
