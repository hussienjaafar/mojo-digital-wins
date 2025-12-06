import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SwitchboardCredentials {
  api_key: string;      // Secret Key
  account_id: string;   // Account ID
}

interface SwitchboardBroadcast {
  id: string;
  title: string;
  description: string | null;
  status: string;
  clicks: number;
  donations: number;
  amount_raised: string;
  cost_estimate: string;
  total_messages: number;
  previously_opted_out: number;
  skipped: number;
  failed_to_deliver: number;
  delivered: number;
  opt_outs: number;
  replies: number;
  message_text: string;
  phone_list_id: string | null;
  phone_list_name: string | null;
  created_at: string;
}

interface SwitchboardResponse {
  data: {
    page: SwitchboardBroadcast[];
    next_page: string | null;
  } | null;
  errors: Array<{ code: string; title: string; description: string }>;
}

async function fetchSwitchboardBroadcasts(
  accountId: string,
  secretKey: string,
  cursor?: string
): Promise<SwitchboardResponse> {
  const url = cursor || 'https://api.oneswitchboard.com/v1/broadcasts';
  
  // HTTP Basic Auth: Account ID as username, Secret Key as password
  const credentials = btoa(`${accountId}:${secretKey}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Switchboard API error: ${response.status} - ${errorText}`);
    throw new Error(`Switchboard API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
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

    if (!api_key || !account_id) {
      throw new Error('Invalid credentials: api_key and account_id are required');
    }

    console.log(`Fetching broadcasts for account: ${account_id}`);

    // Fetch all broadcasts with pagination
    const allBroadcasts: SwitchboardBroadcast[] = [];
    let nextPage: string | null = null;
    let pageCount = 0;
    const maxPages = 50; // Safety limit

    do {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);
      
      const response = await fetchSwitchboardBroadcasts(account_id, api_key, nextPage || undefined);
      
      if (response.errors && response.errors.length > 0) {
        const errorMsg = response.errors.map(e => e.description || e.title).join(', ');
        throw new Error(`Switchboard API errors: ${errorMsg}`);
      }

      if (response.data?.page) {
        allBroadcasts.push(...response.data.page);
        nextPage = response.data.next_page;
      } else {
        nextPage = null;
      }
    } while (nextPage && pageCount < maxPages);

    console.log(`Fetched ${allBroadcasts.length} broadcasts across ${pageCount} pages`);

    // Transform and upsert to sms_campaigns table
    const campaignsToUpsert = allBroadcasts.map(broadcast => ({
      organization_id,
      campaign_id: broadcast.id,
      campaign_name: broadcast.title,
      status: broadcast.status,
      messages_sent: broadcast.total_messages,
      messages_delivered: broadcast.delivered,
      messages_failed: broadcast.failed_to_deliver,
      opt_outs: broadcast.opt_outs,
      clicks: broadcast.clicks,
      conversions: broadcast.donations,
      amount_raised: parseFloat(broadcast.amount_raised) || 0,
      cost: parseFloat(broadcast.cost_estimate) || 0,
      message_text: broadcast.message_text,
      phone_list_name: broadcast.phone_list_name,
      replies: broadcast.replies,
      skipped: broadcast.skipped,
      previously_opted_out: broadcast.previously_opted_out,
      send_date: broadcast.created_at,
      created_at: new Date().toISOString(),
    }));

    if (campaignsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('sms_campaigns')
        .upsert(campaignsToUpsert, {
          onConflict: 'organization_id,campaign_id',
        });

      if (upsertError) {
        console.error('Error upserting SMS campaigns:', upsertError);
        throw new Error(`Failed to save campaigns: ${upsertError.message}`);
      }

      console.log(`Successfully upserted ${campaignsToUpsert.length} SMS campaigns`);
    }

    // Calculate aggregate daily metrics
    const dailyMetrics: Record<string, {
      messages_sent: number;
      messages_delivered: number;
      conversions: number;
      amount_raised: number;
      cost: number;
    }> = {};

    for (const broadcast of allBroadcasts) {
      const date = broadcast.created_at.split('T')[0];
      if (!dailyMetrics[date]) {
        dailyMetrics[date] = {
          messages_sent: 0,
          messages_delivered: 0,
          conversions: 0,
          amount_raised: 0,
          cost: 0,
        };
      }
      dailyMetrics[date].messages_sent += broadcast.total_messages;
      dailyMetrics[date].messages_delivered += broadcast.delivered;
      dailyMetrics[date].conversions += broadcast.donations;
      dailyMetrics[date].amount_raised += parseFloat(broadcast.amount_raised) || 0;
      dailyMetrics[date].cost += parseFloat(broadcast.cost_estimate) || 0;
    }

    // Upsert daily metrics
    const dailyMetricsToUpsert = Object.entries(dailyMetrics).map(([date, metrics]) => ({
      organization_id,
      date,
      channel: 'sms',
      messages_sent: metrics.messages_sent,
      messages_delivered: metrics.messages_delivered,
      conversions: metrics.conversions,
      amount_raised: metrics.amount_raised,
      cost: metrics.cost,
    }));

    if (dailyMetricsToUpsert.length > 0) {
      const { error: dailyError } = await supabase
        .from('daily_aggregated_metrics')
        .upsert(dailyMetricsToUpsert, {
          onConflict: 'organization_id,date,channel',
        });

      if (dailyError) {
        console.error('Error upserting daily metrics:', dailyError);
        // Don't throw, continue with sync status update
      } else {
        console.log(`Updated ${dailyMetricsToUpsert.length} daily metric records`);
      }
    }

    // Get the latest broadcast date for freshness tracking
    const latestBroadcastDate = allBroadcasts.length > 0
      ? allBroadcasts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
      : new Date().toISOString();

    // Update sync status
    await supabase
      .from('client_api_credentials')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success'
      })
      .eq('organization_id', organization_id)
      .eq('platform', 'switchboard');

    // Update data freshness tracking
    const { error: freshnessError } = await supabase.rpc('update_data_freshness', {
      p_source: 'switchboard',
      p_organization_id: organization_id,
      p_latest_data_timestamp: latestBroadcastDate,
      p_sync_status: 'success',
      p_error: null,
      p_records_synced: allBroadcasts.length,
      p_duration_ms: null,
    });
    if (freshnessError) {
      console.error('Error updating freshness:', freshnessError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        campaigns_synced: allBroadcasts.length,
        daily_metrics: Object.keys(dailyMetrics).length,
        message: `Successfully synced ${allBroadcasts.length} SMS broadcasts`
      }),
      { 
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
      
      const body = await req.clone().json().catch(() => ({}));
      const { organization_id } = body;
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
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
