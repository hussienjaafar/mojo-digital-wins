import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// =============================================================================
// TYPES
// =============================================================================

export interface IssuePerformance {
  issue_primary: string;
  creative_count: number;
  mean_roas: number;
  stddev_roas: number | null;
  median_roas: number;
  min_roas: number;
  max_roas: number;
  total_impressions: number;
  total_spend: number;
  total_revenue: number;
  ci_lower: number;
  ci_upper: number;
  confidence_score: number;
  // FDR correction fields (from Benjamini-Hochberg)
  standard_error: number | null;
  z_score: number | null;
  p_value: number;
  p_value_adjusted: number;
  is_significant: boolean;
  // Effect size and statistical power
  effect_size: number | null;
  statistical_power: number | null;
  power_interpretation: string | null;
}

export interface StancePerformance {
  stance: string;
  creative_count: number;
  mean_roas: number;
  total_impressions: number;
  total_spend: number;
  total_revenue: number;
}

export interface TargetPerformance {
  target: string;
  creative_count: number;
  mean_roas: number;
  total_revenue: number;
}

export interface PainPointPerformance {
  pain_point: string;
  creative_count: number;
  mean_roas: number;
  stddev_roas: number;
  total_revenue: number;
}

export interface ValuesPerformance {
  value: string;
  creative_count: number;
  mean_roas: number;
  stddev_roas: number;
  total_revenue: number;
}

export interface IssueTagsPerformance {
  tag: string;
  creative_count: number;
  mean_roas: number;
  stddev_roas: number;
  total_revenue: number;
}

export interface PolicyPerformance {
  policy: string;
  creative_count: number;
  mean_roas: number;
  stddev_roas: number;
  total_revenue: number;
}

export interface LeadingIndicators {
  correlations: {
    early_ctr_to_roas: number;
    early_cpm_to_roas: number;
    // Correlation significance testing
    ctr_correlation_pvalue: number | null;
    cpm_correlation_pvalue: number | null;
    ctr_correlation_significant: boolean;
    cpm_correlation_significant: boolean;
  };
  sample_size: number;
  avg_early_impressions: number;
  insight: string;
}

export interface FatigueAlert {
  creative_id: string;
  issue_primary: string | null;
  headline: string | null;
  thumbnail_url: string | null;
  days_with_data: number;
  total_impressions: number;
  roas: number;
  peak_ctr: number;
  recent_ctr: number;
  decline_from_peak: number;
  trend_slope: number | null;
  fatigue_status: 'FATIGUED' | 'DECLINING' | 'IMPROVING' | 'STABLE';
  recommendation: string;
}

export interface CreativeRecommendation {
  creative_id: string;
  ad_id: string;
  issue_primary: string | null;
  headline: string | null;
  primary_text: string | null;
  thumbnail_url: string | null;
  creative_type: string;
  total_impressions: number;
  total_spend: number;
  total_revenue: number;
  roas: number;
  ctr: number;
  days_with_data: number;
  fatigue_status: string;
  confidence_score: number;
  recommendation: 'SCALE' | 'MAINTAIN' | 'WATCH' | 'GATHER_DATA' | 'REFRESH' | 'PAUSE';
  explanation: string;
  target_attacked: string | null;
}

export interface DonorSegmentation {
  small_donors: {
    count: number;
    total_amount: number;
    percentage_of_total: number;
  };
  large_donors: {
    count: number;
    total_amount: number;
    percentage_of_total: number;
  };
  average_donation: number;
  median_donation: number;
  total_donors: number;
  total_donations: number;
}

