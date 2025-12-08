import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS with allowed origins
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const getCorsHeaders = (origin?: string) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || 'https://lovable.dev';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

// Optional Slack webhook
const SLACK_WEBHOOK = Deno.env.get('OPS_SLACK_WEBHOOK_URL');

async function postToSlack(text: string) {
  if (!SLACK_WEBHOOK) return { ok: false, reason: 'no_webhook' };
  try {
    const res = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: (e as any)?.message };
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined;
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check: require either CRON_SECRET header or valid admin JWT
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedCronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('authorization');

    let isAuthorized = false;

    if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      isAuthorized = true;
      console.log('[ops-alerts] Authorized via CRON_SECRET');
    } else if (authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) {
        const { data: isAdmin } = await supabaseAuth.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        if (isAdmin) {
          isAuthorized = true;
          console.log('[ops-alerts] Authorized via admin JWT');
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - requires CRON_SECRET or admin JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Run diagnostics to get a unified status
    const { data: diag, error } = await supabase.functions.invoke('run-diagnostics', { body: {} });
    if (error) throw error;

    // Simple SLA checks
    const tests = (diag?.tests ?? []) as any[];
    const get = (name: string) => tests.find(t => t.name === name);

    const rss = get('RSS Article Collection');
    const bluesky = get('Bluesky Stream Collection');
    const ai = get('AI Analysis Completion');
    const jobs = get('Scheduled Jobs Automation');

    const breaches: string[] = [];
    if (bluesky?.status !== 'PASS') breaches.push('Bluesky stream not fresh');
    if (ai?.status !== 'PASS') breaches.push('AI analysis coverage below target');
    if (jobs?.status !== 'PASS') breaches.push('Scheduled jobs overdue');

    const summary = {
      overall_status: diag?.overall_status,
      breaches,
      details: {
        rss,
        bluesky,
        ai,
        jobs,
      },
      ts: new Date().toISOString(),
    };

    // Notify Slack if configured
    if (breaches.length > 0) {
      await postToSlack(`OPS ALERT: ${summary.overall_status}\nBreaches: ${breaches.join(', ')}`);
    }

    // Also enqueue emails to admins if there are breaches
    if (breaches.length > 0) {
      const { data: admins } = await supabase.rpc('get_users_with_roles');
      const adminEmails = (admins || []).filter((u: any) => (u.roles || []).includes('admin')).map((u: any) => u.email).slice(0, 20);
      for (const email of adminEmails) {
        await supabase.from('email_queue').insert({
          recipient_email: email,
          recipient_user_id: null,
          email_type: 'critical_alert',
          subject: `Ops Alert: ${summary.overall_status}`,
          html_content: `<pre>${JSON.stringify(summary, null, 2)}</pre>`
        });
      }
    }

    return new Response(JSON.stringify({ success: true, summary }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), { status: 500, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } });
  }
});
