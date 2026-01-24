/**
 * useAdHierarchy Hook
 * 
 * Aggregates ad performance data into campaign and ad set levels
 * for hierarchical navigation like Meta Ads Manager
 */

import { useMemo } from 'react';
import type { AdPerformanceData } from '@/types/adPerformance';
import type { CampaignMetrics, AdSetMetrics, AdHierarchyResult } from '@/types/adHierarchy';

interface UseAdHierarchyOptions {
  ads: AdPerformanceData[];
  campaignNames?: Map<string, string>;
  adsetNames?: Map<string, string>;
}

/**
 * Get campaign name from lookup or generate fallback
 */
function getCampaignName(campaignId: string, campaignNames?: Map<string, string>): string {
  return campaignNames?.get(campaignId) || `Campaign ${campaignId.slice(-8)}`;
}

/**
 * Get adset name from lookup or generate fallback
 */
function getAdsetName(adsetId: string, adsetNames?: Map<string, string>): string {
  return adsetNames?.get(adsetId) || `Ad Set ${adsetId.slice(-8)}`;
}

export function useAdHierarchy({ ads, campaignNames = new Map(), adsetNames = new Map() }: UseAdHierarchyOptions): AdHierarchyResult {
  // Aggregate by campaign
  const campaigns = useMemo(() => {
    const campaignMap = new Map<string, {
      campaign_id: string;
      campaign_name: string;
      status: string;
      ads: AdPerformanceData[];
      adsets: Set<string>;
      donors: Set<string>;
    }>();

    for (const ad of ads) {
      if (!ad.campaign_id) continue;

      const existing = campaignMap.get(ad.campaign_id) || {
        campaign_id: ad.campaign_id,
        campaign_name: getCampaignName(ad.campaign_id, campaignNames),
        status: ad.status,
        ads: [],
        adsets: new Set<string>(),
        donors: new Set<string>(),
      };

      existing.ads.push(ad);
      if (ad.adset_id) existing.adsets.add(ad.adset_id);
      
      // Track donors for unique count
      // Note: We don't have per-ad donor emails here, so we use unique_donors count
      campaignMap.set(ad.campaign_id, existing);
    }

    // Convert to CampaignMetrics
    const result: CampaignMetrics[] = [];
    for (const [campaignId, data] of campaignMap) {
      const totalSpend = data.ads.reduce((sum, ad) => sum + ad.spend, 0);
      const totalRaised = data.ads.reduce((sum, ad) => sum + ad.raised, 0);
      const totalImpressions = data.ads.reduce((sum, ad) => sum + ad.impressions, 0);
      const totalClicks = data.ads.reduce((sum, ad) => sum + ad.clicks, 0);
      const totalLinkClicks = data.ads.reduce((sum, ad) => sum + (ad.link_clicks || 0), 0);
      const uniqueDonors = data.ads.reduce((sum, ad) => sum + ad.unique_donors, 0);
      const donationCount = data.ads.reduce((sum, ad) => sum + ad.donation_count, 0);

      result.push({
        campaign_id: campaignId,
        campaign_name: data.campaign_name,
        status: data.status,
        total_spend: totalSpend,
        total_raised: totalRaised,
        total_roas: totalSpend > 0 ? totalRaised / totalSpend : 0,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_link_clicks: totalLinkClicks,
        unique_donors: uniqueDonors,
        donation_count: donationCount,
        avg_cpa: uniqueDonors > 0 ? totalSpend / uniqueDonors : 0,
        avg_ctr: totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0,
        adset_count: data.adsets.size,
        ad_count: data.ads.length,
      });
    }

    // Sort by spend descending
    return result.sort((a, b) => b.total_spend - a.total_spend);
  }, [ads, campaignNames]);

  // Aggregate by adset
  const adsets = useMemo(() => {
    const adsetMap = new Map<string, {
      adset_id: string;
      adset_name: string;
      campaign_id: string;
      campaign_name: string;
      ads: AdPerformanceData[];
    }>();

    for (const ad of ads) {
      const adsetId = ad.adset_id || 'unknown';
      if (!adsetId) continue;

      const existing = adsetMap.get(adsetId) || {
        adset_id: adsetId,
        adset_name: getAdsetName(adsetId, adsetNames),
        campaign_id: ad.campaign_id,
        campaign_name: getCampaignName(ad.campaign_id, campaignNames),
        ads: [],
      };

      existing.ads.push(ad);
      adsetMap.set(adsetId, existing);
    }

    // Convert to AdSetMetrics
    const result: AdSetMetrics[] = [];
    for (const [adsetId, data] of adsetMap) {
      const totalSpend = data.ads.reduce((sum, ad) => sum + ad.spend, 0);
      const totalRaised = data.ads.reduce((sum, ad) => sum + ad.raised, 0);
      const totalImpressions = data.ads.reduce((sum, ad) => sum + ad.impressions, 0);
      const totalClicks = data.ads.reduce((sum, ad) => sum + ad.clicks, 0);
      const totalLinkClicks = data.ads.reduce((sum, ad) => sum + (ad.link_clicks || 0), 0);
      const uniqueDonors = data.ads.reduce((sum, ad) => sum + ad.unique_donors, 0);
      const donationCount = data.ads.reduce((sum, ad) => sum + ad.donation_count, 0);

      result.push({
        adset_id: adsetId,
        adset_name: data.adset_name,
        campaign_id: data.campaign_id,
        campaign_name: data.campaign_name,
        total_spend: totalSpend,
        total_raised: totalRaised,
        total_roas: totalSpend > 0 ? totalRaised / totalSpend : 0,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_link_clicks: totalLinkClicks,
        unique_donors: uniqueDonors,
        donation_count: donationCount,
        avg_cpa: uniqueDonors > 0 ? totalSpend / uniqueDonors : 0,
        avg_ctr: totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0,
        ad_count: data.ads.length,
      });
    }

    // Sort by spend descending
    return result.sort((a, b) => b.total_spend - a.total_spend);
  }, [ads, campaignNames]);

  return {
    campaigns,
    adsets,
    ads,
  };
}
