-- ============================================================================
-- Fix timezone handling in ActBlue RPCs
-- Issue: RPCs were using UTC date boundaries instead of org timezone
-- This caused transactions from 7pm-midnight EST to appear on the wrong day
-- ============================================================================

-- Drop and recreate get_actblue_daily_rollup with timezone-aware filtering
CREATE OR REPLACE FUNCTION public.get_actblue_daily_rollup(
    _organization_id UUID,
    _start_date DATE,
    _end_date DATE
)
RETURNS TABLE (
    day DATE,
    gross_raised NUMERIC,
    net_raised NUMERIC,
    refunds NUMERIC,
    net_revenue NUMERIC,
    total_fees NUMERIC,
    donation_count BIGINT,
    unique_donors BIGINT,
    refund_count BIGINT,
    recurring_count BIGINT,
    one_time_count BIGINT,
    recurring_revenue NUMERIC,
    one_time_revenue NUMERIC,
    fee_percentage NUMERIC,
    refund_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_timezone TEXT;
BEGIN
    -- Get organization timezone (default to America/New_York)
    SELECT COALESCE(org_timezone, 'America/New_York')
    INTO v_timezone
    FROM client_organizations
    WHERE id = _organization_id;
    
    IF v_timezone IS NULL THEN
        v_timezone := 'America/New_York';
    END IF;

    RETURN QUERY
    WITH txns AS (
        SELECT
            -- Convert UTC timestamp to org timezone, then extract date
            (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE AS local_day,
            t.amount,
            t.net_amount,
            t.fee,
            t.transaction_type,
            t.is_recurring,
            t.donor_email
        FROM actblue_transactions t
        WHERE t.organization_id = _organization_id
          -- Filter by org-local date range
          AND (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE 
              BETWEEN _start_date AND _end_date
    ),
    daily_agg AS (
        SELECT
            txns.local_day,
            -- Gross: sum of donation amounts only (not refunds)
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN amount ELSE 0 END), 0) AS gross,
            -- Net raised: sum of net_amount for donations only
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS net,
            -- Refunds: absolute value of refund amounts
            COALESCE(SUM(CASE WHEN transaction_type IN ('refund', 'cancellation') THEN ABS(COALESCE(net_amount, amount)) ELSE 0 END), 0) AS refund_total,
            -- Fees from donations
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN COALESCE(fee, 0) ELSE 0 END), 0) AS fees,
            -- Counts
            COUNT(*) FILTER (WHERE transaction_type = 'donation') AS don_count,
            COUNT(DISTINCT CASE WHEN transaction_type = 'donation' THEN donor_email END) AS uniq_donors,
            COUNT(*) FILTER (WHERE transaction_type IN ('refund', 'cancellation')) AS ref_count,
            COUNT(*) FILTER (WHERE transaction_type = 'donation' AND is_recurring = true) AS rec_count,
            COUNT(*) FILTER (WHERE transaction_type = 'donation' AND (is_recurring IS NULL OR is_recurring = false)) AS onetime_count,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' AND is_recurring = true THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS rec_rev,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' AND (is_recurring IS NULL OR is_recurring = false) THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS onetime_rev
        FROM txns
        GROUP BY txns.local_day
    )
    SELECT
        d.local_day AS day,
        d.gross AS gross_raised,
        d.net AS net_raised,
        d.refund_total AS refunds,
        (d.net - d.refund_total) AS net_revenue,
        d.fees AS total_fees,
        d.don_count AS donation_count,
        d.uniq_donors AS unique_donors,
        d.ref_count AS refund_count,
        d.rec_count AS recurring_count,
        d.onetime_count AS one_time_count,
        d.rec_rev AS recurring_revenue,
        d.onetime_rev AS one_time_revenue,
        CASE WHEN d.gross > 0 THEN ROUND((d.fees / d.gross) * 100, 2) ELSE 0 END AS fee_percentage,
        CASE WHEN d.gross > 0 THEN ROUND((d.refund_total / d.gross) * 100, 2) ELSE 0 END AS refund_rate
    FROM daily_agg d
    ORDER BY d.local_day;
END;
$$;

