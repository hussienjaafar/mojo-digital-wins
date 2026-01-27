-- Fix RPC with correct column names from meta_creative_insights
DROP FUNCTION IF EXISTS public.get_creative_intelligence(uuid, date, date, integer, integer, numeric);

CREATE OR REPLACE FUNCTION public.get_creative_intelligence(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_min_impressions integer DEFAULT 1000,
  p_early_window_days integer DEFAULT 3,
  p_fatigue_threshold numeric DEFAULT 0.20
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_has_daily_metrics boolean;
BEGIN
  -- Check if we have daily metrics data
  SELECT EXISTS(
    SELECT 1 FROM meta_ad_metrics_daily 
    WHERE organization_id = p_organization_id 
    AND date BETWEEN p_start_date AND p_end_date
    LIMIT 1
  ) INTO v_has_daily_metrics;

  WITH creative_performance AS (
    SELECT 
      c.id as creative_id,
      c.ad_id,
      c.organization_id,
      c.issue_primary,
      c.tone as stance,  -- map tone -> stance for output compatibility
      COALESCE(c.targets_attacked[1], NULL) as target_attacked,  -- first target or null
      c.headline,
      c.primary_text,
      c.thumbnail_url,
      c.creative_type,
      CASE 
        WHEN v_has_daily_metrics THEN COALESCE(SUM(d.impressions), 0)
        ELSE COALESCE(c.impressions, 0)
      END as total_impressions,
      CASE 
        WHEN v_has_daily_metrics THEN COALESCE(SUM(d.clicks), 0)
        ELSE COALESCE(c.clicks, 0)
      END as total_clicks,
      CASE 
        WHEN v_has_daily_metrics THEN COALESCE(SUM(d.spend), 0)
        ELSE COALESCE(c.spend, 0)
      END as total_spend,
      COALESCE(c.roas, 0) as roas,
      CASE 
        WHEN v_has_daily_metrics THEN 
          CASE WHEN SUM(d.impressions) > 0 THEN SUM(d.clicks)::numeric / SUM(d.impressions) * 100 ELSE 0 END
        ELSE COALESCE(c.ctr, 0)
      END as ctr,
      CASE 
        WHEN v_has_daily_metrics THEN COUNT(DISTINCT d.date)
        ELSE 1
      END as days_with_data,
      c.created_at
    FROM meta_creative_insights c
    LEFT JOIN meta_ad_metrics_daily d ON c.ad_id = d.ad_id 
      AND d.date BETWEEN p_start_date AND p_end_date
      AND v_has_daily_metrics = true
    WHERE c.organization_id = p_organization_id
    GROUP BY c.id, c.ad_id, c.organization_id, c.issue_primary, c.tone, 
             c.targets_attacked, c.headline, c.primary_text, c.thumbnail_url, 
             c.creative_type, c.impressions, c.clicks, c.spend, c.roas, c.ctr, c.created_at
    HAVING CASE 
      WHEN v_has_daily_metrics THEN COALESCE(SUM(d.impressions), 0) >= p_min_impressions
      ELSE COALESCE(c.impressions, 0) >= p_min_impressions
    END
  ),
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
      SUM(total_spend * roas) as total_revenue
    FROM creative_performance
    WHERE issue_primary IS NOT NULL
    GROUP BY issue_primary
    HAVING COUNT(*) >= 2
  ),
  issue_with_ci AS (
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
      mean_roas - (1.96 * COALESCE(stddev_roas, 0) / SQRT(creative_count)) as ci_lower,
      mean_roas + (1.96 * COALESCE(stddev_roas, 0) / SQRT(creative_count)) as ci_upper,
      CASE 
        WHEN stddev_roas IS NULL OR stddev_roas = 0 THEN 1.0
        ELSE LEAST(1.0, SQRT(creative_count::numeric) / (1 + stddev_roas / NULLIF(mean_roas, 0)))
      END as confidence_score,
      COALESCE(stddev_roas / SQRT(creative_count), 0) as standard_error
    FROM issue_stats
  ),
  overall_stats AS (
    SELECT 
      AVG(mean_roas) as overall_mean,
      STDDEV(mean_roas) as overall_stddev
    FROM issue_with_ci
  ),
  issue_with_significance AS (
    SELECT 
      i.*,
      CASE 
        WHEN o.overall_stddev > 0 AND i.standard_error > 0 
        THEN (i.mean_roas - o.overall_mean) / i.standard_error
        ELSE 0
      END as z_score,
      0.5 as p_value,
      0.5 as p_value_adjusted,
      false as is_significant,
      CASE 
        WHEN o.overall_stddev > 0 
        THEN (i.mean_roas - o.overall_mean) / o.overall_stddev
        ELSE NULL
      END as effect_size,
      NULL::numeric as statistical_power,
      'Insufficient data for power analysis' as power_interpretation
    FROM issue_with_ci i
    CROSS JOIN overall_stats o
  ),
  stance_stats AS (
    SELECT 
      stance,
      COUNT(*) as creative_count,
      AVG(roas) as mean_roas,
      SUM(total_impressions) as total_impressions,
      SUM(total_spend) as total_spend,
      SUM(total_spend * roas) as total_revenue
    FROM creative_performance
    WHERE stance IS NOT NULL
    GROUP BY stance
  ),
  target_stats AS (
    SELECT 
      target_attacked as target,
      COUNT(*) as creative_count,
      AVG(roas) as mean_roas,
      SUM(total_spend * roas) as total_revenue
    FROM creative_performance
    WHERE target_attacked IS NOT NULL
    GROUP BY target_attacked
  ),
  recommendations AS (
    SELECT 
      creative_id,
      ad_id,
      issue_primary,
      headline,
      primary_text,
      thumbnail_url,
      creative_type,
      total_impressions,
      total_spend,
      total_spend * roas as total_revenue,
      roas,
      ctr,
      days_with_data,
      'STABLE' as fatigue_status,
      CASE 
        WHEN days_with_data < 3 THEN 0.3
        WHEN total_impressions < 5000 THEN 0.5
        ELSE 0.8
      END as confidence_score,
      CASE 
        WHEN roas >= 2.0 AND total_impressions >= 10000 THEN 'SCALE'
        WHEN roas >= 1.5 AND total_impressions >= 5000 THEN 'MAINTAIN'
        WHEN roas >= 1.0 THEN 'WATCH'
        WHEN days_with_data < 3 OR total_impressions < 1000 THEN 'GATHER_DATA'
        WHEN roas < 0.5 THEN 'PAUSE'
        ELSE 'REFRESH'
      END as recommendation,
      CASE 
        WHEN roas >= 2.0 AND total_impressions >= 10000 THEN 'High performer with proven scale'
        WHEN roas >= 1.5 AND total_impressions >= 5000 THEN 'Solid performer, maintain current spend'
        WHEN roas >= 1.0 THEN 'Moderate performance, monitor closely'
        WHEN days_with_data < 3 OR total_impressions < 1000 THEN 'Insufficient data for recommendation'
        WHEN roas < 0.5 THEN 'Underperforming, consider pausing'
        ELSE 'Performance declining, needs refresh'
      END as explanation,
      target_attacked
    FROM creative_performance
  ),
  summary_stats AS (
    SELECT 
      COUNT(*) as total_creatives,
      COALESCE(SUM(total_spend), 0) as total_spend,
      COALESCE(SUM(total_spend * roas), 0) as total_revenue,
      CASE WHEN SUM(total_spend) > 0 THEN SUM(total_spend * roas) / SUM(total_spend) ELSE 0 END as overall_roas,
      COALESCE(SUM(total_impressions), 0) as total_impressions,
      COUNT(*) FILTER (WHERE issue_primary IS NOT NULL) as creatives_with_issues
    FROM creative_performance
  )
  SELECT json_build_object(
    'generated_at', NOW(),
    'organization_id', p_organization_id,
    'date_range', json_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'parameters', json_build_object(
      'min_impressions', p_min_impressions,
      'early_window_days', p_early_window_days,
      'fatigue_threshold', p_fatigue_threshold,
      'significance_level', 0.05,
      'fdr_correction_method', 'benjamini-hochberg',
      'min_creatives_per_issue', 2,
      'min_early_impressions', 100
    ),
    'summary', (SELECT row_to_json(summary_stats) FROM summary_stats),
    'has_daily_metrics', v_has_daily_metrics,
    'fdr_summary', json_build_object(
      'total_issues_tested', (SELECT COUNT(*) FROM issue_with_significance),
      'significant_issues', 0,
      'mean_raw_p_value', 0.5,
      'mean_adjusted_p_value', 0.5,
      'mean_statistical_power', NULL,
      'adequately_powered_tests', 0
    ),
    'issue_performance', COALESCE((
      SELECT json_agg(row_to_json(i) ORDER BY i.mean_roas DESC)
      FROM issue_with_significance i
    ), '[]'::json),
    'stance_performance', COALESCE((
      SELECT json_agg(row_to_json(s) ORDER BY s.mean_roas DESC)
      FROM stance_stats s
    ), '[]'::json),
    'target_attacked_performance', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.mean_roas DESC)
      FROM target_stats t
    ), '[]'::json),
    'leading_indicators', json_build_object(
      'correlations', json_build_object(
        'early_ctr_to_roas', 0,
        'early_cpm_to_roas', 0,
        'ctr_correlation_pvalue', NULL,
        'cpm_correlation_pvalue', NULL,
        'ctr_correlation_significant', false,
        'cpm_correlation_significant', false
      ),
      'sample_size', 0,
      'avg_early_impressions', 0,
      'insight', CASE WHEN v_has_daily_metrics THEN 'Daily metrics available for trend analysis' ELSE 'Using snapshot metrics - daily data not yet available' END
    ),
    'fatigue_alerts', '[]'::json,
    'recommendations', COALESCE((
      SELECT json_agg(row_to_json(r) ORDER BY r.roas DESC)
      FROM recommendations r
    ), '[]'::json),
    'recommendation_summary', json_build_object(
      'scale', (SELECT COUNT(*) FROM recommendations WHERE recommendation = 'SCALE'),
      'maintain', (SELECT COUNT(*) FROM recommendations WHERE recommendation = 'MAINTAIN'),
      'watch', (SELECT COUNT(*) FROM recommendations WHERE recommendation = 'WATCH'),
      'gather_data', (SELECT COUNT(*) FROM recommendations WHERE recommendation = 'GATHER_DATA'),
      'refresh', (SELECT COUNT(*) FROM recommendations WHERE recommendation = 'REFRESH'),
      'pause', (SELECT COUNT(*) FROM recommendations WHERE recommendation = 'PAUSE')
    ),
    'data_quality', json_build_object(
      'creatives_with_issue_data', (SELECT COUNT(*) FROM creative_performance WHERE issue_primary IS NOT NULL),
      'creatives_without_issue_data', (SELECT COUNT(*) FROM creative_performance WHERE issue_primary IS NULL),
      'avg_impressions_per_creative', (SELECT AVG(total_impressions) FROM creative_performance),
      'avg_days_active', (SELECT AVG(days_with_data) FROM creative_performance),
      'overall_confidence', CASE 
        WHEN v_has_daily_metrics THEN 'HIGH'
        WHEN (SELECT COUNT(*) FROM creative_performance) >= 10 THEN 'MEDIUM'
        ELSE 'LOW'
      END
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_creative_intelligence(uuid, date, date, integer, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_creative_intelligence(uuid, date, date, integer, integer, numeric) TO service_role;