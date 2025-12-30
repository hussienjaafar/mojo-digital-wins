-- Phase 1 & 2: Add video engagement and social engagement columns to meta_creative_insights
ALTER TABLE meta_creative_insights
ADD COLUMN IF NOT EXISTS video_plays integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_thruplay integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_p25 integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_p50 integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_p75 integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_p100 integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_avg_watch_time_seconds numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS reactions_total integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reactions_like integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reactions_love integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reactions_other integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS shares integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS post_engagement integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS frequency numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_ranking text,
ADD COLUMN IF NOT EXISTS engagement_rate_ranking text,
ADD COLUMN IF NOT EXISTS conversion_rate_ranking text;

-- Phase 3: Add SMS reply sentiment columns
ALTER TABLE sms_events
ADD COLUMN IF NOT EXISTS reply_text text,
ADD COLUMN IF NOT EXISTS reply_sentiment text,
ADD COLUMN IF NOT EXISTS reply_intent text,
ADD COLUMN IF NOT EXISTS sentiment_analyzed boolean DEFAULT false;

-- Create index for SMS reply sentiment analysis
CREATE INDEX IF NOT EXISTS idx_sms_events_reply_sentiment 
ON sms_events(organization_id, reply_sentiment) 
WHERE reply_text IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_events_unanalyzed_replies
ON sms_events(organization_id)
WHERE reply_text IS NOT NULL AND sentiment_analyzed = false;

-- Phase 4: Create A/B test performance view
CREATE OR REPLACE VIEW ab_test_performance AS
SELECT 
  organization_id,
  ab_test_name,
  ab_test_variation,
  COUNT(*) as donations,
  SUM(amount) as total_raised,
  AVG(amount) as avg_donation,
  SUM(CASE WHEN is_recurring THEN 1 ELSE 0 END) as recurring_donations,
  SUM(net_amount) as net_raised,
  MIN(transaction_date) as first_donation,
  MAX(transaction_date) as last_donation,
  COUNT(DISTINCT donor_email) as unique_donors
FROM actblue_transactions
WHERE ab_test_name IS NOT NULL
  AND transaction_type IS DISTINCT FROM 'refund'
GROUP BY organization_id, ab_test_name, ab_test_variation;

-- Phase 5: Create recurring donor health RPC function
CREATE OR REPLACE FUNCTION get_recurring_health(
  _organization_id uuid,
  _start_date date,
  _end_date date
)
RETURNS TABLE (
  active_recurring bigint,
  paused_recurring bigint,
  cancelled_recurring bigint,
  failed_recurring bigint,
  mrr numeric,
  upsell_shown bigint,
  upsell_succeeded bigint,
  upsell_rate numeric,
  avg_recurring_amount numeric,
  recurring_donor_count bigint,
  total_recurring_revenue numeric
) AS $$
BEGIN
  -- Verify user has access to this organization
  IF NOT (
    public.user_belongs_to_organization(_organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE recurring_state = 'active')::bigint as active_recurring,
    COUNT(*) FILTER (WHERE recurring_state = 'paused')::bigint as paused_recurring,
    COUNT(*) FILTER (WHERE recurring_state IN ('cancelled', 'canceled'))::bigint as cancelled_recurring,
    COUNT(*) FILTER (WHERE recurring_state = 'failed')::bigint as failed_recurring,
    SUM(amount) FILTER (WHERE is_recurring AND recurring_state = 'active' AND transaction_type IS DISTINCT FROM 'refund')::numeric as mrr,
    COUNT(*) FILTER (WHERE recurring_upsell_shown = true)::bigint as upsell_shown,
    COUNT(*) FILTER (WHERE recurring_upsell_succeeded = true)::bigint as upsell_succeeded,
    CASE 
      WHEN COUNT(*) FILTER (WHERE recurring_upsell_shown = true) > 0 
      THEN (COUNT(*) FILTER (WHERE recurring_upsell_succeeded = true)::numeric / 
            COUNT(*) FILTER (WHERE recurring_upsell_shown = true))
      ELSE 0 
    END as upsell_rate,
    AVG(amount) FILTER (WHERE is_recurring AND transaction_type IS DISTINCT FROM 'refund')::numeric as avg_recurring_amount,
    COUNT(DISTINCT donor_email) FILTER (WHERE is_recurring)::bigint as recurring_donor_count,
    SUM(net_amount) FILTER (WHERE is_recurring AND transaction_type IS DISTINCT FROM 'refund')::numeric as total_recurring_revenue
  FROM actblue_transactions
  WHERE organization_id = _organization_id
    AND transaction_date >= _start_date
    AND transaction_date <= _end_date;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;