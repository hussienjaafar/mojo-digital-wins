import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface SyncResult {
  organizations_processed: number;
  campaigns_updated: number;
  total_conversions: number;
  total_amount_raised: number;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const result: SyncResult = {
    organizations_processed: 0,
    campaigns_updated: 0,
    total_conversions: 0,
    total_amount_raised: 0,
    errors: [],
  };

  try {
    // Validate authorization
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    const expectedCronSecret = Deno.env.get("CRON_SECRET");

    if (cronSecret !== expectedCronSecret && !authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for optional organization filter
    let organizationId: string | null = null;
    try {
      const body = await req.json();
      organizationId = body.organization_id || null;
    } catch {
      // No body or invalid JSON, process all organizations
    }

    // Get all SMS campaigns with extracted refcodes
    let campaignsQuery = supabase
      .from("sms_campaigns")
      .select("id, campaign_id, organization_id, extracted_refcode, campaign_name, send_date")
      .not("extracted_refcode", "is", null);

    if (organizationId) {
      campaignsQuery = campaignsQuery.eq("organization_id", organizationId);
    }

    const { data: smsCampaigns, error: campaignsError } = await campaignsQuery;

    if (campaignsError) {
      throw new Error(`Failed to fetch SMS campaigns: ${campaignsError.message}`);
    }

    if (!smsCampaigns || smsCampaigns.length === 0) {
      console.log("No SMS campaigns with extracted refcodes found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No SMS campaigns to process",
          ...result,
          duration_ms: Date.now() - startTime 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group campaigns by organization for efficient processing
    const campaignsByOrg: Record<string, typeof smsCampaigns> = {};
    for (const campaign of smsCampaigns) {
      if (!campaignsByOrg[campaign.organization_id]) {
        campaignsByOrg[campaign.organization_id] = [];
      }
      campaignsByOrg[campaign.organization_id].push(campaign);
    }

    // Process each organization
    for (const [orgId, campaigns] of Object.entries(campaignsByOrg)) {
      result.organizations_processed++;

      try {
        // Get all transactions for this organization
        const { data: transactions, error: txError } = await supabase
          .from("actblue_transactions")
          .select("id, refcode, amount, contribution_form, transaction_date")
          .eq("organization_id", orgId);

        if (txError) {
          result.errors.push(`Org ${orgId}: Failed to fetch transactions - ${txError.message}`);
          continue;
        }

        if (!transactions || transactions.length === 0) {
          continue;
        }

        // For each campaign, find matching transactions
        for (const campaign of campaigns) {
          try {
            const refcode = campaign.extracted_refcode?.toLowerCase();
            if (!refcode) continue;

            // Match transactions by:
            // 1. Direct refcode match (case-insensitive)
            // 2. Contribution form containing 'sms' + matching patterns
            // 3. Date proximity for campaigns with similar naming
            const matchingTx = transactions.filter(tx => {
              const txRefcode = tx.refcode?.toLowerCase() || "";
              const formName = tx.contribution_form?.toLowerCase() || "";
              
              // Direct match
              if (txRefcode.includes(refcode) || refcode.includes(txRefcode)) {
                return true;
              }
              
              // Form-based SMS attribution (e.g., "moliticosms")
              if (formName.includes("sms") || formName.includes("text")) {
                // Check if the refcode contains campaign identifiers
                const campaignName = campaign.campaign_name?.toLowerCase() || "";
                if (campaignName && txRefcode && (
                  campaignName.includes(txRefcode) || 
                  txRefcode.includes(campaignName.substring(0, 4))
                )) {
                  return true;
                }
              }
              
              return false;
            });

            const conversions = matchingTx.length;
            const amountRaised = matchingTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);

            if (conversions > 0) {
              // Update the campaign with attribution data
              const { error: updateError } = await supabase
                .from("sms_campaigns")
                .update({
                  conversions,
                  amount_raised: amountRaised,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", campaign.id);

              if (updateError) {
                result.errors.push(`Campaign ${campaign.campaign_id}: Update failed - ${updateError.message}`);
              } else {
                result.campaigns_updated++;
                result.total_conversions += conversions;
                result.total_amount_raised += amountRaised;
                console.log(`Updated campaign ${campaign.campaign_id}: ${conversions} conversions, $${amountRaised.toFixed(2)}`);
              }
            }
          } catch (campaignError) {
            const errMsg = campaignError instanceof Error ? campaignError.message : String(campaignError);
            result.errors.push(`Campaign ${campaign.campaign_id}: ${errMsg}`);
          }
        }
      } catch (orgError) {
        const errMsg = orgError instanceof Error ? orgError.message : String(orgError);
        result.errors.push(`Org ${orgId}: ${errMsg}`);
      }
    }

    console.log(`Sync complete: ${result.campaigns_updated} campaigns updated with ${result.total_conversions} conversions ($${result.total_amount_raised.toFixed(2)})`);

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
    console.error("SMS attribution sync failed:", error);
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
