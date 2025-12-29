import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

// Use restricted CORS
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || 'https://lovable.dev',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const RATE_LIMIT_BACKOFF_MS = 60000;

interface SwitchboardCredentials {
  api_key: string;
  account_id: string;
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

interface SwitchboardMessageEvent {
  id: string;
  phone_number: string | null;
  status: string | null;
  click_url?: string | null;
  clicks?: number | null;
  delivered_at?: string | null;
  failed_at?: string | null;
  sent_at?: string | null;
  opted_out_at?: string | null;
  replied_at?: string | null;
  last_click_at?: string | null;
  metadata?: Record<string, any> | null;
}

interface SwitchboardMessageResponse {
  data: {
    page: SwitchboardMessageEvent[];
    next_page: string | null;
  } | null;
  errors: Array<{ code: string; title: string; description: string }>;
}

// Utility: sleep for retry backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Utility: fetch with retry and rate limit handling
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit');
      const isServerError = error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503');
      
      if (isRateLimit) {
        console.warn(`[SMS SYNC] Rate limited on ${context}, waiting ${RATE_LIMIT_BACKOFF_MS}ms before retry ${attempt}/${maxRetries}`);
        await sleep(RATE_LIMIT_BACKOFF_MS);
      } else if (isServerError && attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * attempt;
        console.warn(`[SMS SYNC] Server error on ${context}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await sleep(delay);
      } else if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * attempt;
        console.warn(`[SMS SYNC] Error on ${context}: ${error.message}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} retries: ${context}`);
}

async function fetchSwitchboardBroadcasts(
  accountId: string,
  secretKey: string,
  cursor?: string
): Promise<SwitchboardResponse> {
  const url = cursor || 'https://api.oneswitchboard.com/v1/broadcasts';
  const credentials = btoa(`${accountId}:${secretKey}`);
  
  console.log(`[SMS SYNC] Fetching broadcasts from: ${cursor ? 'next page' : 'first page'}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[SMS SYNC] Switchboard API error: ${response.status} - ${errorText}`);
    
    // Check for specific error types
    if (response.status === 401) {
      throw new Error(`Switchboard authentication failed (401): Invalid API credentials`);
    } else if (response.status === 403) {
      throw new Error(`Switchboard access denied (403): Check account permissions`);
    } else if (response.status === 429) {
      throw new Error(`Switchboard rate limit exceeded (429): ${errorText}`);
    }
    
    throw new Error(`Switchboard API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function fetchBroadcastMessages(
  accountId: string,
  secretKey: string,
  broadcastId: string,
  cursor?: string
): Promise<SwitchboardMessageResponse> {
  const url = cursor || `https://api.oneswitchboard.com/v1/broadcasts/${broadcastId}/messages`;
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
    console.error(`[SMS SYNC] Messages API error for broadcast ${broadcastId}: ${response.status} - ${errorText}`);
    throw new Error(`Switchboard API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

const deriveEventType = (msg: SwitchboardMessageEvent): string => {
  if (msg.opted_out_at) return 'opted_out';
  if (msg.replied_at) return 'replied';
  if (msg.last_click_at || (msg.clicks && msg.clicks > 0)) return 'clicked';
  if (msg.delivered_at) return 'delivered';
  if (msg.failed_at) return 'failed';
  if (msg.sent_at) return 'sent';
  return 'unknown';
};

const deriveOccurredAt = (msg: SwitchboardMessageEvent): string => {
  return (
    msg.opted_out_at ||
    msg.replied_at ||
    msg.last_click_at ||
    msg.delivered_at ||
    msg.failed_at ||
    msg.sent_at ||
    new Date().toISOString()
  );
};

// Hash phone number for privacy
const hashPhone = async (phone: string | null): Promise<string | null> => {
  if (!phone) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(phone);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
};

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const body = await req.json();
    const { organization_id, force_full_sync = false, since_date = null } = body;
    
    console.log(`[SMS SYNC] Starting sync for org: ${organization_id}, force_full: ${force_full_sync}, since: ${since_date}`);

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    // --- AUTH CHECK ---
    // Either cron secret or user JWT with org membership
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedCronSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('Authorization');
    
    let isAuthorized = false;
    
    // Check cron secret (scheduled jobs)
    if (cronSecret && providedCronSecret === cronSecret) {
      isAuthorized = true;
      console.log('[SMS SYNC] Authorized via CRON_SECRET');
    }
    
    // Check JWT auth (user must belong to org or be admin)
    if (!isAuthorized && authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (!authError && user) {
        // Check if admin
        const { data: isAdmin } = await userClient.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        
        if (isAdmin) {
          isAuthorized = true;
          console.log('[SMS SYNC] Authorized via admin JWT');
        } else {
          // Check org membership
          const serviceClient = createClient(supabaseUrl, serviceRoleKey);
          const { data: clientUser } = await serviceClient
            .from('client_users')
            .select('organization_id')
            .eq('id', user.id)
            .single();
          
          if (clientUser?.organization_id === organization_id) {
            isAuthorized = true;
            console.log('[SMS SYNC] Authorized via org membership');
          }
        }
      }
    }
    
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - requires CRON_SECRET or valid org membership' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

    const allBroadcasts: SwitchboardBroadcast[] = [];
    let nextPage: string | null = null;
    let pageCount = 0;
    const maxPages = 50;

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
        .upsert(campaignsToUpsert, { onConflict: 'organization_id,campaign_id' });

      if (upsertError) {
        console.error('Error upserting SMS campaigns:', upsertError);
        throw new Error(`Failed to save campaigns: ${upsertError.message}`);
      }

      console.log(`Successfully upserted ${campaignsToUpsert.length} SMS campaigns`);
    }

    // Per-recipient events for donor journey and churn analytics
    for (const broadcast of allBroadcasts) {
      try {
        let msgNext: string | null = null;
        let msgPageCount = 0;
        const messageEvents: SwitchboardMessageEvent[] = [];

        do {
          msgPageCount++;
          const msgResp = await fetchBroadcastMessages(account_id, api_key, broadcast.id, msgNext || undefined);
          if (msgResp.errors && msgResp.errors.length > 0) {
            const errorMsg = msgResp.errors.map(e => e.description || e.title).join(', ');
            throw new Error(`Switchboard message API errors: ${errorMsg}`);
          }
          if (msgResp.data?.page) {
            messageEvents.push(...msgResp.data.page);
            msgNext = msgResp.data.next_page;
          } else {
            msgNext = null;
          }
        } while (msgNext && msgPageCount < 100);

        if (messageEvents.length > 0) {
          const eventsToUpsert = messageEvents.map(msg => ({
            organization_id,
            campaign_id: broadcast.id,
            message_id: msg.id,
            recipient_phone: msg.phone_number,
            status: msg.status,
            event_type: deriveEventType(msg),
            click_url: msg.click_url || null,
            occurred_at: deriveOccurredAt(msg),
            metadata: {
              clicks: msg.clicks || 0,
              delivered_at: msg.delivered_at,
              failed_at: msg.failed_at,
              sent_at: msg.sent_at,
              opted_out_at: msg.opted_out_at,
              replied_at: msg.replied_at,
              last_click_at: msg.last_click_at,
              raw_status: msg.status,
            },
          }));

          const { error: eventError } = await supabase
            .from('sms_events')
            .upsert(eventsToUpsert, { onConflict: 'organization_id,message_id' });

          if (eventError) {
            console.error(`[SMS SYNC] Failed to upsert sms_events for broadcast ${broadcast.id}:`, eventError);
          } else {
            console.log(`[SMS SYNC] Upserted ${eventsToUpsert.length} sms_events for broadcast ${broadcast.id}`);
          }
        }
      } catch (eventErr) {
        const errMessage = eventErr instanceof Error ? eventErr.message : String(eventErr);
        console.warn(`[SMS SYNC] Skipping sms_events for broadcast ${broadcast.id}:`, errMessage);
      }
    }

    // Aggregate daily metrics
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
        .upsert(dailyMetricsToUpsert, { onConflict: 'organization_id,date,channel' });

      if (dailyError) {
        console.error('Error upserting daily metrics:', dailyError);
      } else {
        console.log(`Updated ${dailyMetricsToUpsert.length} daily metric records`);
      }
    }

    const latestBroadcastDate = allBroadcasts.length > 0
      ? allBroadcasts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
      : new Date().toISOString();

    await supabase
      .from('client_api_credentials')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success'
      })
      .eq('organization_id', organization_id)
      .eq('platform', 'switchboard');

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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in sync-switchboard-sms:', error);

    // Log failure for dead-letter handling
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const body = await req.clone().json().catch(() => ({}));
      const { organization_id } = body;
      
      if (organization_id) {
        try {
          await supabase.rpc('log_job_failure', {
            p_function_name: 'sync-switchboard-sms',
            p_error_message: error.message,
            p_context: { organization_id }
          });
        } catch (_) { /* ignore */ }
        
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
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
