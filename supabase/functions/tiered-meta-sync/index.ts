import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * TIERED META SYNC SCHEDULER
 * 
 * This function runs every 15 minutes and determines which Meta accounts
 * need syncing based on their priority tier:
 * - HIGH: sync every 1 hour, fetch last 2 days
 * - MEDIUM: sync every 2 hours, fetch last 3 days  
 * - LOW: sync every 4 hours, fetch last 7 days
 * 
 * It respects rate limits and backs off when needed.
 */

interface SyncAccount {
  credential_id: string;
  organization_id: string;
  organization_name: string;
  sync_priority: string;
  interval_minutes: number;
  date_range_days: number;
  last_sync_at: string | null;
  minutes_overdue: number;
}

interface SyncResult {
  organization_id: string;
  organization_name: string;
  priority: string;
  status: 'success' | 'failed' | 'rate_limited' | 'skipped';
  metrics_stored?: number;
  latest_data_date?: string;
  duration_ms?: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const forceSync = body.force || false;
    const specificOrgId = body.organization_id;
    const maxAccounts = body.max_accounts || 5; // Limit concurrent syncs

    console.log(`[TIERED SYNC] Starting tiered Meta sync scheduler...`);
    console.log(`[TIERED SYNC] Force: ${forceSync}, Specific org: ${specificOrgId || 'all'}`);

    // Get accounts that are due for sync
    let accountsToSync: SyncAccount[] = [];

    if (specificOrgId) {
      // Sync specific organization
      const { data: cred } = await supabase
        .from('client_api_credentials')
        .select(`
          id,
          organization_id,
          meta_sync_priority,
          last_meta_sync_at
        `)
        .eq('organization_id', specificOrgId)
        .eq('platform', 'meta')
        .eq('is_active', true)
        .maybeSingle();

      if (cred) {
        const { data: org } = await supabase
          .from('client_organizations')
          .select('name')
          .eq('id', specificOrgId)
          .maybeSingle();

        const { data: config } = await supabase
          .from('meta_sync_config')
          .select('interval_minutes, date_range_days')
          .eq('tier', cred.meta_sync_priority || 'medium')
          .maybeSingle();

        accountsToSync = [{
          credential_id: cred.id,
          organization_id: cred.organization_id,
          organization_name: org?.name || 'Unknown',
          sync_priority: cred.meta_sync_priority || 'medium',
          interval_minutes: config?.interval_minutes || 120,
          date_range_days: config?.date_range_days || 3,
          last_sync_at: cred.last_meta_sync_at,
          minutes_overdue: 0
        }];
      }
    } else if (forceSync) {
      // Force sync all active accounts
      const { data: creds } = await supabase
        .from('client_api_credentials')
        .select(`
          id,
          organization_id,
          meta_sync_priority,
          last_meta_sync_at
        `)
        .eq('platform', 'meta')
        .eq('is_active', true);

      if (creds) {
        for (const cred of creds) {
          const { data: org } = await supabase
            .from('client_organizations')
            .select('name')
            .eq('id', cred.organization_id)
            .maybeSingle();

          const { data: config } = await supabase
            .from('meta_sync_config')
            .select('interval_minutes, date_range_days')
            .eq('tier', cred.meta_sync_priority || 'medium')
            .maybeSingle();

          accountsToSync.push({
            credential_id: cred.id,
            organization_id: cred.organization_id,
            organization_name: org?.name || 'Unknown',
            sync_priority: cred.meta_sync_priority || 'medium',
            interval_minutes: config?.interval_minutes || 120,
            date_range_days: config?.date_range_days || 3,
            last_sync_at: cred.last_meta_sync_at,
            minutes_overdue: 0
          });
        }
      }
    } else {
      // Normal operation: get accounts due for sync using the DB function
      const { data: dueAccounts, error: dueError } = await supabase
        .rpc('get_meta_accounts_due_for_sync', { p_limit: maxAccounts });

      if (dueError) {
        console.error('[TIERED SYNC] Error getting due accounts:', dueError);
        throw dueError;
      }

      accountsToSync = dueAccounts || [];
    }

