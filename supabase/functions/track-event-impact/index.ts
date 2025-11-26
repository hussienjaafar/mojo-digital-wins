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

    console.log('Starting event-impact correlation tracking...');

    // Get all organizations
    const { data: orgs } = await supabase
      .from('client_organizations')
      .select('id')
      .eq('is_active', true);

    if (!orgs || orgs.length === 0) {
      console.log('No active organizations found');
      return new Response(JSON.stringify({ message: 'No active organizations' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalCorrelations = 0;

    for (const org of orgs) {
      // Get trending topics from last 48 hours
      const { data: trendingTopics } = await supabase
        .from('entity_trends')
        .select('*')
        .eq('organization_id', org.id)
        .gte('trend_window_start', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .gt('velocity', 50)
        .order('velocity', { ascending: false })
        .limit(20);

      if (!trendingTopics || trendingTopics.length === 0) continue;

      for (const topic of trendingTopics) {
        // Get donations in 48 hour window after topic started trending
        const windowStart = new Date(topic.trend_window_start);
        const windowEnd = new Date(windowStart.getTime() + 48 * 60 * 60 * 1000);

        const { data: donations, count } = await supabase
          .from('actblue_transactions')
          .select('amount, transaction_date', { count: 'exact' })
          .eq('organization_id', org.id)
          .gte('transaction_date', windowStart.toISOString())
          .lte('transaction_date', windowEnd.toISOString());

        if (!donations || donations.length === 0) continue;

        const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
        const avgDonation = totalAmount / donations.length;

        // Get baseline (same period from week before)
        const baselineStart = new Date(windowStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        const baselineEnd = new Date(windowEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

        const { data: baselineDonations, count: baselineCount } = await supabase
          .from('actblue_transactions')
          .select('amount', { count: 'exact' })
          .eq('organization_id', org.id)
          .gte('transaction_date', baselineStart.toISOString())
          .lte('transaction_date', baselineEnd.toISOString());

        const baselineAmount = baselineDonations?.reduce((sum, d) => sum + d.amount, 0) || 0;
        const baselineAvg = (baselineCount || 0) > 0 ? baselineAmount / (baselineCount || 1) : 0;

        // Calculate correlation strength
        const donationIncrease = totalAmount - baselineAmount;
        const donationIncreasePercent = baselineAmount > 0 
          ? ((totalAmount - baselineAmount) / baselineAmount) * 100 
          : 0;

        // Store correlation if significant
        if (donationIncreasePercent > 20 || donationIncrease > 1000) {
          const correlationStrength = Math.min(100, 
            (donationIncreasePercent * 0.5) + (topic.velocity * 0.3) + (donations.length * 0.2)
          );

          const { error: insertError } = await supabase
            .from('event_impact_correlations')
            .insert({
              organization_id: org.id,
              entity_name: topic.entity_name,
              entity_type: topic.entity_type,
              event_date: windowStart.toISOString(),
              donations_48h_after: donations.length,
              amount_raised_48h_after: totalAmount,
              avg_donation_48h_after: avgDonation,
              baseline_donations: baselineCount || 0,
              baseline_amount: baselineAmount,
              baseline_avg_donation: baselineAvg,
              correlation_strength: correlationStrength,
              topic_velocity: topic.velocity,
              topic_mentions: topic.current_mentions,
            });

          if (!insertError) {
            totalCorrelations++;
            console.log(`Stored correlation for ${topic.entity_name}: +${donationIncreasePercent.toFixed(1)}%`);
          }
        }
      }
    }

    console.log(`Event-impact tracking complete. Found ${totalCorrelations} correlations.`);

    return new Response(
      JSON.stringify({ 
        success: true,
        correlations_found: totalCorrelations,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in track-event-impact:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
