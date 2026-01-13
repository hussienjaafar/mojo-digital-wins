/**
 * Ad Performance Query Hook
 *
 * Fetches granular Meta ad performance data with ActBlue attribution.
 *
 * CRITICAL FIX: Uses meta_ad_metrics for date-filtered spend (daily data)
 * instead of meta_creative_insights which contains cumulative totals.
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type {
  AdPerformanceData,
  AdPerformanceTotals,
  AdPerformanceResult,
  AdPerformanceTier,
} from '@/types/adPerformance';

// Query key factory
export const adPerformanceKeys = {
  all: ['ad-performance'] as const,
  list: (orgId: string, startDate: string, endDate: string) =>
    [...adPerformanceKeys.all, 'list', orgId, startDate, endDate] as const,
};

/**
 * Calculate performance tier based on ROAS
 */
function getPerformanceTier(roas: number): AdPerformanceTier {
  if (roas >= 3) return 'TOP_PERFORMER';
  if (roas >= 2) return 'STRONG';
  if (roas >= 1) return 'AVERAGE';
  return 'NEEDS_IMPROVEMENT';
}

/**
 * Build totals from ads - FIXED: Uses Set for unique donors instead of summing
 */
function buildTotals(
  ads: AdPerformanceData[],
  allDonorEmails: string[]
): AdPerformanceTotals {
  const total_spend = ads.reduce((sum, ad) => sum + ad.spend, 0);
  const total_raised = ads.reduce((sum, ad) => sum + ad.raised, 0);
  const total_donations = ads.reduce((sum, ad) => sum + ad.donation_count, 0);
  const total_impressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
  const total_clicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);

  // CRITICAL FIX: Use unique donors from the actual set, not sum of per-ad unique donors
  const unique_donors = new Set(allDonorEmails).size;

  return {
    total_spend,
    total_raised,
    total_roas: total_spend > 0 ? total_raised / total_spend : 0,
    total_profit: total_raised - total_spend,
    unique_donors,
    total_donations,
    avg_donation: total_donations > 0 ? total_raised / total_donations : 0,
    avg_cpa: unique_donors > 0 ? total_spend / unique_donors : 0,
    total_impressions,
    total_clicks,
    avg_ctr: total_impressions > 0 ? (total_clicks / total_impressions) * 100 : 0,
  };
}

interface UseAdPerformanceQueryOptions {
  organizationId: string;
  startDate: string;
  endDate: string;
}

