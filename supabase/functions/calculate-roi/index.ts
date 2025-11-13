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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, start_date, end_date } = await req.json();

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    // Default to last 30 days if no dates provided
    const endDateObj = end_date ? new Date(end_date) : new Date();
    const startDateObj = start_date ? new Date(start_date) : new Date(endDateObj.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDateStr = startDateObj.toISOString().split('T')[0];
    const endDateStr = endDateObj.toISOString().split('T')[0];

    console.log(`Calculating ROI for organization ${organization_id} from ${startDateStr} to ${endDateStr}`);

    // Generate list of dates
    const dates: string[] = [];
    const currentDate = new Date(startDateObj);
    while (currentDate <= endDateObj) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process each date
    for (const date of dates) {
      // Fetch Meta Ads spend for the date
      const { data: metaMetrics } = await supabase
        .from('meta_ad_metrics')
        .select('spend, impressions, clicks')
        .eq('organization_id', organization_id)
        .eq('date', date);

      const totalAdSpend = metaMetrics?.reduce((sum, m) => sum + parseFloat(m.spend || '0'), 0) || 0;
      const totalImpressions = metaMetrics?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0;
      const totalClicks = metaMetrics?.reduce((sum, m) => sum + (m.clicks || 0), 0) || 0;

      // Fetch SMS costs for the date
      const { data: smsMetrics } = await supabase
        .from('sms_campaign_metrics')
        .select('cost, messages_sent, conversions')
        .eq('organization_id', organization_id)
        .eq('date', date);

      const totalSmsCost = smsMetrics?.reduce((sum, m) => sum + parseFloat(m.cost || '0'), 0) || 0;
      const totalSmsSent = smsMetrics?.reduce((sum, m) => sum + (m.messages_sent || 0), 0) || 0;
      const totalSmsConversions = smsMetrics?.reduce((sum, m) => sum + (m.conversions || 0), 0) || 0;

      // Fetch ActBlue donations for the date
      const { data: transactions } = await supabase
        .from('actblue_transactions')
        .select('amount, donor_email')
        .eq('organization_id', organization_id)
        .eq('transaction_type', 'donation')
        .gte('transaction_date', `${date}T00:00:00`)
        .lt('transaction_date', `${date}T23:59:59`);

      const totalFundsRaised = transactions?.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0) || 0;
      const totalDonations = transactions?.length || 0;

      // Calculate unique donors (new donors for this date)
      const uniqueEmails = new Set(transactions?.map(t => t.donor_email).filter(Boolean));
      const newDonors = uniqueEmails.size;

      // Calculate ROI
      const totalSpent = totalAdSpend + totalSmsCost;
      const roiPercentage = totalSpent > 0 
        ? ((totalFundsRaised - totalSpent) / totalSpent) * 100
        : 0;

      // Upsert aggregated metrics
      const { error: upsertError } = await supabase
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
        console.error(`Error storing aggregated metrics for ${date}:`, upsertError);
      } else {
        console.log(`Aggregated metrics calculated for ${date}: Raised $${totalFundsRaised}, Spent $${totalSpent}, ROI ${roiPercentage.toFixed(2)}%`);
      }
    }

    console.log('ROI calculation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        dates_processed: dates.length,
        message: 'ROI calculation completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in calculate-roi:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
