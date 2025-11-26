import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

async function sendEmailAlert(alert: any, adminEmails: string[]) {
  if (!RESEND_API_KEY) {
    console.log('[send-spike-alerts] Resend API key not configured, skipping email');
    return { success: false, reason: 'no_api_key' };
  }

  const severityEmojiMap: Record<string, string> = {
    critical: '🚨',
    high: '⚠️',
    medium: '📊',
    low: 'ℹ️'
  };
  const severityEmoji = severityEmojiMap[alert.severity] || 'ℹ️';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Digital Strategy Heartbeat <alerts@resend.dev>',
        to: adminEmails,
        subject: `${severityEmoji} ${alert.severity.toUpperCase()}: ${alert.entity_name}`,
        html: `
          <h2>${severityEmoji} ${alert.severity.toUpperCase()} Alert</h2>
          <p><strong>Type:</strong> ${alert.alert_type}</p>
          <p><strong>Entity:</strong> ${alert.entity_name}</p>
          <p><strong>Velocity Increase:</strong> ${Math.round(alert.velocity_increase)}%</p>
          <p><strong>Current Mentions:</strong> ${alert.current_mentions} (last ${alert.time_window})</p>
          <hr>
          <p>${alert.context_summary}</p>
          <hr>
          <p><small>Detected at ${new Date(alert.detected_at).toLocaleString()}</small></p>
        `
      })
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error('[send-spike-alerts] Email error:', error);
    return { success: false, reason: 'email_failed', error };
  }
}

async function sendWebhookAlert(alert: any, webhookUrl: string) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'spike_alert',
        severity: alert.severity,
        entity: alert.entity_name,
        velocity: alert.velocity_increase,
        mentions: alert.current_mentions,
        timeWindow: alert.time_window,
        summary: alert.context_summary,
        detectedAt: alert.detected_at
      })
    });

    return { success: response.ok };
  } catch (error) {
    console.error('[send-spike-alerts] Webhook error:', error);
    return { success: false, error };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[send-spike-alerts] Processing pending alerts...');

    // Get pending alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('spike_alerts')
      .select('*')
      .eq('status', 'pending')
      .order('severity', { ascending: false })
      .order('detected_at', { ascending: true })
      .limit(50);

    if (alertsError) throw alertsError;

    if (!alerts || alerts.length === 0) {
      console.log('[send-spike-alerts] No pending alerts');
      return new Response(
        JSON.stringify({ success: true, alerts_sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-spike-alerts] Found ${alerts.length} pending alerts`);

    // Get admin users for email notifications
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id, email');

    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);
    const adminEmails = (adminProfiles || [])
      .filter(p => adminUserIds.has(p.id) && p.email)
      .map(p => p.email);

    console.log(`[send-spike-alerts] Found ${adminEmails.length} admin emails`);

    let emailsSent = 0;
    let webhooksSent = 0;
    let failed = 0;

    for (const alert of alerts) {
      const channels = alert.notification_channels || [];
      let alertSent = false;

      // Send email for critical/high alerts
      if (channels.includes('email') && adminEmails.length > 0) {
        const result = await sendEmailAlert(alert, adminEmails);
        if (result.success) {
          emailsSent++;
          alertSent = true;
        }
      }

      // Send webhook (implement your webhook URL here)
      if (channels.includes('webhook')) {
        const webhookUrl = Deno.env.get('SPIKE_ALERT_WEBHOOK_URL');
        if (webhookUrl) {
          const result = await sendWebhookAlert(alert, webhookUrl);
          if (result.success) {
            webhooksSent++;
            alertSent = true;
          }
        }
      }

      // Update alert status
      await supabase
        .from('spike_alerts')
        .update({
          status: alertSent ? 'sent' : 'failed',
          sent_at: alertSent ? new Date().toISOString() : null
        })
        .eq('id', alert.id);

      if (alertSent) {
        console.log(`[send-spike-alerts] ✅ Sent alert for "${alert.entity_name}" (${alert.severity})`);
      } else {
        failed++;
        console.log(`[send-spike-alerts] ❌ Failed to send alert for "${alert.entity_name}"`);
      }

      // Rate limit: wait 1 second between alerts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[send-spike-alerts] ✅ Sent ${emailsSent} emails, ${webhooksSent} webhooks, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        alerts_processed: alerts.length,
        emails_sent: emailsSent,
        webhooks_sent: webhooksSent,
        failed,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[send-spike-alerts] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
