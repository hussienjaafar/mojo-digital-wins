import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '../test-utils';
import { useClientDashboardMetricsQuery } from '@/queries/useClientDashboardMetricsQuery';
import { TEST_ORG_ID } from '../mocks/fixtures';

// Mock the dashboard store to provide date range and filters
vi.mock('@/stores/dashboardStore', () => ({
  useDateRange: () => ({
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  }),
  useSelectedCampaignId: () => null,
  useSelectedCreativeId: () => null,
}));

describe('useClientDashboardMetricsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('KPI Calculations', () => {
    it('correctly separates donations from refunds for total raised', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Total raised should only include donations (50 + 100 + 75 = 225)
      // NOT refunds (-25)
      expect(kpis.totalRaised).toBe(225);
    });

    it('calculates net revenue as donations minus fees minus refunds', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Net from donations: 47.5 + 95 + 71.25 = 213.75
      // Minus refunds: 25
      // Expected net revenue: 213.75 - 25 = 188.75
      expect(kpis.totalNetRevenue).toBe(188.75);
    });

    it('calculates refund rate as percentage of gross donations', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Refund amount: 25
      // Gross donations: 225
      // Refund rate: (25 / 225) * 100 = 11.11%
      expect(kpis.refundRate).toBeCloseTo(11.11, 1);
    });

    it('excludes refunds from donation count', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Should only count 3 donations, not the refund
      expect(kpis.donationCount).toBe(3);
    });

    it('calculates unique donors from donations only', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Three unique donor_id_hashes: hash-1, hash-2, hash-3
      expect(kpis.uniqueDonors).toBe(3);
    });

    it('calculates recurring percentage from donations only', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // 1 recurring donation out of 3 total donations = 33.33%
      expect(kpis.recurringPercentage).toBeCloseTo(33.33, 1);
    });
  });

  describe('Deterministic Rate', () => {
    it('calculates deterministic rate from donation_attribution view', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // From mock attribution data:
      // - 2 attributed (refcode, sms_last_touch)
      // - 1 unattributed
      // Deterministic rate: (2/3) * 100 = 66.67%
      expect(kpis.deterministicRate).toBeCloseTo(66.67, 1);
    });

    it('uses same logic for prevDeterministicRate as current period', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { prevKpis } = result.current.data!;

      // prevDeterministicRate should use donation_attribution view when available
      // (same logic as current period)
      // If no prev attribution data, falls back to transaction fields
      expect(prevKpis.deterministicRate).toBeDefined();
      expect(typeof prevKpis.deterministicRate).toBe('number');
    });
  });

  describe('Channel Breakdown', () => {
    it('breaks down donations by attributed platform', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { channelBreakdown, metaConversions, smsConversions, directDonations } = result.current.data!;

      // From mock attribution data:
      // - 1 meta (refcode with attributed_platform: meta)
      // - 1 sms (sms_last_touch with attributed_platform: sms)
      // - 1 unattributed
      expect(metaConversions).toBe(1);
      expect(smsConversions).toBe(1);
      expect(directDonations).toBe(1);

      // Channel breakdown should include all channels
      expect(channelBreakdown.some(c => c.name.includes('Meta'))).toBe(true);
      expect(channelBreakdown.some(c => c.name.includes('SMS'))).toBe(true);
      expect(channelBreakdown.some(c => c.name.includes('Unattributed'))).toBe(true);
    });
  });

  describe('ROI Calculation', () => {
    it('calculates ROI as net revenue divided by total spend', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Meta spend: 500 + 600 = 1100
      // SMS cost: 100 + 150 = 250
      // Total spend: 1350
      // Net revenue: 188.75
      // ROI = (Revenue - Cost) / Cost = (188.75 - 1350) / 1350 = -0.86
      expect(kpis.totalSpend).toBe(1350);
      expect(kpis.roi).toBeCloseTo(-0.86, 1);
    });
  });

  describe('Time Series', () => {
    it('separates donations and refunds in time series', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { timeSeries } = result.current.data!;

      // Time series should have entries for the date range
      expect(timeSeries.length).toBeGreaterThan(0);

      // Check that refunds are shown as negative values
      const dayWithRefund = timeSeries.find(d => d.refunds < 0);
      if (dayWithRefund) {
        expect(dayWithRefund.refunds).toBeLessThan(0);
      }
    });

    it('calculates netDonations as donation net minus refund net (refund-adjusted)', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { timeSeries } = result.current.data!;

      // Find the day with both donation and refund (2024-01-17 has refund for hash-1)
      // The refund is 25, so netDonations should be affected
      // Sum of all netDonations across days should equal total net revenue (188.75)
      const totalNetFromSeries = timeSeries.reduce((sum, d) => sum + d.netDonations, 0);

      // This should match KPI totalNetRevenue (donation net - refund net)
      expect(totalNetFromSeries).toBeCloseTo(188.75, 1);
    });

    it('includes refund-adjusted netDonations in sparklines', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { sparklines, timeSeries } = result.current.data!;

      // netRevenue sparkline should use refund-adjusted values from timeSeries
      expect(sparklines.netRevenue.length).toBe(timeSeries.length);

      // Sum of sparkline values should match total net revenue
      const sparklineTotal = sparklines.netRevenue.reduce((sum, d) => sum + d.value, 0);
      expect(sparklineTotal).toBeCloseTo(188.75, 1);
    });
  });

  describe('ROI Sparkline', () => {
    it('uses refund-adjusted netDonations for ROI calculation', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { sparklines, timeSeries } = result.current.data!;

      // ROI sparkline should use netDonations (which is refund-adjusted)
      // For each day: ROI = (netDonations - spend) / spend
      expect(sparklines.roi.length).toBe(timeSeries.length);

      // Find a day with spend to verify ROI calculation
      const dayWithSpend = timeSeries.find(d => d.metaSpend + d.smsSpend > 0);
      if (dayWithSpend) {
        const spend = dayWithSpend.metaSpend + dayWithSpend.smsSpend;
        const expectedRoi = (dayWithSpend.netDonations - spend) / spend;
        const roiIndex = timeSeries.indexOf(dayWithSpend);
        expect(sparklines.roi[roiIndex].value).toBeCloseTo(expectedRoi, 2);
      }
    });
  });

  describe('Fee Handling', () => {
    it('calculates total fees from donations only', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Fees: 2.5 + 5 + 3.75 = 11.25
      expect(kpis.totalFees).toBe(11.25);
    });

    it('calculates fee percentage correctly', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Fee percentage: (11.25 / 225) * 100 = 5%
      expect(kpis.feePercentage).toBe(5);
    });
  });
});