export function useAdPerformanceQuery({
  organizationId,
  startDate,
  endDate,
}: UseAdPerformanceQueryOptions): UseQueryResult<AdPerformanceResult, Error> {
  return useQuery<AdPerformanceResult, Error>({
    queryKey: adPerformanceKeys.list(organizationId, startDate, endDate),
    queryFn: async () => {
      const sb = supabase as any;

      // 1. Get DATE-FILTERED spend from meta_ad_metrics (daily data)
      // This is the CRITICAL FIX - using daily metrics instead of cumulative
      const { data: metricsData, error: metricsError } = await sb
        .from('meta_ad_metrics')
        .select('ad_creative_id, campaign_id, ad_id, spend, impressions, clicks, ctr, cpm, cpc')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (metricsError) {
        logger.error('Failed to load ad metrics', metricsError);
        throw new Error('Failed to load ad performance data');
      }

      // Aggregate daily metrics by creative_id
      const metricsMap = new Map<string, {
        spend: number;
        impressions: number;
        clicks: number;
        campaign_id: string;
        ad_id: string | null;
      }>();

      for (const row of metricsData || []) {
        const creativeId = row.ad_creative_id;
        if (!creativeId) continue;

        const existing = metricsMap.get(creativeId) || {
          spend: 0,
          impressions: 0,
          clicks: 0,
          campaign_id: row.campaign_id,
          ad_id: row.ad_id,
        };

        metricsMap.set(creativeId, {
          spend: existing.spend + Number(row.spend || 0),
          impressions: existing.impressions + Number(row.impressions || 0),
          clicks: existing.clicks + Number(row.clicks || 0),
          campaign_id: row.campaign_id,
          ad_id: row.ad_id,
        });
      }

      // 2. Get creative details from meta_creative_insights
      const { data: creativesData, error: creativesError } = await sb
        .from('meta_creative_insights')
        .select(`
          id,
          creative_id,
          campaign_id,
          ad_id,
          thumbnail_url,
          primary_text,
          headline,
          description,
          creative_type,
          performance_tier,
          topic,
          tone,
          sentiment_score,
          urgency_level,
          key_themes,
          extracted_refcode
        `)
        .eq('organization_id', organizationId);

      if (creativesError) {
        logger.error('Failed to load creative insights', creativesError);
        throw new Error('Failed to load creative data');
      }

      // 3. Get DATE-FILTERED donations with attribution
      const { data: donationsData, error: donationsError } = await sb
        .from('donation_attribution')
        .select(`
          attributed_creative_id,
          attributed_ad_id,
          attributed_campaign_id,
          refcode,
          attribution_method,
          amount,
          net_amount,
          donor_email
        `)
        .eq('organization_id', organizationId)
        .gte('transaction_date', startDate)
        .lte('transaction_date', `${endDate}T23:59:59`)
        .eq('transaction_type', 'donation');

      if (donationsError) {
        logger.error('Failed to load donation attribution', donationsError);
        throw new Error('Failed to load donation data');
      }

      // Aggregate donations by creative_id
      const donationsByCreative = new Map<string, {
        raised: number;
        count: number;
        donors: Set<string>;
        attribution_methods: Map<string, number>;
      }>();

      // Track all donor emails for global unique count
      const allDonorEmails: string[] = [];

      for (const donation of donationsData || []) {
        const creativeId = donation.attributed_creative_id;
        if (!creativeId) continue;

        const donorEmail = donation.donor_email || 'anonymous';
        allDonorEmails.push(donorEmail);

        const existing = donationsByCreative.get(creativeId) || {
          raised: 0,
          count: 0,
          donors: new Set<string>(),
          attribution_methods: new Map<string, number>(),
        };

        existing.raised += Number(donation.net_amount ?? donation.amount ?? 0);
        existing.count += 1;
        existing.donors.add(donorEmail);

        const method = donation.attribution_method || 'unknown';
        existing.attribution_methods.set(
          method,
          (existing.attribution_methods.get(method) || 0) + 1
        );

        donationsByCreative.set(creativeId, existing);
      }

      // 4. Build ad performance data by joining metrics, creatives, and donations
      const ads: AdPerformanceData[] = [];

      for (const creative of creativesData || []) {
        const creativeId = creative.creative_id || creative.id;
        const metrics = metricsMap.get(creativeId);
        const donations = donationsByCreative.get(creativeId);

        // Skip creatives with no metrics in the selected period
        if (!metrics) continue;

        const spend = metrics.spend;
        const raised = donations?.raised || 0;
        const donationCount = donations?.count || 0;
        const uniqueDonors = donations?.donors?.size || 0;

        const roas = spend > 0 ? raised / spend : 0;
        const profit = raised - spend;
        const roiPct = spend > 0 ? (profit / spend) * 100 : 0;
        const avgDonation = donationCount > 0 ? raised / donationCount : 0;
        const cpa = uniqueDonors > 0 ? spend / uniqueDonors : 0;
        const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        const cpm = metrics.impressions > 0 ? (spend / metrics.impressions) * 1000 : 0;
        const cpc = metrics.clicks > 0 ? spend / metrics.clicks : 0;

        ads.push({
          id: creative.id,
          ad_id: creative.ad_id || metrics.ad_id || '',
          creative_id: creativeId,
          campaign_id: creative.campaign_id || metrics.campaign_id,
          status: 'ACTIVE', // TODO: Get actual status from meta_ad_status if available
          spend,
          raised,
          roas,
          profit,
          roi_pct: roiPct,
          unique_donors: uniqueDonors,
          donation_count: donationCount,
          avg_donation: avgDonation,
          cpa,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          ctr,
          cpm,
          cpc,
          creative_thumbnail_url: creative.thumbnail_url,
          ad_copy_primary_text: creative.primary_text,
          ad_copy_headline: creative.headline,
          ad_copy_description: creative.description,
          creative_type: creative.creative_type,
          performance_tier: creative.performance_tier || getPerformanceTier(roas),
          topic: creative.topic,
          tone: creative.tone,
          sentiment_score: creative.sentiment_score,
          urgency_level: creative.urgency_level,
          key_themes: creative.key_themes,
          refcode: creative.extracted_refcode,
          attribution_method: null, // Per-donation, not per-ad
        });
      }

      // Sort by spend descending (highest spend first)
      ads.sort((a, b) => b.spend - a.spend);

      // 5. Calculate totals with FIXED unique donor counting
      const totals = buildTotals(ads, allDonorEmails);

      // 6. Build summary
      const topThree = [...ads]
        .sort((a, b) => b.roas - a.roas)
        .filter((ad) => ad.raised > 0)
        .slice(0, 3);

      // 7. Calculate attribution quality metrics
      let clickAttributed = 0;
      let refcodeAttributed = 0;
      let modeledAttributed = 0;

      for (const [, donations] of donationsByCreative) {
        for (const [method, count] of donations.attribution_methods) {
          if (method === 'click') clickAttributed += count;
          else if (method === 'refcode') refcodeAttributed += count;
          else if (method === 'modeled' || method === 'view') modeledAttributed += count;
        }
      }

      const totalAttributed = clickAttributed + refcodeAttributed + modeledAttributed;

      // CRITICAL FIX: attributionFallbackMode should only be true when:
      // 1. We have ads with spend, AND
      // 2. We have ZERO click-based or refcode-based attribution
      // NOT when there's simply no data
      const hasAdsWithSpend = ads.some((ad) => ad.spend > 0);
      const hasDirectAttribution = clickAttributed > 0 || refcodeAttributed > 0;
      const attributionFallbackMode = hasAdsWithSpend && !hasDirectAttribution && totalAttributed > 0;

      return {
        ads,
        totals,
        summary: {
          top_performer: topThree[0] || null,
          top_three: topThree,
          total_ads: ads.length,
          totals,
          has_data: ads.length > 0,
        },
        attribution_quality: {
          deterministic_rate:
            totalAttributed > 0
              ? ((clickAttributed + refcodeAttributed) / totalAttributed) * 100
              : 0,
          click_attributed: clickAttributed,
          refcode_attributed: refcodeAttributed,
          modeled_attributed: modeledAttributed,
          total_attributed: totalAttributed,
        },
        attributionFallbackMode,
      };
    },
    enabled: !!organizationId && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes cache
  });
}
