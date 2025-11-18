import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  event_type: string;
  title: string;
  message: string;
  threat_level?: string;
  source_type?: string;
  source_url?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

function formatSlackMessage(payload: WebhookPayload): any {
  const emoji = payload.threat_level === 'critical' ? '🚨' :
                payload.threat_level === 'high' ? '⚠️' :
                payload.event_type === 'breaking_news' ? '📰' : '📊';

  const color = payload.threat_level === 'critical' ? '#dc2626' :
                payload.threat_level === 'high' ? '#ea580c' :
                payload.threat_level === 'medium' ? '#ca8a04' : '#2563eb';

  return {
    attachments: [{
      color,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${payload.title}`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: payload.message
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*Type:* ${payload.source_type || payload.event_type} | *Level:* ${payload.threat_level || 'N/A'} | *Time:* ${new Date(payload.timestamp).toLocaleString()}`
            }
          ]
        }
      ]
    }]
  };
}

function formatTeamsMessage(payload: WebhookPayload): any {
  const color = payload.threat_level === 'critical' ? 'attention' :
                payload.threat_level === 'high' ? 'warning' :
                payload.threat_level === 'medium' ? 'accent' : 'good';

  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: payload.threat_level === 'critical' ? 'dc2626' :
                payload.threat_level === 'high' ? 'ea580c' :
                payload.threat_level === 'medium' ? 'ca8a04' : '2563eb',
    summary: payload.title,
    sections: [{
      activityTitle: payload.title,
      activitySubtitle: `${payload.source_type || payload.event_type} • ${payload.threat_level || 'Info'}`,
      text: payload.message,
      facts: [
        { name: 'Event Type', value: payload.event_type },
        { name: 'Threat Level', value: payload.threat_level || 'N/A' },
        { name: 'Time', value: new Date(payload.timestamp).toLocaleString() }
      ]
    }],
    potentialAction: payload.source_url ? [{
      '@type': 'OpenUri',
      name: 'View Details',
      targets: [{ os: 'default', uri: payload.source_url }]
    }] : []
  };
}

function formatDiscordMessage(payload: WebhookPayload): any {
  const emoji = payload.threat_level === 'critical' ? '🚨' :
                payload.threat_level === 'high' ? '⚠️' :
                payload.event_type === 'breaking_news' ? '📰' : '📊';

  const color = payload.threat_level === 'critical' ? 0xdc2626 :
                payload.threat_level === 'high' ? 0xea580c :
                payload.threat_level === 'medium' ? 0xca8a04 : 0x2563eb;

  return {
    embeds: [{
      title: `${emoji} ${payload.title}`,
      description: payload.message,
      color,
      fields: [
        { name: 'Type', value: payload.source_type || payload.event_type, inline: true },
        { name: 'Level', value: payload.threat_level || 'Info', inline: true },
      ],
      timestamp: payload.timestamp,
      footer: {
        text: 'Intelligence Alert System'
      }
    }]
  };
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

    const body = await req.json();
    const { event_type, payload, webhook_ids, user_id } = body;

    if (!event_type || !payload) {
      throw new Error('event_type and payload are required');
    }

    console.log(`Sending webhook for event: ${event_type}`);

    // Get webhooks to send to
    let webhooksQuery = supabase
      .from('webhook_configs')
      .select('*')
      .eq('is_enabled', true)
      .contains('events', [event_type]);

    if (webhook_ids && webhook_ids.length > 0) {
      webhooksQuery = webhooksQuery.in('id', webhook_ids);
    }

    if (user_id) {
      webhooksQuery = webhooksQuery.eq('user_id', user_id);
    }

    const { data: webhooks, error: webhooksError } = await webhooksQuery;

    if (webhooksError) throw webhooksError;

    if (!webhooks || webhooks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No webhooks configured for this event', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];

    for (const webhook of webhooks) {
      const startTime = Date.now();
      let deliveryId: string | null = null;

      try {
        // Format payload based on webhook type
        let formattedPayload: any;
        const webhookPayload: WebhookPayload = {
          event_type,
          timestamp: new Date().toISOString(),
          ...payload
        };

        switch (webhook.webhook_type) {
          case 'slack':
            formattedPayload = formatSlackMessage(webhookPayload);
            break;
          case 'teams':
            formattedPayload = formatTeamsMessage(webhookPayload);
            break;
          case 'discord':
            formattedPayload = formatDiscordMessage(webhookPayload);
            break;
          default:
            formattedPayload = webhookPayload;
        }

        // Create delivery record
        const { data: delivery } = await supabase
          .from('webhook_deliveries')
          .insert({
            webhook_id: webhook.id,
            event_type,
            payload: formattedPayload,
            status: 'pending',
          })
          .select('id')
          .single();

        deliveryId = delivery?.id;

        // Send webhook
        const response = await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(webhook.secret_key ? { 'X-Webhook-Secret': webhook.secret_key } : {})
          },
          body: JSON.stringify(formattedPayload),
        });

        const duration = Date.now() - startTime;
        const responseBody = await response.text();

        // Update delivery record
        if (deliveryId) {
          await supabase
            .from('webhook_deliveries')
            .update({
              response_status: response.status,
              response_body: responseBody.substring(0, 1000),
              duration_ms: duration,
              status: response.ok ? 'success' : 'failed',
              error_message: response.ok ? null : `HTTP ${response.status}`,
            })
            .eq('id', deliveryId);
        }

        // Update webhook stats
        await supabase
          .from('webhook_configs')
          .update({
            last_triggered_at: new Date().toISOString(),
            success_count: response.ok ? webhook.success_count + 1 : webhook.success_count,
            failure_count: response.ok ? webhook.failure_count : webhook.failure_count + 1,
          })
          .eq('id', webhook.id);

        results.push({
          webhook_id: webhook.id,
          webhook_name: webhook.webhook_name,
          status: response.ok ? 'success' : 'failed',
          response_status: response.status,
          duration_ms: duration,
        });

        console.log(`Webhook ${webhook.webhook_name}: ${response.ok ? 'success' : 'failed'} (${response.status})`);

      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Update delivery record with failure
        if (deliveryId) {
          await supabase
            .from('webhook_deliveries')
            .update({
              duration_ms: duration,
              status: 'failed',
              error_message: errorMessage,
            })
            .eq('id', deliveryId);
        }

        // Update webhook failure count
        await supabase
          .from('webhook_configs')
          .update({
            failure_count: webhook.failure_count + 1,
          })
          .eq('id', webhook.id);

        results.push({
          webhook_id: webhook.id,
          webhook_name: webhook.webhook_name,
          status: 'failed',
          error: errorMessage,
          duration_ms: duration,
        });

        console.error(`Webhook ${webhook.webhook_name} failed: ${errorMessage}`);
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    return new Response(
      JSON.stringify({
        success: true,
        event_type,
        webhooks_sent: results.length,
        successful: successCount,
        failed: failureCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending webhooks:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
