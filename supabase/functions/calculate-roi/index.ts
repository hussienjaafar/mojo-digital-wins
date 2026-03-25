import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

// SECURITY: Restrict CORS to known origins
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || 'https://lovable.dev',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // SECURITY: Extract user's JWT and create client with their context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT for RLS enforcement
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { organization_id, start_date, end_date } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify user belongs to the organization
    const { data: userAccess, error: accessError } = await supabase
      .from('client_users')
      .select('organization_id')
      .eq('id', user.id)
      .eq('organization_id', organization_id)
      .maybeSingle();

    // Also check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!userAccess && !isAdmin) {
      console.error('[SECURITY] User not authorized for organization:', organization_id);
      return new Response(
        JSON.stringify({ error: 'Access denied to this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for writes and org lookups (after auth check)
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fetch organization timezone for accurate date calculations
    const { data: orgData } = await serviceClient
      .from('client_organizations')
      .select('org_timezone')
      .eq('id', organization_id)
      .single();
    
    const orgTimezone = orgData?.org_timezone || 'America/New_York';
    console.log(`[ROI] Using timezone: ${orgTimezone} for organization ${organization_id}`);

    // Default to last 30 days if no dates provided
    const endDateObj = end_date ? new Date(end_date) : new Date();
    const startDateObj = start_date ? new Date(start_date) : new Date(endDateObj.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDateStr = startDateObj.toISOString().split('T')[0];
    const endDateStr = endDateObj.toISOString().split('T')[0];

    console.log(`[ROI] Calculating for organization ${organization_id} from ${startDateStr} to ${endDateStr}`);

    // Generate list of dates
    const dates: string[] = [];
    const currentDate = new Date(startDateObj);
    while (currentDate <= endDateObj) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process each date
    for (const date of dates) {
      // Fetch Meta Ads spend for the date (RLS will filter by org)
      const { data: metaMetrics } = await supabase
        .from('meta_ad_metrics')
        .select('spend, impressions, clicks')
        .eq('organization_id', organization_id)
        .eq('date', date);

      const totalAdSpend = metaMetrics?.reduce((sum, m) => sum + parseFloat(m.spend || '0'), 0) || 0;
      const totalImpressions = metaMetrics?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0;
      const totalClicks = metaMetrics?.reduce((sum, m) => sum + (m.clicks || 0), 0) || 0;

      // Fetch SMS costs for the date (using sms_campaigns, not sms_campaign_metrics)
      // Note: sms_campaigns uses send_date as the date field
      const { data: smsCampaigns } = await supabase
        .from('sms_campaigns')
        .select('cost, messages_sent, conversions')
        .eq('organization_id', organization_id)
        .gte('send_date', `${date}T00:00:00`)
        .lt('send_date', `${date}T23:59:59.999`)
        .neq('status', 'draft');

      const totalSmsCost = smsCampaigns?.reduce((sum, m) => sum + parseFloat(m.cost || '0'), 0) || 0;
      const totalSmsSent = smsCampaigns?.reduce((sum, m) => sum + (m.messages_sent || 0), 0) || 0;
      const totalSmsConversions = smsCampaigns?.reduce((sum, m) => sum + (m.conversions || 0), 0) || 0;

      // Fetch ActBlue transactions for the date using timezone-aware RPC
      // This ensures consistent results with what the dashboard shows
      const { data: periodSummary } = await serviceClient.rpc('get_actblue_period_summary', {
        p_organization_id: organization_id,
        p_start_date: date,
        p_end_date: date
      });

      // Also fetch raw transactions for unique donor calculation
      // Use timezone-aware date conversion in SQL via the secure view
      const { data: transactions } = await serviceClient
        .from('actblue_transactions_secure')
        .select('amount, net_amount, donor_email, transaction_type, transaction_date')
        .eq('organization_id', organization_id)
        .gte('transaction_date', `${date}T00:00:00`)
        .lt('transaction_date', `${date}T23:59:59.999`);

      // Use RPC data when available (timezone-aware), fallback to raw calculation
      let totalFundsRaised: number;
      let totalDonations: number;
      let newDonors: number;
      let refundAmount = 0;

      if (periodSummary && periodSummary.length > 0) {
        // Use the timezone-aware RPC results
        const summary = periodSummary[0];
        totalFundsRaised = parseFloat(summary.net_raised || '0');
        totalDonations = parseInt(summary.total_donations || '0', 10);
        newDonors = parseInt(summary.unique_donors || '0', 10);
        refundAmount = parseFloat(summary.refund_total || '0');
      } else {
        // Fallback: Calculate from raw transactions
        const donations = (transactions || []).filter((t: any) => t.transaction_type === 'donation');
        const refunds = (transactions || []).filter((t: any) => t.transaction_type === 'refund' || t.transaction_type === 'cancellation');

        const grossDonations = donations.reduce((sum: number, t: any) => sum + parseFloat(t.net_amount || t.amount || '0'), 0);
        refundAmount = refunds.reduce((sum: number, t: any) => sum + Math.abs(parseFloat(t.net_amount || t.amount || '0')), 0);
        totalFundsRaised = grossDonations - refundAmount;
        totalDonations = donations.length;

        const uniqueEmails = new Set(donations.map((t: any) => t.donor_email).filter(Boolean));
        newDonors = uniqueEmails.size;
      }

      // Calculate ROI using net revenue
      const totalSpent = totalAdSpend + totalSmsCost;
      const roiPercentage = totalSpent > 0
        ? ((totalFundsRaised - totalSpent) / totalSpent) * 100
        : 0;

      // Log refund impact for observability
      if (refundAmount > 0) {
        console.log(`[ROI] ${date}: Refund/cancellation amount: $${refundAmount.toFixed(2)}`);
      }

      // Upsert aggregated metrics using service role
      const { error: upsertError } = await serviceClient
        .from('daily_aggregated_metrics')
        .upsert({
          organization_id,
          date,
          total_ad_spend: totalAdSpend,
          total_sms_cost: totalSmsCost,
          total_funds_raised: totalFundsRaised,
          total_donations: totalDonations,
          new_donors: newDonors,
          roi_percentage: roiPercentage,
          meta_impressions: totalImpressions,
          meta_clicks: totalClicks,
          sms_sent: totalSmsSent,
          sms_conversions: totalSmsConversions,
          calculated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,date'
        });

      if (upsertError) {
        console.error(`[ROI] Error storing metrics for ${date}:`, upsertError);
      } else {
        console.log(`[ROI] Metrics calculated for ${date}: Raised $${totalFundsRaised}, Spent $${totalSpent}, ROI ${roiPercentage.toFixed(2)}%`);
      }
    }

    console.log('[ROI] Calculation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        dates_processed: dates.length,
        message: 'ROI calculation completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ROI] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
