import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// ============================================================================
// Auth Validation
// ============================================================================

function validateCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured - allowing request');
    return true;
  }
  const providedSecret = req.headers.get('x-cron-secret');
  return providedSecret === cronSecret;
}

async function validateAuth(req: Request, supabase: any): Promise<{ user: any; isAdmin: boolean } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (error || !user) return null;

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const isAdmin = roles?.some((r: any) => r.role === 'admin') || false;
  return { user, isAdmin };
}

async function validateCronOrAdmin(req: Request, supabase: any): Promise<{ valid: boolean; isAdmin?: boolean; user?: any }> {
  if (validateCronSecret(req)) {
    console.log('[track-event-impact] Authorized via cron');
    return { valid: true };
  }

  const auth = await validateAuth(req, supabase);
  if (auth?.isAdmin) {
    console.log('[track-event-impact] Authorized via admin JWT');
    return { valid: true, isAdmin: true, user: auth.user };
  }

  return { valid: false };
}

// ============================================================================
// Types
// ============================================================================

interface ActionWithOutcomes {
  organization_id: string;
  trend_event_id: string | null;
  trend_key: string;
  actions_sent: number;
  total_outcomes: number;
  sms_responses: number;
  meta_clicks: number;
  donation_count: number;
  donation_amount: number;
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check: require cron or admin
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - requires cron secret or admin role' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 Starting outcome aggregation for trend_outcome_correlation...');

    // Define time windows
    const now = new Date();
    const windowEnd = now;
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24h

    // Get all active organizations
    const { data: orgs } = await supabase
      .from('client_organizations')
      .select('id')
      .eq('is_active', true);

    if (!orgs || orgs.length === 0) {
      console.log('No active organizations found');
      return new Response(JSON.stringify({ message: 'No active organizations' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalCorrelations = 0;
    let boostedCount = 0;

    for (const org of orgs) {
      // Get all actions with trend references in the window
      const { data: actions } = await supabase
        .from('intelligence_actions')
        .select('id, organization_id, trend_event_id, entity_name, action_type, sent_at')
        .eq('organization_id', org.id)
        .eq('action_status', 'sent')
        .gte('sent_at', windowStart.toISOString())
        .lte('sent_at', windowEnd.toISOString());

      if (!actions || actions.length === 0) {
        console.log(`No actions found for org ${org.id} in window`);
        continue;
      }

      // Get all outcomes linked to these actions
      const actionIds = actions.map(a => a.id);
      const { data: outcomes } = await supabase
        .from('outcome_events')
        .select('action_id, outcome_type, outcome_value, outcome_count')
        .in('action_id', actionIds);

      // Build outcome map
      const outcomeByAction = new Map<string, any[]>();
      for (const o of outcomes || []) {
        if (!outcomeByAction.has(o.action_id)) {
          outcomeByAction.set(o.action_id, []);
        }
        outcomeByAction.get(o.action_id)!.push(o);
      }

      // Aggregate by trend_key (entity_name normalized)
      const trendAggregates = new Map<string, ActionWithOutcomes>();

      for (const action of actions) {
        const trendKey = action.entity_name?.toLowerCase().replace(/[^\w\s]/g, '').trim() || 'unknown';
        
        if (!trendAggregates.has(trendKey)) {
          trendAggregates.set(trendKey, {
            organization_id: org.id,
            trend_event_id: action.trend_event_id,
            trend_key: trendKey,
            actions_sent: 0,
            total_outcomes: 0,
            sms_responses: 0,
            meta_clicks: 0,
            donation_count: 0,
            donation_amount: 0,
          });
        }

        const agg = trendAggregates.get(trendKey)!;
        agg.actions_sent++;

        // If we have a trend_event_id, prefer it
        if (action.trend_event_id && !agg.trend_event_id) {
          agg.trend_event_id = action.trend_event_id;
        }

        // Aggregate outcomes
        const actionOutcomes = outcomeByAction.get(action.id) || [];
        for (const outcome of actionOutcomes) {
          agg.total_outcomes += outcome.outcome_count || 1;
          
          if (outcome.outcome_type?.startsWith('sms_')) {
            agg.sms_responses += outcome.outcome_count || 1;
          } else if (outcome.outcome_type?.startsWith('meta_')) {
            agg.meta_clicks += outcome.outcome_count || 1;
          } else if (outcome.outcome_type === 'donation') {
            agg.donation_count += outcome.outcome_count || 1;
            agg.donation_amount += parseFloat(outcome.outcome_value) || 0;
          }
        }
      }

      // Get baseline response rates (30-day average for this org)
      const baselineStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const { data: historicalCorrelations } = await supabase
        .from('trend_outcome_correlation')
        .select('response_rate, donation_rate')
        .eq('organization_id', org.id)
        .gte('window_start', baselineStart.toISOString())
        .lt('window_start', windowStart.toISOString());

      let baselineResponseRate = 5.0; // Default 5%
      if (historicalCorrelations && historicalCorrelations.length >= 3) {
        const avgResponse = historicalCorrelations.reduce((sum, c) => sum + (c.response_rate || 0), 0) / historicalCorrelations.length;
        if (avgResponse > 0) baselineResponseRate = avgResponse;
      }

      // Upsert correlations
      for (const [trendKey, agg] of trendAggregates) {
        const responseRate = agg.actions_sent > 0 
          ? (agg.total_outcomes / agg.actions_sent) * 100 
          : 0;
        
        const donationRate = agg.actions_sent > 0 
          ? (agg.donation_count / agg.actions_sent) * 100 
          : 0;
        
        const avgDonation = agg.donation_count > 0 
          ? agg.donation_amount / agg.donation_count 
          : 0;

        const performanceDelta = responseRate - baselineResponseRate;
        
        // Determine if this should boost relevance
        // Positive signal: response rate above baseline by 20%+ OR donation rate > 2%
        const shouldBoost = performanceDelta > (baselineResponseRate * 0.2) || donationRate > 2;
        
        let learningSignal = 'neutral';
        if (performanceDelta > baselineResponseRate * 0.5) {
          learningSignal = 'strong_positive';
        } else if (performanceDelta > baselineResponseRate * 0.2) {
          learningSignal = 'positive';
        } else if (performanceDelta < -baselineResponseRate * 0.3) {
          learningSignal = 'negative';
        }

        const correlation = {
          organization_id: org.id,
          trend_event_id: agg.trend_event_id,
          trend_key: trendKey,
          actions_sent: agg.actions_sent,
          total_outcomes: agg.total_outcomes,
          total_donations: agg.donation_count,
          total_donation_amount: agg.donation_amount,
          total_clicks: agg.meta_clicks,
          response_rate: parseFloat(responseRate.toFixed(2)),
          donation_rate: parseFloat(donationRate.toFixed(2)),
          avg_donation: parseFloat(avgDonation.toFixed(2)),
          baseline_response_rate: parseFloat(baselineResponseRate.toFixed(2)),
          performance_delta: parseFloat(performanceDelta.toFixed(2)),
          should_boost_relevance: shouldBoost,
          learning_signal: learningSignal,
          computed_at: now.toISOString(),
          window_start: windowStart.toISOString(),
          window_end: windowEnd.toISOString(),
        };

        const { error: upsertError } = await supabase
          .from('trend_outcome_correlation')
          .upsert(correlation, {
            onConflict: 'organization_id,trend_key,window_start',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`Error upserting correlation for ${trendKey}:`, upsertError);
        } else {
          totalCorrelations++;
          if (shouldBoost) boostedCount++;
          console.log(`📈 ${trendKey}: response=${responseRate.toFixed(1)}% (baseline=${baselineResponseRate.toFixed(1)}%), signal=${learningSignal}`);
        }
      }
    }

    console.log(`✅ Outcome aggregation complete. Created ${totalCorrelations} correlations, ${boostedCount} with boost signal.`);

    return new Response(
      JSON.stringify({ 
        success: true,
        correlations_created: totalCorrelations,
        boost_signals: boostedCount,
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in track-event-impact:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
