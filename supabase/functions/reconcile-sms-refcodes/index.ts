import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { extractRefcodeFromMessage } from "../_shared/smsRefcodeExtractor.ts";
import { validateCronSecret } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Reconcile SMS Refcodes
 * 
 * This function:
 * 1. Scans sms_campaigns for campaigns with message_text
 * 2. Extracts refcodes from destination URLs
 * 3. Updates sms_campaigns with extracted_refcode and destination_url
 * 4. Creates/updates refcode_mappings with platform='sms'
 * 
 * Run periodically (every 6 hours) or after SMS sync.
 */

interface ReconcileResult {
  campaigns_processed: number;
  refcodes_extracted: number;
  mappings_created: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    
    let isAuthorized = false;
    
    // Cron secret validation (takes full Request object)
    if (validateCronSecret(req)) {
      isAuthorized = true;
    }
    
    // Service role key validation (for internal invocations)
    if (!isAuthorized && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      if (token === serviceRoleKey) {
        isAuthorized = true;
      }
    }
    
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { organization_id, all_organizations = false } = body;

    const result: ReconcileResult = {
      campaigns_processed: 0,
      refcodes_extracted: 0,
      mappings_created: 0,
      errors: [],
    };

    // Build query for SMS campaigns
    let query = supabase
      .from('sms_campaigns')
      .select('id, organization_id, campaign_id, campaign_name, message_text, send_date, extracted_refcode')
      .not('message_text', 'is', null);

    if (organization_id && !all_organizations) {
      query = query.eq('organization_id', organization_id);
    }

    // Only process campaigns without extracted refcode, or all if forcing
    if (!body.force_reprocess) {
      query = query.is('extracted_refcode', null);
    }

    const { data: campaigns, error: fetchError } = await query.order('send_date', { ascending: false }).limit(500);

    if (fetchError) {
      throw new Error(`Failed to fetch SMS campaigns: ${fetchError.message}`);
    }

    console.log(`[RECONCILE-SMS] Processing ${campaigns?.length || 0} campaigns`);

    for (const campaign of (campaigns || [])) {
      result.campaigns_processed++;
      
      try {
        // Extract refcode from message text
        const extracted = extractRefcodeFromMessage(campaign.message_text);
        
        if (extracted.refcode) {
          result.refcodes_extracted++;
          
          // Update sms_campaigns with extracted data
          const { error: updateError } = await supabase
            .from('sms_campaigns')
            .update({
              extracted_refcode: extracted.refcode,
              destination_url: extracted.url,
            })
            .eq('id', campaign.id);

          if (updateError) {
            console.error(`[RECONCILE-SMS] Error updating campaign ${campaign.campaign_id}:`, updateError);
            result.errors.push(`Campaign ${campaign.campaign_id}: ${updateError.message}`);
            continue;
          }

          // Create/update refcode mapping
          const { error: mappingError } = await supabase
            .from('refcode_mappings')
            .upsert({
              organization_id: campaign.organization_id,
              refcode: extracted.refcode,
              platform: 'sms',
              sms_campaign_id: campaign.campaign_id,
              campaign_name: campaign.campaign_name,
              updated_at: new Date().toISOString(),
            }, { 
              onConflict: 'organization_id,refcode',
              ignoreDuplicates: false 
            });

          if (mappingError) {
            console.error(`[RECONCILE-SMS] Error creating mapping for ${extracted.refcode}:`, mappingError);
            result.errors.push(`Mapping ${extracted.refcode}: ${mappingError.message}`);
          } else {
            result.mappings_created++;
          }
          
          console.log(`[RECONCILE-SMS] Extracted refcode "${extracted.refcode}" from campaign "${campaign.campaign_name}" (pattern: ${extracted.pattern})`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[RECONCILE-SMS] Error processing campaign ${campaign.campaign_id}:`, errMsg);
        result.errors.push(`Campaign ${campaign.campaign_id}: ${errMsg}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[RECONCILE-SMS] Complete in ${duration}ms - processed: ${result.campaigns_processed}, extracted: ${result.refcodes_extracted}, mappings: ${result.mappings_created}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RECONCILE-SMS] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
