import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, checkRateLimit } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();
const PIXEL_ID = "1344961220416600";
const API_VERSION = "v22.0";

function computeNextRetryAt(attempts: number): string {
  const delayMinutes = Math.min(60, 5 * Math.pow(2, Math.max(0, attempts - 1)));
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rateLimit = await checkRateLimit('retry-meta-conversions', 12, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = Deno.env.get('META_CONVERSIONS_API_TOKEN');
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Conversions API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();
    const { data: queueItems, error: queueError } = await supabase
      .from('meta_conversion_retry_queue')
      .select('*')
      .lte('next_retry_at', now)
      .order('next_retry_at', { ascending: true })
      .limit(25);

    if (queueError) throw queueError;

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, sent: 0, failed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sent = 0;
    let failed = 0;

    for (const item of queueItems) {
      const conversionEvent = item.event_payload;
      const apiUrl = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [conversionEvent],
          access_token: accessToken,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        sent += 1;
        await supabase
          .from('meta_conversion_events')
          .update({
            status: 'sent',
            delivered_at: new Date().toISOString(),
            meta_response: {
              events_received: result.events_received,
              fbtrace_id: result.fbtrace_id,
            },
            last_error: null,
            next_retry_at: null,
          })
          .eq('id', item.meta_conversion_event_id);

        await supabase
          .from('meta_conversion_retry_queue')
          .delete()
          .eq('id', item.id);
      } else {
        failed += 1;
        const attempts = (item.attempts || 0) + 1;
        const nextRetryAt = computeNextRetryAt(attempts);

        await supabase
          .from('meta_conversion_retry_queue')
          .update({
            attempts,
            last_error: JSON.stringify(result),
            next_retry_at: nextRetryAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        await supabase
          .from('meta_conversion_events')
          .update({
            status: 'failed',
            retry_count: attempts,
            next_retry_at: nextRetryAt,
            last_error: JSON.stringify(result),
            meta_response: result,
          })
          .eq('id', item.meta_conversion_event_id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: queueItems.length, sent, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[retry-meta-conversions] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
