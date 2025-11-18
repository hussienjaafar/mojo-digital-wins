import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface BriefingData {
  briefing_date: string;
  total_articles: number;
  total_bills: number;
  total_executive_orders: number;
  total_state_actions: number;
  critical_count: number;
  high_count: number;
  top_critical_items: any[];
  organization_mentions: Record<string, { total: number; critical: number; high: number }>;
}

function generateBriefingHTML(briefing: BriefingData, userName: string): string {
  const threatScore = Math.min(100, (briefing.critical_count * 25) + (briefing.high_count * 10));
  const threatColor = threatScore >= 75 ? '#dc2626' : threatScore >= 50 ? '#ea580c' : threatScore >= 25 ? '#ca8a04' : '#16a34a';
  const threatLabel = threatScore >= 75 ? 'SEVERE' : threatScore >= 50 ? 'HIGH' : threatScore >= 25 ? 'MODERATE' : 'LOW';

  const criticalItemsHTML = briefing.top_critical_items?.slice(0, 5).map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 600; color: #111827;">${item.title}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
          ${item.type.replace('_', ' ').toUpperCase()} • ${item.source_name || item.state_code || item.bill_number || ''}
        </div>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        <span style="background: #dc2626; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
          ${item.threat_level?.toUpperCase()}
        </span>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #6b7280;">No critical items today</td></tr>';

  const orgMentionsHTML = Object.entries(briefing.organization_mentions || {}).slice(0, 5).map(([org, data]) => `
    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
      <span style="font-weight: 500;">${org}</span>
      <span style="color: #6b7280;">
        ${data.total} mention${data.total !== 1 ? 's' : ''}
        ${data.critical > 0 ? `<span style="color: #dc2626; margin-left: 8px;">${data.critical} critical</span>` : ''}
      </span>
    </div>
  `).join('') || '<div style="text-align: center; color: #6b7280; padding: 12px;">No organization mentions today</div>';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Intelligence Briefing</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: white;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">
          📊 Daily Intelligence Briefing
        </h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
          ${new Date(briefing.briefing_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </td>
    </tr>

    <!-- Greeting -->
    <tr>
      <td style="padding: 24px 32px 16px;">
        <p style="margin: 0; color: #374151; font-size: 15px;">
          Good morning${userName ? `, ${userName}` : ''}. Here's your intelligence summary for today.
        </p>
      </td>
    </tr>

    <!-- Threat Level -->
    <tr>
      <td style="padding: 0 32px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">
                    Today's Threat Level
                  </div>
                  <div style="font-size: 32px; font-weight: 700; color: ${threatColor}; margin-top: 4px;">
                    ${threatScore}/100
                  </div>
                </div>
                <div style="background: ${threatColor}; color: white; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  ${threatLabel}
                </div>
              </div>
              <div style="background: #e2e8f0; height: 8px; border-radius: 4px; margin-top: 12px; overflow: hidden;">
                <div style="background: ${threatColor}; height: 100%; width: ${threatScore}%; border-radius: 4px;"></div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Quick Stats -->
    <tr>
      <td style="padding: 0 32px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="25%" style="text-align: center; padding: 16px 8px; background: #fef2f2; border-radius: 8px 0 0 8px;">
              <div style="font-size: 24px; font-weight: 700; color: #dc2626;">${briefing.critical_count}</div>
              <div style="font-size: 11px; color: #991b1b; text-transform: uppercase;">Critical</div>
            </td>
            <td width="25%" style="text-align: center; padding: 16px 8px; background: #fff7ed;">
              <div style="font-size: 24px; font-weight: 700; color: #ea580c;">${briefing.high_count}</div>
              <div style="font-size: 11px; color: #9a3412; text-transform: uppercase;">High</div>
            </td>
            <td width="25%" style="text-align: center; padding: 16px 8px; background: #f0f9ff;">
              <div style="font-size: 24px; font-weight: 700; color: #0284c7;">${briefing.total_articles}</div>
              <div style="font-size: 11px; color: #075985; text-transform: uppercase;">Articles</div>
            </td>
            <td width="25%" style="text-align: center; padding: 16px 8px; background: #f0fdf4; border-radius: 0 8px 8px 0;">
              <div style="font-size: 24px; font-weight: 700; color: #16a34a;">${briefing.total_bills}</div>
              <div style="font-size: 11px; color: #166534; text-transform: uppercase;">Bills</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Critical Items -->
    <tr>
      <td style="padding: 0 32px 24px;">
        <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #111827;">
          🚨 Critical & High Priority Items
        </h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          ${criticalItemsHTML}
        </table>
      </td>
    </tr>

    <!-- Organization Mentions -->
    <tr>
      <td style="padding: 0 32px 24px;">
        <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #111827;">
          🏛️ Organization Mentions
        </h2>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
          ${orgMentionsHTML}
        </div>
      </td>
    </tr>

    <!-- CTA -->
    <tr>
      <td style="padding: 0 32px 32px; text-align: center;">
        <a href="${Deno.env.get('PUBLIC_SITE_URL') || 'https://app.example.com'}/admin"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
          View Full Dashboard →
        </a>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background: #f8fafc; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
          You're receiving this because you have daily briefings enabled.
          <br>
          <a href="${Deno.env.get('PUBLIC_SITE_URL') || 'https://app.example.com'}/admin?tab=alert-settings" style="color: #2563eb;">
            Manage your alert preferences
          </a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
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

    const body = await req.json().catch(() => ({}));
    const testEmail = body.test_email; // For testing
    const forceDate = body.date; // Override date for testing

    const today = forceDate || new Date().toISOString().split('T')[0];

    console.log(`Sending daily briefings for ${today}`);

    // Get today's briefing
    const { data: briefing, error: briefingError } = await supabase
      .from('daily_briefings')
      .select('*')
      .eq('briefing_date', today)
      .single();

    if (briefingError && briefingError.code !== 'PGRST116') {
      throw briefingError;
    }

    if (!briefing) {
      // Generate briefing if it doesn't exist
      console.log('Briefing not found, generating...');
      const { error: genError } = await supabase.functions.invoke('smart-alerting', {
        body: { action: 'daily_briefing' }
      });
      if (genError) throw genError;

      // Fetch the newly generated briefing
      const { data: newBriefing } = await supabase
        .from('daily_briefings')
        .select('*')
        .eq('briefing_date', today)
        .single();

      if (!newBriefing) {
        throw new Error('Failed to generate briefing');
      }
    }

    // Get final briefing data
    const { data: finalBriefing } = await supabase
      .from('daily_briefings')
      .select('*')
      .eq('briefing_date', today)
      .single();

    // Get users to send to
    let usersQuery = supabase
      .from('user_article_preferences')
      .select(`
        user_id,
        daily_briefing_time,
        users:user_id (
          email,
          raw_user_meta_data
        )
      `)
      .eq('daily_briefing_enabled', true);

    const { data: users, error: usersError } = await usersQuery;

    if (usersError) throw usersError;

    let emailsSent = 0;
    let emailsFailed = 0;
    const results: any[] = [];

    // If test email provided, only send to that
    const recipients = testEmail
      ? [{ email: testEmail, name: 'Test User' }]
      : users?.map(u => ({
          email: (u.users as any)?.email,
          name: (u.users as any)?.raw_user_meta_data?.full_name || ''
        })).filter(r => r.email) || [];

    for (const recipient of recipients) {
      try {
        const htmlContent = generateBriefingHTML(finalBriefing, recipient.name);

        // Send via Resend
        if (RESEND_API_KEY) {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Intelligence Briefing <briefing@yourdomain.com>',
              to: recipient.email,
              subject: `Daily Intelligence Briefing - ${new Date(today).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
              html: htmlContent,
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Resend API error: ${error}`);
          }

          const result = await response.json();
          results.push({ email: recipient.email, status: 'sent', id: result.id });
          emailsSent++;
        } else {
          // Log to email queue for later processing
          await supabase.from('email_queue').insert({
            recipient_email: recipient.email,
            email_type: 'daily_briefing',
            subject: `Daily Intelligence Briefing - ${new Date(today).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
            html_content: htmlContent,
            status: 'pending',
          });
          results.push({ email: recipient.email, status: 'queued' });
          emailsSent++;
        }

        console.log(`Sent briefing to ${recipient.email}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ email: recipient.email, status: 'failed', error: errorMessage });
        emailsFailed++;
        console.error(`Failed to send to ${recipient.email}: ${errorMessage}`);
      }
    }

    // Mark briefing as sent
    if (emailsSent > 0) {
      await supabase
        .from('daily_briefings')
        .update({ is_sent: true, sent_at: new Date().toISOString() })
        .eq('briefing_date', today);
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending daily briefing:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
