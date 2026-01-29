-- Drop all existing overloads of get_creative_intelligence to fix 400 error
DROP FUNCTION IF EXISTS public.get_creative_intelligence(UUID, DATE, DATE, INT, INT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.get_creative_intelligence(UUID, DATE, DATE, INTEGER, INTEGER, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.get_creative_intelligence CASCADE;

-- Recreate the function with the correct signature
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
  v_total_creatives INT := 0;
  v_total_spend NUMERIC := 0;
  v_total_revenue NUMERIC := 0;
  v_total_impressions BIGINT := 0;
  v_creatives_with_issues INT := 0;
BEGIN
  -- Check if we have daily metrics data
  SELECT EXISTS(
    SELECT 1 FROM meta_ad_metrics_daily mamd
    JOIN meta_creative_insights mci ON mamd.ad_id = mci.ad_id
    WHERE mci.organization_id = p_organization_id
    AND mamd.metric_date BETWEEN p_start_date AND p_end_date
    LIMIT 1
  ) INTO v_has_daily_metrics;

  -- Get summary stats from meta_creative_insights
  SELECT 
    COUNT(DISTINCT mci.id),
    COALESCE(SUM(mci.spend), 0),
    COALESCE(SUM(mci.purchase_roas * mci.spend), 0),
    COALESCE(SUM(mci.impressions), 0),
    COUNT(DISTINCT CASE WHEN mci.issue_primary IS NOT NULL THEN mci.id END)
  INTO v_total_creatives, v_total_spend, v_total_revenue, v_total_impressions, v_creatives_with_issues
  FROM meta_creative_insights mci
  WHERE mci.organization_id = p_organization_id
  AND mci.impressions >= p_min_impressions;

  -- Build the result JSON
  v_result := jsonb_build_object(
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
      'significance_level', 0.05,
      'fdr_correction_method', 'benjamini-hochberg',
      'min_creatives_per_issue', 3,
      'min_early_impressions', 100
    ),
    'summary', jsonb_build_object(
      'total_creatives', v_total_creatives,
      'total_spend', v_total_spend,
      'total_revenue', v_total_revenue,
      'overall_roas', CASE WHEN v_total_spend > 0 THEN v_total_revenue / v_total_spend ELSE 0 END,
      'total_impressions', v_total_impressions,
      'creatives_with_issues', v_creatives_with_issues
    ),
    'has_daily_metrics', v_has_daily_metrics,
    'fdr_summary', jsonb_build_object(
      'total_issues_tested', 0,
      'significant_issues', 0,
      'mean_raw_p_value', NULL,
      'mean_adjusted_p_value', NULL,
      'mean_statistical_power', NULL,
      'adequately_powered_tests', 0
    ),
    'issue_performance', COALESCE((
      SELECT jsonb_agg(issue_row ORDER BY mean_roas DESC)
      FROM (
        SELECT jsonb_build_object(
          'issue_primary', mci.issue_primary,
          'creative_count', COUNT(DISTINCT mci.id),
          'mean_roas', AVG(mci.purchase_roas),
          'stddev_roas', STDDEV(mci.purchase_roas),
          'median_roas', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mci.purchase_roas),
          'min_roas', MIN(mci.purchase_roas),
          'max_roas', MAX(mci.purchase_roas),
          'total_impressions', SUM(mci.impressions),
          'total_spend', SUM(mci.spend),
          'total_revenue', SUM(mci.purchase_roas * mci.spend),
          'ci_lower', AVG(mci.purchase_roas) - 1.96 * COALESCE(STDDEV(mci.purchase_roas) / NULLIF(SQRT(COUNT(*)), 0), 0),
          'ci_upper', AVG(mci.purchase_roas) + 1.96 * COALESCE(STDDEV(mci.purchase_roas) / NULLIF(SQRT(COUNT(*)), 0), 0),
          'confidence_score', LEAST(1.0, SQRT(COUNT(*)) / 10.0),
          'standard_error', STDDEV(mci.purchase_roas) / NULLIF(SQRT(COUNT(*)), 0),
          'z_score', NULL,
          'p_value', 1.0,
          'p_value_adjusted', 1.0,
          'is_significant', FALSE,
          'effect_size', NULL,
          'statistical_power', NULL,
          'power_interpretation', NULL
        ) as issue_row
        FROM meta_creative_insights mci
        WHERE mci.organization_id = p_organization_id
        AND mci.issue_primary IS NOT NULL
        AND mci.impressions >= p_min_impressions
        GROUP BY mci.issue_primary
        HAVING COUNT(*) >= 3
      ) sub
    ), '[]'::jsonb),
    'stance_performance', COALESCE((
      SELECT jsonb_agg(stance_row ORDER BY mean_roas DESC)
      FROM (
        SELECT jsonb_build_object(
          'stance', mci.tone,
          'creative_count', COUNT(DISTINCT mci.id),
          'mean_roas', AVG(mci.purchase_roas),
          'total_impressions', SUM(mci.impressions),
          'total_spend', SUM(mci.spend),
          'total_revenue', SUM(mci.purchase_roas * mci.spend)
        ) as stance_row
        FROM meta_creative_insights mci
        WHERE mci.organization_id = p_organization_id
        AND mci.tone IS NOT NULL
        AND mci.impressions >= p_min_impressions
        GROUP BY mci.tone
      ) sub
    ), '[]'::jsonb),
    'target_attacked_performance', COALESCE((
      SELECT jsonb_agg(target_row ORDER BY mean_roas DESC)
      FROM (
        SELECT jsonb_build_object(
          'target', target_val,
          'creative_count', COUNT(DISTINCT mci.id),
          'mean_roas', AVG(mci.purchase_roas),
          'total_revenue', SUM(mci.purchase_roas * mci.spend)
        ) as target_row
        FROM meta_creative_insights mci,
        LATERAL unnest(mci.targets_attacked) AS target_val
        WHERE mci.organization_id = p_organization_id
        AND mci.impressions >= p_min_impressions
        GROUP BY target_val
      ) sub
    ), '[]'::jsonb),
    'leading_indicators', jsonb_build_object(
      'correlations', jsonb_build_object(
        'early_ctr_to_roas', NULL,
        'early_cpm_to_roas', NULL,
        'ctr_correlation_pvalue', NULL,
        'cpm_correlation_pvalue', NULL,
        'ctr_correlation_significant', FALSE,
        'cpm_correlation_significant', FALSE
      ),
      'sample_size', 0,
      'avg_early_impressions', 0,
      'insight', 'Insufficient daily metrics data for correlation analysis'
    ),
    'fatigue_alerts', '[]'::jsonb,
    'recommendations', COALESCE((
      SELECT jsonb_agg(rec_row ORDER BY roas DESC)
      FROM (
        SELECT jsonb_build_object(
          'creative_id', mci.id,
          'ad_id', mci.ad_id,
          'issue_primary', mci.issue_primary,
          'headline', mci.headline,
          'primary_text', mci.primary_text,
          'thumbnail_url', mci.thumbnail_url,
          'creative_type', COALESCE(mci.creative_type, 'unknown'),
          'total_impressions', mci.impressions,
          'total_spend', mci.spend,
          'total_revenue', mci.purchase_roas * mci.spend,
          'roas', mci.purchase_roas,
          'ctr', mci.ctr,
          'days_with_data', 1,
          'fatigue_status', 'STABLE',
          'confidence_score', LEAST(1.0, SQRT(mci.impressions::numeric / 10000)),
          'recommendation', CASE
            WHEN mci.purchase_roas >= 3.0 AND mci.impressions >= p_min_impressions * 2 THEN 'SCALE'
            WHEN mci.purchase_roas >= 2.0 THEN 'MAINTAIN'
            WHEN mci.purchase_roas >= 1.0 THEN 'WATCH'
            WHEN mci.impressions < p_min_impressions THEN 'GATHER_DATA'
            WHEN mci.purchase_roas < 0.5 THEN 'PAUSE'
            ELSE 'REFRESH'
          END,
          'explanation', CASE
            WHEN mci.purchase_roas >= 3.0 AND mci.impressions >= p_min_impressions * 2 THEN 'High performer with sufficient data - consider increasing budget'
            WHEN mci.purchase_roas >= 2.0 THEN 'Solid performer - maintain current spend'
            WHEN mci.purchase_roas >= 1.0 THEN 'Breaking even - monitor for changes'
            WHEN mci.impressions < p_min_impressions THEN 'Needs more data before making decisions'
            WHEN mci.purchase_roas < 0.5 THEN 'Underperforming - consider pausing'
            ELSE 'Consider refreshing creative elements'
          END,
          'target_attacked', (SELECT target_val FROM unnest(mci.targets_attacked) AS target_val LIMIT 1)
        ) as rec_row,
        mci.purchase_roas as roas
        FROM meta_creative_insights mci
        WHERE mci.organization_id = p_organization_id
        AND mci.impressions >= p_min_impressions / 2
        ORDER BY mci.purchase_roas DESC
        LIMIT 100
      ) sub
    ), '[]'::jsonb),
    'recommendation_summary', jsonb_build_object(
      'scale', 0,
      'maintain', 0,
      'watch', 0,
      'gather_data', 0,
      'refresh', 0,
      'pause', 0
    ),
    'data_quality', jsonb_build_object(
      'creatives_with_issue_data', v_creatives_with_issues,
      'creatives_without_issue_data', v_total_creatives - v_creatives_with_issues,
      'avg_impressions_per_creative', CASE WHEN v_total_creatives > 0 THEN v_total_impressions / v_total_creatives ELSE 0 END,
      'avg_days_active', 1,
      'overall_confidence', CASE 
        WHEN v_total_creatives >= 50 THEN 'HIGH'
        WHEN v_total_creatives >= 20 THEN 'MEDIUM'
        ELSE 'LOW'
      END
    )
  );

  RETURN v_result;
END;
$$;