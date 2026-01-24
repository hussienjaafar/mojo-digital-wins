/**
 * Ad Performance Query Hook
 *
 * Fetches granular Meta ad performance data with ActBlue attribution.
 *
 * UPDATED: Now uses meta_ad_metrics_daily for TRUE ad-level ROAS.
 * Falls back to campaign-level distribution if no ad-level data exists.
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
 * Build totals from ads - Uses Set for unique donors
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

  // Use unique donors from the actual set
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

      // DEV-ONLY: Log received dates and the values used in Supabase filters
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AdPerformance:Hook] Query parameters received:', {
          organizationId,
          startDate,
          endDate,
          queryKey: adPerformanceKeys.list(organizationId, startDate, endDate),
        });
      }

      // ========== STEP 1: Try ad-level daily metrics (preferred) ==========
      // This gives TRUE ad-level ROAS from meta_ad_metrics_daily
      const { data: adLevelData, error: adLevelError } = await sb
        .from('meta_ad_metrics_daily')
        .select(`
          date,
          ad_id,
          ad_name,
          campaign_id,
          adset_id,
          creative_id,
          spend,
          impressions,
          clicks,
          reach,
          ctr,
          cpm,
          cpc,
          frequency,
          conversions,
          conversion_value,
          meta_roas,
          quality_ranking,
          engagement_ranking,
          conversion_ranking
        `)
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate);

      const hasAdLevelData = !adLevelError && adLevelData && adLevelData.length > 0;

      logger.debug('[AdPerformance] Ad-level data check', {
        hasAdLevelData,
        rowCount: adLevelData?.length || 0,
        error: adLevelError?.message,
      });

      // DEV-ONLY: Detailed ad-level query diagnostics
      if (process.env.NODE_ENV !== 'production') {
        // Calculate spend distribution to detect estimation artifacts
        const spendValues = (adLevelData || []).map((r: any) => Number(r.spend || 0)).filter((s: number) => s > 0);
        const uniqueSpendValues = new Set(spendValues.map((s: number) => s.toFixed(2)));
        const hasVariedSpend = uniqueSpendValues.size > 1;

        console.log('[AdPerformance:Hook] Ad-level query result:', {
          table: 'meta_ad_metrics_daily',
          filters: { organization_id: organizationId, 'date >=': startDate, 'date <=': endDate },
          hasData: hasAdLevelData,
          rowCount: adLevelData?.length || 0,
          distinctAds: new Set((adLevelData || []).map((r: any) => r.ad_id)).size,
          dateRange: adLevelData?.length ? {
            min: Math.min(...(adLevelData || []).map((r: any) => new Date(r.date).getTime())),
            max: Math.max(...(adLevelData || []).map((r: any) => new Date(r.date).getTime())),
          } : null,
          spendDiagnostic: {
            hasVariedSpend,
            uniqueSpendValueCount: uniqueSpendValues.size,
            sampleSpends: spendValues.slice(0, 5),
          },
          error: adLevelError?.message || null,
          sampleRows: (adLevelData || []).slice(0, 3).map((r: any) => ({
            date: r.date,
            ad_id: r.ad_id,
            spend: r.spend,
            impressions: r.impressions,
            clicks: r.clicks,
          })),
        });
      }

      // Aggregate ad-level metrics by ad_id
      const adMetricsMap = new Map<string, {
        ad_id: string;
        ad_name: string | null;
        campaign_id: string;
        creative_id: string | null;
        spend: number;
        impressions: number;
        clicks: number;
        reach: number;
        meta_roas: number | null;
        quality_ranking: string | null;
      }>();

      if (hasAdLevelData) {
        for (const row of adLevelData) {
          const adId = row.ad_id;
          if (!adId) continue;

          const existing = adMetricsMap.get(adId) || {
            ad_id: adId,
            ad_name: row.ad_name,
            campaign_id: row.campaign_id,
            creative_id: row.creative_id,
            spend: 0,
            impressions: 0,
            clicks: 0,
            reach: 0,
            meta_roas: null,
            quality_ranking: row.quality_ranking,
          };

          adMetricsMap.set(adId, {
            ...existing,
            spend: existing.spend + Number(row.spend || 0),
            impressions: existing.impressions + Number(row.impressions || 0),
            clicks: existing.clicks + Number(row.clicks || 0),
            reach: existing.reach + Number(row.reach || 0),
            // Use the most recent meta_roas value
            meta_roas: row.meta_roas ?? existing.meta_roas,
          });
        }
      }

      // ========== STEP 2: Get creative details for enrichment ==========
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

      // Build creative lookup by ad_id, creative_id, and refcode
      const creativeByAdId = new Map<string, any>();
      const creativeByCreativeId = new Map<string, any>();
      const creativeByRefcode = new Map<string, any>();
      const refcodeToAdId = new Map<string, string>();

      for (const creative of creativesData || []) {
        if (creative.ad_id) {
          creativeByAdId.set(creative.ad_id, creative);
          // Also map refcode -> ad_id for direct refcode matching
          if (creative.extracted_refcode) {
            refcodeToAdId.set(creative.extracted_refcode.toLowerCase(), creative.ad_id);
            creativeByRefcode.set(creative.extracted_refcode.toLowerCase(), creative);
          }
        }
        if (creative.creative_id) {
          creativeByCreativeId.set(creative.creative_id, creative);
        }
      }

      // DEV-ONLY: Log refcode mapping stats
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AdPerformance:Hook] Creative refcode mappings:', {
          totalCreatives: (creativesData || []).length,
          creativesWithAdId: creativeByAdId.size,
          creativesWithRefcode: creativeByRefcode.size,
          refcodeToAdIdMappings: refcodeToAdId.size,
          sampleRefcodes: [...refcodeToAdId.keys()].slice(0, 5),
        });
      }

      // ========== STEP 3: Get donations with attribution (TIMEZONE-AWARE) ==========
      // Use the timezone-aware RPC to match ActBlue's Eastern time boundaries
      const orgTimezone = 'America/New_York'; // Default to ET for political orgs
      
      const { data: donationsData, error: donationsError } = await sb.rpc(
        'get_ad_performance_donations_tz',
        {
          p_organization_id: organizationId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_timezone: orgTimezone
        }
      );

      if (donationsError) {
        logger.error('Failed to load donation attribution', donationsError);
        throw new Error('Failed to load donation data');
      }

      // DEV-ONLY: Log timezone-aware query results
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AdPerformance:Hook] Timezone-aware donation query:', {
          rpc: 'get_ad_performance_donations_tz',
          params: { p_organization_id: organizationId, p_start_date: startDate, p_end_date: endDate, p_timezone: orgTimezone },
          resultCount: (donationsData || []).length,
          totalRaised: (donationsData || []).reduce((sum: number, d: any) => sum + Number(d.net_amount || 0), 0),
        });
      }

      // Aggregate donations by ad_id (primary), creative_id (secondary), or refcode (fallback)
      const donationsByAdId = new Map<string, {
        raised: number;
        count: number;
        donors: Set<string>;
        attribution_methods: Map<string, number>;
      }>();

      const donationsByCreativeId = new Map<string, {
        raised: number;
        count: number;
        donors: Set<string>;
        attribution_methods: Map<string, number>;
      }>();

      // Track by refcode for direct matching when ad_id/creative_id missing
      const donationsByRefcode = new Map<string, {
        raised: number;
        count: number;
        donors: Set<string>;
        attribution_methods: Map<string, number>;
      }>();

      const allDonorEmails: string[] = [];
      let directAdIdMatches = 0;
      let creativeIdMatches = 0;
      let refcodeMatches = 0;
      let unattributedCount = 0;

      for (const donation of donationsData || []) {
        const donorEmail = donation.donor_email || 'anonymous';
        allDonorEmails.push(donorEmail);
        const amount = Number(donation.net_amount ?? donation.amount ?? 0);
        const method = donation.attribution_method || 'unknown';
        let wasAttributed = false;

        // Try ad_id first (best: direct attribution)
        if (donation.attributed_ad_id) {
          const adId = donation.attributed_ad_id;
          const existing = donationsByAdId.get(adId) || {
            raised: 0,
            count: 0,
            donors: new Set<string>(),
            attribution_methods: new Map<string, number>(),
          };
          existing.raised += amount;
          existing.count += 1;
          existing.donors.add(donorEmail);
          existing.attribution_methods.set(method, (existing.attribution_methods.get(method) || 0) + 1);
          donationsByAdId.set(adId, existing);
          directAdIdMatches++;
          wasAttributed = true;
        }

        // Also track by creative_id for fallback
        if (donation.attributed_creative_id) {
          const creativeId = donation.attributed_creative_id;
          const existing = donationsByCreativeId.get(creativeId) || {
            raised: 0,
            count: 0,
            donors: new Set<string>(),
            attribution_methods: new Map<string, number>(),
          };
          existing.raised += amount;
          existing.count += 1;
          existing.donors.add(donorEmail);
          existing.attribution_methods.set(method, (existing.attribution_methods.get(method) || 0) + 1);
          donationsByCreativeId.set(creativeId, existing);
          if (!wasAttributed) creativeIdMatches++;
          wasAttributed = true;
        }

        // NEW: Try refcode-based matching when ad_id/creative_id are missing
        // This allows direct matching even if refcode_mappings wasn't updated
        if (!wasAttributed && donation.refcode) {
          const refcodeLower = donation.refcode.toLowerCase();

          // Check if we have a direct refcode -> ad_id mapping from creatives
          const mappedAdId = refcodeToAdId.get(refcodeLower);
          if (mappedAdId) {
            const existing = donationsByAdId.get(mappedAdId) || {
              raised: 0,
              count: 0,
              donors: new Set<string>(),
              attribution_methods: new Map<string, number>(),
            };
            existing.raised += amount;
            existing.count += 1;
            existing.donors.add(donorEmail);
            existing.attribution_methods.set('refcode_direct', (existing.attribution_methods.get('refcode_direct') || 0) + 1);
            donationsByAdId.set(mappedAdId, existing);
            refcodeMatches++;
            wasAttributed = true;
          } else {
            // Track by refcode for later analysis
            const existing = donationsByRefcode.get(refcodeLower) || {
              raised: 0,
              count: 0,
              donors: new Set<string>(),
              attribution_methods: new Map<string, number>(),
            };
            existing.raised += amount;
            existing.count += 1;
            existing.donors.add(donorEmail);
            existing.attribution_methods.set(method, (existing.attribution_methods.get(method) || 0) + 1);
            donationsByRefcode.set(refcodeLower, existing);
          }
        }

        if (!wasAttributed) unattributedCount++;
      }

      // DEV-ONLY: Log attribution stats
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AdPerformance:Hook] Donation attribution stats:', {
          totalDonations: (donationsData || []).length,
          directAdIdMatches,
          creativeIdMatches,
          refcodeMatches,
          unattributedCount,
          uniqueRefcodesInDonations: donationsByRefcode.size,
          unmatchedRefcodes: [...donationsByRefcode.keys()].slice(0, 10),
        });
      }

      // ========== STEP 4: Build ad performance data ==========
      const ads: AdPerformanceData[] = [];

      if (hasAdLevelData && adMetricsMap.size > 0) {
        // PRIMARY PATH: Use ad-level metrics (TRUE ROAS)
        logger.debug('[AdPerformance] Using ad-level metrics path', { adCount: adMetricsMap.size });

        for (const [adId, metrics] of adMetricsMap) {
          // Look up donations by ad_id first, then by creative_id
          let donations = donationsByAdId.get(adId);
          if (!donations && metrics.creative_id) {
            donations = donationsByCreativeId.get(metrics.creative_id);
          }

          // Get creative details
          let creative = creativeByAdId.get(adId);
          if (!creative && metrics.creative_id) {
            creative = creativeByCreativeId.get(metrics.creative_id);
          }

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
            id: creative?.id || adId,
            ad_id: adId,
            creative_id: metrics.creative_id || creative?.creative_id || '',
            campaign_id: metrics.campaign_id,
            status: 'ACTIVE',
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
            creative_thumbnail_url: creative?.thumbnail_url || null,
            ad_copy_primary_text: creative?.primary_text || null,
            ad_copy_headline: creative?.headline || metrics.ad_name || null,
            ad_copy_description: creative?.description || null,
            creative_type: creative?.creative_type || 'unknown',
            performance_tier: creative?.performance_tier || getPerformanceTier(roas),
            topic: creative?.topic || null,
            tone: creative?.tone || null,
            sentiment_score: creative?.sentiment_score || null,
            urgency_level: creative?.urgency_level || null,
            key_themes: creative?.key_themes || null,
            refcode: creative?.extracted_refcode || null,
            attribution_method: null,
          });
        }
      } else {
        // FALLBACK PATH: Use campaign-level distribution (legacy approach)
        logger.debug('[AdPerformance] Falling back to campaign-level metrics');

        // Fetch from old meta_ad_metrics table
        const { data: metricsData, error: metricsError } = await sb
          .from('meta_ad_metrics')
          .select('campaign_id, ad_id, spend, impressions, clicks, date')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate);

        // DEV-ONLY: Fallback query diagnostics
        if (process.env.NODE_ENV !== 'production') {
          console.log('[AdPerformance:Hook] Fallback query result:', {
            table: 'meta_ad_metrics',
            filters: { organization_id: organizationId, 'date >=': startDate, 'date <=': endDate },
            rowCount: metricsData?.length || 0,
            error: metricsError?.message || null,
            sampleDates: metricsData?.slice(0, 5).map((r: any) => r.date) || [],
            sampleCampaigns: [...new Set(metricsData?.map((r: any) => r.campaign_id) || [])].slice(0, 3),
          });
        }

        if (metricsError) {
          logger.error('Failed to load campaign metrics', metricsError);
          throw new Error('Failed to load ad performance data');
        }

        // Aggregate by campaign_id
        const metricsByCampaign = new Map<string, {
          spend: number;
          impressions: number;
          clicks: number;
        }>();

        for (const row of metricsData || []) {
          const campaignId = row.campaign_id;
          if (!campaignId) continue;

          const existing = metricsByCampaign.get(campaignId) || {
            spend: 0,
            impressions: 0,
            clicks: 0,
          };

          metricsByCampaign.set(campaignId, {
            spend: existing.spend + Number(row.spend || 0),
            impressions: existing.impressions + Number(row.impressions || 0),
            clicks: existing.clicks + Number(row.clicks || 0),
          });
        }

        // Build ads from creatives with campaign-level distribution
        for (const creative of creativesData || []) {
          const creativeId = creative.creative_id || creative.id;
          const campaignId = creative.campaign_id;
          const metrics = campaignId ? metricsByCampaign.get(campaignId) : null;
          const donations = donationsByCreativeId.get(creativeId);

          if (!metrics) continue;

          // Count creatives per campaign for distribution
          const creativesInCampaign = (creativesData || []).filter(
            (c: any) => c.campaign_id === campaignId
          ).length;

          const spendShare = creativesInCampaign > 0 ? metrics.spend / creativesInCampaign : metrics.spend;
          const impressionsShare = creativesInCampaign > 0 ? metrics.impressions / creativesInCampaign : metrics.impressions;
          const clicksShare = creativesInCampaign > 0 ? metrics.clicks / creativesInCampaign : metrics.clicks;

          const spend = spendShare;
          const raised = donations?.raised || 0;
          const donationCount = donations?.count || 0;
          const uniqueDonors = donations?.donors?.size || 0;

          const roas = spend > 0 ? raised / spend : 0;
          const profit = raised - spend;
          const roiPct = spend > 0 ? (profit / spend) * 100 : 0;
          const avgDonation = donationCount > 0 ? raised / donationCount : 0;
          const cpa = uniqueDonors > 0 ? spend / uniqueDonors : 0;
          const ctr = impressionsShare > 0 ? (clicksShare / impressionsShare) * 100 : 0;
          const cpm = impressionsShare > 0 ? (spend / impressionsShare) * 1000 : 0;
          const cpc = clicksShare > 0 ? spend / clicksShare : 0;

          ads.push({
            id: creative.id,
            ad_id: creative.ad_id || '',
            creative_id: creativeId,
            campaign_id: creative.campaign_id,
            status: 'ACTIVE',
            spend,
            raised,
            roas,
            profit,
            roi_pct: roiPct,
            unique_donors: uniqueDonors,
            donation_count: donationCount,
            avg_donation: avgDonation,
            cpa,
            impressions: impressionsShare,
            clicks: clicksShare,
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
            attribution_method: null,
          });
        }
      }

      // Sort by spend descending
      ads.sort((a, b) => b.spend - a.spend);

      // ========== STEP 5: Detect estimation artifacts ==========
      // Check if we're using estimated distribution (campaign-level fallback)
      const isEstimatedDistribution = !hasAdLevelData && ads.length > 0;

      // Detect identical spend values (artifact of even distribution)
      const spendValues = ads.map((ad) => ad.spend).filter((s) => s > 0);
      const uniqueSpendValues = new Set(spendValues.map((s) => s.toFixed(2)));
      const hasIdenticalSpend = spendValues.length > 1 && uniqueSpendValues.size === 1;

      // DEV-ONLY: Log distribution artifact detection
      if (process.env.NODE_ENV !== 'production' && hasIdenticalSpend) {
        console.warn('[AdPerformance:Hook] DISTRIBUTION ARTIFACT DETECTED:', {
          adsWithSpend: spendValues.length,
          uniqueSpendValues: uniqueSpendValues.size,
          sampleSpend: spendValues[0],
          isEstimatedDistribution,
          hint: 'All ads have identical spend - this indicates campaign-level distribution, not true ad-level metrics',
        });
      }

      // Calculate attributed vs unattributed donations
      const totalDonationsInPeriod = (donationsData || []).length;
      const attributedToAdCount = [...donationsByAdId.values()].reduce((sum, d) => sum + d.count, 0);
      const attributedToCreativeCount = [...donationsByCreativeId.values()].reduce((sum, d) => sum + d.count, 0);
      const totalAttributedCount = Math.max(attributedToAdCount, attributedToCreativeCount);
      const unattributedDonationCount = totalDonationsInPeriod - totalAttributedCount;

      // Calculate unattributed raised
      const totalRaisedInPeriod = (donationsData || []).reduce(
        (sum, d) => sum + Number(d.net_amount ?? d.amount ?? 0),
        0
      );
      const attributedRaised = ads.reduce((sum, ad) => sum + ad.raised, 0);
      const unattributedRaised = Math.max(0, totalRaisedInPeriod - attributedRaised);
      const hasUnattributedDonations = unattributedDonationCount > 0 || unattributedRaised > 0;

      // DEV-ONLY: Log attribution coverage
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AdPerformance:Hook] Attribution coverage:', {
          totalDonationsInPeriod,
          attributedToAdCount,
          attributedToCreativeCount,
          unattributedDonationCount,
          totalRaisedInPeriod: totalRaisedInPeriod.toFixed(2),
          attributedRaised: attributedRaised.toFixed(2),
          unattributedRaised: unattributedRaised.toFixed(2),
          hasUnattributedDonations,
        });
      }

      // ========== STEP 6: Calculate totals and summary ==========
      const totals = buildTotals(ads, allDonorEmails);

      const topThree = [...ads]
        .sort((a, b) => b.roas - a.roas)
        .filter((ad) => ad.raised > 0)
        .slice(0, 3);

      // Calculate attribution quality metrics
      let clickAttributed = 0;
      let refcodeAttributed = 0;
      let modeledAttributed = 0;

      const allDonationMaps = [...donationsByAdId.values(), ...donationsByCreativeId.values()];
      const seenMethods = new Set<string>();

      for (const donations of allDonationMaps) {
        for (const [method, count] of donations.attribution_methods) {
          const key = `${method}-${count}`;
          if (seenMethods.has(key)) continue;
          seenMethods.add(key);

          if (method === 'click') clickAttributed += count;
          else if (method === 'refcode') refcodeAttributed += count;
          else if (method === 'modeled' || method === 'view') modeledAttributed += count;
        }
      }

      const totalAttributed = clickAttributed + refcodeAttributed + modeledAttributed;
      const hasAdsWithSpend = ads.some((ad) => ad.spend > 0);
      const hasDirectAttribution = clickAttributed > 0 || refcodeAttributed > 0;
      const attributionFallbackMode = hasAdsWithSpend && !hasDirectAttribution && totalAttributed > 0;

      logger.debug('[AdPerformance] Query complete', {
        dataSource: hasAdLevelData ? 'ad-level' : 'campaign-level',
        adsReturned: ads.length,
        totalSpend: totals.total_spend,
        totalRaised: totals.total_raised,
      });

      // DEV-ONLY: Final summary diagnostics
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AdPerformance:Hook] Final result summary:', {
          dataSource: hasAdLevelData ? 'ad-level (meta_ad_metrics_daily)' : 'campaign-level (meta_ad_metrics)',
          totalAdsReturned: ads.length,
          totalCreativesFound: creativesData?.length || 0,
          totalDonationsFound: (donationsData || []).length,
          totals: {
            spend: totals.total_spend,
            raised: totals.total_raised,
            roas: totals.total_roas,
          },
          debugHint: ads.length === 0
            ? 'NO DATA: Check if (1) meta_ad_metrics_daily has rows for org+dateRange, (2) meta_ad_metrics has campaign rows, (3) meta_creative_insights has creatives that match campaign_ids'
            : null,
        });
      }

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
        isEstimatedDistribution,
        hasUnattributedDonations,
        unattributedDonationCount,
        unattributedRaised,
      };
    },
    enabled: !!organizationId && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes cache
  });
}