-- Drop and recreate get_actblue_period_summary with timezone-aware filtering
CREATE OR REPLACE FUNCTION public.get_actblue_period_summary(
    _organization_id UUID,
    _start_date DATE,
    _end_date DATE
)
RETURNS TABLE (
    gross_raised NUMERIC,
    net_raised NUMERIC,
    refunds NUMERIC,
    net_revenue NUMERIC,
    total_fees NUMERIC,
    donation_count BIGINT,
    unique_donors_approx BIGINT,
    refund_count BIGINT,
    recurring_count BIGINT,
    one_time_count BIGINT,
    recurring_revenue NUMERIC,
    one_time_revenue NUMERIC,
    avg_fee_percentage NUMERIC,
    refund_rate NUMERIC,
    avg_donation NUMERIC,
    days_with_donations BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_timezone TEXT;
BEGIN
    -- Get organization timezone (default to America/New_York)
    SELECT COALESCE(org_timezone, 'America/New_York')
    INTO v_timezone
    FROM client_organizations
    WHERE id = _organization_id;
    
    IF v_timezone IS NULL THEN
        v_timezone := 'America/New_York';
    END IF;

    RETURN QUERY
    WITH txns AS (
        SELECT
            (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE AS local_day,
            t.amount,
            t.net_amount,
            t.fee,
            t.transaction_type,
            t.is_recurring,
            t.donor_email
        FROM actblue_transactions t
        WHERE t.organization_id = _organization_id
          AND (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE 
              BETWEEN _start_date AND _end_date
    ),
    agg AS (
        SELECT
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN amount ELSE 0 END), 0) AS gross,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS net,
            COALESCE(SUM(CASE WHEN transaction_type IN ('refund', 'cancellation') THEN ABS(COALESCE(net_amount, amount)) ELSE 0 END), 0) AS refund_total,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN COALESCE(fee, 0) ELSE 0 END), 0) AS fees,
            COUNT(*) FILTER (WHERE transaction_type = 'donation') AS don_count,
            COUNT(DISTINCT CASE WHEN transaction_type = 'donation' THEN donor_email END) AS uniq_donors,
            COUNT(*) FILTER (WHERE transaction_type IN ('refund', 'cancellation')) AS ref_count,
            COUNT(*) FILTER (WHERE transaction_type = 'donation' AND is_recurring = true) AS rec_count,
            COUNT(*) FILTER (WHERE transaction_type = 'donation' AND (is_recurring IS NULL OR is_recurring = false)) AS onetime_count,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' AND is_recurring = true THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS rec_rev,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' AND (is_recurring IS NULL OR is_recurring = false) THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS onetime_rev,
            COUNT(DISTINCT CASE WHEN transaction_type = 'donation' THEN local_day END) AS days_active
        FROM txns
    )
    SELECT
        a.gross AS gross_raised,
        a.net AS net_raised,
        a.refund_total AS refunds,
        (a.net - a.refund_total) AS net_revenue,
        a.fees AS total_fees,
        a.don_count AS donation_count,
        a.uniq_donors AS unique_donors_approx,
        a.ref_count AS refund_count,
        a.rec_count AS recurring_count,
        a.onetime_count AS one_time_count,
        a.rec_rev AS recurring_revenue,
        a.onetime_rev AS one_time_revenue,
        CASE WHEN a.gross > 0 THEN ROUND((a.fees / a.gross) * 100, 2) ELSE 0 END AS avg_fee_percentage,
        CASE WHEN a.gross > 0 THEN ROUND((a.refund_total / a.gross) * 100, 2) ELSE 0 END AS refund_rate,
        CASE WHEN a.don_count > 0 THEN ROUND(a.gross / a.don_count, 2) ELSE 0 END AS avg_donation,
        a.days_active AS days_with_donations
    FROM agg a;
END;
$$;

