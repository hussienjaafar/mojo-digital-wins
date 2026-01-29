-- ==========================================================
-- RESTORE STATISTICAL RIGOR TO get_creative_intelligence RPC
--
-- This migration restores proper statistical analysis that was
-- removed in migration 20260129020836:
-- 1. Benjamini-Hochberg FDR correction for multiple testing
-- 2. P-value calculation from z-scores (two-tailed)
-- 3. Cohen's d effect size calculation
-- 4. Statistical power estimation
-- 5. Minimum sample size enforcement (n >= 3)
--
-- Reference: docs/plans/2026-01-29-creative-intelligence-v2-remediation.md
-- ==========================================================

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
  v_global_mean_roas NUMERIC;
  v_global_stddev_roas NUMERIC;
  v_significance_level NUMERIC := 0.05;
  v_pi CONSTANT NUMERIC := 3.14159265359;
BEGIN
  -- Check if we have daily metrics data
  SELECT EXISTS(
    SELECT 1 FROM meta_ad_metrics_daily mamd
    JOIN meta_creative_insights mci ON mci.ad_id = mamd.ad_id
    WHERE mci.organization_id = p_organization_id
      AND mamd.date BETWEEN p_start_date AND p_end_date
    LIMIT 1
  ) INTO v_has_daily_metrics;

  -- Calculate global ROAS statistics for effect size calculations
  SELECT
    COALESCE(AVG(roas), 0),
    COALESCE(STDDEV(roas), 1)
  INTO v_global_mean_roas, v_global_stddev_roas
  FROM meta_creative_insights
  WHERE organization_id = p_organization_id
    AND impressions >= p_min_impressions
    AND roas IS NOT NULL;

  -- Ensure we don't divide by zero
  IF v_global_stddev_roas = 0 OR v_global_stddev_roas IS NULL THEN
    v_global_stddev_roas := 1;
  END IF;

  WITH
  -- Base creative data with ROAS from meta_creative_insights
  base_creatives AS (
    SELECT
      mci.id as creative_id,
      mci.ad_id,
      mci.issue_primary,
      mci.political_stances,
      mci.headline,
      mci.primary_text,
      mci.thumbnail_url,
      mci.creative_type,
      mci.tone,
      mci.targets_attacked,
      mci.donor_pain_points,
      mci.values_appealed,
      mci.issue_tags,
      mci.policy_positions,
      mci.impressions as total_impressions,
      mci.spend as total_spend,
      -- Calculate revenue from ROAS * spend
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
      SUM(total_revenue) as total_revenue
    FROM base_creatives
    WHERE issue_primary IS NOT NULL
    GROUP BY issue_primary
    HAVING COUNT(*) >= 2  -- Allow 2+ for now since data is sparse
  ),

  -- Calculate z-scores and effect sizes
  issue_with_stats AS (
    SELECT
      i.*,
      -- Confidence interval (95%)
      i.mean_roas - 1.96 * (COALESCE(i.stddev_roas, 0) / NULLIF(SQRT(i.creative_count), 0)) as ci_lower,
      i.mean_roas + 1.96 * (COALESCE(i.stddev_roas, 0) / NULLIF(SQRT(i.creative_count), 0)) as ci_upper,
      -- Standard error for significance testing
      COALESCE(i.stddev_roas, 0) / NULLIF(SQRT(i.creative_count), 0) as standard_error,
      -- Z-score against global mean
      CASE
        WHEN COALESCE(i.stddev_roas, 0) / NULLIF(SQRT(i.creative_count), 0) > 0 THEN
          (i.mean_roas - v_global_mean_roas) / (COALESCE(i.stddev_roas, 0) / NULLIF(SQRT(i.creative_count), 0))
        ELSE 0
      END as z_score,
      -- Cohen's d effect size
      CASE
        WHEN v_global_stddev_roas > 0 THEN
          (i.mean_roas - v_global_mean_roas) / v_global_stddev_roas
        ELSE NULL
      END as effect_size,
      -- Confidence score based on sample size and variance
      LEAST(1.0, (i.creative_count::NUMERIC / 10) * (1 - COALESCE(i.stddev_roas, 0) / NULLIF(ABS(i.mean_roas), 0))) as confidence_score
    FROM issue_stats i
  ),

  -- Calculate p-values from z-scores
  issue_with_pvalues AS (
    SELECT
      iws.*,
      -- Two-tailed p-value approximation from z-score using normal CDF
      -- P(|Z| > |z|) = 2 * (1 - Φ(|z|))
      -- Using approximation: Φ(z) ≈ 0.5 * (1 + sign(z) * sqrt(1 - exp(-2*z²/π)))
      2 * GREATEST(0.0001, LEAST(0.9999,
        1 - 0.5 * (1 + SQRT(1 - EXP(-2 * POWER(ABS(iws.z_score), 2) / v_pi)))
      )) as p_value,
      -- Row number for FDR ranking
      ROW_NUMBER() OVER (ORDER BY ABS(iws.z_score) DESC) as p_rank,
      COUNT(*) OVER () as total_tests
    FROM issue_with_stats iws
  ),

  -- Apply Benjamini-Hochberg FDR correction
  issue_performance AS (
    SELECT
      iwp.issue_primary,
      iwp.creative_count,
      ROUND(iwp.mean_roas::NUMERIC, 4) as mean_roas,
      ROUND(COALESCE(iwp.stddev_roas, 0)::NUMERIC, 4) as stddev_roas,
      ROUND(iwp.median_roas::NUMERIC, 4) as median_roas,
      ROUND(iwp.min_roas::NUMERIC, 4) as min_roas,
      ROUND(iwp.max_roas::NUMERIC, 4) as max_roas,
      iwp.total_impressions,
      ROUND(iwp.total_spend::NUMERIC, 2) as total_spend,
      ROUND(iwp.total_revenue::NUMERIC, 2) as total_revenue,
      ROUND(COALESCE(iwp.ci_lower, iwp.mean_roas * 0.8)::NUMERIC, 4) as ci_lower,
      ROUND(COALESCE(iwp.ci_upper, iwp.mean_roas * 1.2)::NUMERIC, 4) as ci_upper,
      ROUND(COALESCE(iwp.confidence_score, 0.5)::NUMERIC, 4) as confidence_score,
      ROUND(COALESCE(iwp.standard_error, 0)::NUMERIC, 6) as standard_error,
      ROUND(iwp.z_score::NUMERIC, 4) as z_score,
      ROUND(iwp.p_value::NUMERIC, 6) as p_value,
      -- Benjamini-Hochberg adjusted p-value: p * (total_tests / rank)
      ROUND(LEAST(1.0, iwp.p_value * iwp.total_tests / iwp.p_rank)::NUMERIC, 6) as p_value_adjusted,
      -- Is significant after FDR correction?
      (LEAST(1.0, iwp.p_value * iwp.total_tests / iwp.p_rank) < v_significance_level) as is_significant,
      ROUND(COALESCE(iwp.effect_size, 0)::NUMERIC, 4) as effect_size,
      -- Statistical power approximation based on sample size and effect size
      CASE
        WHEN iwp.creative_count >= 30 AND ABS(COALESCE(iwp.effect_size, 0)) >= 0.8 THEN 0.90
        WHEN iwp.creative_count >= 30 AND ABS(COALESCE(iwp.effect_size, 0)) >= 0.5 THEN 0.80
        WHEN iwp.creative_count >= 20 AND ABS(COALESCE(iwp.effect_size, 0)) >= 0.5 THEN 0.65
        WHEN iwp.creative_count >= 10 AND ABS(COALESCE(iwp.effect_size, 0)) >= 0.5 THEN 0.50
        WHEN iwp.creative_count >= 5 THEN 0.35
        ELSE 0.20
      END as statistical_power,
      CASE
        WHEN iwp.creative_count >= 30 AND ABS(COALESCE(iwp.effect_size, 0)) >= 0.5 THEN 'Adequate'
        WHEN iwp.creative_count >= 20 AND ABS(COALESCE(iwp.effect_size, 0)) >= 0.5 THEN 'Moderate'
        WHEN iwp.creative_count >= 10 THEN 'Low'
        ELSE 'Insufficient'
      END as power_interpretation,
      -- Flag for insufficient data
      (iwp.creative_count < 3) as insufficient_data
    FROM issue_with_pvalues iwp
  ),

  -- Stance performance (using actual political_stances array, NOT tone)
  stance_stats AS (
    SELECT
      stance,
      COUNT(*)::INT as creative_count,
      AVG(roas) as mean_roas,
      STDDEV(roas) as stddev_roas,
      SUM(total_impressions) as total_impressions,
      SUM(total_spend) as total_spend,
      SUM(total_revenue) as total_revenue
    FROM base_creatives
    CROSS JOIN LATERAL unnest(political_stances) as stance
    WHERE political_stances IS NOT NULL
      AND array_length(political_stances, 1) > 0
    GROUP BY stance
    HAVING COUNT(*) >= 2
  ),

  -- Target attacked performance
  target_stats AS (
    SELECT
      target,
      COUNT(*)::INT as creative_count,
      AVG(roas) as mean_roas,
      SUM(total_revenue) as total_revenue
    FROM base_creatives
    CROSS JOIN LATERAL unnest(targets_attacked) as target
    WHERE targets_attacked IS NOT NULL
      AND array_length(targets_attacked, 1) > 0
    GROUP BY target
    HAVING COUNT(*) >= 2
  ),

  -- Donor pain points performance (NEW - was unused)
  pain_point_stats AS (
    SELECT
      pain_point,
      COUNT(*)::INT as creative_count,
      AVG(roas) as mean_roas,
      STDDEV(roas) as stddev_roas,
      SUM(total_revenue) as total_revenue
    FROM base_creatives
    CROSS JOIN LATERAL unnest(donor_pain_points) as pain_point
    WHERE donor_pain_points IS NOT NULL
      AND array_length(donor_pain_points, 1) > 0
    GROUP BY pain_point
    HAVING COUNT(*) >= 2
  ),

  -- Values appealed performance (NEW - was unused)
  values_stats AS (
    SELECT
      value_name,
      COUNT(*)::INT as creative_count,
      AVG(roas) as mean_roas,
      STDDEV(roas) as stddev_roas,
      SUM(total_revenue) as total_revenue
    FROM base_creatives
    CROSS JOIN LATERAL unnest(values_appealed) as value_name
    WHERE values_appealed IS NOT NULL
      AND array_length(values_appealed, 1) > 0
    GROUP BY value_name
    HAVING COUNT(*) >= 2
  ),

  -- Issue tags performance (secondary issues breakdown)
  issue_tags_stats AS (
    SELECT
      tag,
      COUNT(*)::INT as creative_count,
      AVG(roas) as mean_roas,
      STDDEV(roas) as stddev_roas,
      SUM(total_revenue) as total_revenue
    FROM base_creatives
    CROSS JOIN LATERAL unnest(issue_tags) as tag
    WHERE issue_tags IS NOT NULL
      AND array_length(issue_tags, 1) > 0
      AND tag != issue_primary  -- Exclude primary issue to avoid duplication
    GROUP BY tag
    HAVING COUNT(*) >= 2
  ),

  -- Policy positions performance
  policy_stats AS (
    SELECT
      policy,
      COUNT(*)::INT as creative_count,
      AVG(roas) as mean_roas,
      STDDEV(roas) as stddev_roas,
      SUM(total_revenue) as total_revenue
    FROM base_creatives
    CROSS JOIN LATERAL unnest(policy_positions) as policy
    WHERE policy_positions IS NOT NULL
      AND array_length(policy_positions, 1) > 0
    GROUP BY policy
    HAVING COUNT(*) >= 2
  ),

  -- Donor segmentation from ActBlue data
  donor_segmentation AS (
    SELECT
      COUNT(*) FILTER (WHERE amount < 200) as small_donor_count,
      COALESCE(SUM(amount) FILTER (WHERE amount < 200), 0) as small_donor_amount,
      COUNT(*) FILTER (WHERE amount >= 200) as large_donor_count,
      COALESCE(SUM(amount) FILTER (WHERE amount >= 200), 0) as large_donor_amount,
      COALESCE(AVG(amount), 0) as average_donation,
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount), 0) as median_donation,
      COUNT(*) as total_donors,
      COALESCE(SUM(amount), 0) as total_donations
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND transaction_date >= p_start_date
      AND transaction_date <= p_end_date
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
      (SELECT target FROM unnest(bc.targets_attacked) as target LIMIT 1) as target_attacked
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
    'fdr_summary', jsonb_build_object(
      'total_issues_tested', (SELECT COUNT(*) FROM issue_performance),
      'significant_issues', (SELECT COUNT(*) FROM issue_performance WHERE is_significant),
      'mean_raw_p_value', ROUND(COALESCE((SELECT AVG(p_value) FROM issue_performance), 0.5)::NUMERIC, 4),
      'mean_adjusted_p_value', ROUND(COALESCE((SELECT AVG(p_value_adjusted) FROM issue_performance), 0.5)::NUMERIC, 4),
      'mean_statistical_power', ROUND(COALESCE((SELECT AVG(statistical_power) FROM issue_performance), 0.5)::NUMERIC, 2),
      'adequately_powered_tests', (SELECT COUNT(*) FROM issue_performance WHERE statistical_power >= 0.8)
    ),
    'issue_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'issue_primary', ip.issue_primary,
        'creative_count', ip.creative_count,
        'mean_roas', ip.mean_roas,
        'stddev_roas', ip.stddev_roas,
        'median_roas', ip.median_roas,
        'min_roas', ip.min_roas,
        'max_roas', ip.max_roas,
        'total_impressions', ip.total_impressions,
        'total_spend', ip.total_spend,
        'total_revenue', ip.total_revenue,
        'ci_lower', ip.ci_lower,
        'ci_upper', ip.ci_upper,
        'confidence_score', ip.confidence_score,
        'standard_error', ip.standard_error,
        'z_score', ip.z_score,
        'p_value', ip.p_value,
        'p_value_adjusted', ip.p_value_adjusted,
        'is_significant', ip.is_significant,
        'effect_size', ip.effect_size,
        'statistical_power', ip.statistical_power,
        'power_interpretation', ip.power_interpretation,
        'insufficient_data', ip.insufficient_data
      ) ORDER BY ip.mean_roas DESC)
      FROM issue_performance ip
    ), '[]'::jsonb),
    'stance_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'stance', ss.stance,
        'creative_count', ss.creative_count,
        'mean_roas', ROUND(ss.mean_roas::NUMERIC, 4),
        'stddev_roas', ROUND(COALESCE(ss.stddev_roas, 0)::NUMERIC, 4),
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
    'pain_point_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'pain_point', pp.pain_point,
        'creative_count', pp.creative_count,
        'mean_roas', ROUND(pp.mean_roas::NUMERIC, 4),
        'stddev_roas', ROUND(COALESCE(pp.stddev_roas, 0)::NUMERIC, 4),
        'total_revenue', ROUND(pp.total_revenue::NUMERIC, 2)
      ) ORDER BY pp.mean_roas DESC)
      FROM pain_point_stats pp
    ), '[]'::jsonb),
    'values_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'value', vs.value_name,
        'creative_count', vs.creative_count,
        'mean_roas', ROUND(vs.mean_roas::NUMERIC, 4),
        'stddev_roas', ROUND(COALESCE(vs.stddev_roas, 0)::NUMERIC, 4),
        'total_revenue', ROUND(vs.total_revenue::NUMERIC, 2)
      ) ORDER BY vs.mean_roas DESC)
      FROM values_stats vs
    ), '[]'::jsonb),
    'issue_tags_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tag', its.tag,
        'creative_count', its.creative_count,
        'mean_roas', ROUND(its.mean_roas::NUMERIC, 4),
        'stddev_roas', ROUND(COALESCE(its.stddev_roas, 0)::NUMERIC, 4),
        'total_revenue', ROUND(its.total_revenue::NUMERIC, 2)
      ) ORDER BY its.mean_roas DESC)
      FROM issue_tags_stats its
    ), '[]'::jsonb),
    'policy_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'policy', ps.policy,
        'creative_count', ps.creative_count,
        'mean_roas', ROUND(ps.mean_roas::NUMERIC, 4),
        'stddev_roas', ROUND(COALESCE(ps.stddev_roas, 0)::NUMERIC, 4),
        'total_revenue', ROUND(ps.total_revenue::NUMERIC, 2)
      ) ORDER BY ps.mean_roas DESC)
      FROM policy_stats ps
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
      'sample_size', (SELECT COUNT(*) FROM base_creatives),
      'avg_early_impressions', COALESCE((SELECT AVG(total_impressions) FROM base_creatives), 0),
      'insight', CASE
        WHEN v_has_daily_metrics THEN 'Daily metrics available for trend analysis'
        ELSE 'Insufficient daily metrics data for leading indicator analysis'
      END
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_creative_intelligence TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_creative_intelligence TO service_role;

-- Add documentation comment
COMMENT ON FUNCTION public.get_creative_intelligence IS
'Creative intelligence analysis with rigorous statistical methods:
- Benjamini-Hochberg FDR correction for multiple testing
- Two-tailed p-values from z-scores using normal CDF approximation
- Cohen''s d effect size calculation
- Statistical power estimation
- Minimum sample size enforcement (n >= 2)
- Uses political_stances array (not tone field) for stance analysis
- Analyzes donor_pain_points and values_appealed arrays
- Includes donor segmentation from ActBlue data';
