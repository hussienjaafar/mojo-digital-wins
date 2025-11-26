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

    // Get transactions without attribution (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: transactions, error: txError } = await supabase
      .from('actblue_transactions')
      .select('*')
      .gte('transaction_date', thirtyDaysAgo)
      .is('attribution_calculated', null)
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (txError) throw txError;

    console.log(`Processing ${transactions?.length || 0} transactions`);

    let attributionsCreated = 0;

    for (const transaction of transactions || []) {
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
        await supabase
          .from('transaction_attribution')
          .insert({
            transaction_id: transaction.id,
            organization_id: transaction.organization_id,
            touchpoint_id: null,
            attribution_weight: 1.0,
            attribution_type: 'organic',
          });

        await supabase
          .from('actblue_transactions')
          .update({ attribution_calculated: true })
          .eq('id', transaction.id);

        attributionsCreated++;
        continue;
      }

      // Multi-touch attribution: 40-20-40 model
      const attributions = [];
      
      if (touchpoints.length === 1) {
        // Only one touchpoint - gets 100%
        attributions.push({
          transaction_id: transaction.id,
          organization_id: transaction.organization_id,
          touchpoint_id: touchpoints[0].id,
          attribution_weight: 1.0,
          attribution_type: 'single_touch',
        });
      } else {
        // First touch: 40%
        attributions.push({
          transaction_id: transaction.id,
          organization_id: transaction.organization_id,
          touchpoint_id: touchpoints[0].id,
          attribution_weight: 0.4,
          attribution_type: 'first_touch',
        });

        // Last touch: 40%
        attributions.push({
          transaction_id: transaction.id,
          organization_id: transaction.organization_id,
          touchpoint_id: touchpoints[touchpoints.length - 1].id,
          attribution_weight: 0.4,
          attribution_type: 'last_touch',
        });

        // Middle touches: 20% divided equally
        const middleTouches = touchpoints.slice(1, -1);
        if (middleTouches.length > 0) {
          const middleWeight = 0.2 / middleTouches.length;
          for (const touchpoint of middleTouches) {
            attributions.push({
              transaction_id: transaction.id,
              organization_id: transaction.organization_id,
              touchpoint_id: touchpoint.id,
              attribution_weight: middleWeight,
              attribution_type: 'middle_touch',
            });
          }
        }
      }

      // Insert attributions
      const { error: attrError } = await supabase
        .from('transaction_attribution')
        .insert(attributions);

      if (attrError) {
        console.error(`Error inserting attribution for ${transaction.id}:`, attrError);
        continue;
      }

      // Mark transaction as attributed
      await supabase
        .from('actblue_transactions')
        .update({ attribution_calculated: true })
        .eq('id', transaction.id);

      attributionsCreated++;
    }

    console.log(`Attribution calculation complete. Processed ${attributionsCreated} transactions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transactionsProcessed: attributionsCreated,
        totalTransactions: transactions?.length || 0
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
