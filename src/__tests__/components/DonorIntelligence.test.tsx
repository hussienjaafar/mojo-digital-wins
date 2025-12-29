import { describe, it, expect } from 'vitest';

/**
 * Unit tests for DonorIntelligence calculation logic.
 * Tests the lifetime-based new/returning donor classification.
 */
describe('DonorIntelligence Calculations', () => {
  describe('Lifetime-Based New/Returning Donor Logic', () => {
    /**
     * Helper to simulate the lifetime-based new/returning donor calculation logic.
     * A donor is "new" if their first-ever donation falls within the selected date range.
     * A donor is "returning" if their first donation predates the range.
     */
    function calculateNewReturningDonors(
      attributionData: Array<{
        creative_topic: string | null;
        donor_id_hash?: string | null;
        donor_phone_hash?: string | null;
      }>,
      donorFirstDonations: Array<{
        donor_key: string;
        first_donation_at: string;
      }>,
      rangeStartDate: Date
    ): Map<string, { newDonors: number; returningDonors: number }> {
      const topicStats = new Map<string, { newDonors: number; returningDonors: number }>();
      const topicDonorsSeen = new Map<string, Set<string>>();

      // Build lookup map for first donation dates
      const donorFirstDonationMap = new Map<string, Date>();
      donorFirstDonations.forEach(d => {
        if (d.donor_key && d.first_donation_at) {
          donorFirstDonationMap.set(d.donor_key, new Date(d.first_donation_at));
        }
      });

      // Process each attribution record
      attributionData.forEach(d => {
        const topic = d.creative_topic || 'Unknown';
        if (!topicStats.has(topic)) {
          topicStats.set(topic, { newDonors: 0, returningDonors: 0 });
          topicDonorsSeen.set(topic, new Set());
        }

        const donorKey = d.donor_id_hash || d.donor_phone_hash;
        if (donorKey) {
          const seenForTopic = topicDonorsSeen.get(topic)!;
          if (!seenForTopic.has(donorKey)) {
            seenForTopic.add(donorKey);

            const firstDonationDate = donorFirstDonationMap.get(donorKey);
            const stats = topicStats.get(topic)!;

            if (firstDonationDate) {
              if (firstDonationDate >= rangeStartDate) {
                stats.newDonors += 1;
              } else {
                stats.returningDonors += 1;
              }
            } else {
              // No lifetime data - treat as new
              stats.newDonors += 1;
            }
          }
        }
      });

      return topicStats;
    }

    it('classifies donors as new when first donation is within date range', () => {
      const rangeStartDate = new Date('2024-01-15');
      const attributionData = [
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-1' },
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-2' },
      ];
      const donorFirstDonations = [
        { donor_key: 'hash-1', first_donation_at: '2024-01-20T10:00:00Z' }, // After range start
        { donor_key: 'hash-2', first_donation_at: '2024-01-16T10:00:00Z' }, // After range start
      ];

      const result = calculateNewReturningDonors(attributionData, donorFirstDonations, rangeStartDate);

      // Both donors are new (first donation within range)
      expect(result.get('Climate Action')?.newDonors).toBe(2);
      expect(result.get('Climate Action')?.returningDonors).toBe(0);
    });

    it('classifies donors as returning when first donation predates range', () => {
      const rangeStartDate = new Date('2024-01-15');
      const attributionData = [
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-1' },
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-2' },
      ];
      const donorFirstDonations = [
        { donor_key: 'hash-1', first_donation_at: '2023-06-01T10:00:00Z' }, // Before range start
        { donor_key: 'hash-2', first_donation_at: '2024-01-01T10:00:00Z' }, // Before range start
      ];

      const result = calculateNewReturningDonors(attributionData, donorFirstDonations, rangeStartDate);

      // Both donors are returning (first donation predates range)
      expect(result.get('Climate Action')?.newDonors).toBe(0);
      expect(result.get('Climate Action')?.returningDonors).toBe(2);
    });

    it('correctly splits new and returning donors', () => {
      const rangeStartDate = new Date('2024-01-15');
      const attributionData = [
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-1' },
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-2' },
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-3' },
      ];
      const donorFirstDonations = [
        { donor_key: 'hash-1', first_donation_at: '2023-06-01T10:00:00Z' }, // Returning
        { donor_key: 'hash-2', first_donation_at: '2024-01-20T10:00:00Z' }, // New
        { donor_key: 'hash-3', first_donation_at: '2024-01-16T10:00:00Z' }, // New
      ];

      const result = calculateNewReturningDonors(attributionData, donorFirstDonations, rangeStartDate);

      expect(result.get('Climate Action')?.newDonors).toBe(2);
      expect(result.get('Climate Action')?.returningDonors).toBe(1);
    });

    it('uses donor_phone_hash as fallback when donor_id_hash is null', () => {
      const rangeStartDate = new Date('2024-01-15');
      const attributionData = [
        { creative_topic: 'Climate Action', donor_id_hash: null, donor_phone_hash: 'phone-hash-1' },
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-2', donor_phone_hash: null },
      ];
      const donorFirstDonations = [
        { donor_key: 'phone-hash-1', first_donation_at: '2024-01-20T10:00:00Z' }, // New
        { donor_key: 'hash-2', first_donation_at: '2023-01-01T10:00:00Z' }, // Returning
      ];

      const result = calculateNewReturningDonors(attributionData, donorFirstDonations, rangeStartDate);

      expect(result.get('Climate Action')?.newDonors).toBe(1);
      expect(result.get('Climate Action')?.returningDonors).toBe(1);
    });

    it('counts unique donors only once per topic (avoids double-counting)', () => {
      const rangeStartDate = new Date('2024-01-15');
      const attributionData = [
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-1' },
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-1' }, // Same donor, same topic
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-1' }, // Same donor, same topic
      ];
      const donorFirstDonations = [
        { donor_key: 'hash-1', first_donation_at: '2024-01-20T10:00:00Z' }, // New
      ];

      const result = calculateNewReturningDonors(attributionData, donorFirstDonations, rangeStartDate);

      // Should only count once despite 3 donations
      expect(result.get('Climate Action')?.newDonors).toBe(1);
      expect(result.get('Climate Action')?.returningDonors).toBe(0);
    });

    it('treats donors without lifetime data as new', () => {
      const rangeStartDate = new Date('2024-01-15');
      const attributionData = [
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-1' },
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-2' },
      ];
      const donorFirstDonations: Array<{ donor_key: string; first_donation_at: string }> = [];

      const result = calculateNewReturningDonors(attributionData, donorFirstDonations, rangeStartDate);

      // No lifetime data, treat as new
      expect(result.get('Climate Action')?.newDonors).toBe(2);
      expect(result.get('Climate Action')?.returningDonors).toBe(0);
    });

    it('groups donations without topic as Unknown', () => {
      const rangeStartDate = new Date('2024-01-15');
      const attributionData = [
        { creative_topic: null, donor_id_hash: 'hash-1' },
        { creative_topic: null, donor_id_hash: 'hash-2' },
      ];
      const donorFirstDonations = [
        { donor_key: 'hash-1', first_donation_at: '2024-01-20T10:00:00Z' },
        { donor_key: 'hash-2', first_donation_at: '2024-01-20T10:00:00Z' },
      ];

      const result = calculateNewReturningDonors(attributionData, donorFirstDonations, rangeStartDate);

      expect(result.get('Unknown')?.newDonors).toBe(2);
    });

    it('tracks donors separately across different topics', () => {
      const rangeStartDate = new Date('2024-01-15');
      const attributionData = [
        { creative_topic: 'Climate Action', donor_id_hash: 'hash-1' },
        { creative_topic: 'Healthcare', donor_id_hash: 'hash-1' }, // Same donor, different topic
        { creative_topic: 'Healthcare', donor_id_hash: 'hash-2' },
      ];
      const donorFirstDonations = [
        { donor_key: 'hash-1', first_donation_at: '2024-01-20T10:00:00Z' }, // New
        { donor_key: 'hash-2', first_donation_at: '2023-01-01T10:00:00Z' }, // Returning
      ];

      const result = calculateNewReturningDonors(attributionData, donorFirstDonations, rangeStartDate);

      // Climate Action: hash-1 is new
      expect(result.get('Climate Action')?.newDonors).toBe(1);
      expect(result.get('Climate Action')?.returningDonors).toBe(0);

      // Healthcare: hash-1 is new (different topic), hash-2 is returning
      expect(result.get('Healthcare')?.newDonors).toBe(1);
      expect(result.get('Healthcare')?.returningDonors).toBe(1);
    });
  });

  describe('Attribution Data Filtering', () => {
    function filterByPlatform(
      attributionData: Array<{
        attributed_platform: string | null;
        amount: number;
      }>,
      platform: string | 'all'
    ): typeof attributionData {
      if (platform === 'all') return attributionData;
      return attributionData.filter(d => d.attributed_platform === platform);
    }

    it('filters data by attributed_platform', () => {
      const data = [
        { attributed_platform: 'meta', amount: 100 },
        { attributed_platform: 'sms', amount: 50 },
        { attributed_platform: 'meta', amount: 75 },
        { attributed_platform: null, amount: 25 },
      ];

      const metaOnly = filterByPlatform(data, 'meta');
      expect(metaOnly.length).toBe(2);
      expect(metaOnly.reduce((sum, d) => sum + d.amount, 0)).toBe(175);

      const smsOnly = filterByPlatform(data, 'sms');
      expect(smsOnly.length).toBe(1);
      expect(smsOnly[0].amount).toBe(50);
    });

    it('returns all data when platform is "all"', () => {
      const data = [
        { attributed_platform: 'meta', amount: 100 },
        { attributed_platform: 'sms', amount: 50 },
        { attributed_platform: null, amount: 25 },
      ];

      const all = filterByPlatform(data, 'all');
      expect(all.length).toBe(3);
    });
  });

  describe('SMS Funnel Calculations', () => {
    function calculateSmsFunnel(
      smsEvents: Array<{ event_type: string; phone_hash: string | null }>
    ): { sent: number; delivered: number; clicked: number } {
      const counts: Record<string, number> = {};

      smsEvents.forEach(event => {
        const type = event.event_type || 'unknown';
        counts[type] = (counts[type] || 0) + 1;
      });

      return {
        sent: counts.sent || 0,
        delivered: counts.delivered || 0,
        clicked: counts.clicked || 0,
      };
    }

    it('counts SMS events by type', () => {
      const events = [
        { event_type: 'sent', phone_hash: 'hash-1' },
        { event_type: 'sent', phone_hash: 'hash-2' },
        { event_type: 'delivered', phone_hash: 'hash-1' },
        { event_type: 'delivered', phone_hash: 'hash-2' },
        { event_type: 'clicked', phone_hash: 'hash-1' },
      ];

      const funnel = calculateSmsFunnel(events);

      expect(funnel.sent).toBe(2);
      expect(funnel.delivered).toBe(2);
      expect(funnel.clicked).toBe(1);
    });

    it('handles events with null phone_hash', () => {
      const events = [
        { event_type: 'sent', phone_hash: null },
        { event_type: 'delivered', phone_hash: null },
      ];

      const funnel = calculateSmsFunnel(events);

      expect(funnel.sent).toBe(1);
      expect(funnel.delivered).toBe(1);
    });
  });
});
