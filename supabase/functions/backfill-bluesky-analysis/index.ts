import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseJsonBody, z } from "../_shared/validators.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting backfill of unprocessed Bluesky posts...');

     const bodySchema = z.object({
       batchSize: z.coerce.number().int().min(1).max(1000).optional().default(500),
       maxBatches: z.coerce.number().int().min(1).max(50).optional().default(10),
     }).passthrough();

     const parsedBody = await parseJsonBody(req, bodySchema, { allowEmpty: true, allowInvalidJson: true });
     const { batchSize, maxBatches } = parsedBody.ok ? parsedBody.data : { batchSize: 500, maxBatches: 10 };

    let totalProcessed = 0;
    let batchCount = 0;

    while (batchCount < maxBatches) {
      // Invoke analyze-bluesky-posts function
      const { data, error } = await supabase.functions.invoke('analyze-bluesky-posts', {
        body: { batchSize }
      });

      if (error) {
        console.error(`❌ Error in batch ${batchCount + 1}:`, error);
        break;
      }

      console.log(`✅ Batch ${batchCount + 1} complete:`, data);
      
      if (data.processed === 0) {
        console.log('✅ No more posts to process');
        break;
      }

      totalProcessed += data.processed;
      batchCount++;

      // Small delay between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalProcessed,
        batchesRun: batchCount,
        message: `Processed ${totalProcessed} posts in ${batchCount} batches`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in backfill-bluesky-analysis:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
