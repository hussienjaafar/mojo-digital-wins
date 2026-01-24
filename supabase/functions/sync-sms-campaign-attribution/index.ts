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

interface Campaign {
  id: string;
  campaign_id: string;
  organization_id: string;
  extracted_refcode: string | null;
  actblue_refcode: string | null;
  actblue_form: string | null;
  campaign_name: string | null;
  send_date: string;
}

interface Transaction {
  id: string;
  refcode: string | null;
  amount: number;
  contribution_form: string | null;
  transaction_date: string;
  donor_email: string | null;
}

interface MatchResult {
  campaign_id: string;
  transaction_id: string;
  amount: number;
  score: number;
}

/**
 * Calculate match score between a campaign and transaction
 * Uses tiered matching logic based on refcode patterns
 * 
 * PRIORITY ORDER:
 * 1. Exact actblue_refcode match (resolved from vanity URL) - Score 200
 * 2. Direct extracted_refcode match - Score 180
 * 3. Date-coded refcode pattern matching - Score 150/100
 * 3.5. ActBlue form name match - Score 140
 * 4. Extracted refcode in form path - Score 120
 * 5. Generic SMS/text form match (fallback) - Score 50
 */
function calculateMatchScore(campaign: Campaign, transaction: Transaction): number {
  const txRefcode = transaction.refcode?.toLowerCase() || "";
  const extractedRefcode = campaign.extracted_refcode?.toLowerCase() || "";
  const actblueRefcode = campaign.actblue_refcode?.toLowerCase() || "";
  const actblueForm = campaign.actblue_form?.toLowerCase() || "";
  const formName = transaction.contribution_form?.toLowerCase() || "";
  
  // Check if this could possibly be an SMS-related transaction
  const hasSmsIndicator = txRefcode || formName.includes('sms') || formName.includes('text') || 
    (actblueForm && formName.includes(actblueForm));
  
  if (!hasSmsIndicator) {
    return 0; // No refcode and not SMS form - no match possible
  }
  
  const campaignDate = new Date(campaign.send_date);
  const txDate = new Date(transaction.transaction_date);
  const daysDiff = Math.abs((txDate.getTime() - campaignDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Tier 1: Explicit actblue_refcode match (highest priority - deterministic)
  // This is the resolved refcode from following vanity URL redirects
  if (actblueRefcode && txRefcode) {
    if (txRefcode === actblueRefcode) {
      return 200;
    }
    // Also match if transaction refcode contains the actblue refcode or vice versa
    // This handles cases like "20250115AAMA" matching "aama" (the form name)
    if (txRefcode.endsWith(actblueRefcode) || actblueRefcode.includes(txRefcode)) {
      return 195;
    }
  }
  
  // Tier 2: Direct extracted_refcode match (vanity path match)
  if (extractedRefcode && txRefcode) {
    if (txRefcode === extractedRefcode) return 180;
    if (txRefcode.startsWith(extractedRefcode) || extractedRefcode.startsWith(txRefcode)) return 175;
  }
  
  // Tier 3: Date-coded refcode with token match
  // E.g., '20250115AAMA' matches campaign with send_date 2025-01-15 and extracted_refcode containing 'aama'
  const dateCodedMatch = txRefcode.match(/^(20\d{6})([a-z]+)$/i);
  if (dateCodedMatch && (extractedRefcode || actblueRefcode)) {
    const [, dateStr, token] = dateCodedMatch;
    try {
      const refcodeDate = new Date(
        parseInt(dateStr.substring(0, 4)),
        parseInt(dateStr.substring(4, 6)) - 1,
        parseInt(dateStr.substring(6, 8))
      );
      const refcodeDaysDiff = Math.abs((refcodeDate.getTime() - campaignDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (refcodeDaysDiff <= 1) {
        const tokenLower = token.toLowerCase();
        
        // Check against actblue_refcode first (more reliable)
        if (actblueRefcode && (actblueRefcode.includes(tokenLower) || tokenLower.includes(actblueRefcode))) {
          return 160; // Higher score for actblue_refcode match
        }
        
        // Fallback to extracted refcode
        const extractedClean = extractedRefcode.replace(/[0-9]/g, '');
        if (extractedRefcode.includes(tokenLower) || tokenLower.includes(extractedClean)) {
          return 150;
        }
        
        // Date matches but token doesn't - lower confidence match
        return 100;
      }
    } catch {
      // Invalid date parsing, skip this tier
    }
  }
  
  // Tier 3.5: ActBlue form name match (campaign's form matches transaction's contribution form)
  // E.g., Campaign has actblue_form='ahamawytext' matches transaction.contribution_form containing 'ahamawytext'
  if (actblueForm && formName) {
    // Exact or partial form name match within 14 days
    if (formName.includes(actblueForm) || actblueForm.includes(formName.split('/').pop() || '')) {
      if (daysDiff <= 14) {
        return 140;
      } else if (daysDiff <= 30) {
        return 130; // Slightly lower for older matches
      }
    }
  }
  
  // Tier 4: Extracted refcode matches form name pattern
  // E.g., extracted_refcode='nakba' matches contribution_form containing 'nakba'
  if (extractedRefcode && formName) {
    const formPath = formName.split('/').pop()?.split('?')[0] || formName;
    if (formPath.includes(extractedRefcode) || extractedRefcode.includes(formPath)) {
      if (daysDiff <= 14) {
        return 120;
      } else if (daysDiff <= 30) {
        return 110;
      }
    }
  }
  
  // Tier 5: Generic SMS/text form-based attribution within 3 days of campaign
  if ((formName.includes('sms') || formName.includes('text')) && daysDiff <= 3) {
    return 50;
  }
  
  return 0;
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
      .select("id, campaign_id, organization_id, extracted_refcode, actblue_refcode, actblue_form, campaign_name, send_date")
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
    const campaignsByOrg: Record<string, Campaign[]> = {};
    for (const campaign of smsCampaigns) {
      if (!campaignsByOrg[campaign.organization_id]) {
        campaignsByOrg[campaign.organization_id] = [];
      }
      campaignsByOrg[campaign.organization_id].push(campaign as Campaign);
    }

    // Process each organization
    for (const [orgId, campaigns] of Object.entries(campaignsByOrg)) {
      result.organizations_processed++;

      try {
        // Get all transactions for this organization
        const { data: transactions, error: txError } = await supabase
          .from("actblue_transactions")
          .select("id, refcode, amount, contribution_form, transaction_date, donor_email")
          .eq("organization_id", orgId);

        if (txError) {
          result.errors.push(`Org ${orgId}: Failed to fetch transactions - ${txError.message}`);
          continue;
        }

        if (!transactions || transactions.length === 0) {
          continue;
        }

        // Build match results for all campaign-transaction pairs
        const allMatches: MatchResult[] = [];
        
        for (const campaign of campaigns) {
          for (const tx of transactions) {
            const score = calculateMatchScore(campaign, tx as Transaction);
            if (score > 0) {
              allMatches.push({
                campaign_id: campaign.id,
                transaction_id: tx.id,
                amount: tx.amount || 0,
                score,
              });
            }
          }
        }

        // For each transaction, keep only the best match
        const txBestMatch: Record<string, MatchResult> = {};
        for (const match of allMatches) {
          const existing = txBestMatch[match.transaction_id];
          if (!existing || match.score > existing.score) {
            txBestMatch[match.transaction_id] = match;
          }
        }

        // Aggregate by campaign
        const campaignStats: Record<string, { conversions: number; amount_raised: number }> = {};
        for (const match of Object.values(txBestMatch)) {
          if (!campaignStats[match.campaign_id]) {
            campaignStats[match.campaign_id] = { conversions: 0, amount_raised: 0 };
          }
          campaignStats[match.campaign_id].conversions++;
          campaignStats[match.campaign_id].amount_raised += match.amount;
        }

        // Update each campaign with attribution data
        for (const [campaignId, stats] of Object.entries(campaignStats)) {
          try {
            const { error: updateError } = await supabase
              .from("sms_campaigns")
              .update({
                conversions: stats.conversions,
                amount_raised: stats.amount_raised,
                updated_at: new Date().toISOString(),
              })
              .eq("id", campaignId);

            if (updateError) {
              result.errors.push(`Campaign ${campaignId}: Update failed - ${updateError.message}`);
            } else {
              result.campaigns_updated++;
              result.total_conversions += stats.conversions;
              result.total_amount_raised += stats.amount_raised;
              console.log(`Updated campaign ${campaignId}: ${stats.conversions} conversions, $${stats.amount_raised.toFixed(2)}`);
            }
          } catch (campaignError) {
            const errMsg = campaignError instanceof Error ? campaignError.message : String(campaignError);
            result.errors.push(`Campaign ${campaignId}: ${errMsg}`);
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