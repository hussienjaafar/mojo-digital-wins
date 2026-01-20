import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { dailyBriefing } from "../_shared/email-templates/templates/report.ts";

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
  const threatLabel = threatScore >= 75 ? 'SEVERE' : threatScore >= 50 ? 'HIGH' : threatScore >= 25 ? 'MODERATE' : 'LOW';

  const appUrl = Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('APP_URL') || 'https://mojo-digital-wins.lovable.app';

  // Map top_critical_items to the expected format
  const topItems = (briefing.top_critical_items || []).slice(0, 5).map(item => ({
    title: item.title,
    severity: item.threat_level || 'critical',
    mentions: 1, // Using 1 as default since we don't have mention count per item
  }));

  // Map organization_mentions to the expected format
  const topOrganizations = Object.entries(briefing.organization_mentions || {}).slice(0, 5).map(([name, data]) => ({
    name,
    mentions: data.total,
  }));

  return dailyBriefing({
    userName: userName || 'there',
    date: new Date(briefing.briefing_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    threatLevel: {
      score: threatScore,
      label: threatLabel,
    },
    stats: {
      criticalAlerts: briefing.critical_count,
      highAlerts: briefing.high_count,
      newArticles: briefing.total_articles,
      pendingBills: briefing.total_bills,
    },
    topItems,
    topOrganizations,
    dashboardUrl: `${appUrl}/admin`,
    preferencesUrl: `${appUrl}/admin?tab=alert-settings`,
  });
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

    console.log('=== SEND-DAILY-BRIEFING V2 - Using profiles/user_roles directly ===');

    // Get admin users to send briefing to
    // Query profiles directly since we're using service role key
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    // Get admin users from user_roles
    const { data: adminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (rolesError) {
      console.error('Error fetching admin roles:', rolesError);
      throw rolesError;
    }

    console.log(`Found ${profiles?.length} profiles, ${adminRoles?.length} admin roles`);

    const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);

    let emailsSent = 0;
    let emailsFailed = 0;
    const results: any[] = [];

    // If test email provided, only send to that
    const recipients = testEmail
      ? [{ email: testEmail, name: 'Test User' }]
      : (profiles || [])
          .filter(p => adminUserIds.has(p.id))
          .map(p => ({
            email: p.email,
            name: p.email?.split('@')[0] || 'Admin'
          }));

    console.log(`Sending to ${recipients.length} recipients`);

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
