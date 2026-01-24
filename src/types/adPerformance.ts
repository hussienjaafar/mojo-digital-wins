/**
 * Ad Performance Types
 *
 * Types for the granular Meta Ad + Message Performance feature.
 * Used for drilling down into individual ad performance with ActBlue attribution.
 */

export type AdPerformanceStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type AdPerformanceTier = 'TOP_PERFORMER' | 'STRONG' | 'AVERAGE' | 'NEEDS_IMPROVEMENT';

/**
 * Video transcription status
 */
export type VideoTranscriptionStatus =
  | 'PENDING'
  | 'URL_FETCHED'
  | 'URL_EXPIRED'
  | 'URL_INACCESSIBLE'
  | 'DOWNLOADED'
  | 'TRANSCRIBED'
  | 'TRANSCRIPT_FAILED'
  | 'ERROR'
  | 'NO_VIDEO';

/**
 * Video transcription data for an ad
 */
export interface AdVideoTranscription {
  video_id: string;
  status: VideoTranscriptionStatus;
  transcript_text: string | null;
  duration_seconds: number | null;
  language: string | null;
  speaker_count: number | null;
  words_per_minute: number | null;
  hook_text: string | null;
  topic_primary: string | null;
  topic_tags: string[] | null;
  tone_primary: string | null;
  tone_tags: string[] | null;
  sentiment_score: number | null;
  urgency_level: string | null;
  cta_text: string | null;
  cta_type: string | null;
  key_phrases: string[] | null;
  error_message: string | null;
  transcribed_at: string | null;
}

/**
 * Individual ad performance data combining Meta creative insights with ActBlue attribution
 */
export interface AdPerformanceData {
  id: string;
  ad_id: string;
  ad_name?: string; // Actual Meta ad name (e.g., "FR2025OCT_ADV_4to1")
  creative_id: string;
  campaign_id: string;
  campaign_name?: string; // Resolved campaign name for display
  adset_id?: string; // Ad Set ID for hierarchical navigation
  adset_name?: string; // Resolved ad set name for display
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
  link_clicks: number;
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

  // Video transcription (optional, populated when available)
  transcription?: AdVideoTranscription | null;
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
  total_link_clicks: number;
  avg_ctr: number; // Now uses Link CTR
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
  // Lookup maps for hierarchical navigation
  campaignNames: Record<string, string>;
  adsetNames: Record<string, string>;
  // Flag indicating whether fallback attribution was used due to no click data
  attributionFallbackMode: boolean;
  // Flag indicating spend/impressions are estimated (campaign distributed, not true ad-level)
  isEstimatedDistribution: boolean;
  // Flag indicating donations exist but couldn't be attributed to specific ads
  hasUnattributedDonations: boolean;
  // Count of donations in period that weren't matched to any ad
  unattributedDonationCount: number;
  // Total raised from unattributed donations
  unattributedRaised: number;
}
