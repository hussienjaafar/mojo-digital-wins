import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { channel, batch_size = 20, organization_id } = await req.json();

    const results = {
      sms_processed: 0,
      meta_processed: 0,
      sms_errors: 0,
      meta_errors: 0,
      duration_ms: 0
    };

    const startTime = Date.now();

    // Process SMS creatives if requested or no channel specified
    if (!channel || channel === 'sms') {
      let smsQuery = supabase
        .from('sms_creative_insights')
        .select('id, message_text')
        .is('ai_analyzed', false)
        .not('message_text', 'is', null)
        .limit(batch_size);

      if (organization_id) {
        smsQuery = smsQuery.eq('organization_id', organization_id);
      }

      const { data: smsCreatives, error: smsError } = await smsQuery;

      if (smsError) {
        console.error('Error fetching SMS creatives:', smsError);
      } else if (smsCreatives && smsCreatives.length > 0) {
        console.log(`Processing ${smsCreatives.length} SMS creatives`);

        // Call analyze-sms-creatives function
        const { error: analyzeError } = await supabase.functions.invoke('analyze-sms-creatives', {
          body: { batch_size, organization_id }
        });

        if (analyzeError) {
          console.error('Error analyzing SMS creatives:', analyzeError);
          results.sms_errors = smsCreatives.length;
        } else {
          results.sms_processed = smsCreatives.length;
        }
      }
    }

    // Process Meta creatives if requested or no channel specified
    if (!channel || channel === 'meta') {
      let metaQuery = supabase
        .from('meta_creative_insights')
        .select('id, primary_text, headline, description')
        .is('ai_analyzed', false)
        .limit(batch_size);

      if (organization_id) {
        metaQuery = metaQuery.eq('organization_id', organization_id);
      }

      const { data: metaCreatives, error: metaError } = await metaQuery;

      if (metaError) {
        console.error('Error fetching Meta creatives:', metaError);
      } else if (metaCreatives && metaCreatives.length > 0) {
        console.log(`Processing ${metaCreatives.length} Meta creatives`);

        // Call analyze-meta-creatives function
        const { error: analyzeError } = await supabase.functions.invoke('analyze-meta-creatives', {
          body: { batch_size, organization_id }
        });

        if (analyzeError) {
          console.error('Error analyzing Meta creatives:', analyzeError);
          results.meta_errors = metaCreatives.length;
        } else {
          results.meta_processed = metaCreatives.length;
        }
      }
    }

    results.duration_ms = Date.now() - startTime;

    // Get remaining counts
    const { count: smsRemaining } = await supabase
      .from('sms_creative_insights')
      .select('*', { count: 'exact', head: true })
      .is('ai_analyzed', false)
      .not('message_text', 'is', null);

    const { count: metaRemaining } = await supabase
      .from('meta_creative_insights')
      .select('*', { count: 'exact', head: true })
      .is('ai_analyzed', false);

    console.log(`Backfill complete. SMS: ${results.sms_processed}, Meta: ${results.meta_processed}`);
    console.log(`Remaining - SMS: ${smsRemaining}, Meta: ${metaRemaining}`);

    return new Response(JSON.stringify({
      success: true,
      results,
      remaining: {
        sms: smsRemaining || 0,
        meta: metaRemaining || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Backfill error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
