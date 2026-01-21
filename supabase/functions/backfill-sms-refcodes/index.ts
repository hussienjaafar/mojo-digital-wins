import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveVanityUrl } from "../_shared/urlResolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface BackfillResult {
  campaigns_processed: number;
  refcodes_resolved: number;
  already_resolved: number;
  failed: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const result: BackfillResult = {
    campaigns_processed: 0,
    refcodes_resolved: 0,
    already_resolved: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Validate authorization - cron secret, service role, or admin user
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    let isAuthorized = false;
    
    // Check cron secret
    if (cronSecret && cronSecret === expectedCronSecret) {
      isAuthorized = true;
    }
    
    // Check service role key
    if (!isAuthorized && authHeader === `Bearer ${serviceRoleKey}`) {
      isAuthorized = true;
    }
    
    // Check admin JWT
    if (!isAuthorized && authHeader?.startsWith("Bearer ")) {
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
          console.log("[BACKFILL] Authorized via admin JWT");
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body for optional filters
    let organizationId: string | null = null;
    let limit = 100;
    let forceReprocess = false;
    
    try {
      const body = await req.json();
      organizationId = body.organization_id || null;
      limit = body.limit || 100;
      forceReprocess = body.force_reprocess || false;
    } catch {
      // No body or invalid JSON
    }

    console.log(`[BACKFILL] Starting SMS refcode backfill (org: ${organizationId || 'all'}, limit: ${limit}, force: ${forceReprocess})`);

    // Query campaigns that need refcode resolution
    let query = supabase
      .from("sms_campaigns")
      .select("id, campaign_name, destination_url, extracted_refcode, actblue_refcode")
      .not("destination_url", "is", null);

    // Only process campaigns without actblue_refcode (unless forcing)
    if (!forceReprocess) {
      query = query.is("actblue_refcode", null);
    }

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    query = query.limit(limit);

    const { data: campaigns, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch campaigns: ${fetchError.message}`);
    }

    if (!campaigns || campaigns.length === 0) {
      console.log("[BACKFILL] No campaigns need refcode resolution");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No campaigns to process",
          ...result,
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[BACKFILL] Processing ${campaigns.length} campaigns`);

    // Process each campaign
    for (const campaign of campaigns) {
      result.campaigns_processed++;

      // Skip if already has actblue_refcode (unless forcing)
      if (campaign.actblue_refcode && !forceReprocess) {
        result.already_resolved++;
        continue;
      }

      if (!campaign.destination_url) {
        continue;
      }

      try {
        console.log(`[BACKFILL] Resolving URL for "${campaign.campaign_name}": ${campaign.destination_url}`);
        
        const resolved = await resolveVanityUrl(campaign.destination_url);

        if (resolved.success && (resolved.actblueRefcode || resolved.actblueForm)) {
          // Use refcode if available, otherwise use form name
          const actblueRefcode = resolved.actblueRefcode || resolved.actblueForm;
          
          const { error: updateError } = await supabase
            .from("sms_campaigns")
            .update({
              actblue_refcode: actblueRefcode,
              updated_at: new Date().toISOString(),
            })
            .eq("id", campaign.id);

          if (updateError) {
            result.errors.push(`Campaign ${campaign.id}: Update failed - ${updateError.message}`);
            result.failed++;
          } else {
            result.refcodes_resolved++;
            console.log(`[BACKFILL] Resolved "${campaign.campaign_name}": ${campaign.extracted_refcode} -> ${actblueRefcode}`);
          }
        } else {
          console.log(`[BACKFILL] Could not resolve ActBlue refcode for "${campaign.campaign_name}": ${resolved.error || 'No ActBlue URL found'}`);
          result.failed++;
          if (resolved.error) {
            result.errors.push(`Campaign ${campaign.id}: ${resolved.error}`);
          }
        }

        // Rate limiting: 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Campaign ${campaign.id}: ${errMsg}`);
        result.failed++;
      }
    }

    console.log(`[BACKFILL] Complete: ${result.refcodes_resolved} resolved, ${result.failed} failed, ${result.already_resolved} already had refcodes`);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        duration_ms: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[BACKFILL] Failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errMsg,
        ...result,
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
