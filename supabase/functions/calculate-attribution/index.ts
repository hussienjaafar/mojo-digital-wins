import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log('Starting attribution calculation...');

    // Get transactions from last 30 days that haven't been attributed yet
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: transactions, error: txError } = await supabase
      .from('actblue_transactions')
      .select('*')
      .gte('transaction_date', thirtyDaysAgo)
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (txError) throw txError;

    console.log(`Processing ${transactions?.length || 0} transactions`);

    let attributionsCreated = 0;
    let attributionsUpdated = 0;

    for (const transaction of transactions || []) {
      // Check if attribution already exists
      const { data: existingAttribution } = await supabase
        .from('transaction_attribution')
        .select('id')
        .eq('transaction_id', transaction.transaction_id)
        .single();

      if (existingAttribution) {
        console.log(`Attribution already exists for transaction ${transaction.transaction_id}`);
        continue;
      }

      // Find all touchpoints for this donor (email-based)
      const { data: touchpoints, error: touchpointsError } = await supabase
        .from('attribution_touchpoints')
        .select('*')
        .eq('donor_email', transaction.donor_email)
        .eq('organization_id', transaction.organization_id)
        .lte('occurred_at', transaction.transaction_date)
        .order('occurred_at', { ascending: true });

      if (touchpointsError) {
        console.error(`Error fetching touchpoints for ${transaction.id}:`, touchpointsError);
        continue;
      }

      if (!touchpoints || touchpoints.length === 0) {
        // No touchpoints found - mark as direct/organic
        const { error: attrError } = await supabase
          .from('transaction_attribution')
          .insert({
            transaction_id: transaction.transaction_id,
            organization_id: transaction.organization_id,
            donor_email: transaction.donor_email,
            first_touch_channel: 'organic',
            first_touch_campaign: null,
            first_touch_weight: 1.0,
            last_touch_channel: 'organic',
            last_touch_campaign: null,
            last_touch_weight: 0,
            middle_touches: [],
            middle_touches_weight: 0,
            total_touchpoints: 0,
            attribution_calculated_at: new Date().toISOString(),
          });

        if (attrError) {
          console.error(`Error inserting organic attribution for ${transaction.id}:`, attrError);
          continue;
        }

        attributionsCreated++;
        continue;
      }

      // Multi-touch attribution: 40-20-40 model
      const firstTouch = touchpoints[0];
      const lastTouch = touchpoints[touchpoints.length - 1];
      const middleTouches = touchpoints.slice(1, -1);
      
      const attributionData: any = {
        transaction_id: transaction.transaction_id,
        organization_id: transaction.organization_id,
        donor_email: transaction.donor_email,
        first_touch_channel: firstTouch.touchpoint_type,
        first_touch_campaign: firstTouch.campaign_id,
        first_touch_weight: 0.4,
        last_touch_channel: lastTouch.touchpoint_type,
        last_touch_campaign: lastTouch.campaign_id,
        last_touch_weight: touchpoints.length > 1 ? 0.4 : 0.6,
        middle_touches: middleTouches.map(tp => ({
          channel: tp.touchpoint_type,
          campaign: tp.campaign_id,
          utm_source: tp.utm_source,
          utm_medium: tp.utm_medium,
          occurred_at: tp.occurred_at,
          weight: touchpoints.length > 2 ? 0.2 / middleTouches.length : 0
        })),
        middle_touches_weight: touchpoints.length > 2 ? 0.2 : 0,
        total_touchpoints: touchpoints.length,
        attribution_calculated_at: new Date().toISOString(),
      };

      // Insert attribution
      const { error: attrError } = await supabase
        .from('transaction_attribution')
        .insert(attributionData);

      if (attrError) {
        console.error(`Error inserting attribution for ${transaction.id}:`, attrError);
        continue;
      }

      attributionsCreated++;
    }

    console.log(`Attribution calculation complete. Created ${attributionsCreated} new attributions, updated ${attributionsUpdated}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        attributionsCreated,
        attributionsUpdated,
        totalTransactionsProcessed: transactions?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error calculating attribution:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
