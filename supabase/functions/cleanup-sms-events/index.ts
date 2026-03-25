import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cleanup low-value SMS events to reclaim storage space
 * 
 * Safe deletions (AI learning not impacted):
 * - 'delivered' events older than 30 days
 * - 'unknown' events older than 7 days
 * - 'sent' events older than 60 days (campaign-level metrics preserved)
 * 
 * The AI learning pipeline uses sms_campaigns (aggregate data), not raw sms_events.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      dry_run = true, // Default to dry run for safety
      delivered_days = 30,
      unknown_days = 7,
      sent_days = 60,
      batch_size = 10000,
    } = await req.json().catch(() => ({}));

    console.log(`SMS event cleanup starting (dry_run: ${dry_run})`);

    const now = new Date();
    const deliveredCutoff = new Date(now);
    deliveredCutoff.setDate(deliveredCutoff.getDate() - delivered_days);
    
    const unknownCutoff = new Date(now);
    unknownCutoff.setDate(unknownCutoff.getDate() - unknown_days);
    
    const sentCutoff = new Date(now);
    sentCutoff.setDate(sentCutoff.getDate() - sent_days);

    const results = {
      delivered: { count: 0, deleted: 0 },
      unknown: { count: 0, deleted: 0 },
      sent: { count: 0, deleted: 0 },
      total_freed_estimate_mb: 0,
    };

    // Count 'delivered' events to delete
    const { count: deliveredCount } = await supabase
      .from('sms_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'delivered')
      .lt('occurred_at', deliveredCutoff.toISOString());

    results.delivered.count = deliveredCount || 0;

    // Count 'unknown' events to delete
    const { count: unknownCount } = await supabase
      .from('sms_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'unknown')
      .lt('occurred_at', unknownCutoff.toISOString());

    results.unknown.count = unknownCount || 0;

    // Count 'sent' events to delete
    const { count: sentCount } = await supabase
      .from('sms_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'sent')
      .lt('occurred_at', sentCutoff.toISOString());

    results.sent.count = sentCount || 0;

    const totalToDelete = results.delivered.count + results.unknown.count + results.sent.count;
    
    // Estimate storage freed (~400 bytes per event average)
    results.total_freed_estimate_mb = Math.round((totalToDelete * 400) / (1024 * 1024));

    console.log(`Found ${totalToDelete} events to delete (~${results.total_freed_estimate_mb}MB)`);

    if (!dry_run && totalToDelete > 0) {
      // Delete in batches to avoid timeouts
      let deleted = 0;

      // Delete 'delivered' events
      if (results.delivered.count > 0) {
        const { data, error } = await supabase.rpc('delete_old_sms_events', {
          p_event_type: 'delivered',
          p_cutoff_date: deliveredCutoff.toISOString(),
          p_batch_size: batch_size,
        });
        
        if (error) {
          // Fallback to direct delete if RPC doesn't exist
          console.log('RPC not available, using direct delete for delivered...');
          const { count } = await supabase
            .from('sms_events')
            .delete({ count: 'exact' })
            .eq('event_type', 'delivered')
            .lt('occurred_at', deliveredCutoff.toISOString())
            .limit(batch_size);
          results.delivered.deleted = count || 0;
        } else {
          results.delivered.deleted = data || 0;
        }
        deleted += results.delivered.deleted;
      }

      // Delete 'unknown' events
      if (results.unknown.count > 0) {
        const { count } = await supabase
          .from('sms_events')
          .delete({ count: 'exact' })
          .eq('event_type', 'unknown')
          .lt('occurred_at', unknownCutoff.toISOString())
          .limit(batch_size);
        results.unknown.deleted = count || 0;
        deleted += results.unknown.deleted;
      }

      // Delete 'sent' events (be more conservative)
      if (results.sent.count > 0) {
        const { count } = await supabase
          .from('sms_events')
          .delete({ count: 'exact' })
          .eq('event_type', 'sent')
          .lt('occurred_at', sentCutoff.toISOString())
          .limit(batch_size);
        results.sent.deleted = count || 0;
        deleted += results.sent.deleted;
      }

      console.log(`Deleted ${deleted} events in this batch`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        retention_policy: {
          delivered_days,
          unknown_days,
          sent_days,
        },
        cutoff_dates: {
          delivered: deliveredCutoff.toISOString(),
          unknown: unknownCutoff.toISOString(),
          sent: sentCutoff.toISOString(),
        },
        results,
        message: dry_run 
          ? `Dry run complete. ${totalToDelete} events would be deleted (~${results.total_freed_estimate_mb}MB). Run with dry_run: false to execute.`
          : `Cleanup complete. Deleted ${results.delivered.deleted + results.unknown.deleted + results.sent.deleted} events.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
