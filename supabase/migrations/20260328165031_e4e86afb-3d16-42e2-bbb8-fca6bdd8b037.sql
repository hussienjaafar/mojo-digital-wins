
-- RPC: get_refcode_channel_performance
-- Returns refcode-level and channel-level aggregations using attributed_channel
CREATE OR REPLACE FUNCTION public.get_refcode_channel_performance(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH refcode_agg AS (
    SELECT
      COALESCE(refcode, '(no refcode)') AS refcode,
      COALESCE(attributed_channel, 'other') AS channel,
      COUNT(*) AS donation_count,
      COUNT(DISTINCT donor_email) AS unique_donors,
      COALESCE(SUM(amount), 0) AS total_revenue,
      COUNT(*) FILTER (WHERE is_recurring = true) AS recurring_count
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND transaction_type IS DISTINCT FROM 'refund'
    GROUP BY COALESCE(refcode, '(no refcode)'), COALESCE(attributed_channel, 'other')
  ),
  channel_agg AS (
    SELECT
      channel,
      SUM(donation_count) AS donation_count,
      SUM(unique_donors) AS unique_donors,
      SUM(total_revenue) AS total_revenue,
      COUNT(DISTINCT refcode) AS refcode_count
    FROM refcode_agg
    GROUP BY channel
  ),
  donor_stats AS (
    SELECT
      COUNT(DISTINCT donor_email) AS total_donors,
      COUNT(DISTINCT donor_email) FILTER (WHERE cnt > 1) AS repeat_donors,
      COUNT(DISTINCT donor_email) FILTER (WHERE has_recurring) AS recurring_donors
    FROM (
      SELECT
        donor_email,
        COUNT(*) AS cnt,
        BOOL_OR(is_recurring) AS has_recurring
      FROM actblue_transactions
      WHERE organization_id = p_organization_id
        AND transaction_type IS DISTINCT FROM 'refund'
        AND donor_email IS NOT NULL
      GROUP BY donor_email
    ) sub
  )
  SELECT jsonb_build_object(
    'refcodes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'refcode', r.refcode,
        'channel', r.channel,
        'donationCount', r.donation_count,
        'uniqueDonors', r.unique_donors,
        'totalRevenue', r.total_revenue,
        'avgGift', CASE WHEN r.donation_count > 0 THEN ROUND(r.total_revenue / r.donation_count, 2) ELSE 0 END,
        'recurringCount', r.recurring_count,
        'recurringRate', CASE WHEN r.donation_count > 0 THEN ROUND((r.recurring_count::numeric / r.donation_count) * 100, 1) ELSE 0 END
      ) ORDER BY r.total_revenue DESC)
      FROM refcode_agg r
    ), '[]'::jsonb),
    'channels', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'channel', c.channel,
        'label', CASE c.channel
          WHEN 'meta' THEN 'Meta Ads'
          WHEN 'sms' THEN 'SMS'
          WHEN 'email' THEN 'Email'
          WHEN 'organic' THEN 'Organic'
          WHEN 'direct' THEN 'Direct'
          ELSE 'Other'
        END,
        'donationCount', c.donation_count,
        'uniqueDonors', c.unique_donors,
        'totalRevenue', c.total_revenue,
        'avgGift', CASE WHEN c.donation_count > 0 THEN ROUND(c.total_revenue / c.donation_count, 2) ELSE 0 END,
        'refcodeCount', c.refcode_count
      ) ORDER BY c.total_revenue DESC)
      FROM channel_agg c
    ), '[]'::jsonb),
    'retention', (
      SELECT jsonb_build_object(
        'totalDonors', total_donors,
        'repeatDonors', repeat_donors,
        'recurringDonors', recurring_donors,
        'repeatRate', CASE WHEN total_donors > 0 THEN ROUND((repeat_donors::numeric / total_donors) * 100, 1) ELSE 0 END,
        'recurringRate', CASE WHEN total_donors > 0 THEN ROUND((recurring_donors::numeric / total_donors) * 100, 1) ELSE 0 END
      )
      FROM donor_stats
    )
  ) INTO result;

  RETURN result;
END;
$$;
