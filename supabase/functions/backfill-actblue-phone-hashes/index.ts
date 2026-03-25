import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { computePhoneHash } from "../_shared/phoneHash.ts";
import { validateCronSecret } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Backfill Phone Hashes to ActBlue Transactions
 * 
 * This function:
 * 1. Finds actblue_transactions with phone but no phone_hash
 * 2. Computes standardized SHA-256 hash using shared utility
 * 3. Updates transactions with phone_hash for identity matching
 * 
 * Run once for historical data, then incrementally via webhook.
 */

interface BackfillResult {
  transactions_processed: number;
  hashes_created: number;
  skipped_invalid: number;
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
    const { 
      organization_id, 
      all_organizations = false,
      batch_size = 1000,
      max_batches = 10 
    } = body;

    const result: BackfillResult = {
      transactions_processed: 0,
      hashes_created: 0,
      skipped_invalid: 0,
      errors: [],
    };

    let batchCount = 0;
    let hasMore = true;

    while (hasMore && batchCount < max_batches) {
      batchCount++;
      
      // Fetch transactions with phone but no phone_hash
      let query = supabase
        .from('actblue_transactions')
        .select('id, phone')
        .not('phone', 'is', null)
        .is('phone_hash', null)
        .limit(batch_size);

      if (organization_id && !all_organizations) {
        query = query.eq('organization_id', organization_id);
      }

      const { data: transactions, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(`Failed to fetch transactions: ${fetchError.message}`);
      }

      if (!transactions || transactions.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`[BACKFILL-PHONE] Processing batch ${batchCount} with ${transactions.length} transactions`);

      // Process in smaller chunks to avoid timeout
      const chunkSize = 100;
      for (let i = 0; i < transactions.length; i += chunkSize) {
        const chunk = transactions.slice(i, i + chunkSize);
        
        const updates: { id: string; phone_hash: string }[] = [];
        
        for (const tx of chunk) {
          result.transactions_processed++;
          
          const hash = await computePhoneHash(tx.phone);
          
          if (hash) {
            updates.push({ id: tx.id, phone_hash: hash });
          } else {
            result.skipped_invalid++;
          }
        }

        // Batch update using individual updates (Supabase doesn't support bulk update with different values)
        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('actblue_transactions')
            .update({ phone_hash: update.phone_hash })
            .eq('id', update.id);

          if (updateError) {
            result.errors.push(`TX ${update.id}: ${updateError.message}`);
          } else {
            result.hashes_created++;
          }
        }
      }

      // Check if we got a full batch (might have more)
      hasMore = transactions.length === batch_size;
    }

    const duration = Date.now() - startTime;
    console.log(`[BACKFILL-PHONE] Complete in ${duration}ms - processed: ${result.transactions_processed}, created: ${result.hashes_created}, skipped: ${result.skipped_invalid}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        batches_processed: batchCount,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BACKFILL-PHONE] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
