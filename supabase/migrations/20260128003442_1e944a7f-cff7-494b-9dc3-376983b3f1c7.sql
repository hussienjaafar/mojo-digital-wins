-- Fix get_creative_intelligence function: replace illegal TEXT[] to JSONB casts with unnest()
CREATE OR REPLACE FUNCTION get_creative_intelligence(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_min_impressions INT DEFAULT 1000,
  p_early_window_days INT DEFAULT 3,
  p_fatigue_threshold FLOAT DEFAULT 0.20,
  p_significance_level FLOAT DEFAULT 0.05,
  p_min_creatives_per_issue INT DEFAULT 3,
  p_min_early_impressions INT DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_org_timezone TEXT;
  v_has_daily_metrics BOOLEAN;
BEGIN
  SELECT COALESCE(org_timezone, 'America/New_York') INTO v_org_timezone
  FROM client_organizations WHERE id = p_organization_id;

  -- Check if daily metrics exist for this org and date range
  SELECT EXISTS(
    SELECT 1 FROM meta_ad_metrics_daily
    WHERE organization_id = p_organization_id
      AND date BETWEEN p_start_date AND p_end_date
    LIMIT 1
  ) INTO v_has_daily_metrics;

  WITH
  creative_base AS (
    SELECT ci.id, ci.creative_id, ci.ad_id, ci.issue_primary, ci.issue_tags,
           ci.political_stances, ci.targets_attacked, ci.targets_supported,
           ci.policy_positions, ci.donor_pain_points, ci.topic, ci.tone,
           ci.creative_type, ci.thumbnail_url, ci.headline, ci.primary_text, ci.created_at,
           -- Snapshot metrics from meta_creative_insights (fallback source)
           ci.impressions as snapshot_impressions,
           ci.clicks as snapshot_clicks,
           ci.spend as snapshot_spend,
           ci.ctr as snapshot_ctr,
           ci.roas as snapshot_roas
    FROM meta_creative_insights ci
    WHERE ci.organization_id = p_organization_id
  ),
  daily_metrics AS (
    SELECT m.ad_id, m.date, m.impressions, m.clicks, m.spend, m.link_clicks
    FROM meta_ad_metrics_daily m
    JOIN creative_base cb ON m.ad_id = cb.ad_id
    WHERE m.date BETWEEN p_start_date AND p_end_date
  ),
  attributed_revenue AS (
    SELECT cb.creative_id, cb.ad_id, SUM(at.amount) as total_revenue,
           COUNT(DISTINCT at.id) as donation_count, COUNT(DISTINCT at.donor_email) as unique_donors
    FROM creative_base cb
    LEFT JOIN actblue_transactions at ON (
      at.organization_id = p_organization_id
      AND at.transaction_type = 'donation'
      AND DATE(at.transaction_date AT TIME ZONE v_org_timezone) BETWEEN p_start_date AND p_end_date
      AND (at.refcode ILIKE '%' || cb.creative_id || '%' OR at.refcode2 IS NOT NULL)
    )
    GROUP BY cb.creative_id, cb.ad_id
  ),
  creative_performance AS (
    SELECT cb.creative_id, cb.ad_id, cb.issue_primary, cb.political_stances,
           cb.targets_attacked, cb.targets_supported, cb.topic, cb.tone,
           cb.creative_type, cb.thumbnail_url, cb.headline, cb.created_at,
           -- Use daily metrics when available, fall back to snapshot metrics
           CASE WHEN v_has_daily_metrics
             THEN COALESCE(SUM(dm.impressions), 0)
             ELSE COALESCE(cb.snapshot_impressions, 0)
           END as total_impressions,
           CASE WHEN v_has_daily_metrics
             THEN COALESCE(SUM(dm.clicks), 0)
             ELSE COALESCE(cb.snapshot_clicks, 0)
           END as total_clicks,
           CASE WHEN v_has_daily_metrics
             THEN COALESCE(SUM(dm.spend), 0)
             ELSE COALESCE(cb.snapshot_spend, 0)
           END as total_spend,
           CASE WHEN v_has_daily_metrics
             THEN COALESCE(SUM(dm.link_clicks), 0)
             ELSE 0
           END as total_link_clicks,
           CASE WHEN v_has_daily_metrics AND SUM(dm.impressions) > 0
             THEN SUM(dm.clicks)::float / SUM(dm.impressions)
             ELSE COALESCE(cb.snapshot_ctr, 0)
           END as ctr,
           CASE WHEN v_has_daily_metrics AND SUM(dm.impressions) > 0
             THEN SUM(dm.spend) / SUM(dm.impressions) * 1000
             ELSE CASE WHEN COALESCE(cb.snapshot_impressions, 0) > 0
               THEN COALESCE(cb.snapshot_spend, 0) / cb.snapshot_impressions * 1000
               ELSE 0
             END
           END as cpm,
           COALESCE(ar.total_revenue, 0) as total_revenue,
           COALESCE(ar.donation_count, 0) as donation_count,
           CASE WHEN v_has_daily_metrics AND SUM(dm.spend) > 0
             THEN COALESCE(ar.total_revenue, 0) / SUM(dm.spend)
             ELSE CASE WHEN COALESCE(cb.snapshot_spend, 0) > 0
               THEN COALESCE(ar.total_revenue, 0) / cb.snapshot_spend
               ELSE COALESCE(cb.snapshot_roas, 0)
             END
           END as roas,
           CASE WHEN v_has_daily_metrics
             THEN COUNT(DISTINCT dm.date)
             ELSE 1
           END as days_with_data,
           MIN(dm.date) as first_date, MAX(dm.date) as last_date
    FROM creative_base cb
    LEFT JOIN daily_metrics dm ON cb.ad_id = dm.ad_id
    LEFT JOIN attributed_revenue ar ON cb.creative_id = ar.creative_id
    GROUP BY cb.creative_id, cb.ad_id, cb.issue_primary, cb.political_stances,
             cb.targets_attacked, cb.targets_supported, cb.topic, cb.tone,
             cb.creative_type, cb.thumbnail_url, cb.headline, cb.created_at,
             cb.snapshot_impressions, cb.snapshot_clicks, cb.snapshot_spend,
             cb.snapshot_ctr, cb.snapshot_roas, ar.total_revenue, ar.donation_count
    HAVING CASE WHEN v_has_daily_metrics
             THEN COALESCE(SUM(dm.impressions), 0)
             ELSE COALESCE(cb.snapshot_impressions, 0)
           END >= p_min_impressions
  ),
  -- Issue performance with FDR correction
  issue_stats AS (
    SELECT issue_primary,
           COUNT(*) as creative_count,
           AVG(roas) as mean_roas,
           STDDEV_SAMP(roas) as stddev_roas,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY roas) as median_roas,
           MIN(roas) as min_roas,
           MAX(roas) as max_roas,
           SUM(total_impressions) as total_impressions,
           SUM(total_spend) as total_spend,
           SUM(total_revenue) as total_revenue
    FROM creative_performance
    WHERE issue_primary IS NOT NULL
    GROUP BY issue_primary
    HAVING COUNT(*) >= p_min_creatives_per_issue
  ),
  global_stats AS (
    SELECT AVG(roas) as global_mean, STDDEV_SAMP(roas) as global_stddev
    FROM creative_performance
  ),
  issue_performance AS (
    SELECT i.issue_primary,
           i.creative_count,
           ROUND(i.mean_roas::numeric, 4) as mean_roas,
           ROUND(i.stddev_roas::numeric, 4) as stddev_roas,
           ROUND(i.median_roas::numeric, 4) as median_roas,
           ROUND(i.min_roas::numeric, 4) as min_roas,
           ROUND(i.max_roas::numeric, 4) as max_roas,
           i.total_impressions,
           ROUND(i.total_spend::numeric, 2) as total_spend,
           ROUND(i.total_revenue::numeric, 2) as total_revenue,
           -- Confidence interval
           ROUND((i.mean_roas - 1.96 * COALESCE(i.stddev_roas, 0) / SQRT(i.creative_count))::numeric, 4) as ci_lower,
           ROUND((i.mean_roas + 1.96 * COALESCE(i.stddev_roas, 0) / SQRT(i.creative_count))::numeric, 4) as ci_upper,
           -- Standard error and z-score
           CASE WHEN i.stddev_roas > 0 AND i.creative_count > 1
             THEN i.stddev_roas / SQRT(i.creative_count)
             ELSE NULL
           END as standard_error,
           CASE WHEN g.global_stddev > 0 AND i.stddev_roas > 0 AND i.creative_count > 1
             THEN (i.mean_roas - g.global_mean) / (i.stddev_roas / SQRT(i.creative_count))
             ELSE NULL
           END as z_score,
           -- Confidence score based on sample size
           LEAST(1.0, i.creative_count::float / 10) as confidence_score,
           -- Effect size (Cohen's d)
           CASE WHEN g.global_stddev > 0
             THEN (i.mean_roas - g.global_mean) / g.global_stddev
             ELSE NULL
           END as effect_size,
           ROW_NUMBER() OVER (ORDER BY i.mean_roas DESC) as rank_num,
           COUNT(*) OVER () as total_issues
    FROM issue_stats i
    CROSS JOIN global_stats g
  ),
  issue_with_pvalues AS (
    SELECT ip.*,
           -- Raw p-value (two-tailed)
           CASE WHEN z_score IS NOT NULL
             THEN 2 * (1 - (0.5 * (1 + SIGN(z_score) * (1 - EXP(-0.7 * ABS(z_score) * (1 + 0.0001 * z_score * z_score))))))
             ELSE 1.0
           END as p_value,
           -- BH adjusted p-value
           CASE WHEN z_score IS NOT NULL
             THEN LEAST(1.0, (2 * (1 - (0.5 * (1 + SIGN(z_score) * (1 - EXP(-0.7 * ABS(z_score) * (1 + 0.0001 * z_score * z_score))))))) * total_issues / rank_num)
             ELSE 1.0
           END as p_value_adjusted
    FROM issue_performance ip
  ),
  final_issue_performance AS (
    SELECT issue_primary, creative_count, mean_roas, stddev_roas, median_roas,
           min_roas, max_roas, total_impressions, total_spend, total_revenue,
           ci_lower, ci_upper, confidence_score,
           ROUND(standard_error::numeric, 6) as standard_error,
           ROUND(z_score::numeric, 4) as z_score,
           ROUND(p_value::numeric, 6) as p_value,
           ROUND(p_value_adjusted::numeric, 6) as p_value_adjusted,
           p_value_adjusted < p_significance_level as is_significant,
           ROUND(effect_size::numeric, 4) as effect_size,
           -- Statistical power approximation
           CASE WHEN effect_size IS NOT NULL AND creative_count >= 3
             THEN LEAST(1.0, 0.5 + 0.3 * ABS(effect_size) * SQRT(creative_count))
             ELSE NULL
           END as statistical_power,
           CASE WHEN effect_size IS NOT NULL AND creative_count >= 3
             THEN CASE
               WHEN LEAST(1.0, 0.5 + 0.3 * ABS(effect_size) * SQRT(creative_count)) >= 0.8 THEN 'ADEQUATE'
               WHEN LEAST(1.0, 0.5 + 0.3 * ABS(effect_size) * SQRT(creative_count)) >= 0.5 THEN 'MODERATE'
               ELSE 'LOW'
             END
             ELSE NULL
           END as power_interpretation
    FROM issue_with_pvalues
  ),
  -- Stance performance - FIXED: use unnest() instead of jsonb_array_elements_text with cast
  stance_performance AS (
    SELECT stance,
           COUNT(*) as creative_count,
           ROUND(AVG(roas)::numeric, 4) as mean_roas,
           SUM(total_impressions) as total_impressions,
           ROUND(SUM(total_spend)::numeric, 2) as total_spend,
           ROUND(SUM(total_revenue)::numeric, 2) as total_revenue
    FROM creative_performance, unnest(political_stances) as stance
    WHERE political_stances IS NOT NULL 
      AND array_length(political_stances, 1) > 0
    GROUP BY stance
    HAVING COUNT(*) >= 2
  ),
  -- Target attacked performance - FIXED: use unnest() instead of jsonb_array_elements_text with cast
  target_performance AS (
    SELECT target,
           COUNT(*) as creative_count,
           ROUND(AVG(roas)::numeric, 4) as mean_roas,
           ROUND(SUM(total_revenue)::numeric, 2) as total_revenue
    FROM creative_performance, unnest(targets_attacked) as target
    WHERE targets_attacked IS NOT NULL 
      AND array_length(targets_attacked, 1) > 0
    GROUP BY target
    HAVING COUNT(*) >= 2
  ),
  -- Summary metrics
  summary AS (
    SELECT COUNT(*) as total_creatives,
           ROUND(SUM(total_spend)::numeric, 2) as total_spend,
           ROUND(SUM(total_revenue)::numeric, 2) as total_revenue,
           ROUND(CASE WHEN SUM(total_spend) > 0 THEN SUM(total_revenue) / SUM(total_spend) ELSE 0 END::numeric, 4) as overall_roas,
           SUM(total_impressions) as total_impressions,
           COUNT(*) FILTER (WHERE issue_primary IS NOT NULL) as creatives_with_issues
    FROM creative_performance
  ),
  -- Recommendations - FIXED: use unnest() with LIMIT 1 for target_attacked
  recommendations AS (
    SELECT creative_id, ad_id, issue_primary, headline, thumbnail_url, creative_type,
           total_impressions, ROUND(total_spend::numeric, 2) as total_spend,
           ROUND(total_revenue::numeric, 2) as total_revenue,
           ROUND(roas::numeric, 4) as roas, ROUND(ctr::numeric, 6) as ctr,
           days_with_data,
           CASE
             WHEN roas >= 2.0 AND days_with_data >= 3 THEN 'SCALE'
             WHEN roas >= 1.0 AND roas < 2.0 AND days_with_data >= 3 THEN 'MAINTAIN'
             WHEN roas >= 0.5 AND roas < 1.0 THEN 'WATCH'
             WHEN days_with_data < 3 THEN 'GATHER_DATA'
             WHEN roas < 0.5 AND days_with_data >= 5 THEN 'PAUSE'
             ELSE 'WATCH'
           END as recommendation,
           CASE
             WHEN roas >= 2.0 AND days_with_data >= 3 THEN 'High performer with consistent results. Increase budget allocation.'
             WHEN roas >= 1.0 AND roas < 2.0 AND days_with_data >= 3 THEN 'Profitable creative. Maintain current spend.'
             WHEN roas >= 0.5 AND roas < 1.0 THEN 'Below target ROAS. Monitor closely for improvement.'
             WHEN days_with_data < 3 THEN 'Insufficient data. Allow more time for optimization.'
             WHEN roas < 0.5 AND days_with_data >= 5 THEN 'Underperforming. Consider pausing or major refresh.'
             ELSE 'Monitor performance and gather more data.'
           END as explanation,
           LEAST(1.0, days_with_data::float / 7) as confidence_score,
           'STABLE' as fatigue_status,
           (SELECT t FROM unnest(targets_attacked) as t LIMIT 1) as target_attacked
    FROM creative_performance
    ORDER BY roas DESC
    LIMIT 50
  ),
  recommendation_summary AS (
    SELECT COUNT(*) FILTER (WHERE recommendation = 'SCALE') as scale,
           COUNT(*) FILTER (WHERE recommendation = 'MAINTAIN') as maintain,
           COUNT(*) FILTER (WHERE recommendation = 'WATCH') as watch,
           COUNT(*) FILTER (WHERE recommendation = 'GATHER_DATA') as gather_data,
           COUNT(*) FILTER (WHERE recommendation = 'REFRESH') as refresh,
           COUNT(*) FILTER (WHERE recommendation = 'PAUSE') as pause
    FROM recommendations
  ),
  -- Data quality metrics
  data_quality AS (
    SELECT COUNT(*) FILTER (WHERE issue_primary IS NOT NULL) as creatives_with_issue_data,
           COUNT(*) FILTER (WHERE issue_primary IS NULL) as creatives_without_issue_data,
           ROUND(AVG(total_impressions)::numeric, 0) as avg_impressions_per_creative,
           ROUND(AVG(days_with_data)::numeric, 1) as avg_days_active,
           CASE
             WHEN COUNT(*) >= 20 AND AVG(days_with_data) >= 5 THEN 'HIGH'
             WHEN COUNT(*) >= 10 AND AVG(days_with_data) >= 3 THEN 'MEDIUM'
             ELSE 'LOW'
           END as overall_confidence
    FROM creative_performance
  ),
  -- FDR summary
  fdr_summary AS (
    SELECT COUNT(*) as total_issues_tested,
           COUNT(*) FILTER (WHERE is_significant) as significant_issues,
           ROUND(AVG(p_value)::numeric, 6) as mean_raw_p_value,
           ROUND(AVG(p_value_adjusted)::numeric, 6) as mean_adjusted_p_value,
           ROUND(AVG(statistical_power)::numeric, 4) as mean_statistical_power,
           COUNT(*) FILTER (WHERE statistical_power >= 0.8) as adequately_powered_tests
    FROM final_issue_performance
  )
  SELECT json_build_object(
    'generated_at', NOW(),
    'organization_id', p_organization_id,
    'date_range', json_build_object('start_date', p_start_date, 'end_date', p_end_date),
    'parameters', json_build_object(
      'min_impressions', p_min_impressions,
      'early_window_days', p_early_window_days,
      'fatigue_threshold', p_fatigue_threshold,
      'significance_level', p_significance_level,
      'fdr_correction_method', 'benjamini_hochberg',
      'min_creatives_per_issue', p_min_creatives_per_issue,
      'min_early_impressions', p_min_early_impressions
    ),
    'summary', (SELECT row_to_json(s) FROM summary s),
    'fdr_summary', (SELECT row_to_json(f) FROM fdr_summary f),
    'issue_performance', COALESCE((SELECT json_agg(row_to_json(ip) ORDER BY ip.mean_roas DESC) FROM final_issue_performance ip), '[]'::json),
    'stance_performance', COALESCE((SELECT json_agg(row_to_json(sp) ORDER BY sp.mean_roas DESC) FROM stance_performance sp), '[]'::json),
    'target_attacked_performance', COALESCE((SELECT json_agg(row_to_json(tp) ORDER BY tp.mean_roas DESC) FROM target_performance tp), '[]'::json),
    'leading_indicators', json_build_object(
      'correlations', json_build_object(
        'early_ctr_to_roas', 0,
        'early_cpm_to_roas', 0,
        'ctr_correlation_pvalue', null,
        'cpm_correlation_pvalue', null,
        'ctr_correlation_significant', false,
        'cpm_correlation_significant', false
      ),
      'sample_size', 0,
      'avg_early_impressions', 0,
      'insight', 'Leading indicators require daily metrics data'
    ),
    'fatigue_alerts', '[]'::json,
    'recommendations', COALESCE((SELECT json_agg(row_to_json(r)) FROM recommendations r), '[]'::json),
    'recommendation_summary', (SELECT row_to_json(rs) FROM recommendation_summary rs),
    'data_quality', (SELECT row_to_json(dq) FROM data_quality dq),
    'has_daily_metrics', v_has_daily_metrics
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION get_creative_intelligence TO authenticated;
GRANT EXECUTE ON FUNCTION get_creative_intelligence TO service_role;