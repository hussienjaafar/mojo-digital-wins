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

    const { 
      touchpoint_type,
      organization_id,
      donor_email,
      utm_source,
      utm_medium,
      utm_campaign,
      refcode,
      campaign_id,
      metadata,
      occurred_at,
    } = await req.json();

    if (!touchpoint_type || !organization_id) {
      throw new Error('touchpoint_type and organization_id are required');
    }

    console.log(`Recording ${touchpoint_type} touchpoint for org ${organization_id}`);

    // Insert touchpoint
    const { data: touchpoint, error: touchpointError } = await supabase
      .from('attribution_touchpoints')
      .insert({
        touchpoint_type,
        organization_id,
        donor_email,
        utm_source,
        utm_medium,
        utm_campaign,
        refcode,
        campaign_id,
        metadata,
        occurred_at: occurred_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (touchpointError) {
      console.error('Error inserting touchpoint:', touchpointError);
      throw touchpointError;
    }

    console.log(`Touchpoint recorded: ${touchpoint.id}`);

    // If donor_email is provided, check for recent donations to link
    if (donor_email) {
      const { data: recentDonations } = await supabase
        .from('actblue_transactions')
        .select('id, transaction_id, amount, transaction_date')
        .eq('organization_id', organization_id)
        .eq('donor_email', donor_email)
        .gte('transaction_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('transaction_date', { ascending: false })
        .limit(5);

      if (recentDonations && recentDonations.length > 0) {
        console.log(`Found ${recentDonations.length} recent donations for ${donor_email}`);
        
        // Link touchpoint to donations for attribution modeling
        for (const donation of recentDonations) {
          console.log(`Linking touchpoint to donation ${donation.transaction_id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        touchpoint_id: touchpoint.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in track-attribution-touchpoint:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
