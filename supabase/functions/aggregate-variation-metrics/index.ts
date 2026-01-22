import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Aggregate Variation Metrics - DISABLED
 * 
 * This function previously distributed parent ad metrics to variations when Meta's 
 * asset-level breakdown API returned empty data. This created misleading "estimated" 
 * metrics that appeared to show variation performance differences when none existed.
 * 
 * The function is now disabled. Per-variation performance data is only available 
 * for Dynamic Creative (DCO) ads where Meta provides actual asset-level breakdowns.
 * 
 * For standard ads, the UI now shows a clear message explaining this limitation
 * rather than displaying fake distributed metrics.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[AGGREGATE VARIATION METRICS] Function called but is now disabled');
  console.log('[AGGREGATE VARIATION METRICS] Meta only provides per-variation metrics for Dynamic Creative (DCO) ads');

  return new Response(
    JSON.stringify({
      success: true,
      message: 'This function is disabled. Per-variation metrics are only available for Dynamic Creative ads where Meta provides actual asset-level breakdowns.',
      processed: 0,
      updated: 0,
      reason: 'Distributing parent metrics equally to variations creates misleading data',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
