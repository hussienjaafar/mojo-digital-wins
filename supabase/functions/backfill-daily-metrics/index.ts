import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await anonClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { organization_id, start_date, end_date, all_orgs } = await req.json();

    // Default to last 30 days
    const endDateObj = end_date ? new Date(end_date) : new Date();
    const startDateObj = start_date ? new Date(start_date) : new Date(endDateObj.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDateStr = startDateObj.toISOString().split('T')[0];
    const endDateStr = endDateObj.toISOString().split('T')[0];

    console.log(`[BACKFILL] Starting backfill from ${startDateStr} to ${endDateStr}`);

    // Get organizations to process
    let orgs: { id: string; org_timezone: string | null }[] = [];
    
    if (all_orgs) {
      const { data } = await supabase
        .from('client_organizations')
        .select('id, org_timezone')
        .eq('is_active', true);
      orgs = data || [];
    } else if (organization_id) {
      const { data } = await supabase
        .from('client_organizations')
        .select('id, org_timezone')
        .eq('id', organization_id)
        .single();
      if (data) orgs = [data];
    } else {
      return new Response(
        JSON.stringify({ error: 'organization_id or all_orgs=true required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BACKFILL] Processing ${orgs.length} organization(s)`);

    const results: { org_id: string; dates_processed: number; errors: string[] }[] = [];

    for (const org of orgs) {
      const orgTimezone = org.org_timezone || 'America/New_York';
      const orgErrors: string[] = [];
      let datesProcessed = 0;

      // Generate dates
      const dates: string[] = [];
      const currentDate = new Date(startDateObj);
      while (currentDate <= endDateObj) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      for (const date of dates) {
        try {
          // Use timezone-aware RPC for ActBlue data
          const { data: periodSummary, error: rpcError } = await supabase.rpc('get_actblue_period_summary', {
            p_organization_id: org.id,
            p_start_date: date,
            p_end_date: date
          });

          if (rpcError) {
            console.error(`[BACKFILL] RPC error for ${org.id} on ${date}:`, rpcError);
          }

          // Get Meta Ads spend
          const { data: metaMetrics } = await supabase
            .from('meta_ad_metrics')
            .select('spend, impressions, clicks')
            .eq('organization_id', org.id)
            .eq('date', date);

          const totalAdSpend = metaMetrics?.reduce((sum, m) => sum + parseFloat(m.spend || '0'), 0) || 0;
          const totalImpressions = metaMetrics?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0;
          const totalClicks = metaMetrics?.reduce((sum, m) => sum + (m.clicks || 0), 0) || 0;

          // Get SMS costs
          const { data: smsCampaigns } = await supabase
            .from('sms_campaigns')
            .select('cost, messages_sent, conversions')
            .eq('organization_id', org.id)
            .gte('send_date', `${date}T00:00:00`)
            .lt('send_date', `${date}T23:59:59.999`)
            .neq('status', 'draft');

          const totalSmsCost = smsCampaigns?.reduce((sum, m) => sum + parseFloat(m.cost || '0'), 0) || 0;
          const totalSmsSent = smsCampaigns?.reduce((sum, m) => sum + (m.messages_sent || 0), 0) || 0;
          const totalSmsConversions = smsCampaigns?.reduce((sum, m) => sum + (m.conversions || 0), 0) || 0;

          // Extract ActBlue data from RPC
          let totalFundsRaised = 0;
          let totalDonations = 0;
          let newDonors = 0;

          if (periodSummary && periodSummary.length > 0) {
            const summary = periodSummary[0];
            totalFundsRaised = parseFloat(summary.net_raised || '0');
            totalDonations = parseInt(summary.total_donations || '0', 10);
            newDonors = parseInt(summary.unique_donors || '0', 10);
          }

          // Calculate ROI
          const totalSpent = totalAdSpend + totalSmsCost;
          const roiPercentage = totalSpent > 0
            ? ((totalFundsRaised - totalSpent) / totalSpent) * 100
            : 0;

          // Upsert metrics
          const { error: upsertError } = await supabase
            .from('daily_aggregated_metrics')
            .upsert({
              organization_id: org.id,
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
            orgErrors.push(`${date}: ${upsertError.message}`);
          } else {
            datesProcessed++;
          }
        } catch (err: any) {
          orgErrors.push(`${date}: ${err.message}`);
        }
      }

      results.push({
        org_id: org.id,
        dates_processed: datesProcessed,
        errors: orgErrors
      });

      console.log(`[BACKFILL] Completed ${org.id}: ${datesProcessed} dates, ${orgErrors.length} errors`);
    }

    const totalProcessed = results.reduce((sum, r) => sum + r.dates_processed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    console.log(`[BACKFILL] Complete: ${totalProcessed} dates processed, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        organizations_processed: results.length,
        total_dates_processed: totalProcessed,
        total_errors: totalErrors,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[BACKFILL] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
