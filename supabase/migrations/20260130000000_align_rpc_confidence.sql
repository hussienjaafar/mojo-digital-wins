-- ==========================================================
-- ALIGN RPC CONFIDENCE WITH ANALYSIS CONFIDENCE
--
-- Modifies the get_creative_intelligence RPC to combine:
-- 1. Impression-based confidence (data reliability)
-- 2. Analysis confidence from topic extraction (coherence)
--
-- This ensures the UI displays confidence that reflects both
-- how much data we have AND how confident we are in the analysis.
--
-- Reference: Confidence Scoring Audit findings
-- ==========================================================

-- Drop and recreate the function with updated confidence calculation
DROP FUNCTION IF EXISTS get_creative_intelligence(UUID, DATE, DATE, INT, INT, NUMERIC);

CREATE OR REPLACE FUNCTION get_creative_intelligence(
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
AS $$
DECLARE
  v_significance_level NUMERIC := 0.05;
  v_global_mean_roas NUMERIC;
  v_global_stddev_roas NUMERIC;
BEGIN
  -- Calculate global mean and stddev for effect size calculations
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
  -- Now includes analysis_confidence for weighted confidence scoring
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
      1 as days_with_data,
      -- Include analysis confidence for weighted combination
      COALESCE(mci.analysis_confidence, 0.5) as analysis_confidence
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
    HAVING COUNT(*) >= 2
  ),

  -- Calculate confidence intervals, p-values, and confidence scores
  issue_with_ci AS (
    SELECT
      i.*,
      -- Standard error for 95% CI
      CASE WHEN i.creative_count > 1 THEN i.stddev_roas / SQRT(i.creative_count) ELSE NULL END as standard_error,
      -- 95% CI bounds
      i.mean_roas - 1.96 * COALESCE(i.stddev_roas / NULLIF(SQRT(i.creative_count), 0), 0) as ci_lower,
      i.mean_roas + 1.96 * COALESCE(i.stddev_roas / NULLIF(SQRT(i.creative_count), 0), 0) as ci_upper,
      -- Calculate confidence score based on sample size and coefficient of variation
      LEAST(1.0, (i.creative_count::NUMERIC / 10) * (1 - COALESCE(i.stddev_roas, 0) / NULLIF(ABS(i.mean_roas), 0))) as confidence_score
    FROM issue_stats i
  ),

  -- Calculate z-scores and p-values for each issue
  issue_with_pvalues AS (
    SELECT
      iwc.*,
      -- Z-score: (mean - global_mean) / (stddev / sqrt(n))
      CASE
        WHEN iwc.standard_error IS NOT NULL AND iwc.standard_error > 0 THEN
          (iwc.mean_roas - v_global_mean_roas) / iwc.standard_error
        ELSE NULL
      END as z_score,
      -- P-value approximation using z-score (two-tailed)
      CASE
        WHEN iwc.standard_error IS NOT NULL AND iwc.standard_error > 0 THEN
          2 * (1 - (0.5 * (1 + SIGN((iwc.mean_roas - v_global_mean_roas) / iwc.standard_error) *
            SQRT(1 - EXP(-2 * POWER((iwc.mean_roas - v_global_mean_roas) / iwc.standard_error, 2) / 3.14159)))))
        ELSE 1.0
      END as p_value,
      -- Row number for FDR correction
      ROW_NUMBER() OVER (ORDER BY
        CASE
          WHEN iwc.standard_error IS NOT NULL AND iwc.standard_error > 0 THEN
            2 * (1 - (0.5 * (1 + SIGN((iwc.mean_roas - v_global_mean_roas) / iwc.standard_error) *
              SQRT(1 - EXP(-2 * POWER((iwc.mean_roas - v_global_mean_roas) / iwc.standard_error, 2) / 3.14159)))))
          ELSE 1.0
        END
      ) as p_rank,
      COUNT(*) OVER () as total_tests,
      -- Effect size (Cohen's d)
      CASE
        WHEN v_global_stddev_roas > 0 THEN
          (iwc.mean_roas - v_global_mean_roas) / v_global_stddev_roas
        ELSE NULL
      END as effect_size,
      -- Statistical power estimation (simplified)
      CASE
        WHEN iwc.creative_count >= 3 AND v_global_stddev_roas > 0 THEN
          LEAST(1.0, 0.2 + 0.1 * iwc.creative_count + 0.3 * ABS((iwc.mean_roas - v_global_mean_roas) / v_global_stddev_roas))
        ELSE NULL
      END as statistical_power
    FROM issue_with_ci iwc
  ),

  -- Apply FDR correction (Benjamini-Hochberg)
  issue_performance AS (
    SELECT
      iwp.issue_primary,
      iwp.creative_count,
      ROUND(iwp.mean_roas::NUMERIC, 4) as mean_roas,
      ROUND(COALESCE(iwp.stddev_roas, 0)::NUMERIC, 4) as stddev_roas,
      ROUND(iwp.median_roas::NUMERIC, 4) as median_roas,
      ROUND(iwp.min_roas::NUMERIC, 4) as min_roas,
      ROUND(iwp.max_roas::NUMERIC, 4) as max_roas,
      iwp.total_impressions::BIGINT as total_impressions,
      ROUND(iwp.total_spend::NUMERIC, 2) as total_spend,
      ROUND(iwp.total_revenue::NUMERIC, 2) as total_revenue,
      ROUND(COALESCE(iwp.ci_lower, iwp.mean_roas)::NUMERIC, 4) as ci_lower,
      ROUND(COALESCE(iwp.ci_upper, iwp.mean_roas)::NUMERIC, 4) as ci_upper,
      ROUND(COALESCE(iwp.confidence_score, 0.5)::NUMERIC, 4) as confidence_score,
      -- FDR-corrected values
      ROUND(COALESCE(iwp.standard_error, 0)::NUMERIC, 6) as standard_error,
      ROUND(COALESCE(iwp.z_score, 0)::NUMERIC, 4) as z_score,
      ROUND(COALESCE(iwp.p_value, 1.0)::NUMERIC, 6) as p_value,
      -- Benjamini-Hochberg adjusted p-value
      ROUND(LEAST(1.0, iwp.p_value * iwp.total_tests / iwp.p_rank)::NUMERIC, 6) as p_value_adjusted,
      -- Significance after FDR correction
      (LEAST(1.0, iwp.p_value * iwp.total_tests / iwp.p_rank) < v_significance_level) as is_significant,
      -- Effect size and power
      ROUND(COALESCE(iwp.effect_size, 0)::NUMERIC, 4) as effect_size,
      ROUND(COALESCE(iwp.statistical_power, 0)::NUMERIC, 4) as statistical_power,
      CASE
        WHEN iwp.statistical_power >= 0.8 THEN 'Adequately powered'
        WHEN iwp.statistical_power >= 0.5 THEN 'Moderately powered'
        WHEN iwp.statistical_power IS NOT NULL THEN 'Underpowered'
        ELSE 'Insufficient data'
      END as power_interpretation
    FROM issue_with_pvalues iwp
  ),

  -- Stance performance using political_stances array (FIX: was using tone)
  stance_stats AS (
    SELECT
      stance,
      COUNT(*)::INT as creative_count,
      AVG(roas) as mean_roas,
      SUM(total_impressions) as total_impressions,
      SUM(total_spend) as total_spend,
      SUM(total_revenue) as total_revenue
    FROM base_creatives
    CROSS JOIN LATERAL unnest(political_stances) as stance
    WHERE political_stances IS NOT NULL
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
    GROUP BY target
    HAVING COUNT(*) >= 2
  ),

  -- Pain point performance
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
    GROUP BY pain_point
    HAVING COUNT(*) >= 2
  ),

  -- Values performance
  values_stats AS (
    SELECT
      value,
      COUNT(*)::INT as creative_count,
      AVG(roas) as mean_roas,
      STDDEV(roas) as stddev_roas,
      SUM(total_revenue) as total_revenue
    FROM base_creatives
    CROSS JOIN LATERAL unnest(values_appealed) as value
    WHERE values_appealed IS NOT NULL
    GROUP BY value
    HAVING COUNT(*) >= 2
  ),

  -- Issue tags performance
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
    GROUP BY tag
    HAVING COUNT(*) >= 2
  ),

  -- Policy performance
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
    GROUP BY policy
    HAVING COUNT(*) >= 2
  ),

  -- Donor segmentation (political campaign feature)
  donor_segmentation AS (
    SELECT
      COUNT(CASE WHEN amount < 200 THEN 1 END) as small_donor_count,
      SUM(CASE WHEN amount < 200 THEN amount ELSE 0 END) as small_donor_amount,
      COUNT(CASE WHEN amount >= 200 THEN 1 END) as large_donor_count,
      SUM(CASE WHEN amount >= 200 THEN amount ELSE 0 END) as large_donor_amount,
      AVG(amount) as average_donation,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) as median_donation,
      COUNT(*) as total_donors,
      SUM(amount) as total_donations
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND transaction_date >= p_start_date
      AND transaction_date <= p_end_date
  ),

  -- Creative recommendations with ALIGNED confidence
  -- Combines impression-based (60%) and analysis confidence (40%)
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
      -- ALIGNED: Weighted combination of impression-based and analysis confidence
      -- 60% impression-based (data reliability) + 40% analysis confidence (extraction quality)
      LEAST(1.0,
        0.6 * LEAST(1.0, bc.total_impressions::NUMERIC / 10000) +
        0.4 * bc.analysis_confidence
      ) as confidence_score,
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
      'min_early_impressions', 100,
      'confidence_weighting', 'impression:60% + analysis:40%'
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
        'power_interpretation', ip.power_interpretation
      ) ORDER BY ip.mean_roas DESC)
      FROM issue_performance ip
    ), '[]'::JSONB),
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
    ), '[]'::JSONB),
    'target_attacked_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'target', ts.target,
        'creative_count', ts.creative_count,
        'mean_roas', ROUND(ts.mean_roas::NUMERIC, 4),
        'total_revenue', ROUND(ts.total_revenue::NUMERIC, 2)
      ) ORDER BY ts.mean_roas DESC)
      FROM target_stats ts
    ), '[]'::JSONB),
    'pain_point_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'pain_point', pps.pain_point,
        'creative_count', pps.creative_count,
        'mean_roas', ROUND(pps.mean_roas::NUMERIC, 4),
        'stddev_roas', ROUND(COALESCE(pps.stddev_roas, 0)::NUMERIC, 4),
        'total_revenue', ROUND(pps.total_revenue::NUMERIC, 2)
      ) ORDER BY pps.mean_roas DESC)
      FROM pain_point_stats pps
    ), '[]'::JSONB),
    'values_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'value', vs.value,
        'creative_count', vs.creative_count,
        'mean_roas', ROUND(vs.mean_roas::NUMERIC, 4),
        'stddev_roas', ROUND(COALESCE(vs.stddev_roas, 0)::NUMERIC, 4),
        'total_revenue', ROUND(vs.total_revenue::NUMERIC, 2)
      ) ORDER BY vs.mean_roas DESC)
      FROM values_stats vs
    ), '[]'::JSONB),
    'issue_tags_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tag', its.tag,
        'creative_count', its.creative_count,
        'mean_roas', ROUND(its.mean_roas::NUMERIC, 4),
        'stddev_roas', ROUND(COALESCE(its.stddev_roas, 0)::NUMERIC, 4),
        'total_revenue', ROUND(its.total_revenue::NUMERIC, 2)
      ) ORDER BY its.mean_roas DESC)
      FROM issue_tags_stats its
    ), '[]'::JSONB),
    'policy_performance', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'policy', ps.policy,
        'creative_count', ps.creative_count,
        'mean_roas', ROUND(ps.mean_roas::NUMERIC, 4),
        'stddev_roas', ROUND(COALESCE(ps.stddev_roas, 0)::NUMERIC, 4),
        'total_revenue', ROUND(ps.total_revenue::NUMERIC, 2)
      ) ORDER BY ps.mean_roas DESC)
      FROM policy_stats ps
    ), '[]'::JSONB),
    'leading_indicators', jsonb_build_object(
      'correlations', jsonb_build_object(
        'early_ctr_to_roas', 0,
        'early_cpm_to_roas', 0,
        'ctr_correlation_pvalue', null,
        'cpm_correlation_pvalue', null,
        'ctr_correlation_significant', false,
        'cpm_correlation_significant', false
      ),
      'sample_size', 0,
      'avg_early_impressions', 0,
      'insight', 'Insufficient data for leading indicator analysis'
    ),
    'fatigue_alerts', '[]'::JSONB,
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
    ), '[]'::JSONB),
    'recommendation_summary', (SELECT row_to_json(rec_summary.*) FROM rec_summary),
    'data_quality', jsonb_build_object(
      'creatives_with_issue_data', (SELECT COUNT(*) FROM base_creatives WHERE issue_primary IS NOT NULL),
      'creatives_without_issue_data', (SELECT COUNT(*) FROM base_creatives WHERE issue_primary IS NULL),
      'avg_impressions_per_creative', ROUND(COALESCE((SELECT AVG(total_impressions) FROM base_creatives), 0)::NUMERIC, 0),
      'avg_days_active', 1,
      'overall_confidence', CASE
        WHEN (SELECT COUNT(*) FROM base_creatives) >= 10 AND
             (SELECT COUNT(*) FROM base_creatives WHERE issue_primary IS NOT NULL)::NUMERIC /
             NULLIF((SELECT COUNT(*) FROM base_creatives), 0) >= 0.7 THEN 'HIGH'
        WHEN (SELECT COUNT(*) FROM base_creatives) >= 5 THEN 'MEDIUM'
        ELSE 'LOW'
      END
    ),
    'has_daily_metrics', false
  ) INTO STRICT v_global_mean_roas;

  -- Return the result (reusing variable for simplicity)
  RETURN v_global_mean_roas;
END;
$$;

-- Add comment documenting the confidence weighting
COMMENT ON FUNCTION get_creative_intelligence(UUID, DATE, DATE, INT, INT, NUMERIC) IS
  'Returns creative intelligence analytics with FDR-corrected statistical significance.
   Confidence scoring now combines: 60% impression-based (data reliability) + 40% analysis confidence (extraction quality).
   This ensures recommendations reflect both data volume and topic extraction quality.';
