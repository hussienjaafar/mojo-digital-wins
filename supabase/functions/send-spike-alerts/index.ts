import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'alerts@resend.dev';
const MAX_RETRY_COUNT = 3;

interface AlertResult {
  success: boolean;
  reason?: string;
  error?: any;
}

async function sendEmailAlert(alert: any, adminEmails: string[]): Promise<AlertResult> {
  if (!RESEND_API_KEY) {
    console.log('[send-spike-alerts] ⚠️ Resend API key not configured');
    return { success: false, reason: 'no_api_key' };
  }

  if (adminEmails.length === 0) {
    console.log('[send-spike-alerts] ⚠️ No admin emails to send to');
    return { success: false, reason: 'no_recipients' };
  }

  const severityEmojiMap: Record<string, string> = {
    critical: '🚨',
    high: '⚠️',
    medium: '📊',
    low: 'ℹ️'
  };
  const severityEmoji = severityEmojiMap[alert.severity] || 'ℹ️';

  const severityColorMap: Record<string, string> = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#2563eb'
  };
  const severityColor = severityColorMap[alert.severity] || '#6b7280';

  try {
    console.log(`[send-spike-alerts] Sending email from ${SENDER_EMAIL} to ${adminEmails.length} recipients`);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `Digital Strategy Heartbeat <${SENDER_EMAIL}>`,
        to: adminEmails,
        subject: `${severityEmoji} ${alert.severity.toUpperCase()}: ${alert.entity_name} spike detected`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f9fafb; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              .header { background: ${severityColor}; color: white; padding: 20px; }
              .header h1 { margin: 0; font-size: 20px; }
              .content { padding: 20px; }
              .stat { display: inline-block; margin-right: 20px; margin-bottom: 10px; }
              .stat-value { font-size: 24px; font-weight: bold; color: #111827; }
              .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
              .context { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0; }
              .footer { padding: 15px 20px; background: #f9fafb; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${severityEmoji} ${alert.severity.toUpperCase()} ALERT</h1>
              </div>
              <div class="content">
                <h2 style="margin-top: 0; color: #111827;">${alert.entity_name}</h2>
                <p style="color: #6b7280; margin-bottom: 20px;">Type: ${alert.alert_type.replace('_', ' ')}</p>
                
                <div>
                  <div class="stat">
                    <div class="stat-value">${Math.round(alert.velocity_increase)}%</div>
                    <div class="stat-label">Velocity Increase</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">${alert.current_mentions}</div>
                    <div class="stat-label">Mentions (${alert.time_window})</div>
                  </div>
                </div>

                <div class="context">
                  <p style="margin: 0;">${alert.context_summary}</p>
                </div>

                ${alert.related_articles?.length > 0 ? `
                  <p style="font-size: 14px; color: #6b7280;">
                    ${alert.related_articles.length} related article(s) found
                  </p>
                ` : ''}
              </div>
              <div class="footer">
                Detected at ${new Date(alert.detected_at).toLocaleString('en-US', { 
                  timeZone: 'America/New_York',
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })} ET
              </div>
            </div>
          </body>
          </html>
        `
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[send-spike-alerts] Resend API error: ${response.status} - ${errorText}`);
      return { success: false, reason: 'api_error', error: errorText };
    }

    const result = await response.json();
    console.log(`[send-spike-alerts] ✅ Email sent successfully:`, result.id);
    return { success: true };
  } catch (error) {
    console.error('[send-spike-alerts] Email error:', error);
    return { success: false, reason: 'email_failed', error };
  }
}

async function sendWebhookAlert(alert: any, webhookUrl: string): Promise<AlertResult> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'spike_alert',
        severity: alert.severity,
        entity: alert.entity_name,
        entity_type: alert.entity_type,
        velocity: alert.velocity_increase,
        mentions: alert.current_mentions,
        timeWindow: alert.time_window,
        summary: alert.context_summary,
        detectedAt: alert.detected_at,
        relatedArticles: alert.related_articles?.length || 0
      })
    });

    if (!response.ok) {
      return { success: false, reason: 'webhook_error' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('[send-spike-alerts] Webhook error:', error);
    return { success: false, reason: 'webhook_failed', error };
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

    console.log('[send-spike-alerts] Processing alerts...');

    // Get pending alerts AND failed alerts that can be retried
    const { data: alerts, error: alertsError } = await supabase
      .from('spike_alerts')
      .select('*')
      .or(`status.eq.pending,and(status.eq.failed,retry_count.lt.${MAX_RETRY_COUNT})`)
      .order('severity', { ascending: false })
      .order('detected_at', { ascending: true })
      .limit(30);

    if (alertsError) {
      console.error('[send-spike-alerts] Error fetching alerts:', alertsError);
      throw alertsError;
    }

    if (!alerts || alerts.length === 0) {
      console.log('[send-spike-alerts] No pending or retryable alerts');
      return new Response(
        JSON.stringify({ success: true, alerts_sent: 0, message: 'No alerts to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pendingCount = alerts.filter(a => a.status === 'pending').length;
    const retryCount = alerts.filter(a => a.status === 'failed').length;
    console.log(`[send-spike-alerts] Found ${pendingCount} pending, ${retryCount} retryable alerts`);

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

    if (adminEmails.length === 0) {
      console.warn('[send-spike-alerts] ⚠️ No admin emails found - alerts cannot be delivered');
    } else {
      console.log(`[send-spike-alerts] Will send to ${adminEmails.length} admin(s)`);
    }

    let emailsSent = 0;
    let webhooksSent = 0;
    let failed = 0;
    let retried = 0;

    for (const alert of alerts) {
      const channels = alert.notification_channels || ['email'];
      let alertSent = false;
      let failureReason = '';
      const isRetry = alert.status === 'failed';

      if (isRetry) {
        retried++;
        console.log(`[send-spike-alerts] Retrying alert for "${alert.entity_name}" (attempt ${(alert.retry_count || 0) + 1}/${MAX_RETRY_COUNT})`);
      }

      // Send email
      if (channels.includes('email') && adminEmails.length > 0) {
        const result = await sendEmailAlert(alert, adminEmails);
        if (result.success) {
          emailsSent++;
          alertSent = true;
        } else {
          failureReason = result.reason || 'unknown';
        }
      }

      // Send webhook
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
      const currentRetryCount = alert.retry_count || 0;
      const newRetryCount = alertSent ? currentRetryCount : currentRetryCount + 1;
      
      await supabase
        .from('spike_alerts')
        .update({
          status: alertSent ? 'sent' : 'failed',
          sent_at: alertSent ? new Date().toISOString() : null,
          retry_count: newRetryCount,
          last_error: alertSent ? null : failureReason
        })
        .eq('id', alert.id);

      if (alertSent) {
        console.log(`[send-spike-alerts] ✅ Sent ${alert.severity} alert for "${alert.entity_name}"`);
      } else {
        failed++;
        console.log(`[send-spike-alerts] ❌ Failed alert for "${alert.entity_name}" (${failureReason}, retry ${newRetryCount}/${MAX_RETRY_COUNT})`);
      }

      // Rate limit: wait 500ms between alerts
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const summary = {
      success: true,
      alerts_processed: alerts.length,
      emails_sent: emailsSent,
      webhooks_sent: webhooksSent,
      failed,
      retried,
      admin_recipients: adminEmails.length,
      sender_email: SENDER_EMAIL,
      timestamp: new Date().toISOString()
    };

    console.log(`[send-spike-alerts] ✅ Complete:`, summary);

    return new Response(
      JSON.stringify(summary),
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
