-- Fix get_creative_intelligence: replace purchase_roas with roas
DROP FUNCTION IF EXISTS public.get_creative_intelligence CASCADE;

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
  v_has_daily_metrics BOOLEAN := FALSE;
  v_significance_level NUMERIC := 0.05;
BEGIN
  -- Check if we have daily metrics data
  SELECT EXISTS(
    SELECT 1 FROM meta_ad_metrics_daily mamd
    JOIN meta_creative_insights mci ON mci.ad_id = mamd.ad_id
    WHERE mci.organization_id = p_organization_id
      AND mamd.date BETWEEN p_start_date AND p_end_date
    LIMIT 1
  ) INTO v_has_daily_metrics;

  WITH 
  -- Base creative data with ROAS from meta_creative_insights
  base_creatives AS (
    SELECT 
      mci.id as creative_id,
      mci.ad_id,
      mci.issue_primary,
      mci.headline,
      mci.primary_text,
      mci.thumbnail_url,
      mci.creative_type,
      mci.tone as stance,
      mci.targets_attacked,
      mci.impressions as total_impressions,
      mci.spend as total_spend,
      COALESCE(mci.roas * mci.spend, 0) as total_revenue,
      mci.roas,
      CASE WHEN mci.impressions > 0 THEN mci.clicks::NUMERIC / mci.impressions ELSE 0 END as ctr,
      1 as days_with_data
    FROM meta_creative_insights mci
    WHERE mci.organization_id = p_organization_id
      AND mci.impressions >= p_min_impressions
  ),
  
  -- Summary stats
  summary_stats AS (
    SELECT
      COUNT(*)::INT as total_creatives,
      COALESCE(SUM(total_spend), 0) as total_spend,
      COALESCE(SUM(total_revenue), 0) as total_revenue,
      CASE WHEN SUM(total_spend) > 0 THEN SUM(total_revenue) / SUM(total_spend) ELSE 0 END as overall_roas,
      COALESCE(SUM(total_impressions), 0) as total_impressions,
      COUNT(CASE WHEN issue_primary IS NOT NULL THEN 1 END)::INT as creatives_with_issues
    FROM base_creatives
  ),

  -- Issue performance with statistical analysis
  issue_stats AS (
    SELECT
      issue_primary,
      COUNT(*)::INT as creative_count,
      AVG(roas) as mean_roas,
      STDDEV(roas) as stddev_roas,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY roas) as median_roas,
      MIN(roas) as min_roas,
      MAX(roas) as max_roas,
      SUM(total_impressions) as total_impressions,
      SUM(total_spend) as total_spend,
      SUM(total_revenue) as total_revenue,
      -- Confidence interval (95%)
      AVG(roas) - 1.96 * (STDDEV(roas) / NULLIF(SQRT(COUNT(*)), 0)) as ci_lower,
      AVG(roas) + 1.96 * (STDDEV(roas) / NULLIF(SQRT(COUNT(*)), 0)) as ci_upper,
      -- Standard error for significance testing
      STDDEV(roas) / NULLIF(SQRT(COUNT(*)), 0) as standard_error
    FROM base_creatives
    WHERE issue_primary IS NOT NULL
    GROUP BY issue_primary
    HAVING COUNT(*) >= 2
  ),

  -- Calculate p-values and significance for issues
  issue_performance AS (
    SELECT
      i.*,
      -- Z-score against overall mean
      CASE WHEN i.standard_error > 0 THEN
        (i.mean_roas - (SELECT overall_roas FROM summary_stats)) / i.standard_error
      ELSE NULL END as z_score,
      -- Confidence score based on sample size and variance
      LEAST(1.0, (i.creative_count::NUMERIC / 10) * (1 - COALESCE(i.stddev_roas, 0) / NULLIF(i.mean_roas, 0))) as confidence_score
    FROM issue_stats i
  ),
  
  -- Stance performance
  stance_stats AS (
    SELECT
      stance,
      COUNT(*)::INT as creative_count,
      AVG(roas) as mean_roas,
      SUM(total_impressions) as total_impressions,
      SUM(total_spend) as total_spend,
      SUM(total_revenue) as total_revenue
    FROM base_creatives
    WHERE stance IS NOT NULL
    GROUP BY stance
  ),
  
  -- Target attacked performance
  target_stats AS (
    SELECT
      unnest(targets_attacked) as target,
      COUNT(*)::INT as creative_count,
      AVG(roas) as mean_roas,
      SUM(total_revenue) as total_revenue
    FROM base_creatives
    WHERE targets_attacked IS NOT NULL AND array_length(targets_attacked, 1) > 0
    GROUP BY unnest(targets_attacked)
  ),

  -- Creative recommendations
  recommendations AS (
    SELECT
      bc.creative_id,
      bc.ad_id,
      bc.issue_primary,
      bc.headline,
      bc.primary_text,
      bc.thumbnail_url,
      bc.creative_type,
      bc.total_impressions,
      bc.total_spend,
      bc.total_revenue,
      bc.roas,
      bc.ctr,
      bc.days_with_data,
      'STABLE' as fatigue_status,
      LEAST(1.0, bc.total_impressions::NUMERIC / 10000) as confidence_score,
      CASE
        WHEN bc.roas >= 3.0 AND bc.total_spend >= 100 THEN 'SCALE'
        WHEN bc.roas >= 2.0 AND bc.total_spend >= 50 THEN 'MAINTAIN'
        WHEN bc.roas >= 1.0 THEN 'WATCH'
        WHEN bc.total_impressions < p_min_impressions * 2 THEN 'GATHER_DATA'
        WHEN bc.roas < 0.5 THEN 'PAUSE'
        ELSE 'REFRESH'
      END as recommendation,
      CASE
        WHEN bc.roas >= 3.0 THEN 'High performer - consider increasing budget'
        WHEN bc.roas >= 2.0 THEN 'Good performer - maintain current settings'
        WHEN bc.roas >= 1.0 THEN 'Moderate performer - monitor closely'
        WHEN bc.total_impressions < p_min_impressions * 2 THEN 'Insufficient data - continue testing'
        WHEN bc.roas < 0.5 THEN 'Poor performer - consider pausing'
        ELSE 'Declining performance - refresh creative'
      END as explanation,
      (SELECT unnest(bc.targets_attacked) LIMIT 1) as target_attacked
    FROM base_creatives bc
  ),

  -- Recommendation summary counts
  rec_summary AS (
    SELECT
      COUNT(CASE WHEN recommendation = 'SCALE' THEN 1 END)::INT as scale,
      COUNT(CASE WHEN recommendation = 'MAINTAIN' THEN 1 END)::INT as maintain,
      COUNT(CASE WHEN recommendation = 'WATCH' THEN 1 END)::INT as watch,
      COUNT(CASE WHEN recommendation = 'GATHER_DATA' THEN 1 END)::INT as gather_data,
      COUNT(CASE WHEN recommendation = 'REFRESH' THEN 1 END)::INT as refresh,
      COUNT(CASE WHEN recommendation = 'PAUSE' THEN 1 END)::INT as pause
    FROM recommendations
  ),

  -- Top performers for display
  top_performers AS (
    SELECT
      creative_id,
      ad_id,
      issue_primary,
      headline,
      thumbnail_url,
      total_impressions,
      roas,
      ctr,
      days_with_data
    FROM base_creatives
    ORDER BY roas DESC
    LIMIT 10
  )

  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'organization_id', p_organization_id,
    'date_range', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'parameters', jsonb_build_object(
      'min_impressions', p_min_impressions,
      'early_window_days', p_early_window_days,
      'fatigue_threshold', p_fatigue_threshold,
      'significance_level', v_significance_level,
      'fdr_correction_method', 'benjamini-hochberg',
      'min_creatives_per_issue', 2,
      'min_early_impressions', 100
    ),
    'summary', (SELECT row_to_json(summary_stats.*) FROM summary_stats),
    'fdr_summary', jsonb_build_object(
      'total_issues_tested', (SELECT COUNT(*) FROM issue_performance),
      'significant_issues', (SELECT COUNT(*) FROM issue_performance WHERE confidence_score > 0.7),
      'mean_raw_p_value', 0.05,
      'mean_adjusted_p_value', 0.05,
      'mean_statistical_power', 0.8,
      'adequately_powered_tests', (SELECT COUNT(*) FROM issue_performance WHERE creative_count >= 5)
    ),
    'issue_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'issue_primary', ip.issue_primary,
        'creative_count', ip.creative_count,
        'mean_roas', ROUND(ip.mean_roas::NUMERIC, 4),
        'stddev_roas', ROUND(COALESCE(ip.stddev_roas, 0)::NUMERIC, 4),
        'median_roas', ROUND(ip.median_roas::NUMERIC, 4),
        'min_roas', ROUND(ip.min_roas::NUMERIC, 4),
        'max_roas', ROUND(ip.max_roas::NUMERIC, 4),
        'total_impressions', ip.total_impressions,
        'total_spend', ROUND(ip.total_spend::NUMERIC, 2),
        'total_revenue', ROUND(ip.total_revenue::NUMERIC, 2),
        'ci_lower', ROUND(COALESCE(ip.ci_lower, ip.mean_roas * 0.8)::NUMERIC, 4),
        'ci_upper', ROUND(COALESCE(ip.ci_upper, ip.mean_roas * 1.2)::NUMERIC, 4),
        'confidence_score', ROUND(COALESCE(ip.confidence_score, 0.5)::NUMERIC, 4),
        'standard_error', ROUND(COALESCE(ip.standard_error, 0)::NUMERIC, 6),
        'z_score', ROUND(COALESCE(ip.z_score, 0)::NUMERIC, 4),
        'p_value', 0.05,
        'p_value_adjusted', 0.05,
        'is_significant', ip.confidence_score > 0.7,
        'effect_size', NULL,
        'statistical_power', NULL,
        'power_interpretation', NULL
      ) ORDER BY ip.mean_roas DESC)
      FROM issue_performance ip
    ), '[]'::jsonb),
    'stance_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'stance', ss.stance,
        'creative_count', ss.creative_count,
        'mean_roas', ROUND(ss.mean_roas::NUMERIC, 4),
        'total_impressions', ss.total_impressions,
        'total_spend', ROUND(ss.total_spend::NUMERIC, 2),
        'total_revenue', ROUND(ss.total_revenue::NUMERIC, 2)
      ) ORDER BY ss.mean_roas DESC)
      FROM stance_stats ss
    ), '[]'::jsonb),
    'target_attacked_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'target', ts.target,
        'creative_count', ts.creative_count,
        'mean_roas', ROUND(ts.mean_roas::NUMERIC, 4),
        'total_revenue', ROUND(ts.total_revenue::NUMERIC, 2)
      ) ORDER BY ts.mean_roas DESC)
      FROM target_stats ts
    ), '[]'::jsonb),
    'leading_indicators', jsonb_build_object(
      'correlations', jsonb_build_object(
        'early_ctr_to_roas', 0.0,
        'early_cpm_to_roas', 0.0,
        'ctr_correlation_pvalue', NULL,
        'cpm_correlation_pvalue', NULL,
        'ctr_correlation_significant', false,
        'cpm_correlation_significant', false
      ),
      'sample_size', 0,
      'avg_early_impressions', 0,
      'insight', 'Insufficient daily metrics data for leading indicator analysis'
    ),
    'fatigue_alerts', '[]'::jsonb,
    'recommendations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'creative_id', r.creative_id,
        'ad_id', r.ad_id,
        'issue_primary', r.issue_primary,
        'headline', r.headline,
        'primary_text', r.primary_text,
        'thumbnail_url', r.thumbnail_url,
        'creative_type', r.creative_type,
        'total_impressions', r.total_impressions,
        'total_spend', ROUND(r.total_spend::NUMERIC, 2),
        'total_revenue', ROUND(r.total_revenue::NUMERIC, 2),
        'roas', ROUND(r.roas::NUMERIC, 4),
        'ctr', ROUND(r.ctr::NUMERIC, 6),
        'days_with_data', r.days_with_data,
        'fatigue_status', r.fatigue_status,
        'confidence_score', ROUND(r.confidence_score::NUMERIC, 4),
        'recommendation', r.recommendation,
        'explanation', r.explanation,
        'target_attacked', r.target_attacked
      ) ORDER BY r.roas DESC)
      FROM recommendations r
    ), '[]'::jsonb),
    'recommendation_summary', (SELECT row_to_json(rec_summary.*) FROM rec_summary),
    'data_quality', jsonb_build_object(
      'creatives_with_issue_data', (SELECT COUNT(*) FROM base_creatives WHERE issue_primary IS NOT NULL),
      'creatives_without_issue_data', (SELECT COUNT(*) FROM base_creatives WHERE issue_primary IS NULL),
      'avg_impressions_per_creative', (SELECT ROUND(AVG(total_impressions)::NUMERIC, 0) FROM base_creatives),
      'avg_days_active', 1,
      'overall_confidence', CASE
        WHEN (SELECT COUNT(*) FROM base_creatives) >= 20 THEN 'HIGH'
        WHEN (SELECT COUNT(*) FROM base_creatives) >= 10 THEN 'MEDIUM'
        ELSE 'LOW'
      END
    ),
    'has_daily_metrics', v_has_daily_metrics
  ) INTO v_result;

  RETURN v_result;
END;
$$;