-- Drop and recreate get_actblue_filtered_rollup with timezone-aware filtering
CREATE OR REPLACE FUNCTION public.get_actblue_filtered_rollup(
    p_org_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_campaign_id TEXT DEFAULT NULL,
    p_creative_id TEXT DEFAULT NULL,
    p_timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
    day DATE,
    gross_raised NUMERIC,
    net_raised NUMERIC,
    refund_amount NUMERIC,
    transaction_count BIGINT,
    refund_count BIGINT,
    unique_donors BIGINT,
    recurring_count BIGINT,
    recurring_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_timezone TEXT;
BEGIN
    -- Use provided timezone or get from org, default to America/New_York
    IF p_timezone IS NOT NULL AND p_timezone != '' THEN
        v_timezone := p_timezone;
    ELSE
        SELECT COALESCE(org_timezone, 'America/New_York')
        INTO v_timezone
        FROM client_organizations
        WHERE id = p_org_id;
        
        IF v_timezone IS NULL THEN
            v_timezone := 'America/New_York';
        END IF;
    END IF;

    RETURN QUERY
    WITH filtered_txns AS (
        SELECT
            t.id,
            (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE AS local_day,
            t.amount,
            t.net_amount,
            t.transaction_type,
            t.is_recurring,
            t.donor_email
        FROM actblue_transactions t
        LEFT JOIN donation_attribution da ON da.transaction_id = t.id AND da.organization_id = t.organization_id
        WHERE t.organization_id = p_org_id
          AND (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE 
              BETWEEN p_start_date AND p_end_date
          -- Apply campaign filter if provided
          AND (p_campaign_id IS NULL OR da.attributed_campaign_id = p_campaign_id)
          -- Apply creative filter if provided
          AND (p_creative_id IS NULL OR da.attributed_creative_id = p_creative_id)
    ),
    daily_agg AS (
        SELECT
            ft.local_day,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN amount ELSE 0 END), 0) AS gross,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS net,
            COALESCE(SUM(CASE WHEN transaction_type IN ('refund', 'cancellation') THEN ABS(COALESCE(net_amount, amount)) ELSE 0 END), 0) AS refunds,
            COUNT(*) FILTER (WHERE transaction_type = 'donation') AS txn_count,
            COUNT(*) FILTER (WHERE transaction_type IN ('refund', 'cancellation')) AS ref_count,
            COUNT(DISTINCT CASE WHEN transaction_type = 'donation' THEN donor_email END) AS uniq_donors,
            COUNT(*) FILTER (WHERE transaction_type = 'donation' AND is_recurring = true) AS rec_count,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' AND is_recurring = true THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS rec_amount
        FROM filtered_txns ft
        GROUP BY ft.local_day
    )
    SELECT
        d.local_day AS day,
        d.gross AS gross_raised,
        d.net AS net_raised,
        d.refunds AS refund_amount,
        d.txn_count AS transaction_count,
        d.ref_count AS refund_count,
        d.uniq_donors AS unique_donors,
        d.rec_count AS recurring_count,
        d.rec_amount AS recurring_amount
    FROM daily_agg d
    ORDER BY d.local_day;
END;
$$;

-- Update get_actblue_dashboard_metrics with timezone-aware filtering
CREATE OR REPLACE FUNCTION public.get_actblue_dashboard_metrics(
    p_org_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_campaign_id TEXT DEFAULT NULL,
    p_creative_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_timezone TEXT;
    v_result JSON;
BEGIN
    -- Get organization timezone
    SELECT COALESCE(org_timezone, 'America/New_York')
    INTO v_timezone
    FROM client_organizations
    WHERE id = p_org_id;
    
    IF v_timezone IS NULL THEN
        v_timezone := 'America/New_York';
    END IF;

    WITH base_txns AS (
        SELECT
            t.id,
            (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE AS local_day,
            t.amount,
            t.net_amount,
            t.fee,
            t.transaction_type,
            t.is_recurring,
            t.donor_email,
            t.refcode,
            t.source_campaign,
            t.click_id,
            t.fbclid,
            da.attribution_method,
            da.attributed_campaign_id,
            da.attributed_creative_id
        FROM actblue_transactions t
        LEFT JOIN donation_attribution da ON da.transaction_id = t.id AND da.organization_id = t.organization_id
        WHERE t.organization_id = p_org_id
          AND (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE 
              BETWEEN p_start_date AND p_end_date
          AND (p_campaign_id IS NULL OR da.attributed_campaign_id = p_campaign_id)
          AND (p_creative_id IS NULL OR da.attributed_creative_id = p_creative_id)
    ),
    prev_txns AS (
        SELECT
            t.id,
            t.donor_email
        FROM actblue_transactions t
        LEFT JOIN donation_attribution da ON da.transaction_id = t.id AND da.organization_id = t.organization_id
        WHERE t.organization_id = p_org_id
          AND (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE 
              BETWEEN (p_start_date - (p_end_date - p_start_date + 1)) AND (p_start_date - 1)
          AND (p_campaign_id IS NULL OR da.attributed_campaign_id = p_campaign_id)
          AND (p_creative_id IS NULL OR da.attributed_creative_id = p_creative_id)
          AND t.transaction_type = 'donation'
    ),
    summary AS (
        SELECT
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN amount ELSE 0 END), 0) AS gross_raised,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS net_raised,
            COALESCE(SUM(CASE WHEN transaction_type IN ('refund', 'cancellation') THEN ABS(COALESCE(net_amount, amount)) ELSE 0 END), 0) AS refund_amount,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN COALESCE(fee, 0) ELSE 0 END), 0) AS total_fees,
            COUNT(*) FILTER (WHERE transaction_type = 'donation') AS donation_count,
            COUNT(*) FILTER (WHERE transaction_type IN ('refund', 'cancellation')) AS refund_count,
            COUNT(DISTINCT CASE WHEN transaction_type = 'donation' THEN donor_email END) AS unique_donors,
            COUNT(*) FILTER (WHERE transaction_type = 'donation' AND is_recurring = true) AS recurring_count,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' AND is_recurring = true THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS recurring_revenue
        FROM base_txns
    ),
    daily AS (
        SELECT
            local_day,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN amount ELSE 0 END), 0) AS gross,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS net,
            COALESCE(SUM(CASE WHEN transaction_type IN ('refund', 'cancellation') THEN ABS(COALESCE(net_amount, amount)) ELSE 0 END), 0) AS refunds,
            COUNT(*) FILTER (WHERE transaction_type = 'donation') AS donations,
            COUNT(DISTINCT CASE WHEN transaction_type = 'donation' THEN donor_email END) AS donors
        FROM base_txns
        GROUP BY local_day
        ORDER BY local_day
    ),
    channel_breakdown AS (
        SELECT
            CASE 
                WHEN attribution_method IN ('click_id', 'fbclid', 'refcode_meta') THEN 'meta'
                WHEN attribution_method IN ('sms_click', 'refcode_sms') THEN 'sms'
                WHEN attribution_method = 'email' THEN 'email'
                WHEN attribution_method IS NOT NULL THEN 'other'
                ELSE 'direct'
            END AS channel,
            COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN amount ELSE 0 END), 0) AS gross,
            COUNT(*) FILTER (WHERE transaction_type = 'donation') AS count
        FROM base_txns
        GROUP BY 1
    ),
    prev_donors AS (
        SELECT DISTINCT donor_email FROM prev_txns
    ),
    donor_breakdown AS (
        SELECT
            COUNT(DISTINCT CASE WHEN transaction_type = 'donation' AND donor_email NOT IN (SELECT donor_email FROM prev_donors WHERE donor_email IS NOT NULL) THEN donor_email END) AS new_donors,
            COUNT(DISTINCT CASE WHEN transaction_type = 'donation' AND donor_email IN (SELECT donor_email FROM prev_donors WHERE donor_email IS NOT NULL) THEN donor_email END) AS returning_donors
        FROM base_txns
        WHERE donor_email IS NOT NULL
    )
    SELECT json_build_object(
        'summary', (SELECT row_to_json(summary) FROM summary),
        'daily', (SELECT COALESCE(json_agg(row_to_json(daily) ORDER BY daily.local_day), '[]'::json) FROM daily),
        'channels', (SELECT COALESCE(json_agg(row_to_json(channel_breakdown)), '[]'::json) FROM channel_breakdown),
        'donors', (SELECT row_to_json(donor_breakdown) FROM donor_breakdown),
        'timezone', v_timezone
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- Update get_sms_metrics with timezone-aware filtering
CREATE OR REPLACE FUNCTION public.get_sms_metrics(
    p_org_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_timezone TEXT;
    v_result JSON;
BEGIN
    -- Get organization timezone
    SELECT COALESCE(org_timezone, 'America/New_York')
    INTO v_timezone
    FROM client_organizations
    WHERE id = p_org_id;
    
    IF v_timezone IS NULL THEN
        v_timezone := 'America/New_York';
    END IF;

    WITH sms_data AS (
        SELECT
            (send_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE AS local_day,
            messages_sent,
            conversions,
            cost,
            amount_raised,
            campaign_name,
            audience_size
        FROM sms_campaigns
        WHERE organization_id = p_org_id
          AND (send_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE 
              BETWEEN p_start_date AND p_end_date
          AND status != 'draft'
    ),
    summary AS (
        SELECT
            COALESCE(SUM(messages_sent), 0) AS total_messages,
            COALESCE(SUM(conversions), 0) AS total_conversions,
            COALESCE(SUM(cost), 0) AS total_cost,
            COALESCE(SUM(amount_raised), 0) AS total_raised,
            COUNT(*) AS campaign_count
        FROM sms_data
    ),
    daily AS (
        SELECT
            local_day,
            SUM(messages_sent) AS messages,
            SUM(conversions) AS conversions,
            SUM(cost) AS cost,
            SUM(amount_raised) AS raised
        FROM sms_data
        GROUP BY local_day
        ORDER BY local_day
    ),
    campaigns AS (
        SELECT
            campaign_name,
            local_day AS send_date,
            messages_sent,
            conversions,
            cost,
            amount_raised,
            audience_size
        FROM sms_data
        ORDER BY local_day DESC
    )
    SELECT json_build_object(
        'summary', (SELECT row_to_json(summary) FROM summary),
        'daily', (SELECT COALESCE(json_agg(row_to_json(daily) ORDER BY daily.local_day), '[]'::json) FROM daily),
        'campaigns', (SELECT COALESCE(json_agg(row_to_json(campaigns)), '[]'::json) FROM campaigns),
        'timezone', v_timezone
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- Create debug function to compare UTC vs timezone-aware totals
CREATE OR REPLACE FUNCTION public.debug_timezone_totals(
    p_org_id UUID,
    p_date DATE
)
RETURNS TABLE (
    method TEXT,
    total_gross NUMERIC,
    total_net NUMERIC,
    donation_count BIGINT,
    timezone_used TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_timezone TEXT;
BEGIN
    -- Get organization timezone
    SELECT COALESCE(org_timezone, 'America/New_York')
    INTO v_timezone
    FROM client_organizations
    WHERE id = p_org_id;
    
    IF v_timezone IS NULL THEN
        v_timezone := 'America/New_York';
    END IF;

    -- Return UTC-based totals
    RETURN QUERY
    SELECT
        'utc_date'::TEXT AS method,
        COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN amount ELSE 0 END), 0) AS total_gross,
        COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS total_net,
        COUNT(*) FILTER (WHERE transaction_type = 'donation') AS donation_count,
        'UTC'::TEXT AS timezone_used
    FROM actblue_transactions
    WHERE organization_id = p_org_id
      AND transaction_date::DATE = p_date;
    
    -- Return timezone-aware totals
    RETURN QUERY
    SELECT
        'org_timezone'::TEXT AS method,
        COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN amount ELSE 0 END), 0) AS total_gross,
        COALESCE(SUM(CASE WHEN transaction_type = 'donation' THEN COALESCE(net_amount, amount) ELSE 0 END), 0) AS total_net,
        COUNT(*) FILTER (WHERE transaction_type = 'donation') AS donation_count,
        v_timezone AS timezone_used
    FROM actblue_transactions
    WHERE organization_id = p_org_id
      AND (transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE = p_date;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_actblue_daily_rollup(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_actblue_period_summary(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_actblue_filtered_rollup(UUID, DATE, DATE, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_actblue_dashboard_metrics(UUID, DATE, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sms_metrics(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_timezone_totals(UUID, DATE) TO authenticated;