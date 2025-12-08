import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SECURITY: Restrict CORS to known origins
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || 'https://lovable.dev',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthAlert {
  type: 'unmapped_transactions' | 'missing_metrics' | 'stale_mappings' | 'data_quality';
  severity: 'warning' | 'critical';
  message: string;
  count: number;
  organizationId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // SECURITY: Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      console.error('[SECURITY] Non-admin user attempted to access monitor-attribution-health:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for cross-org monitoring (after admin check)
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    console.log('[HEALTH] Starting attribution health monitoring...');

    // Get all active organizations
    const { data: orgs, error: orgsError } = await serviceClient
      .from('client_organizations')
      .select('id, name')
      .eq('is_active', true);

    if (orgsError) throw orgsError;

    const alerts: HealthAlert[] = [];

    for (const org of orgs || []) {
      console.log(`[HEALTH] Checking health for org: ${org.name}`);

      // 1. Check for unmapped transactions
      const { count: unmappedCount, error: unmappedError } = await serviceClient
        .from('actblue_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .is('refcode', null)
        .gte('transaction_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (!unmappedError && unmappedCount && unmappedCount > 10) {
        alerts.push({
          type: 'unmapped_transactions',
          severity: unmappedCount > 50 ? 'critical' : 'warning',
          message: `${unmappedCount} transactions in the last 7 days have no refcode`,
          count: unmappedCount,
          organizationId: org.id,
        });
      }

      // 2. Check for campaigns missing metrics
      const { data: attributions, error: attrError } = await serviceClient
        .from('campaign_attribution')
        .select('id, meta_campaign_id, switchboard_campaign_id')
        .eq('organization_id', org.id);

      if (!attrError && attributions) {
        let missingMetricsCount = 0;

        for (const attr of attributions) {
          if (attr.meta_campaign_id) {
            const { count } = await serviceClient
              .from('meta_ad_metrics')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', attr.meta_campaign_id)
              .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

            if (!count || count === 0) missingMetricsCount++;
          }

          if (attr.switchboard_campaign_id) {
            const { count } = await serviceClient
              .from('sms_campaign_metrics')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', attr.switchboard_campaign_id)
              .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

            if (!count || count === 0) missingMetricsCount++;
          }
        }

        if (missingMetricsCount > 0) {
          alerts.push({
            type: 'missing_metrics',
            severity: missingMetricsCount > 5 ? 'critical' : 'warning',
            message: `${missingMetricsCount} campaigns have no metrics in the last 30 days`,
            count: missingMetricsCount,
            organizationId: org.id,
          });
        }
      }

      // 3. Check for stale attribution mappings
      const { data: recentTxns, error: txnError } = await serviceClient
        .from('actblue_transactions')
        .select('refcode')
        .eq('organization_id', org.id)
        .gte('transaction_date', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString());

      if (!txnError && recentTxns) {
        const activeRefcodes = new Set(recentTxns.map(t => t.refcode).filter(Boolean));

        const { data: allMappings, error: mappingsError } = await serviceClient
          .from('campaign_attribution')
          .select('refcode')
          .eq('organization_id', org.id);

        if (!mappingsError && allMappings) {
          const staleCount = allMappings.filter(
            m => m.refcode && !activeRefcodes.has(m.refcode)
          ).length;

          if (staleCount > 10) {
            alerts.push({
              type: 'stale_mappings',
              severity: 'warning',
              message: `${staleCount} attribution mappings have no transactions in 60 days`,
              count: staleCount,
              organizationId: org.id,
            });
          }
        }
      }

      // 4. Calculate overall data quality score
      const totalIssues = alerts
        .filter(a => a.organizationId === org.id)
        .reduce((sum, a) => sum + a.count, 0);

      const { count: totalRecords } = await serviceClient
        .from('campaign_attribution')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id);

      if (totalRecords && totalIssues > 0) {
        const qualityScore = Math.max(0, 100 - (totalIssues / totalRecords) * 100);

        if (qualityScore < 70) {
          alerts.push({
            type: 'data_quality',
            severity: qualityScore < 50 ? 'critical' : 'warning',
            message: `Data quality score is ${Math.round(qualityScore)}%`,
            count: Math.round(qualityScore),
            organizationId: org.id,
          });
        }
      }
    }

    // Send critical alerts via email
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    
    if (criticalAlerts.length > 0) {
      console.log(`[HEALTH] Found ${criticalAlerts.length} critical attribution health issues`);
      
      for (const alert of criticalAlerts) {
        const { data: org } = await serviceClient
          .from('client_organizations')
          .select('name, primary_contact_email')
          .eq('id', alert.organizationId)
          .single();

        if (org?.primary_contact_email) {
          await serviceClient.from('email_queue').insert({
            to_emails: [org.primary_contact_email],
            subject: `[CRITICAL] Attribution Health Alert - ${org.name}`,
            html_body: `
              <h2>Critical Attribution Health Issue Detected</h2>
              <p><strong>Alert Type:</strong> ${alert.type.replace(/_/g, ' ').toUpperCase()}</p>
              <p><strong>Message:</strong> ${alert.message}</p>
              <p><strong>Organization:</strong> ${org.name}</p>
              <p>Please review your attribution configuration and data quality.</p>
            `,
            priority: 1,
          });
        }
      }
    }

    // Store health check results
    await serviceClient.from('attribution_health_logs').insert({
      checked_at: new Date().toISOString(),
      total_alerts: alerts.length,
      critical_alerts: criticalAlerts.length,
      alerts: alerts,
    });

    console.log(`[HEALTH] Health check complete. Found ${alerts.length} total issues (${criticalAlerts.length} critical)`);

    return new Response(
      JSON.stringify({
        success: true,
        totalAlerts: alerts.length,
        criticalAlerts: criticalAlerts.length,
        alerts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[HEALTH] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
