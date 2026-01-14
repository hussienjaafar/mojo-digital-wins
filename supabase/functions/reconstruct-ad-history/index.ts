/**
 * RECONSTRUCT AD HISTORY
 * 
 * Backfills the refcode_mapping_history table with accurate date ranges
 * by analyzing meta_ad_metrics_daily to determine when each ad was actually active.
 * 
 * This fixes the issue where ads sharing a refcode don't have proper date ranges
 * for point-in-time attribution.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface AdActivityRange {
  ad_id: string;
  organization_id: string;
  first_active_date: string;
  last_active_date: string;
  total_spend: number;
  active_days: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // SECURITY: Authentication required
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedCronSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('authorization');
    
    let isAuthorized = false;
    
    // Check cron secret for scheduled jobs
    if (cronSecret && providedCronSecret === cronSecret) {
      isAuthorized = true;
      console.log('[RECONSTRUCT-AD-HISTORY] Authorized via CRON_SECRET');
    }
    
    // Check admin JWT
    if (!isAuthorized && authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: isAdmin } = await userClient.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        if (isAdmin) {
          isAuthorized = true;
          console.log('[RECONSTRUCT-AD-HISTORY] Authorized via admin JWT');
        }
      }
    }
    
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - requires CRON_SECRET or admin access' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let body: { organization_id?: string; dry_run?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine
    }
    
    const { organization_id, dry_run = false } = body;
    
    console.log(`[RECONSTRUCT-AD-HISTORY] Starting reconstruction, org=${organization_id || 'all'}, dry_run=${dry_run}`);

    // Step 1: Get actual activity date ranges from meta_ad_metrics_daily
    let query = supabase
      .from('meta_ad_metrics_daily')
      .select('ad_id, organization_id, date, spend')
      .order('ad_id')
      .order('date');
    
    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }
    
    const { data: dailyMetrics, error: metricsError } = await query;
    
    if (metricsError) {
      throw metricsError;
    }
    
    if (!dailyMetrics || dailyMetrics.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No daily metrics found to process',
          updated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Aggregate to get date ranges per ad
    const adActivityMap = new Map<string, AdActivityRange>();
    
    for (const metric of dailyMetrics) {
      const key = `${metric.organization_id}:${metric.ad_id}`;
      const existing = adActivityMap.get(key);
      
      if (!existing) {
        adActivityMap.set(key, {
          ad_id: metric.ad_id,
          organization_id: metric.organization_id,
          first_active_date: metric.date,
          last_active_date: metric.date,
          total_spend: metric.spend || 0,
          active_days: 1
        });
      } else {
        // Update date range
        if (metric.date < existing.first_active_date) {
          existing.first_active_date = metric.date;
        }
        if (metric.date > existing.last_active_date) {
          existing.last_active_date = metric.date;
        }
        existing.total_spend += metric.spend || 0;
        existing.active_days++;
      }
    }
    
    console.log(`[RECONSTRUCT-AD-HISTORY] Found ${adActivityMap.size} ads with metrics data`);

    // Step 3: Get existing refcode mappings to update
    let mappingQuery = supabase
      .from('refcode_mapping_history')
      .select('*');
    
    if (organization_id) {
      mappingQuery = mappingQuery.eq('organization_id', organization_id);
    }
    
    const { data: existingMappings, error: mappingError } = await mappingQuery;
    
    if (mappingError) {
      throw mappingError;
    }

    // Step 4: Determine which ads are still active (have recent data)
    const today = new Date();
    const recentCutoff = new Date(today);
    recentCutoff.setDate(recentCutoff.getDate() - 14); // Within last 14 days = active
    const recentCutoffStr = recentCutoff.toISOString().split('T')[0];

    // Step 5: Update refcode_mapping_history with accurate dates
    let updated = 0;
    let skipped = 0;
    const updates: Array<{
      ad_id: string;
      refcode: string;
      old_first_seen: string;
      new_first_seen: string;
      new_last_seen: string;
      is_active: boolean;
    }> = [];

    for (const mapping of existingMappings || []) {
      const key = `${mapping.organization_id}:${mapping.ad_id}`;
      const activity = adActivityMap.get(key);
      
      if (!activity) {
        // No metrics data for this ad
        console.log(`[RECONSTRUCT-AD-HISTORY] No metrics for ad ${mapping.ad_id}, skipping`);
        skipped++;
        continue;
      }
      
      // Determine if this ad is still active
      const isStillActive = activity.last_active_date >= recentCutoffStr;
      
      // Prepare update
      const updateInfo = {
        ad_id: mapping.ad_id,
        refcode: mapping.refcode,
        old_first_seen: mapping.first_seen_at,
        new_first_seen: activity.first_active_date,
        new_last_seen: activity.last_active_date,
        is_active: isStillActive
      };
      updates.push(updateInfo);
      
      if (!dry_run) {
        const { error: updateError } = await supabase
          .from('refcode_mapping_history')
          .update({
            first_seen_at: activity.first_active_date,
            last_seen_at: activity.last_active_date,
            is_active: isStillActive
          })
          .eq('id', mapping.id);
        
        if (updateError) {
          console.error(`[RECONSTRUCT-AD-HISTORY] Failed to update mapping for ad ${mapping.ad_id}:`, updateError);
        } else {
          updated++;
          console.log(`[RECONSTRUCT-AD-HISTORY] Updated ad ${mapping.ad_id}: ${activity.first_active_date} to ${activity.last_active_date}, active=${isStillActive}`);
        }
      } else {
        updated++;
      }
    }

    // Step 6: Also check for ads in metrics that don't have refcode mappings yet
    // These might need to be added via sync-meta-ads + refcode-reconcile
    const unmappedAds: string[] = [];
    for (const [key, activity] of adActivityMap) {
      const hasMapping = (existingMappings || []).some(
        m => m.ad_id === activity.ad_id && m.organization_id === activity.organization_id
      );
      if (!hasMapping) {
        unmappedAds.push(activity.ad_id);
      }
    }
    
    if (unmappedAds.length > 0) {
      console.log(`[RECONSTRUCT-AD-HISTORY] Found ${unmappedAds.length} ads with metrics but no refcode mapping - run sync-meta-ads + refcode-reconcile to fix`);
    }

    const result = {
      success: true,
      dry_run,
      total_ads_in_metrics: adActivityMap.size,
      mappings_processed: (existingMappings || []).length,
      updated,
      skipped,
      unmapped_ads_count: unmappedAds.length,
      updates: dry_run ? updates : undefined,
      unmapped_ads: unmappedAds.length > 0 ? unmappedAds.slice(0, 10) : undefined // Sample for debugging
    };

    console.log(`[RECONSTRUCT-AD-HISTORY] Completed:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[RECONSTRUCT-AD-HISTORY] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
