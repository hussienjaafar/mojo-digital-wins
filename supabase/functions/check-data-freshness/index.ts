import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Data Freshness SLA Monitoring & Alerting
 * 
 * Checks all data sources against their SLAs and creates alerts for stale data.
 * Should be run on a schedule (every 15-30 minutes).
 */

interface FreshnessSLA {
  source: string;
  sla_hours: number;
  alert_threshold_hours: number;
  critical_threshold_hours: number;
}

const FRESHNESS_SLAS: FreshnessSLA[] = [
  { source: 'meta', sla_hours: 24, alert_threshold_hours: 36, critical_threshold_hours: 48 },
  { source: 'actblue_webhook', sla_hours: 1, alert_threshold_hours: 2, critical_threshold_hours: 6 },
  { source: 'actblue_csv', sla_hours: 24, alert_threshold_hours: 36, critical_threshold_hours: 48 },
  { source: 'switchboard', sla_hours: 4, alert_threshold_hours: 12, critical_threshold_hours: 24 },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[DATA FRESHNESS] Starting SLA check...');

    // Get current freshness status for all sources
    const { data: freshnessRecords, error: fetchError } = await supabase
      .from('data_freshness')
      .select('*');

    if (fetchError) {
      console.error('[DATA FRESHNESS] Error fetching records:', fetchError);
      throw fetchError;
    }

    const alerts: any[] = [];
    const resolvedAlerts: string[] = [];
    const now = new Date();

    for (const record of freshnessRecords || []) {
      const slaConfig = FRESHNESS_SLAS.find(s => s.source === record.source);
      if (!slaConfig) continue;

      const dataLagHours = record.data_lag_hours || 0;
      const lastSyncedAt = record.last_synced_at ? new Date(record.last_synced_at) : null;
      const hoursSinceSync = lastSyncedAt 
        ? (now.getTime() - lastSyncedAt.getTime()) / (1000 * 60 * 60)
        : null;

      // Determine severity
      let severity: 'warning' | 'critical' | null = null;
      let alertType = 'stale_data';

      if (dataLagHours >= slaConfig.critical_threshold_hours) {
        severity = 'critical';
      } else if (dataLagHours >= slaConfig.alert_threshold_hours) {
        severity = 'warning';
      }

      // Check for sync failures
      if (record.last_sync_status === 'error') {
        severity = 'critical';
        alertType = 'sync_failure';
      }

      // Check if never synced
      if (!lastSyncedAt && !record.latest_data_timestamp) {
        severity = 'warning';
        alertType = 'never_synced';
      }

      if (severity) {
        // Check for existing unresolved alert
        const { data: existingAlert } = await supabase
          .from('data_freshness_alerts')
          .select('id')
          .eq('platform', record.source)
          .eq('organization_id', record.organization_id)
          .eq('is_resolved', false)
          .single();

        if (!existingAlert) {
          alerts.push({
            platform: record.source,
            organization_id: record.organization_id,
            alert_type: alertType,
            hours_stale: Math.round(dataLagHours * 10) / 10,
            expected_freshness_hours: slaConfig.sla_hours,
            last_data_date: record.latest_data_timestamp,
            is_resolved: false,
          });

          console.log(`[DATA FRESHNESS] Creating ${severity} alert for ${record.source} (org: ${record.organization_id || 'global'}) - ${dataLagHours.toFixed(1)}h stale`);
        }
      } else {
        // Data is fresh - resolve any existing alerts
        const { data: existingAlert } = await supabase
          .from('data_freshness_alerts')
          .select('id')
          .eq('platform', record.source)
          .eq('organization_id', record.organization_id)
          .eq('is_resolved', false)
          .single();

        if (existingAlert) {
          resolvedAlerts.push(existingAlert.id);
        }
      }
    }

    // Insert new alerts
    if (alerts.length > 0) {
      const { error: insertError } = await supabase
        .from('data_freshness_alerts')
        .insert(alerts);

      if (insertError) {
        console.error('[DATA FRESHNESS] Error inserting alerts:', insertError);
      } else {
        console.log(`[DATA FRESHNESS] Created ${alerts.length} new alerts`);
      }
    }

    // Resolve stale alerts
    if (resolvedAlerts.length > 0) {
      const { error: resolveError } = await supabase
        .from('data_freshness_alerts')
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .in('id', resolvedAlerts);

      if (resolveError) {
        console.error('[DATA FRESHNESS] Error resolving alerts:', resolveError);
      } else {
        console.log(`[DATA FRESHNESS] Resolved ${resolvedAlerts.length} alerts`);
      }
    }

    // Update SLA breach counts
    for (const record of freshnessRecords || []) {
      const slaConfig = FRESHNESS_SLAS.find(s => s.source === record.source);
      if (!slaConfig) continue;

      const isWithinSla = (record.data_lag_hours || 0) <= slaConfig.sla_hours;
      const newBreachCount = isWithinSla ? 0 : (record.sla_breach_count || 0) + 1;

      if (record.is_within_sla !== isWithinSla || record.sla_breach_count !== newBreachCount) {
        await supabase
          .from('data_freshness')
          .update({
            is_within_sla: isWithinSla,
            sla_breach_count: newBreachCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);
      }
    }

    // Get summary for response
    const staleCount = (freshnessRecords || []).filter(r => {
      const sla = FRESHNESS_SLAS.find(s => s.source === r.source);
      return sla && (r.data_lag_hours || 0) > sla.sla_hours;
    }).length;

    const criticalCount = (freshnessRecords || []).filter(r => {
      const sla = FRESHNESS_SLAS.find(s => s.source === r.source);
      return sla && (r.data_lag_hours || 0) >= sla.critical_threshold_hours;
    }).length;

    console.log(`[DATA FRESHNESS] Check complete. Stale: ${staleCount}, Critical: ${criticalCount}, New alerts: ${alerts.length}, Resolved: ${resolvedAlerts.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_sources: freshnessRecords?.length || 0,
          stale_count: staleCount,
          critical_count: criticalCount,
          new_alerts: alerts.length,
          resolved_alerts: resolvedAlerts.length,
        },
        alerts: alerts.map(a => ({ source: a.platform, org: a.organization_id, hours_stale: a.hours_stale })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[DATA FRESHNESS] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
