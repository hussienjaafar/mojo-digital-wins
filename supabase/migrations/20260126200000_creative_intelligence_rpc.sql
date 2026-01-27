-- Creative Intelligence Unified RPC
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_creative_intelligence(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_min_impressions INT DEFAULT 1000,
  p_early_window_days INT DEFAULT 3,
  p_fatigue_threshold FLOAT DEFAULT 0.20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_org_timezone TEXT;
BEGIN
  SELECT COALESCE(org_timezone, 'America/New_York') INTO v_org_timezone
  FROM client_organizations WHERE id = p_organization_id;

  WITH
  creative_base AS (
    SELECT ci.id, ci.creative_id, ci.ad_id, ci.issue_primary, ci.issue_tags,
           ci.political_stances, ci.targets_attacked, ci.targets_supported,
           ci.policy_positions, ci.donor_pain_points, ci.topic, ci.tone,
           ci.creative_type, ci.thumbnail_url, ci.headline, ci.primary_text, ci.created_at
    FROM meta_creative_insights ci
    WHERE ci.organization_id = p_organization_id
  ),
  daily_metrics AS (
    SELECT m.ad_id, m.date, m.impressions, m.clicks, m.spend, m.link_clicks,
           m.video_views, m.video_p25_watched, m.video_p50_watched,
           m.video_p75_watched, m.video_p100_watched
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
           COALESCE(SUM(dm.impressions), 0) as total_impressions,
           COALESCE(SUM(dm.clicks), 0) as total_clicks,
           COALESCE(SUM(dm.spend), 0) as total_spend,
           COALESCE(SUM(dm.link_clicks), 0) as total_link_clicks,
           CASE WHEN SUM(dm.impressions) > 0 THEN SUM(dm.clicks)::float / SUM(dm.impressions) ELSE 0 END as ctr,
           CASE WHEN SUM(dm.impressions) > 0 THEN SUM(dm.spend) / SUM(dm.impressions) * 1000 ELSE 0 END as cpm,
           COALESCE(ar.total_revenue, 0) as total_revenue,
           COALESCE(ar.donation_count, 0) as donation_count,
           CASE WHEN SUM(dm.spend) > 0 THEN COALESCE(ar.total_revenue, 0) / SUM(dm.spend) ELSE 0 END as roas,
           COUNT(DISTINCT dm.date) as days_with_data,
           MIN(dm.date) as first_date, MAX(dm.date) as last_date
    FROM creative_base cb
    LEFT JOIN daily_metrics dm ON cb.ad_id = dm.ad_id
    LEFT JOIN attributed_revenue ar ON cb.creative_id = ar.creative_id
    GROUP BY cb.creative_id, cb.ad_id, cb.issue_primary, cb.political_stances,
             cb.targets_attacked, cb.targets_supported, cb.topic, cb.tone,
             cb.creative_type, cb.thumbnail_url, cb.headline, cb.created_at,
             ar.total_revenue, ar.donation_count
    HAVING COALESCE(SUM(dm.impressions), 0) >= p_min_impressions
  ),
  issue_performance AS (
    SELECT issue_primary, COUNT(*) as creative_count,
           ROUND(AVG(roas)::numeric, 3) as mean_roas,
           ROUND(STDDEV(roas)::numeric, 3) as stddev_roas,
           ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY roas)::numeric, 3) as median_roas,
           ROUND(MIN(roas)::numeric, 3) as min_roas, ROUND(MAX(roas)::numeric, 3) as max_roas,
           SUM(total_impressions) as total_impressions,
           ROUND(SUM(total_spend)::numeric, 2) as total_spend,
           ROUND(SUM(total_revenue)::numeric, 2) as total_revenue,
           ROUND((AVG(roas) - 1.96 * COALESCE(STDDEV(roas), 0) / GREATEST(SQRT(COUNT(*)), 1))::numeric, 3) as ci_lower,
           ROUND((AVG(roas) + 1.96 * COALESCE(STDDEV(roas), 0) / GREATEST(SQRT(COUNT(*)), 1))::numeric, 3) as ci_upper,
           LEAST(100, ROUND((COUNT(*) * 15) + (SUM(total_impressions) / 5000) + (CASE WHEN STDDEV(roas) < 0.5 THEN 20 ELSE 0 END))) as confidence_score
    FROM creative_performance WHERE issue_primary IS NOT NULL GROUP BY issue_primary
  ),
  stance_performance AS (
    SELECT stance, COUNT(*) as creative_count, ROUND(AVG(roas)::numeric, 3) as mean_roas,
           SUM(total_impressions) as total_impressions,
           ROUND(SUM(total_spend)::numeric, 2) as total_spend,
           ROUND(SUM(total_revenue)::numeric, 2) as total_revenue
    FROM creative_performance, LATERAL unnest(political_stances) as stance
    WHERE political_stances IS NOT NULL AND array_length(political_stances, 1) > 0
    GROUP BY stance HAVING COUNT(*) >= 1
  ),
  target_attacked_performance AS (
    SELECT target, COUNT(*) as creative_count, ROUND(AVG(roas)::numeric, 3) as mean_roas,
           ROUND(SUM(total_revenue)::numeric, 2) as total_revenue
    FROM creative_performance, LATERAL unnest(targets_attacked) as target
    WHERE targets_attacked IS NOT NULL AND array_length(targets_attacked, 1) > 0
    GROUP BY target
  ),
  early_vs_final AS (
    SELECT cp.creative_id, cp.roas as final_roas,
           (SELECT SUM(dm2.clicks)::float / NULLIF(SUM(dm2.impressions), 0) FROM daily_metrics dm2 WHERE dm2.ad_id = cp.ad_id AND dm2.date <= cp.first_date + p_early_window_days) as early_ctr,
           (SELECT SUM(dm2.spend) / NULLIF(SUM(dm2.impressions), 0) * 1000 FROM daily_metrics dm2 WHERE dm2.ad_id = cp.ad_id AND dm2.date <= cp.first_date + p_early_window_days) as early_cpm
    FROM creative_performance cp WHERE cp.days_with_data >= p_early_window_days + 3
  ),
  leading_indicators AS (
    SELECT CORR(early_ctr, final_roas) as ctr_roas_correlation,
           CORR(early_cpm, final_roas) as cpm_roas_correlation, COUNT(*) as sample_size
    FROM early_vs_final WHERE early_ctr IS NOT NULL
  ),
  creative_trend AS (
    SELECT cp.creative_id, cp.issue_primary, cp.headline, cp.thumbnail_url,
           cp.days_with_data, cp.total_impressions, cp.roas, cp.ctr as overall_ctr,
           (SELECT MAX(dm2.clicks::float / NULLIF(dm2.impressions, 0)) FROM daily_metrics dm2 WHERE dm2.ad_id = cp.ad_id AND dm2.impressions >= 100) as peak_ctr,
           (SELECT AVG(dm2.clicks::float / NULLIF(dm2.impressions, 0)) FROM daily_metrics dm2 WHERE dm2.ad_id = cp.ad_id AND dm2.date >= cp.last_date - 2 AND dm2.impressions >= 100) as recent_ctr,
           (SELECT REGR_SLOPE(dm2.clicks::float / NULLIF(dm2.impressions, 0), EXTRACT(EPOCH FROM dm2.date)) FROM daily_metrics dm2 WHERE dm2.ad_id = cp.ad_id AND dm2.impressions >= 100) as trend_slope
    FROM creative_performance cp WHERE cp.days_with_data >= 5
  ),
  fatigue_analysis AS (
    SELECT creative_id, issue_primary, headline, thumbnail_url, days_with_data, total_impressions,
           ROUND(roas::numeric, 3) as roas, ROUND(peak_ctr::numeric, 4) as peak_ctr,
           ROUND(recent_ctr::numeric, 4) as recent_ctr,
           ROUND((1 - recent_ctr / NULLIF(peak_ctr, 0))::numeric, 3) as decline_from_peak, trend_slope,
           CASE WHEN (1 - recent_ctr / NULLIF(peak_ctr, 0)) >= p_fatigue_threshold AND trend_slope < 0 THEN 'FATIGUED'
                WHEN (1 - recent_ctr / NULLIF(peak_ctr, 0)) >= p_fatigue_threshold * 0.5 AND trend_slope < 0 THEN 'DECLINING'
                WHEN trend_slope > 0 THEN 'IMPROVING' ELSE 'STABLE' END as fatigue_status,
           CASE WHEN (1 - recent_ctr / NULLIF(peak_ctr, 0)) >= p_fatigue_threshold AND trend_slope < 0 THEN 'REFRESH_OR_PAUSE'
                WHEN (1 - recent_ctr / NULLIF(peak_ctr, 0)) >= p_fatigue_threshold * 0.5 AND trend_slope < 0 THEN 'MONITOR'
                WHEN roas >= 1.5 AND trend_slope >= 0 THEN 'SCALE'
                WHEN roas >= 1.0 AND trend_slope >= 0 THEN 'MAINTAIN'
                WHEN roas < 0.5 THEN 'PAUSE' ELSE 'WATCH' END as recommendation
    FROM creative_trend WHERE peak_ctr IS NOT NULL
  ),
  creative_recommendations AS (
    SELECT cp.creative_id, cp.ad_id, cp.issue_primary, cp.headline, cp.thumbnail_url,
           cp.creative_type, cp.total_impressions, cp.total_spend, cp.total_revenue,
           ROUND(cp.roas::numeric, 3) as roas, ROUND(cp.ctr::numeric, 4) as ctr, cp.days_with_data,
           COALESCE(fa.fatigue_status, 'UNKNOWN') as fatigue_status,
           LEAST(100, ROUND((cp.total_impressions / 1000) + (cp.days_with_data * 3) + (CASE WHEN cp.total_revenue > 0 THEN 20 ELSE 0 END))) as confidence_score,
           CASE WHEN fa.fatigue_status = 'FATIGUED' THEN 'REFRESH'
                WHEN cp.roas >= 1.5 AND COALESCE(fa.trend_slope, 0) >= 0 AND cp.total_impressions >= 5000 THEN 'SCALE'
                WHEN cp.roas >= 1.0 AND COALESCE(fa.trend_slope, 0) >= 0 THEN 'MAINTAIN'
                WHEN cp.roas < 0.5 AND cp.total_impressions >= 3000 THEN 'PAUSE'
                WHEN cp.total_impressions < 2000 THEN 'GATHER_DATA' ELSE 'WATCH' END as recommendation,
           CASE WHEN fa.fatigue_status = 'FATIGUED' THEN 'Performance declining - refresh creative'
                WHEN cp.roas >= 1.5 AND COALESCE(fa.trend_slope, 0) >= 0 AND cp.total_impressions >= 5000 THEN 'Strong performer - increase budget'
                WHEN cp.roas >= 1.0 AND COALESCE(fa.trend_slope, 0) >= 0 THEN 'Profitable and stable - maintain spend'
                WHEN cp.roas < 0.5 AND cp.total_impressions >= 3000 THEN 'Underperforming - consider pausing'
                WHEN cp.total_impressions < 2000 THEN 'Not enough data - continue gathering' ELSE 'Mixed signals - monitor closely' END as explanation
    FROM creative_performance cp LEFT JOIN fatigue_analysis fa ON cp.creative_id = fa.creative_id
  )
  SELECT json_build_object(
    'generated_at', NOW(),
    'organization_id', p_organization_id,
    'date_range', json_build_object('start_date', p_start_date, 'end_date', p_end_date),
    'parameters', json_build_object('min_impressions', p_min_impressions, 'early_window_days', p_early_window_days, 'fatigue_threshold', p_fatigue_threshold),
    'summary', (SELECT json_build_object('total_creatives', COUNT(*), 'total_spend', ROUND(SUM(total_spend)::numeric, 2), 'total_revenue', ROUND(SUM(total_revenue)::numeric, 2), 'overall_roas', ROUND((SUM(total_revenue) / NULLIF(SUM(total_spend), 0))::numeric, 3), 'total_impressions', SUM(total_impressions), 'creatives_with_issues', COUNT(*) FILTER (WHERE issue_primary IS NOT NULL)) FROM creative_performance),
    'issue_performance', (SELECT COALESCE(json_agg(row_to_json(ip) ORDER BY ip.mean_roas DESC), '[]'::json) FROM issue_performance ip),
    'stance_performance', (SELECT COALESCE(json_agg(row_to_json(sp) ORDER BY sp.mean_roas DESC), '[]'::json) FROM stance_performance sp),
    'target_attacked_performance', (SELECT COALESCE(json_agg(row_to_json(tap) ORDER BY tap.mean_roas DESC), '[]'::json) FROM target_attacked_performance tap),
    'leading_indicators', (SELECT json_build_object('correlations', json_build_object('early_ctr_to_roas', ROUND(COALESCE(ctr_roas_correlation, 0)::numeric, 3), 'early_cpm_to_roas', ROUND(COALESCE(cpm_roas_correlation, 0)::numeric, 3)), 'sample_size', COALESCE(sample_size, 0), 'insight', CASE WHEN ctr_roas_correlation > 0.5 THEN 'Strong: Early CTR predicts ROAS' WHEN ctr_roas_correlation > 0.3 THEN 'Moderate correlation' ELSE 'Weak correlation' END) FROM leading_indicators),
    'fatigue_alerts', (SELECT COALESCE(json_agg(row_to_json(fa) ORDER BY fa.decline_from_peak DESC), '[]'::json) FROM fatigue_analysis fa WHERE fa.fatigue_status IN ('FATIGUED', 'DECLINING')),
    'recommendations', (SELECT COALESCE(json_agg(row_to_json(cr) ORDER BY CASE cr.recommendation WHEN 'SCALE' THEN 1 WHEN 'MAINTAIN' THEN 2 WHEN 'WATCH' THEN 3 WHEN 'GATHER_DATA' THEN 4 WHEN 'REFRESH' THEN 5 WHEN 'PAUSE' THEN 6 ELSE 7 END, cr.roas DESC), '[]'::json) FROM creative_recommendations cr),
    'recommendation_summary', (SELECT json_build_object('scale', COUNT(*) FILTER (WHERE recommendation = 'SCALE'), 'maintain', COUNT(*) FILTER (WHERE recommendation = 'MAINTAIN'), 'watch', COUNT(*) FILTER (WHERE recommendation = 'WATCH'), 'gather_data', COUNT(*) FILTER (WHERE recommendation = 'GATHER_DATA'), 'refresh', COUNT(*) FILTER (WHERE recommendation = 'REFRESH'), 'pause', COUNT(*) FILTER (WHERE recommendation = 'PAUSE')) FROM creative_recommendations),
    'data_quality', (SELECT json_build_object('creatives_with_issue_data', COUNT(*) FILTER (WHERE issue_primary IS NOT NULL), 'creatives_without_issue_data', COUNT(*) FILTER (WHERE issue_primary IS NULL), 'avg_impressions_per_creative', ROUND(AVG(total_impressions)), 'avg_days_active', ROUND(AVG(days_with_data)), 'overall_confidence', CASE WHEN AVG(total_impressions) > 10000 AND COUNT(*) >= 5 THEN 'HIGH' WHEN AVG(total_impressions) > 3000 AND COUNT(*) >= 3 THEN 'MEDIUM' ELSE 'LOW' END) FROM creative_performance)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_creative_intelligence TO authenticated;
GRANT EXECUTE ON FUNCTION get_creative_intelligence TO service_role;
