import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Use service role to encrypt credentials
    );

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      organizationId, 
      accessToken, 
      expiresIn,
      selectedAdAccount,
      metaUserId,
      metaUserName,
    } = await req.json();
    
    if (!organizationId || !accessToken || !selectedAdAccount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[meta-save-connection] Saving Meta connection for org:', organizationId);

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (expiresIn || 5184000) * 1000).toISOString();

    // Check if credential already exists
    const { data: existing } = await supabase
      .from('client_api_credentials')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('platform', 'meta')
      .single();

    // Store encrypted credentials
    const credentialData = {
      organization_id: organizationId,
      platform: 'meta',
      is_active: true,
      encrypted_credentials: {
        access_token: accessToken,
        ad_account_id: selectedAdAccount.id,
        ad_account_name: selectedAdAccount.name,
        account_id: selectedAdAccount.account_id,
        meta_user_id: metaUserId,
        meta_user_name: metaUserName,
        expires_at: expiresAt,
      },
      credential_mask: {
        ad_account_name: selectedAdAccount.name,
        business_name: selectedAdAccount.business_name,
        meta_user: metaUserName,
      },
      last_tested_at: new Date().toISOString(),
      last_test_status: 'success',
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing) {
      // Update existing
      const result = await supabase
        .from('client_api_credentials')
        .update(credentialData)
        .eq('id', existing.id);
      error = result.error;
    } else {
      // Insert new
      const result = await supabase
        .from('client_api_credentials')
        .insert(credentialData);
      error = result.error;
    }

    if (error) {
      console.error('[meta-save-connection] DB error:', error);
      throw error;
    }

    console.log('[meta-save-connection] Successfully saved Meta connection');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Meta connection saved successfully',
        adAccount: {
          id: selectedAdAccount.id,
          name: selectedAdAccount.name,
          business_name: selectedAdAccount.business_name,
        },
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[meta-save-connection] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});