    if (accountsToSync.length === 0) {
      console.log('[TIERED SYNC] No accounts due for sync');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No accounts due for sync',
          accounts_checked: 0,
          accounts_synced: 0,
          duration_ms: Date.now() - startTime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[TIERED SYNC] ${accountsToSync.length} accounts due for sync`);

    // Sync each account
    const results: SyncResult[] = [];
    let rateLimitHit = false;

    for (const account of accountsToSync) {
      // If we hit a rate limit, skip lower priority accounts
      if (rateLimitHit && account.sync_priority !== 'high') {
        console.log(`[TIERED SYNC] Skipping ${account.organization_name} (${account.sync_priority}) due to rate limit`);
        results.push({
          organization_id: account.organization_id,
          organization_name: account.organization_name,
          priority: account.sync_priority,
          status: 'skipped',
          error: 'Rate limit backoff - skipping lower priority'
        });
        continue;
      }

      const syncStart = Date.now();
      console.log(`[TIERED SYNC] Syncing ${account.organization_name} (priority: ${account.sync_priority}, range: ${account.date_range_days} days)`);

      try {
        // Calculate date range based on tier
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - account.date_range_days);

        // Call the admin-sync-meta function
        const { data: syncData, error: syncError } = await supabase.functions.invoke('admin-sync-meta', {
          body: {
            organization_id: account.organization_id,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            mode: 'tiered'
          },
          headers: { 
            'x-admin-key': 'internal-sync-trigger',
            'x-scheduled-job': 'true'
          }
        });

        if (syncError) {
          throw new Error(syncError.message || 'Sync function failed');
        }

        // Check for rate limiting in response
        if (syncData?.error?.includes('rate limit') || syncData?.error?.includes('429')) {
          rateLimitHit = true;
          
          // Update with rate limit backoff
          await supabase.rpc('update_meta_sync_status', {
            p_organization_id: account.organization_id,
            p_status: 'rate_limited',
            p_error: 'Meta API rate limit hit',
            p_is_rate_limited: true
          });

          results.push({
            organization_id: account.organization_id,
            organization_name: account.organization_name,
            priority: account.sync_priority,
            status: 'rate_limited',
            duration_ms: Date.now() - syncStart,
            error: 'Rate limit hit - backing off'
          });
          continue;
        }

        // Success - update sync status
        const latestDate = syncData?.date_range?.actual?.latest || syncData?.data_freshness?.latest_data_date;

        await supabase.rpc('update_meta_sync_status', {
          p_organization_id: account.organization_id,
          p_status: 'success',
          p_latest_data_date: latestDate || null,
          p_error: null,
          p_is_rate_limited: false
        });

        results.push({
          organization_id: account.organization_id,
          organization_name: account.organization_name,
          priority: account.sync_priority,
          status: 'success',
          metrics_stored: syncData?.metrics_stored || 0,
          latest_data_date: latestDate,
          duration_ms: Date.now() - syncStart
        });

        console.log(`[TIERED SYNC] ✓ ${account.organization_name}: ${syncData?.metrics_stored || 0} metrics, latest: ${latestDate}`);

      } catch (error: any) {
        console.error(`[TIERED SYNC] ✗ ${account.organization_name} failed:`, error.message);

        // Check if it's a rate limit error
        const isRateLimit = error.message?.includes('rate limit') || error.message?.includes('429');
        if (isRateLimit) {
          rateLimitHit = true;
        }

        // Update error status
        await supabase.rpc('update_meta_sync_status', {
          p_organization_id: account.organization_id,
          p_status: 'failed',
          p_error: error.message,
          p_is_rate_limited: isRateLimit
        });

        results.push({
          organization_id: account.organization_id,
          organization_name: account.organization_name,
          priority: account.sync_priority,
          status: isRateLimit ? 'rate_limited' : 'failed',
          duration_ms: Date.now() - syncStart,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const rateLimitedCount = results.filter(r => r.status === 'rate_limited').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    console.log(`[TIERED SYNC] Complete: ${successCount} success, ${failedCount} failed, ${rateLimitedCount} rate limited, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        accounts_checked: accountsToSync.length,
        accounts_synced: successCount,
        accounts_failed: failedCount,
        accounts_rate_limited: rateLimitedCount,
        accounts_skipped: skippedCount,
        results,
        duration_ms: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[TIERED SYNC] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error',
        duration_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
