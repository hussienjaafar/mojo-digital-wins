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
      organization_id,
      donor_email,
      interaction_type, // 'open' | 'click'
      campaign_id,
      email_subject,
      link_url,
      utm_source,
      utm_medium,
      utm_campaign,
      refcode,
    } = await req.json();

    if (!organization_id || !interaction_type) {
      throw new Error('organization_id and interaction_type are required');
    }

    console.log(`Tracking email ${interaction_type} for organization: ${organization_id}`);

    // Create attribution touchpoint
    const touchpointData: any = {
      organization_id,
      donor_email: donor_email || null,
      touchpoint_type: interaction_type === 'open' ? 'email_open' : 'email_click',
      occurred_at: new Date().toISOString(),
      utm_source: utm_source || 'email',
      utm_medium: utm_medium || 'email',
      utm_campaign: utm_campaign || campaign_id || 'email_campaign',
      campaign_id: campaign_id || null,
      refcode: refcode || null,
      metadata: {
        email_subject: email_subject || null,
        link_url: link_url || null,
        interaction_type,
      }
    };

    const { data: touchpoint, error: touchpointError } = await supabase
      .from('attribution_touchpoints')
      .insert(touchpointData)
      .select()
      .single();

    if (touchpointError) {
      console.error('Error creating email touchpoint:', touchpointError);
      throw touchpointError;
    }

    console.log(`Email ${interaction_type} tracked successfully:`, touchpoint.id);

    // Return a 1x1 transparent pixel for email tracking
    if (interaction_type === 'open') {
      const pixel = Uint8Array.from([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
        0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b
      ]);

      return new Response(pixel, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
    }

    // For clicks, return JSON success
    return new Response(
      JSON.stringify({ 
        success: true, 
        touchpoint_id: touchpoint.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in track-email-interaction:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
