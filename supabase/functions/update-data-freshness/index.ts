import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Unified Data Freshness Update Function
 * 
 * Called by all sync jobs to update the data_freshness tracking table.
 * This provides a single source of truth for data currency across all sources.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      source,
      organization_id = null,
      latest_data_timestamp = null,
      sync_status = 'success',
      error_message = null,
      records_synced = 0,
      duration_ms = null,
    } = body;

    if (!source) {
      return new Response(
        JSON.stringify({ error: 'source is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating freshness for source: ${source}, org: ${organization_id || 'global'}`);

    // Call the database function to update freshness
    const { data, error } = await supabase.rpc('update_data_freshness', {
      p_source: source,
      p_organization_id: organization_id,
      p_latest_data_timestamp: latest_data_timestamp,
      p_sync_status: sync_status,
      p_error: error_message,
      p_records_synced: records_synced,
      p_duration_ms: duration_ms,
    });

    if (error) {
      console.error('Error updating freshness:', error);
      throw error;
    }

    console.log(`Freshness updated successfully, id: ${data}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        freshness_id: data,
        source,
        organization_id,
        sync_status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in update-data-freshness:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
