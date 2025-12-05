import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SwitchboardCredentials {
  api_key: string;
  account_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id } = await req.json();

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    console.log(`Starting Switchboard SMS sync for organization: ${organization_id}`);

    // Fetch credentials
    const { data: credData, error: credError } = await supabase
      .from('client_api_credentials')
      .select('encrypted_credentials')
      .eq('organization_id', organization_id)
      .eq('platform', 'switchboard')
      .eq('is_active', true)
      .single();

    if (credError || !credData) {
      throw new Error('Switchboard credentials not found or inactive');
    }

    const credentials = credData.encrypted_credentials as unknown as SwitchboardCredentials;
    const { api_key, account_id } = credentials;

    console.log(`Credentials found for account: ${account_id}`);

    // IMPORTANT: OneSwitchboard does NOT have a public API for fetching campaign metrics.
    // Their API is only for pushing phone audiences TO Switchboard, not pulling reports.
    // 
    // To get SMS data into this system, users should:
    // 1. Export CSV reports from OneSwitchboard dashboard
    // 2. Contact developers@oneswitchboard.com to request reporting API access
    // 3. Use manual data import feature (to be implemented)
    //
    // For now, return a helpful message explaining this limitation.
    
    console.log('OneSwitchboard does not provide a public reporting API');
    
    // Update sync status with informational message
    await supabase
      .from('client_api_credentials')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'no_api_available'
      })
      .eq('organization_id', organization_id)
      .eq('platform', 'switchboard');

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'OneSwitchboard does not provide a public reporting API for campaign metrics.',
        suggestion: 'Please export CSV reports from your OneSwitchboard dashboard, or contact developers@oneswitchboard.com to request API access for reporting.',
        credentials_valid: true,
        account_id: account_id
      }),
      { 
        status: 200, // Return 200 so the UI doesn't show an error, just a message
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in sync-switchboard-sms:', error);

    // Try to update error status
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { organization_id } = await req.json().catch(() => ({}));
      if (organization_id) {
        await supabase
          .from('client_api_credentials')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: 'error'
          })
          .eq('organization_id', organization_id)
          .eq('platform', 'switchboard');
      }
    } catch (updateError) {
      console.error('Error updating sync status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