export interface CreativeIntelligenceData {
  generated_at: string;
  organization_id: string;
  date_range: {
    start_date: string;
    end_date: string;
  };
  parameters: {
    min_impressions: number;
    early_window_days: number;
    fatigue_threshold: number;
    significance_level: number;
    fdr_correction_method: string;
    min_creatives_per_issue: number;
    min_early_impressions: number;
  };
  summary: {
    total_creatives: number;
    total_spend: number;
    total_revenue: number;
    overall_roas: number;
    total_impressions: number;
    creatives_with_issues: number;
  };
  donor_segmentation?: DonorSegmentation;
  fdr_summary: {
    total_issues_tested: number;
    significant_issues: number;
    mean_raw_p_value: number;
    mean_adjusted_p_value: number;
    mean_statistical_power: number | null;
    adequately_powered_tests: number;
  };
  issue_performance: IssuePerformance[];
  stance_performance: StancePerformance[];
  target_attacked_performance: TargetPerformance[];
  pain_point_performance: PainPointPerformance[];
  values_performance: ValuesPerformance[];
  issue_tags_performance: IssueTagsPerformance[];
  policy_performance: PolicyPerformance[];
  leading_indicators: LeadingIndicators;
  fatigue_alerts: FatigueAlert[];
  recommendations: CreativeRecommendation[];
  recommendation_summary: {
    scale: number;
    maintain: number;
    watch: number;
    gather_data: number;
    refresh: number;
    pause: number;
  };
  data_quality: {
    creatives_with_issue_data: number;
    creatives_without_issue_data: number;
    avg_impressions_per_creative: number;
    avg_days_active: number;
    overall_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  has_daily_metrics: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

interface UseCreativeIntelligenceOptions {
  organizationId: string;
  startDate: string;
  endDate: string;
  minImpressions?: number;
  earlyWindowDays?: number;
  fatigueThreshold?: number;
  enabled?: boolean;
}

export function useCreativeIntelligence({
  organizationId,
  startDate,
  endDate,
  minImpressions = 1000,
  earlyWindowDays = 3,
  fatigueThreshold = 0.20,
  enabled = true,
}: UseCreativeIntelligenceOptions) {
  return useQuery({
    queryKey: [
      'creative-intelligence',
      organizationId,
      startDate,
      endDate,
      minImpressions,
      earlyWindowDays,
      fatigueThreshold,
    ],
    queryFn: async (): Promise<CreativeIntelligenceData> => {
      const { data, error } = await (supabase.rpc as any)('get_creative_intelligence', {
        p_organization_id: organizationId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_min_impressions: minImpressions,
        p_early_window_days: earlyWindowDays,
        p_fatigue_threshold: fatigueThreshold,
      });

      if (error) {
        console.error('[useCreativeIntelligence] RPC error:', error);
        throw new Error(error.message);
      }

      // Debug: log raw RPC response to diagnose data flow issues
      console.log('[useCreativeIntelligence] Raw RPC response type:', typeof data);
      console.log('[useCreativeIntelligence] Raw RPC response:', data);

      // Handle case where Supabase returns JSON as a string instead of parsed object
      if (typeof data === 'string') {
        console.warn('[useCreativeIntelligence] RPC returned string, parsing as JSON');
        return JSON.parse(data) as CreativeIntelligenceData;
      }

      return data as unknown as CreativeIntelligenceData;
    },
    enabled: enabled && !!organizationId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });
}

// =============================================================================
// DERIVED HOOKS (convenience wrappers)
// =============================================================================

/**
 * Get just the issue performance rankings
 */
export function useIssuePerformance(options: UseCreativeIntelligenceOptions) {
  const query = useCreativeIntelligence(options);
  return {
    ...query,
    data: query.data?.issue_performance ?? [],
  };
}

/**
 * Get just the recommendations
 */
export function useCreativeRecommendations(options: UseCreativeIntelligenceOptions) {
  const query = useCreativeIntelligence(options);
  return {
    ...query,
    data: query.data?.recommendations ?? [],
  };
}

/**
 * Get just the fatigue alerts
 */
export function useFatigueAlerts(options: UseCreativeIntelligenceOptions) {
  const query = useCreativeIntelligence(options);
  return {
    ...query,
    data: query.data?.fatigue_alerts ?? [],
  };
}

/**
 * Get creatives that should be scaled (high performers)
 */
export function useScalableCreatives(options: UseCreativeIntelligenceOptions) {
  const query = useCreativeIntelligence(options);
  return {
    ...query,
    data: query.data?.recommendations.filter(r => r.recommendation === 'SCALE') ?? [],
  };
}

/**
 * Get creatives that need attention (pause or refresh)
 */
export function useCreativesNeedingAttention(options: UseCreativeIntelligenceOptions) {
  const query = useCreativeIntelligence(options);
  return {
    ...query,
    data: query.data?.recommendations.filter(
      r => r.recommendation === 'PAUSE' || r.recommendation === 'REFRESH'
    ) ?? [],
  };
}

/**
 * Get donor segmentation data (political campaign feature)
 */
export function useDonorSegmentation(options: UseCreativeIntelligenceOptions) {
  const query = useCreativeIntelligence(options);
  return {
    ...query,
    data: query.data?.donor_segmentation ?? null,
  };
}
