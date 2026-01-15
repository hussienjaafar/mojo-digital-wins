import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Validate Switchboard Data Edge Function
 * 
 * Performs comprehensive data quality checks on SMS/Switchboard data:
 * - Campaign data completeness
 * - Phone hash coverage
 * - Message delivery rates
 * - Identity resolution quality
 */

interface ValidationResult {
  organizationId: string;
  organizationName?: string;
  healthScore: number; // 0-100
  issues: Array<{
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    metric?: number;
    threshold?: number;
  }>;
  metrics: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalMessages30Days: number;
    uniqueRecipients30Days: number;
    phoneHashCoverage: number;
    identityResolutionRate: number;
    deliveryRate: number;
    optOutRate: number;
    lastMessageDate: string | null;
  };
  validatedAt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id } = await req.json().catch(() => ({}));

    console.log(`[VALIDATE-SWITCHBOARD] Starting validation${organization_id ? ` for org ${organization_id}` : ' for all orgs'}`);

    // Get organizations to validate
    let orgsQuery = supabase
      .from('client_organizations')
      .select('id, name')
      .eq('is_active', true);

    if (organization_id) {
      orgsQuery = orgsQuery.eq('id', organization_id);
    }

    const { data: organizations, error: orgsError } = await orgsQuery;

    if (orgsError) throw orgsError;

    const results: ValidationResult[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const org of organizations || []) {
      const result: ValidationResult = {
        organizationId: org.id,
        organizationName: org.name,
        healthScore: 100,
        issues: [],
        metrics: {
          totalCampaigns: 0,
          activeCampaigns: 0,
          totalMessages30Days: 0,
          uniqueRecipients30Days: 0,
          phoneHashCoverage: 0,
          identityResolutionRate: 0,
          deliveryRate: 0,
          optOutRate: 0,
          lastMessageDate: null,
        },
        validatedAt: now.toISOString(),
      };

      try {
        // 1. Get campaign statistics
        const { count: totalCampaigns } = await supabase
          .from('sms_campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id);

        const { count: activeCampaigns } = await supabase
          .from('sms_campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .eq('is_active', true);

        result.metrics.totalCampaigns = totalCampaigns || 0;
        result.metrics.activeCampaigns = activeCampaigns || 0;

        // 2. Get message statistics (last 30 days)
        const { data: messageStats } = await supabase
          .from('sms_messages')
          .select('id, phone_hash, delivered_at, sent_at')
          .eq('organization_id', org.id)
          .gte('sent_at', thirtyDaysAgo.toISOString())
          .limit(10000);

        if (messageStats) {
          result.metrics.totalMessages30Days = messageStats.length;
          result.metrics.uniqueRecipients30Days = new Set(messageStats.map(m => m.phone_hash)).size;
          
          const deliveredCount = messageStats.filter(m => m.delivered_at).length;
          result.metrics.deliveryRate = messageStats.length > 0 
            ? Math.round((deliveredCount / messageStats.length) * 100) 
            : 0;

          const messagesWithHash = messageStats.filter(m => m.phone_hash).length;
          result.metrics.phoneHashCoverage = messageStats.length > 0
            ? Math.round((messagesWithHash / messageStats.length) * 100)
            : 0;
        }

        // 3. Get latest message date
        const { data: latestMessage } = await supabase
          .from('sms_messages')
          .select('sent_at')
          .eq('organization_id', org.id)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        result.metrics.lastMessageDate = latestMessage?.sent_at || null;

        // 4. Calculate identity resolution rate
        const { count: donorsWithPhone } = await supabase
          .from('donor_identities')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .not('phone_hash', 'is', null);

        const { count: totalDonors } = await supabase
          .from('donor_identities')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id);

        result.metrics.identityResolutionRate = totalDonors && totalDonors > 0
          ? Math.round(((donorsWithPhone || 0) / totalDonors) * 100)
          : 0;

        // 5. Check for opt-outs
        const { count: optOuts } = await supabase
          .from('sms_opt_outs')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id);

        const { count: totalRecipients } = await supabase
          .from('sms_recipients')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id);

        result.metrics.optOutRate = totalRecipients && totalRecipients > 0
          ? Math.round(((optOuts || 0) / totalRecipients) * 100)
          : 0;

        // =========================================================================
        // VALIDATION RULES
        // =========================================================================

        // Rule 1: No campaigns configured
        if (result.metrics.totalCampaigns === 0) {
          result.issues.push({
            type: 'no_campaigns',
            severity: 'warning',
            message: 'No SMS campaigns configured for this organization',
          });
          result.healthScore -= 30;
        }

        // Rule 2: No active campaigns
        if (result.metrics.totalCampaigns > 0 && result.metrics.activeCampaigns === 0) {
          result.issues.push({
            type: 'no_active_campaigns',
            severity: 'warning',
            message: 'All SMS campaigns are inactive',
          });
          result.healthScore -= 20;
        }

        // Rule 3: No recent messages
        if (result.metrics.lastMessageDate) {
          const daysSinceLastMessage = (now.getTime() - new Date(result.metrics.lastMessageDate).getTime()) / (24 * 60 * 60 * 1000);
          if (daysSinceLastMessage > 7) {
            result.issues.push({
              type: 'stale_messages',
              severity: daysSinceLastMessage > 30 ? 'critical' : 'warning',
              message: `No SMS messages sent in ${Math.round(daysSinceLastMessage)} days`,
              metric: Math.round(daysSinceLastMessage),
              threshold: 7,
            });
            result.healthScore -= daysSinceLastMessage > 30 ? 30 : 15;
          }
        } else if (result.metrics.totalCampaigns > 0) {
          result.issues.push({
            type: 'no_messages',
            severity: 'warning',
            message: 'Campaigns exist but no messages have been sent',
          });
          result.healthScore -= 20;
        }

        // Rule 4: Low phone hash coverage
        if (result.metrics.totalMessages30Days > 0 && result.metrics.phoneHashCoverage < 80) {
          result.issues.push({
            type: 'low_phone_hash_coverage',
            severity: result.metrics.phoneHashCoverage < 50 ? 'critical' : 'warning',
            message: `Only ${result.metrics.phoneHashCoverage}% of messages have phone hashes for identity resolution`,
            metric: result.metrics.phoneHashCoverage,
            threshold: 80,
          });
          result.healthScore -= result.metrics.phoneHashCoverage < 50 ? 25 : 10;
        }

        // Rule 5: Low delivery rate
        if (result.metrics.totalMessages30Days > 0 && result.metrics.deliveryRate < 90) {
          result.issues.push({
            type: 'low_delivery_rate',
            severity: result.metrics.deliveryRate < 70 ? 'critical' : 'warning',
            message: `SMS delivery rate is ${result.metrics.deliveryRate}% (target: 90%+)`,
            metric: result.metrics.deliveryRate,
            threshold: 90,
          });
          result.healthScore -= result.metrics.deliveryRate < 70 ? 20 : 10;
        }

        // Rule 6: Low identity resolution
        if (totalDonors && totalDonors > 100 && result.metrics.identityResolutionRate < 50) {
          result.issues.push({
            type: 'low_identity_resolution',
            severity: 'warning',
            message: `Only ${result.metrics.identityResolutionRate}% of donors have phone numbers linked`,
            metric: result.metrics.identityResolutionRate,
            threshold: 50,
          });
          result.healthScore -= 10;
        }

        // Rule 7: High opt-out rate
        if (result.metrics.optOutRate > 5) {
          result.issues.push({
            type: 'high_opt_out_rate',
            severity: result.metrics.optOutRate > 10 ? 'critical' : 'warning',
            message: `Opt-out rate is ${result.metrics.optOutRate}% (healthy: <5%)`,
            metric: result.metrics.optOutRate,
            threshold: 5,
          });
          result.healthScore -= result.metrics.optOutRate > 10 ? 15 : 5;
        }

        // Clamp health score
        result.healthScore = Math.max(0, Math.min(100, result.healthScore));

      } catch (err: any) {
        console.error(`[VALIDATE-SWITCHBOARD] Error validating org ${org.id}:`, err);
        result.issues.push({
          type: 'validation_error',
          severity: 'critical',
          message: `Validation failed: ${err.message}`,
        });
        result.healthScore = 0;
      }

      results.push(result);
      console.log(`[VALIDATE-SWITCHBOARD] ${org.name}: Health score ${result.healthScore}, ${result.issues.length} issues`);
    }

    // Store validation results for tracking
    for (const result of results) {
      // Store result (ignore errors if table doesn't exist)
      try {
        await supabase.from('sms_health_validations').upsert({
          organization_id: result.organizationId,
          health_score: result.healthScore,
          issues: result.issues,
          metrics: result.metrics,
          validated_at: result.validatedAt,
        }, { onConflict: 'organization_id' });
      } catch {
        // Table might not exist yet, that's OK
      }
    }

    // Summary
    const avgScore = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.healthScore, 0) / results.length)
      : 0;
    const criticalCount = results.filter(r => r.issues.some(i => i.severity === 'critical')).length;

    console.log(`[VALIDATE-SWITCHBOARD] Complete. Avg score: ${avgScore}, Critical: ${criticalCount}/${results.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          organizationsChecked: results.length,
          averageHealthScore: avgScore,
          healthyCount: results.filter(r => r.healthScore >= 80).length,
          warningCount: results.filter(r => r.healthScore >= 50 && r.healthScore < 80).length,
          criticalCount: results.filter(r => r.healthScore < 50).length,
        },
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[VALIDATE-SWITCHBOARD] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
