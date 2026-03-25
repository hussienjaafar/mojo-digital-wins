-- Recreate the function with fixed array handling (using unnest instead of jsonb casting)
CREATE OR REPLACE FUNCTION public.get_creative_intelligence(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_min_impressions INT DEFAULT 1000,
  p_early_window_days INT DEFAULT 3,
  p_fatigue_threshold NUMERIC DEFAULT 0.20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_has_daily_metrics BOOLEAN;
  v_global_mean_roas NUMERIC;
  v_global_stddev_roas NUMERIC;
  v_significance_level NUMERIC := 0.05;
BEGIN
  -- Check if we have daily metrics data
  SELECT EXISTS(
    SELECT 1 FROM meta_ad_metrics_daily mamd
    JOIN meta_creative_insights mci ON mamd.ad_id = mci.ad_id
    WHERE mci.organization_id = p_organization_id
      AND mamd.date_start >= p_start_date
      AND mamd.date_start <= p_end_date
    LIMIT 1
  ) INTO v_has_daily_metrics;

  -- Calculate global ROAS statistics for z-score calculations
  SELECT 
    COALESCE(AVG(CASE WHEN spend > 0 THEN revenue / spend ELSE 0 END), 0),
    COALESCE(STDDEV(CASE WHEN spend > 0 THEN revenue / spend ELSE 0 END), 1)
  INTO v_global_mean_roas, v_global_stddev_roas
  FROM meta_creative_insights
  WHERE organization_id = p_organization_id;

  -- Ensure we don't divide by zero
  IF v_global_stddev_roas = 0 THEN
    v_global_stddev_roas := 1;
  END IF;

  WITH creative_performance AS (
    -- Base creative data with aggregated metrics
    SELECT 
      mci.id as creative_id,
      mci.ad_id,
      mci.issue_primary,
      mci.political_stances,
      mci.targets_attacked,
      mci.headline,
      mci.primary_text,
      mci.thumbnail_url,
      mci.creative_type,
      COALESCE(mci.impressions, 0) as total_impressions,
      COALESCE(mci.spend, 0) as total_spend,
      COALESCE(mci.revenue, 0) as total_revenue,
      CASE WHEN COALESCE(mci.spend, 0) > 0 
           THEN COALESCE(mci.revenue, 0) / mci.spend 
           ELSE 0 END as roas,
      CASE WHEN COALESCE(mci.impressions, 0) > 0 
           THEN COALESCE(mci.clicks, 0)::NUMERIC / mci.impressions 
           ELSE 0 END as ctr,
      -- Count days with data (approximate from daily metrics if available)
      COALESCE((
        SELECT COUNT(DISTINCT mamd.date_start)
        FROM meta_ad_metrics_daily mamd
        WHERE mamd.ad_id = mci.ad_id
          AND mamd.date_start >= p_start_date
          AND mamd.date_start <= p_end_date
      ), 1) as days_with_data
    FROM meta_creative_insights mci
    WHERE mci.organization_id = p_organization_id
      AND COALESCE(mci.impressions, 0) >= p_min_impressions
  ),
  
  -- Issue performance with statistical analysis
  issue_stats AS (
    SELECT 
      issue_primary,
      COUNT(*) as creative_count,
      AVG(roas) as mean_roas,
      STDDEV(roas) as stddev_roas,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY roas) as median_roas,
      MIN(roas) as min_roas,
      MAX(roas) as max_roas,
      SUM(total_impressions) as total_impressions,
      SUM(total_spend) as total_spend,
      SUM(total_revenue) as total_revenue
    FROM creative_performance
    WHERE issue_primary IS NOT NULL
    GROUP BY issue_primary
    HAVING COUNT(*) >= 2
  ),
  
  issue_performance AS (
    SELECT 
      issue_primary,
      creative_count,
      mean_roas,
      stddev_roas,
      median_roas,
      min_roas,
      max_roas,
      total_impressions,
      total_spend,
      total_revenue,
      -- Confidence interval (95%)
      mean_roas - (1.96 * COALESCE(stddev_roas, 0) / SQRT(creative_count)) as ci_lower,
      mean_roas + (1.96 * COALESCE(stddev_roas, 0) / SQRT(creative_count)) as ci_upper,
      -- Confidence score based on sample size and variance
      LEAST(1.0, (creative_count::NUMERIC / 10) * (1 - COALESCE(stddev_roas, 0) / NULLIF(mean_roas, 0))) as confidence_score,
      -- Standard error for significance testing
      COALESCE(stddev_roas, 0) / SQRT(creative_count) as standard_error,
      -- Z-score vs global mean
      CASE WHEN v_global_stddev_roas > 0 
           THEN (mean_roas - v_global_mean_roas) / v_global_stddev_roas 
           ELSE 0 END as z_score,
      -- Effect size (Cohen's d)
      CASE WHEN v_global_stddev_roas > 0 
           THEN (mean_roas - v_global_mean_roas) / v_global_stddev_roas 
           ELSE NULL END as effect_size
    FROM issue_stats
  ),
  
  -- Calculate p-values and apply FDR correction
  issue_with_pvalues AS (
    SELECT 
      ip.*,
      -- Two-tailed p-value approximation from z-score
      2 * (1 - LEAST(0.9999, GREATEST(0.0001, 
        0.5 * (1 + SIGN(z_score) * SQRT(1 - EXP(-2 * z_score * z_score / 3.14159)))
      ))) as p_value,
      ROW_NUMBER() OVER (ORDER BY ABS(z_score) DESC) as rank_by_zscore,
      COUNT(*) OVER () as total_issues
    FROM issue_performance ip
  ),
  
  issue_final AS (
    SELECT 
      issue_primary,
      creative_count,
      ROUND(mean_roas::NUMERIC, 3) as mean_roas,
      ROUND(COALESCE(stddev_roas, 0)::NUMERIC, 3) as stddev_roas,
      ROUND(median_roas::NUMERIC, 3) as median_roas,
      ROUND(min_roas::NUMERIC, 3) as min_roas,
      ROUND(max_roas::NUMERIC, 3) as max_roas,
      total_impressions,
      ROUND(total_spend::NUMERIC, 2) as total_spend,
      ROUND(total_revenue::NUMERIC, 2) as total_revenue,
      ROUND(ci_lower::NUMERIC, 3) as ci_lower,
      ROUND(ci_upper::NUMERIC, 3) as ci_upper,
      ROUND(COALESCE(confidence_score, 0)::NUMERIC, 3) as confidence_score,
      ROUND(standard_error::NUMERIC, 4) as standard_error,
      ROUND(z_score::NUMERIC, 3) as z_score,
      ROUND(p_value::NUMERIC, 4) as p_value,
      -- Benjamini-Hochberg adjusted p-value
      ROUND(LEAST(1.0, p_value * total_issues / rank_by_zscore)::NUMERIC, 4) as p_value_adjusted,
      -- Is significant after FDR correction?
      (LEAST(1.0, p_value * total_issues / rank_by_zscore) < v_significance_level) as is_significant,
      ROUND(effect_size::NUMERIC, 3) as effect_size,
      -- Statistical power approximation (simplified)
      CASE WHEN creative_count >= 30 AND ABS(COALESCE(effect_size, 0)) >= 0.5 THEN 0.8
           WHEN creative_count >= 20 AND ABS(COALESCE(effect_size, 0)) >= 0.5 THEN 0.6
           WHEN creative_count >= 10 THEN 0.4
           ELSE 0.2 END as statistical_power,
      CASE WHEN creative_count >= 30 AND ABS(COALESCE(effect_size, 0)) >= 0.5 THEN 'Adequate'
           WHEN creative_count >= 20 AND ABS(COALESCE(effect_size, 0)) >= 0.5 THEN 'Moderate'
           WHEN creative_count >= 10 THEN 'Low'
           ELSE 'Insufficient' END as power_interpretation
    FROM issue_with_pvalues
  ),
  
  -- Stance performance (using unnest for TEXT[] arrays)
  stance_performance AS (
    SELECT 
      s.stance,
      COUNT(*) as creative_count,
      ROUND(AVG(cp.roas)::NUMERIC, 3) as mean_roas,
      SUM(cp.total_impressions) as total_impressions,
      ROUND(SUM(cp.total_spend)::NUMERIC, 2) as total_spend,
      ROUND(SUM(cp.total_revenue)::NUMERIC, 2) as total_revenue
    FROM creative_performance cp
    CROSS JOIN LATERAL unnest(cp.political_stances) AS s(stance)
    WHERE cp.political_stances IS NOT NULL 
      AND array_length(cp.political_stances, 1) > 0
    GROUP BY s.stance
    HAVING COUNT(*) >= 2
  ),
  
  -- Target attacked performance (using unnest for TEXT[] arrays)
  target_performance AS (
    SELECT 
      t.target,
      COUNT(*) as creative_count,
      ROUND(AVG(cp.roas)::NUMERIC, 3) as mean_roas,
      ROUND(SUM(cp.total_revenue)::NUMERIC, 2) as total_revenue
    FROM creative_performance cp
    CROSS JOIN LATERAL unnest(cp.targets_attacked) AS t(target)
    WHERE cp.targets_attacked IS NOT NULL 
      AND array_length(cp.targets_attacked, 1) > 0
    GROUP BY t.target
    HAVING COUNT(*) >= 2
  ),
  
  -- Leading indicators (early CTR/CPM correlation with ROAS) - only if daily metrics exist
  leading_indicators AS (
    SELECT 
      CASE WHEN v_has_daily_metrics THEN
        COALESCE((
          SELECT CORR(early_ctr, final_roas)
          FROM (
            SELECT 
              mci.id,
              (SELECT AVG(CASE WHEN mamd.impressions > 0 THEN mamd.clicks::NUMERIC / mamd.impressions ELSE 0 END)
               FROM meta_ad_metrics_daily mamd
               WHERE mamd.ad_id = mci.ad_id
                 AND mamd.date_start >= p_start_date
                 AND mamd.date_start < p_start_date + p_early_window_days
              ) as early_ctr,
              CASE WHEN mci.spend > 0 THEN mci.revenue / mci.spend ELSE 0 END as final_roas
            FROM meta_creative_insights mci
            WHERE mci.organization_id = p_organization_id
              AND mci.impressions >= p_min_impressions
          ) sub
          WHERE early_ctr IS NOT NULL
        ), 0)
      ELSE 0 END as early_ctr_to_roas,
      CASE WHEN v_has_daily_metrics THEN
        COALESCE((
          SELECT CORR(early_cpm, final_roas)
          FROM (
            SELECT 
              mci.id,
              (SELECT AVG(CASE WHEN mamd.impressions > 0 THEN mamd.spend / (mamd.impressions / 1000.0) ELSE 0 END)
               FROM meta_ad_metrics_daily mamd
               WHERE mamd.ad_id = mci.ad_id
                 AND mamd.date_start >= p_start_date
                 AND mamd.date_start < p_start_date + p_early_window_days
              ) as early_cpm,
              CASE WHEN mci.spend > 0 THEN mci.revenue / mci.spend ELSE 0 END as final_roas
            FROM meta_creative_insights mci
            WHERE mci.organization_id = p_organization_id
              AND mci.impressions >= p_min_impressions
          ) sub
          WHERE early_cpm IS NOT NULL
        ), 0)
      ELSE 0 END as early_cpm_to_roas,
      (SELECT COUNT(*) FROM creative_performance) as sample_size,
      COALESCE((
        SELECT AVG(total_impressions) FROM creative_performance
      ), 0) as avg_early_impressions
  ),
  
  -- Fatigue detection - only meaningful with daily metrics
  fatigue_alerts AS (
    SELECT 
      cp.creative_id,
      cp.issue_primary,
      cp.headline,
      cp.thumbnail_url,
      cp.days_with_data,
      cp.total_impressions,
      cp.roas,
      cp.ctr as peak_ctr,
      cp.ctr as recent_ctr,
      0::NUMERIC as decline_from_peak,
      NULL::NUMERIC as trend_slope,
      'STABLE'::TEXT as fatigue_status,
      'Monitoring performance'::TEXT as recommendation
    FROM creative_performance cp
    WHERE v_has_daily_metrics = false
    LIMIT 0  -- Return empty if no daily metrics
  ),
  
  -- Creative recommendations
  recommendations AS (
    SELECT 
      cp.creative_id,
      cp.ad_id,
      cp.issue_primary,
      cp.headline,
      cp.primary_text,
      cp.thumbnail_url,
      cp.creative_type,
      cp.total_impressions,
      cp.total_spend,
      cp.total_revenue,
      ROUND(cp.roas::NUMERIC, 3) as roas,
      ROUND(cp.ctr::NUMERIC, 5) as ctr,
      cp.days_with_data,
      'STABLE' as fatigue_status,
      -- Confidence based on impressions and days
      LEAST(1.0, (cp.total_impressions::NUMERIC / 10000) * (cp.days_with_data::NUMERIC / 7)) as confidence_score,
      -- Recommendation logic
      CASE 
        WHEN cp.roas >= v_global_mean_roas * 1.5 AND cp.total_impressions >= p_min_impressions * 2 THEN 'SCALE'
        WHEN cp.roas >= v_global_mean_roas AND cp.total_impressions >= p_min_impressions THEN 'MAINTAIN'
        WHEN cp.roas >= v_global_mean_roas * 0.7 THEN 'WATCH'
        WHEN cp.total_impressions < p_min_impressions THEN 'GATHER_DATA'
        WHEN cp.roas < v_global_mean_roas * 0.5 THEN 'PAUSE'
        ELSE 'REFRESH'
      END as recommendation,
      CASE 
        WHEN cp.roas >= v_global_mean_roas * 1.5 THEN 'High performer - increase budget allocation'
        WHEN cp.roas >= v_global_mean_roas THEN 'Solid performer - maintain current spend'
        WHEN cp.roas >= v_global_mean_roas * 0.7 THEN 'Underperforming slightly - monitor closely'
        WHEN cp.total_impressions < p_min_impressions THEN 'Insufficient data - allow more time'
        WHEN cp.roas < v_global_mean_roas * 0.5 THEN 'Poor performer - consider pausing'
        ELSE 'Consider creative refresh'
      END as explanation,
      (SELECT t FROM unnest(cp.targets_attacked) AS t LIMIT 1) as target_attacked
    FROM creative_performance cp
  ),
  
  -- Donor segmentation from ActBlue data
  donor_segmentation AS (
    SELECT
      COUNT(*) FILTER (WHERE amount < 100) as small_donor_count,
      COALESCE(SUM(amount) FILTER (WHERE amount < 100), 0) as small_donor_amount,
      COUNT(*) FILTER (WHERE amount >= 100) as large_donor_count,
      COALESCE(SUM(amount) FILTER (WHERE amount >= 100), 0) as large_donor_amount,
      COALESCE(AVG(amount), 0) as average_donation,
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount), 0) as median_donation,
      COUNT(*) as total_donors,
      COALESCE(SUM(amount), 0) as total_donations
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND transaction_date >= p_start_date
      AND transaction_date <= p_end_date
  ),
  
  -- Summary statistics
  summary AS (
    SELECT 
      COUNT(*) as total_creatives,
      ROUND(SUM(total_spend)::NUMERIC, 2) as total_spend,
      ROUND(SUM(total_revenue)::NUMERIC, 2) as total_revenue,
      ROUND(CASE WHEN SUM(total_spend) > 0 THEN SUM(total_revenue) / SUM(total_spend) ELSE 0 END::NUMERIC, 3) as overall_roas,
      SUM(total_impressions) as total_impressions,
      COUNT(*) FILTER (WHERE issue_primary IS NOT NULL) as creatives_with_issues
    FROM creative_performance
  ),
  
  -- FDR summary
  fdr_summary AS (
    SELECT
      COUNT(*) as total_issues_tested,
      COUNT(*) FILTER (WHERE is_significant) as significant_issues,
      ROUND(AVG(p_value)::NUMERIC, 4) as mean_raw_p_value,
      ROUND(AVG(p_value_adjusted)::NUMERIC, 4) as mean_adjusted_p_value,
      ROUND(AVG(statistical_power)::NUMERIC, 2) as mean_statistical_power,
      COUNT(*) FILTER (WHERE statistical_power >= 0.8) as adequately_powered_tests
    FROM issue_final
  ),
  
  -- Recommendation summary
  recommendation_summary AS (
    SELECT
      COUNT(*) FILTER (WHERE recommendation = 'SCALE') as scale,
      COUNT(*) FILTER (WHERE recommendation = 'MAINTAIN') as maintain,
      COUNT(*) FILTER (WHERE recommendation = 'WATCH') as watch,
      COUNT(*) FILTER (WHERE recommendation = 'GATHER_DATA') as gather_data,
      COUNT(*) FILTER (WHERE recommendation = 'REFRESH') as refresh,
      COUNT(*) FILTER (WHERE recommendation = 'PAUSE') as pause
    FROM recommendations
  ),
  
  -- Data quality metrics
  data_quality AS (
    SELECT
      COUNT(*) FILTER (WHERE issue_primary IS NOT NULL) as creatives_with_issue_data,
      COUNT(*) FILTER (WHERE issue_primary IS NULL) as creatives_without_issue_data,
      ROUND(AVG(total_impressions)::NUMERIC, 0) as avg_impressions_per_creative,
      ROUND(AVG(days_with_data)::NUMERIC, 1) as avg_days_active,
      CASE 
        WHEN COUNT(*) >= 50 AND AVG(days_with_data) >= 7 THEN 'HIGH'
        WHEN COUNT(*) >= 20 AND AVG(days_with_data) >= 3 THEN 'MEDIUM'
        ELSE 'LOW'
      END as overall_confidence
    FROM creative_performance
  )
  
  -- Build final JSON response
  SELECT jsonb_build_object(
    'generated_at', NOW()::TEXT,
    'organization_id', p_organization_id::TEXT,
    'date_range', jsonb_build_object(
      'start_date', p_start_date::TEXT,
      'end_date', p_end_date::TEXT
    ),
    'parameters', jsonb_build_object(
      'min_impressions', p_min_impressions,
      'early_window_days', p_early_window_days,
      'fatigue_threshold', p_fatigue_threshold,
      'significance_level', v_significance_level,
      'fdr_correction_method', 'benjamini-hochberg',
      'min_creatives_per_issue', 2,
      'min_early_impressions', p_min_impressions
    ),
    'summary', (SELECT row_to_json(summary.*)::jsonb FROM summary),
    'donor_segmentation', (
      SELECT jsonb_build_object(
        'small_donors', jsonb_build_object(
          'count', small_donor_count,
          'total_amount', ROUND(small_donor_amount::NUMERIC, 2),
          'percentage_of_total', CASE WHEN total_donations > 0 THEN ROUND((small_donor_amount / total_donations * 100)::NUMERIC, 1) ELSE 0 END
        ),
        'large_donors', jsonb_build_object(
          'count', large_donor_count,
          'total_amount', ROUND(large_donor_amount::NUMERIC, 2),
          'percentage_of_total', CASE WHEN total_donations > 0 THEN ROUND((large_donor_amount / total_donations * 100)::NUMERIC, 1) ELSE 0 END
        ),
        'average_donation', ROUND(average_donation::NUMERIC, 2),
        'median_donation', ROUND(median_donation::NUMERIC, 2),
        'total_donors', total_donors,
        'total_donations', ROUND(total_donations::NUMERIC, 2)
      )
      FROM donor_segmentation
    ),
    'fdr_summary', (SELECT row_to_json(fdr_summary.*)::jsonb FROM fdr_summary),
    'issue_performance', COALESCE((SELECT jsonb_agg(row_to_json(issue_final.*)::jsonb ORDER BY mean_roas DESC) FROM issue_final), '[]'::jsonb),
    'stance_performance', COALESCE((SELECT jsonb_agg(row_to_json(stance_performance.*)::jsonb ORDER BY mean_roas DESC) FROM stance_performance), '[]'::jsonb),
    'target_attacked_performance', COALESCE((SELECT jsonb_agg(row_to_json(target_performance.*)::jsonb ORDER BY mean_roas DESC) FROM target_performance), '[]'::jsonb),
    'leading_indicators', (
      SELECT jsonb_build_object(
        'correlations', jsonb_build_object(
          'early_ctr_to_roas', ROUND(early_ctr_to_roas::NUMERIC, 3),
          'early_cpm_to_roas', ROUND(early_cpm_to_roas::NUMERIC, 3),
          'ctr_correlation_pvalue', NULL,
          'cpm_correlation_pvalue', NULL,
          'ctr_correlation_significant', ABS(early_ctr_to_roas) > 0.3,
          'cpm_correlation_significant', ABS(early_cpm_to_roas) > 0.3
        ),
        'sample_size', sample_size,
        'avg_early_impressions', ROUND(avg_early_impressions::NUMERIC, 0),
        'insight', CASE 
          WHEN ABS(early_ctr_to_roas) > 0.5 THEN 'Strong early CTR signal for ROAS prediction'
          WHEN ABS(early_ctr_to_roas) > 0.3 THEN 'Moderate early CTR correlation with final ROAS'
          ELSE 'Early metrics have limited predictive value - rely on longer observation'
        END
      )
      FROM leading_indicators
    ),
    'fatigue_alerts', COALESCE((SELECT jsonb_agg(row_to_json(fatigue_alerts.*)::jsonb) FROM fatigue_alerts), '[]'::jsonb),
    'recommendations', COALESCE((SELECT jsonb_agg(row_to_json(recommendations.*)::jsonb ORDER BY roas DESC) FROM recommendations), '[]'::jsonb),
    'recommendation_summary', (SELECT row_to_json(recommendation_summary.*)::jsonb FROM recommendation_summary),
    'data_quality', (SELECT row_to_json(data_quality.*)::jsonb FROM data_quality),
    'has_daily_metrics', v_has_daily_metrics
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_creative_intelligence TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_creative_intelligence TO service_role;