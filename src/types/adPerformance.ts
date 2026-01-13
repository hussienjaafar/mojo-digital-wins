/**
 * Ad Performance Types
 *
 * Types for the granular Meta Ad + Message Performance feature.
 * Used for drilling down into individual ad performance with ActBlue attribution.
 */

export type AdPerformanceStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type AdPerformanceTier = 'TOP_PERFORMER' | 'STRONG' | 'AVERAGE' | 'NEEDS_IMPROVEMENT';

/**
 * Individual ad performance data combining Meta creative insights with ActBlue attribution
 */
export interface AdPerformanceData {
  id: string;
  ad_id: string;
  creative_id: string;
  campaign_id: string;
  status: AdPerformanceStatus | string;

  // Core metrics
  spend: number;
  raised: number;
  roas: number;
  profit: number;
  roi_pct: number;

  // Donor metrics
  unique_donors: number;
  donation_count: number;
  avg_donation: number;
  cpa: number;

  // Meta metrics
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;

  // Creative details
  creative_thumbnail_url: string | null;
  ad_copy_primary_text: string | null;
  ad_copy_headline: string | null;
  ad_copy_description: string | null;
  creative_type: string | null;

  // AI analysis
  performance_tier: AdPerformanceTier | null;
  topic: string | null;
  tone: string | null;
  sentiment_score: number | null;
  urgency_level: string | null;
  key_themes: string[] | null;

  // Attribution
  refcode: string | null;
  attribution_method: 'click' | 'view' | 'refcode' | 'modeled' | null;
}

/**
 * Aggregate totals for all ads in the selected period
 */
export interface AdPerformanceTotals {
  total_spend: number;
  total_raised: number;
  total_roas: number;
  total_profit: number;
  unique_donors: number;
  total_donations: number;
  avg_donation: number;
  avg_cpa: number;
  total_impressions: number;
  total_clicks: number;
  avg_ctr: number;
}

/**
 * Summary for dashboard card widget
 */
export interface AdPerformanceSummary {
  top_performer: AdPerformanceData | null;
  top_three: AdPerformanceData[];
  total_ads: number;
  totals: AdPerformanceTotals;
  has_data: boolean;
}

/**
 * Query result structure
 */
export interface AdPerformanceResult {
  ads: AdPerformanceData[];
  totals: AdPerformanceTotals;
  summary: AdPerformanceSummary;
  attribution_quality: {
    deterministic_rate: number;
    click_attributed: number;
    refcode_attributed: number;
    modeled_attributed: number;
    total_attributed: number;
  };
  // Flag indicating whether fallback attribution was used due to no click data
  attributionFallbackMode: boolean;
}
