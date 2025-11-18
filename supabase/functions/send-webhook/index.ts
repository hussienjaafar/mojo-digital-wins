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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { event_type, payload } = await req.json();

    console.log(`Processing webhook event: ${event_type}`);

    // Get active webhook configs for this event type
    const { data: webhooks } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('is_active', true)
      .contains('event_types', [event_type]);

    if (!webhooks || webhooks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No webhooks configured for this event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let deliveredCount = 0;
    let failedCount = 0;

    for (const webhook of webhooks) {
      try {
        // Create delivery record
        const { data: delivery } = await supabase
          .from('webhook_deliveries')
          .insert({
            webhook_id: webhook.id,
            event_type,
            payload,
            status: 'sending'
          })
          .select()
          .single();

        // Send webhook
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(webhook.headers || {})
        };

        // Add signature if secret is configured
        if (webhook.secret) {
          const signature = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(webhook.secret + JSON.stringify(payload))
          );
          headers['X-Webhook-Signature'] = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        const responseBody = await response.text();

        // Update delivery status
        await supabase
          .from('webhook_deliveries')
          .update({
            status: response.ok ? 'delivered' : 'failed',
            response_code: response.status,
            response_body: responseBody.substring(0, 1000),
            delivered_at: response.ok ? new Date().toISOString() : null,
            error_message: response.ok ? null : `HTTP ${response.status}`
          })
          .eq('id', delivery.id);

        if (response.ok) {
          deliveredCount++;
        } else {
          failedCount++;
        }

      } catch (error: any) {
        failedCount++;
        console.error(`Error sending webhook to ${webhook.url}:`, error);
      }
    }

    console.log(`Webhooks sent: ${deliveredCount} delivered, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        delivered: deliveredCount,
        failed: failedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-webhook:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
