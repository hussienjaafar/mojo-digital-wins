import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithClient } from '../test-utils';
import { TEST_ORG_ID } from '../mocks/fixtures';

// ============================================================================
// Campaign/Creative Filter End-to-End Tests
// ============================================================================

// Dynamic mock values that can be changed between tests
let mockCampaignId: string | null = null;
let mockCreativeId: string | null = null;

// Mock the dashboard store with dynamic values
vi.mock('@/stores/dashboardStore', () => ({
  useDateRange: () => ({
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  }),
  useSelectedCampaignId: () => mockCampaignId,
  useSelectedCreativeId: () => mockCreativeId,
}));

// Import after mocking
import { useClientDashboardMetricsQuery } from '@/queries/useClientDashboardMetricsQuery';

describe('Campaign/Creative Filter End-to-End', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset filter values before each test
    mockCampaignId = null;
    mockCreativeId = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('No Filters (Baseline)', () => {
    it('includes all donations when no filter is active', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // All 3 donations: 50 + 100 + 75 = 225
      expect(kpis.totalRaised).toBe(225);
      expect(kpis.donationCount).toBe(3);
    });

    it('includes all spend (Meta + SMS) when no filter is active', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Meta: 500 + 600 = 1100
      // SMS: 100 + 150 = 250
      // Total: 1350
      expect(kpis.totalSpend).toBe(1350);
    });

    it('includes SMS conversions when no filter is active', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { smsConversions } = result.current.data!;

      // txn-2 is SMS attributed
      expect(smsConversions).toBe(1);
    });

    it('includes all channel breakdowns when no filter is active', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { metaConversions, smsConversions, directDonations } = result.current.data!;

      // From mock attribution: 1 meta, 1 sms, 1 unattributed
      expect(metaConversions).toBe(1);
      expect(smsConversions).toBe(1);
      expect(directDonations).toBe(1);
    });
  });

  describe('Campaign Filter Active', () => {
    beforeEach(() => {
      // Set campaign-A filter
      mockCampaignId = 'campaign-A';
    });

    it('filters donations to only matching campaign', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // With campaign-A filter:
      // - Only txn-1 (campaign-A) should be included: $50 donation
      // - txn-2 (campaign-B) and txn-4 (unattributed) excluded
      expect(kpis.totalRaised).toBe(50);
      expect(kpis.donationCount).toBe(1);
    });

    it('filters net revenue with global refunds applied', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Only txn-1 net_amount: 47.5
      // ALL refunds are included globally (refunds can't be campaign-filtered)
      // Refund: 25
      // Net revenue: 47.5 - 25 = 22.5
      expect(kpis.totalNetRevenue).toBe(22.5);
    });

    it('filters Meta spend to only matching campaign', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // With campaign-A filter:
      // - Only meta-m-1 (campaign-A): $500 spend
      // - meta-m-2 (campaign-B): $600 excluded
      // - SMS excluded entirely (no campaign mapping)
      expect(kpis.totalSpend).toBe(500);
    });

    it('excludes SMS metrics when campaign filter is active', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { smsConversions } = result.current.data!;

      // SMS has no campaign mapping, so should be excluded entirely
      expect(smsConversions).toBe(0);
    });

    it('calculates filtered ROI with global refunds', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Filtered net revenue: 47.5 (txn-1 net) - 25 (ALL refunds) = 22.5
      // Filtered spend: 500 (campaign-A Meta only)
      // ROI = Net Revenue / Spend (investment multiplier) = 22.5 / 500 = 0.045
      expect(kpis.roi).toBeCloseTo(0.045, 2);
    });

    it('shows only Meta in channel breakdown when campaign filter active', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { metaConversions, smsConversions, directDonations } = result.current.data!;

      // Only campaign-A has one Meta attribution
      expect(metaConversions).toBe(1);
      expect(smsConversions).toBe(0);
      expect(directDonations).toBe(0);
    });
  });

  describe('Campaign Filter - Different Campaign', () => {
    beforeEach(() => {
      // Set campaign-B filter (SMS campaign)
      mockCampaignId = 'campaign-B';
    });

    it('filters donations to campaign-B', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Only txn-2 (campaign-B): $100 donation
      expect(kpis.totalRaised).toBe(100);
      expect(kpis.donationCount).toBe(1);
    });

    it('filters Meta spend to campaign-B', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Only meta-m-2 (campaign-B): $600 spend
      // SMS excluded (no campaign mapping)
      expect(kpis.totalSpend).toBe(600);
    });
  });

  describe('Creative Filter Active', () => {
    beforeEach(() => {
      // Set creative-1 filter
      mockCreativeId = 'creative-1';
    });

    it('filters donations to only matching creative', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Only txn-1 has creative-1: $50
      expect(kpis.totalRaised).toBe(50);
      expect(kpis.donationCount).toBe(1);
    });

    it('filters Meta spend by ad_creative_id when creative filter active', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Creative filter now filters Meta spend by ad_creative_id:
      // - Only meta-m-1 (creative-1): $500 spend
      // - meta-m-2 (creative-2): $600 excluded
      // SMS excluded because creative filter is active (SMS has no creative mapping)
      expect(kpis.totalSpend).toBe(500);
    });

    it('excludes SMS when creative filter active', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { smsConversions } = result.current.data!;

      // SMS excluded when creative filter active (no creative mapping)
      expect(smsConversions).toBe(0);
    });

    it('calculates ROI correctly with filtered creative spend', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Net revenue: 47.5 (txn-1 net) - 25 (ALL refunds, not filtered) = 22.5
      // Spend: 500 (creative-1 Meta only, SMS excluded)
      // ROI = Net Revenue / Spend (investment multiplier) = 22.5 / 500 = 0.045
      expect(kpis.roi).toBeCloseTo(0.045, 2);
    });
  });

  describe('Combined Campaign + Creative Filter', () => {
    beforeEach(() => {
      // Set both filters
      mockCampaignId = 'campaign-A';
      mockCreativeId = 'creative-1';
    });

    it('applies both filters together', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Only txn-1 matches both campaign-A AND creative-1: $50
      expect(kpis.totalRaised).toBe(50);
      expect(kpis.donationCount).toBe(1);
    });
  });

  describe('Non-existent Filter Values', () => {
    beforeEach(() => {
      // Set a campaign that doesn't exist in the data
      mockCampaignId = 'campaign-nonexistent';
    });

    it('returns zero metrics when no donations match filter', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      expect(kpis.totalRaised).toBe(0);
      expect(kpis.donationCount).toBe(0);
      expect(kpis.uniqueDonors).toBe(0);
    });

    it('returns zero spend when no campaigns match filter', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // No matching meta spend, SMS excluded because campaign filter active
      expect(kpis.totalSpend).toBe(0);
    });

    it('handles division by zero in ROI when no spend', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // ROI should be 0 when no spend (not NaN or Infinity)
      expect(kpis.roi).toBe(0);
    });
  });

  describe('Refund Handling Under Filters', () => {
    beforeEach(() => {
      // Set campaign-A filter
      mockCampaignId = 'campaign-A';
    });

    it('includes ALL refunds in net revenue calculation (refunds are not filterable)', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Gross donations (campaign-A only): $50
      expect(kpis.totalRaised).toBe(50);

      // Net revenue = donation net - ALL refunds
      // Donation net (txn-1): 47.5
      // ALL refunds (txn-3): 25 (refunds don't have campaign attribution)
      // Net revenue: 47.5 - 25 = 22.5
      expect(kpis.totalNetRevenue).toBe(22.5);

      // Refund amount should be global (not filtered)
      expect(kpis.refundAmount).toBe(25);
    });

    it('calculates refund rate against filtered gross donations', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // Refund rate = refund amount / gross donations
      // Refund amount: 25 (all refunds)
      // Gross donations (campaign-A): 50
      // Refund rate: (25 / 50) * 100 = 50%
      expect(kpis.refundRate).toBe(50);
    });

    it('maintains refund-adjusted net in ROI calculation', async () => {
      const { result } = renderHookWithClient(() =>
        useClientDashboardMetricsQuery(TEST_ORG_ID)
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

      const { kpis } = result.current.data!;

      // ROI = Net Revenue / Spend (investment multiplier)
      // Net revenue: 22.5 (filtered donations minus ALL refunds)
      // Total spend: 500 (campaign-A Meta only, SMS excluded)
      // ROI: 22.5 / 500 = 0.045
      expect(kpis.roi).toBeCloseTo(0.045, 2);
    });
  });
});
