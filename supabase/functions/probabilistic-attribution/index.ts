import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * ================================================================================
 * PROBABILISTIC ATTRIBUTION - DISABLED
 * ================================================================================
 * 
 * This function has been DISABLED as part of the attribution system hardening.
 * 
 * REASON FOR DISABLING:
 * - We do not have per-donor Meta data (clicks, impressions, touchpoints)
 * - The attribution_touchpoints table contains only "other" type records
 * - Timing-based correlation with active campaigns creates misleading attribution
 * - Confidence scores were not empirically calibrated
 * 
 * This function should only be re-enabled if:
 * 1. We have genuine donor-level touchpoint data (e.g., SMS clicks with phone hash)
 * 2. Confidence scores are properly calibrated against holdout tests
 * 
 * For now, all attribution should flow through:
 * - auto-match-attribution (for refcode->campaign mapping)
 * - Direct query of actblue_transactions + campaign_attribution
 * ================================================================================
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[PROBABILISTIC-ATTRIBUTION] Function is DISABLED - see header comments for rationale');

  return new Response(
    JSON.stringify({
      success: false,
      disabled: true,
      message: 'Probabilistic attribution is disabled. Use auto-match-attribution for refcode-based matching.',
      reason: 'No per-donor Meta data available. Timing-based correlation creates misleading attribution.',
      recommendation: 'Use campaign_attribution table with is_deterministic=true records for reliable attribution.'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
