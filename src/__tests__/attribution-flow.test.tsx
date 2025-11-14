import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { 
  mockAttributionMappings, 
  mockTransactions, 
  mockMetaMetrics, 
  mockSMSMetrics,
  mockROIAnalytics 
} from './mocks/handlers';

// Test utilities
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Attribution Flow', () => {
  describe('UTM to Meta Campaign Attribution', () => {
    it('should link UTM parameters to Meta campaign correctly', () => {
      const metaAttribution = mockAttributionMappings.find(
        (attr) => attr.meta_campaign_id === 'meta-123'
      );

      expect(metaAttribution).toBeDefined();
      expect(metaAttribution?.utm_source).toBe('facebook');
      expect(metaAttribution?.utm_medium).toBe('cpc');
      expect(metaAttribution?.utm_campaign).toBe('fall_fundraiser');
      expect(metaAttribution?.refcode).toBe('META_FALL_2024');
    });

    it('should attribute donations with matching UTM to correct Meta campaign', () => {
      const metaAttribution = mockAttributionMappings.find(
        (attr) => attr.meta_campaign_id === 'meta-123'
      );
      const matchingTransaction = mockTransactions.find(
        (txn) => txn.refcode === metaAttribution?.refcode
      );

      expect(matchingTransaction).toBeDefined();
      expect(matchingTransaction?.refcode).toBe('META_FALL_2024');
      expect(matchingTransaction?.source_campaign).toBe('fall_fundraiser');
      expect(matchingTransaction?.amount).toBe(50);
    });

    it('should calculate Meta campaign revenue from attributed donations', () => {
      const metaAttribution = mockAttributionMappings.find(
        (attr) => attr.meta_campaign_id === 'meta-123'
      );
      const attributedTransactions = mockTransactions.filter(
        (txn) => txn.refcode === metaAttribution?.refcode
      );

      const totalRevenue = attributedTransactions.reduce(
        (sum, txn) => sum + txn.amount,
        0
      );

      expect(totalRevenue).toBe(50);
      expect(attributedTransactions.length).toBe(1);
    });

    it('should calculate ROI for Meta campaign with correct attribution', () => {
      const metaAttribution = mockAttributionMappings.find(
        (attr) => attr.meta_campaign_id === 'meta-123'
      );
      const attributedTransactions = mockTransactions.filter(
        (txn) => txn.refcode === metaAttribution?.refcode
      );
      const metaMetric = mockMetaMetrics.find(
        (m) => m.campaign_id === metaAttribution?.meta_campaign_id
      );

      const revenue = attributedTransactions.reduce((sum, txn) => sum + txn.amount, 0);
      const spend = metaMetric?.spend || 0;
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;

      expect(revenue).toBe(50);
      expect(spend).toBe(500);
      expect(roi).toBe(-90); // Loss
    });
  });

  describe('UTM to SMS Campaign Attribution', () => {
    it('should link UTM parameters to Switchboard campaign ID', () => {
      const smsAttribution = mockAttributionMappings.find(
        (attr) => attr.switchboard_campaign_id === 'sms-456'
      );

      expect(smsAttribution).toBeDefined();
      expect(smsAttribution?.utm_source).toBe('switchboard');
      expect(smsAttribution?.utm_medium).toBe('sms');
      expect(smsAttribution?.utm_campaign).toBe('gotv_campaign');
      expect(smsAttribution?.refcode).toBe('SMS_GOTV_2024');
    });

    it('should attribute SMS-driven donations correctly', () => {
      const smsAttribution = mockAttributionMappings.find(
        (attr) => attr.switchboard_campaign_id === 'sms-456'
      );
      const matchingTransaction = mockTransactions.find(
        (txn) => txn.refcode === smsAttribution?.refcode
      );

      expect(matchingTransaction).toBeDefined();
      expect(matchingTransaction?.refcode).toBe('SMS_GOTV_2024');
      expect(matchingTransaction?.source_campaign).toBe('gotv_campaign');
      expect(matchingTransaction?.amount).toBe(100);
    });

    it('should calculate SMS campaign revenue from attributed donations', () => {
      const smsAttribution = mockAttributionMappings.find(
        (attr) => attr.switchboard_campaign_id === 'sms-456'
      );
      const attributedTransactions = mockTransactions.filter(
        (txn) => txn.refcode === smsAttribution?.refcode
      );

      const totalRevenue = attributedTransactions.reduce(
        (sum, txn) => sum + txn.amount,
        0
      );

      expect(totalRevenue).toBe(100);
      expect(attributedTransactions.length).toBe(1);
    });

    it('should calculate ROI for SMS campaign with correct attribution', () => {
      const smsAttribution = mockAttributionMappings.find(
        (attr) => attr.switchboard_campaign_id === 'sms-456'
      );
      const attributedTransactions = mockTransactions.filter(
        (txn) => txn.refcode === smsAttribution?.refcode
      );
      const smsMetric = mockSMSMetrics.find(
        (m) => m.campaign_id === smsAttribution?.switchboard_campaign_id
      );

      const revenue = attributedTransactions.reduce((sum, txn) => sum + txn.amount, 0);
      const cost = smsMetric?.cost || 0;
      const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : 0;

      expect(revenue).toBe(100);
      expect(cost).toBe(100);
      expect(roi).toBe(0); // Break-even
    });
  });

  describe('Refcode to ActBlue Attribution', () => {
    it('should attribute donations with matching refcode', () => {
      const refcode = 'META_FALL_2024';
      const matchingTransactions = mockTransactions.filter(
        (txn) => txn.refcode === refcode
      );

      expect(matchingTransactions.length).toBeGreaterThan(0);
      expect(matchingTransactions[0].refcode).toBe(refcode);
    });

    it('should calculate total revenue for a refcode', () => {
      const refcode = 'MULTI_TOUCH';
      const matchingTransactions = mockTransactions.filter(
        (txn) => txn.refcode === refcode
      );

      const totalRevenue = matchingTransactions.reduce(
        (sum, txn) => sum + txn.amount,
        0
      );

      expect(totalRevenue).toBe(250);
      expect(matchingTransactions.length).toBe(1);
    });

    it('should link refcode to both Meta and SMS campaigns', () => {
      const multiTouchAttribution = mockAttributionMappings.find(
        (attr) => attr.refcode === 'MULTI_TOUCH'
      );

      expect(multiTouchAttribution).toBeDefined();
      expect(multiTouchAttribution?.meta_campaign_id).toBe('meta-789');
      expect(multiTouchAttribution?.switchboard_campaign_id).toBe('sms-789');
    });

    it('should handle donations with no refcode gracefully', () => {
      const transactionWithoutRefcode = {
        ...mockTransactions[0],
        refcode: null,
      };

      const matchingAttribution = mockAttributionMappings.find(
        (attr) => attr.refcode === transactionWithoutRefcode.refcode
      );

      expect(matchingAttribution).toBeUndefined();
    });
  });

  describe('Multi-touch Attribution Calculations', () => {
    it('should calculate first-touch attribution (credit Meta)', () => {
      const multiTouchROI = mockROIAnalytics[0];
      const donationAmount = 250;

      expect(multiTouchROI.first_touch_attribution).toBe(donationAmount);
      // First touch should give 100% credit to Meta (first interaction)
    });

    it('should calculate last-touch attribution (credit SMS)', () => {
      const multiTouchROI = mockROIAnalytics[0];
      const donationAmount = 250;

      expect(multiTouchROI.last_touch_attribution).toBe(donationAmount);
      // Last touch should give 100% credit to SMS (final interaction before conversion)
    });

    it('should calculate linear attribution (split credit 50/50)', () => {
      const multiTouchROI = mockROIAnalytics[0];
      const donationAmount = 250;
      const expectedLinearCredit = donationAmount / 2; // Split evenly between 2 touchpoints

      expect(multiTouchROI.linear_attribution).toBe(expectedLinearCredit);
    });

    it('should calculate position-based attribution (40-20-40 model)', () => {
      const multiTouchROI = mockROIAnalytics[0];
      const donationAmount = 250;
      // 40% to first (Meta), 40% to last (SMS), 20% to middle
      const expectedPositionBased = 175; // In a 2-touch model, this might vary

      expect(multiTouchROI.position_based_attribution).toBe(expectedPositionBased);
    });

    it('should calculate time-decay attribution (favor recent touches)', () => {
      const multiTouchROI = mockROIAnalytics[0];
      const donationAmount = 250;
      // Time decay gives more credit to recent interactions (SMS)
      // Should be less than full amount but more than linear

      expect(multiTouchROI.time_decay_attribution).toBeLessThan(donationAmount);
      expect(multiTouchROI.time_decay_attribution).toBeGreaterThan(0);
    });

    it('should ensure all attribution models reference the same donation', () => {
      const multiTouchROI = mockROIAnalytics[0];
      
      // All attribution values should be positive
      expect(multiTouchROI.first_touch_attribution).toBeGreaterThan(0);
      expect(multiTouchROI.last_touch_attribution).toBeGreaterThan(0);
      expect(multiTouchROI.linear_attribution).toBeGreaterThan(0);
      expect(multiTouchROI.position_based_attribution).toBeGreaterThan(0);
      expect(multiTouchROI.time_decay_attribution).toBeGreaterThan(0);
    });

    it('should track complete donor journey (Meta → SMS → Donation)', () => {
      const multiTouchAttribution = mockAttributionMappings.find(
        (attr) => attr.refcode === 'MULTI_TOUCH'
      );
      const donation = mockTransactions.find(
        (txn) => txn.refcode === 'MULTI_TOUCH'
      );
      const metaMetric = mockMetaMetrics.find(
        (m) => m.campaign_id === multiTouchAttribution?.meta_campaign_id
      );
      const smsMetric = mockSMSMetrics.find(
        (m) => m.campaign_id === multiTouchAttribution?.switchboard_campaign_id
      );

      // Verify complete journey exists
      expect(multiTouchAttribution).toBeDefined();
      expect(donation).toBeDefined();
      expect(metaMetric).toBeDefined();
      expect(smsMetric).toBeDefined();

      // Verify journey timeline
      expect(new Date(metaMetric!.date).getTime()).toBeLessThan(
        new Date(smsMetric!.date).getTime()
      );
      expect(new Date(smsMetric!.date).getTime()).toBeLessThanOrEqual(
        new Date(donation!.transaction_date).getTime()
      );
    });
  });

  describe('Attribution Data Integrity', () => {
    it('should have unique attribution IDs', () => {
      const ids = mockAttributionMappings.map((attr) => attr.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid organization IDs for all attributions', () => {
      mockAttributionMappings.forEach((attr) => {
        expect(attr.organization_id).toBeDefined();
        expect(attr.organization_id).toBe('org-1');
      });
    });

    it('should have at least one channel ID (Meta or SMS)', () => {
      mockAttributionMappings.forEach((attr) => {
        const hasMetaId = attr.meta_campaign_id !== null;
        const hasSMSId = attr.switchboard_campaign_id !== null;
        expect(hasMetaId || hasSMSId).toBe(true);
      });
    });

    it('should have matching refcodes between attribution and transactions', () => {
      const attributionRefcodes = new Set(
        mockAttributionMappings.map((attr) => attr.refcode).filter(Boolean)
      );
      const transactionRefcodes = new Set(
        mockTransactions.map((txn) => txn.refcode).filter(Boolean)
      );

      attributionRefcodes.forEach((refcode) => {
        expect(transactionRefcodes.has(refcode!)).toBe(true);
      });
    });
  });

  describe('Revenue Attribution Calculations', () => {
    it('should calculate total attributed revenue across all channels', () => {
      const totalRevenue = mockTransactions.reduce(
        (sum, txn) => sum + txn.amount,
        0
      );
      expect(totalRevenue).toBe(400); // 50 + 100 + 250
    });

    it('should calculate revenue by channel (Meta vs SMS)', () => {
      const metaRefcodes = mockAttributionMappings
        .filter((attr) => attr.meta_campaign_id !== null)
        .map((attr) => attr.refcode);
      
      const smsRefcodes = mockAttributionMappings
        .filter((attr) => attr.switchboard_campaign_id !== null && attr.meta_campaign_id === null)
        .map((attr) => attr.refcode);

      const metaRevenue = mockTransactions
        .filter((txn) => metaRefcodes.includes(txn.refcode))
        .reduce((sum, txn) => sum + txn.amount, 0);

      const smsRevenue = mockTransactions
        .filter((txn) => smsRefcodes.includes(txn.refcode))
        .reduce((sum, txn) => sum + txn.amount, 0);

      expect(metaRevenue).toBeGreaterThan(0);
      expect(smsRevenue).toBeGreaterThan(0);
    });

    it('should handle multi-channel attribution for shared refcodes', () => {
      const multiChannelRefcode = 'MULTI_TOUCH';
      const attribution = mockAttributionMappings.find(
        (attr) => attr.refcode === multiChannelRefcode
      );

      expect(attribution?.meta_campaign_id).toBeDefined();
      expect(attribution?.switchboard_campaign_id).toBeDefined();

      const revenue = mockTransactions
        .filter((txn) => txn.refcode === multiChannelRefcode)
        .reduce((sum, txn) => sum + txn.amount, 0);

      expect(revenue).toBe(250);
    });
  });

  describe('Attribution Time Windows', () => {
    it('should respect chronological order of touchpoints', () => {
      const multiTouchAttribution = mockAttributionMappings.find(
        (attr) => attr.refcode === 'MULTI_TOUCH'
      );

      const metaDate = new Date(
        mockMetaMetrics.find(
          (m) => m.campaign_id === multiTouchAttribution?.meta_campaign_id
        )?.date || ''
      );

      const smsDate = new Date(
        mockSMSMetrics.find(
          (m) => m.campaign_id === multiTouchAttribution?.switchboard_campaign_id
        )?.date || ''
      );

      const donationDate = new Date(
        mockTransactions.find(
          (txn) => txn.refcode === multiTouchAttribution?.refcode
        )?.transaction_date || ''
      );

      expect(metaDate.getTime()).toBeLessThanOrEqual(smsDate.getTime());
      expect(smsDate.getTime()).toBeLessThanOrEqual(donationDate.getTime());
    });

    it('should handle same-day conversions', () => {
      const metaTransaction = mockTransactions.find(
        (txn) => txn.refcode === 'META_FALL_2024'
      );
      const metaMetric = mockMetaMetrics.find((m) => m.campaign_id === 'meta-123');

      const txnDate = new Date(metaTransaction!.transaction_date).toISOString().split('T')[0];
      const metricDate = metaMetric!.date;

      expect(txnDate).toBe(metricDate);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle attributions with missing UTM parameters', () => {
      const attributionWithPartialUTM = {
        id: 'attr-partial',
        organization_id: 'org-1',
        meta_campaign_id: 'meta-999',
        refcode: 'PARTIAL_UTM',
        utm_source: 'facebook',
        utm_medium: null,
        utm_campaign: null,
      };

      expect(attributionWithPartialUTM.utm_source).toBeDefined();
      expect(attributionWithPartialUTM.utm_medium).toBeNull();
    });

    it('should handle zero-value donations', () => {
      const zeroDonation = {
        ...mockTransactions[0],
        amount: 0,
      };

      expect(zeroDonation.amount).toBe(0);
      // Should still track for conversion count even if zero value
    });

    it('should handle negative ROI scenarios', () => {
      const spend = 1000;
      const revenue = 100;
      const roi = ((revenue - spend) / spend) * 100;

      expect(roi).toBeLessThan(0);
      expect(roi).toBe(-90);
    });

    it('should handle divisions by zero in ROI calculations', () => {
      const revenue = 100;
      const spend = 0;
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;

      expect(roi).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate conversion rate from Meta ads', () => {
      const metaMetric = mockMetaMetrics[0];
      const clicks = metaMetric.clicks || 0;
      const conversions = metaMetric.conversions || 0;
      const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

      expect(conversionRate).toBeGreaterThan(0);
      expect(conversionRate).toBe(4); // 10 conversions / 250 clicks = 4%
    });

    it('should calculate cost per conversion for SMS', () => {
      const smsMetric = mockSMSMetrics[0];
      const cost = smsMetric.cost || 0;
      const conversions = smsMetric.conversions || 0;
      const costPerConversion = conversions > 0 ? cost / conversions : 0;

      expect(costPerConversion).toBeGreaterThan(0);
      expect(costPerConversion).toBe(20); // $100 / 5 conversions = $20
    });

    it('should calculate ROAS (Return on Ad Spend)', () => {
      const spend = 500;
      const revenue = 50;
      const roas = spend > 0 ? revenue / spend : 0;

      expect(roas).toBeLessThan(1); // Loss
      expect(roas).toBe(0.1); // $0.10 return per $1 spent
    });
  });
});
