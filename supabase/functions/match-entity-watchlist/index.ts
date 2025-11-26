import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting watchlist matching...');

    // Get all active watchlist items
    const { data: watchlistItems, error: watchlistError } = await supabase
      .from('entity_watchlist')
      .select('*, client_organizations(name, slug)')
      .eq('is_active', true);

    if (watchlistError) throw watchlistError;

    console.log(`Processing ${watchlistItems?.length || 0} watchlist items`);

    // Get all current trends
    const { data: trends, error: trendsError } = await supabase
      .from('entity_trends')
      .select('*')
      .order('calculated_at', { ascending: false });

    if (trendsError) throw trendsError;

    const alerts = [];
    const now = new Date().toISOString();

    for (const watchlistItem of watchlistItems || []) {
      // Find matching trends (exact match or fuzzy match)
      const matchingTrends = trends?.filter(trend => {
        const trendName = trend.entity_name.toLowerCase();
        const watchedName = watchlistItem.entity_name.toLowerCase();
        
        // Exact match
        if (trendName === watchedName) return true;
        
        // Fuzzy match (contains)
        if (trendName.includes(watchedName) || watchedName.includes(trendName)) return true;
        
        return false;
      }) || [];

      for (const trend of matchingTrends) {
        // Check if threshold is exceeded
        const thresholdExceeded = watchlistItem.alert_threshold && 
          trend.mentions_last_hour >= watchlistItem.alert_threshold;

        // Calculate actionable score (0-100)
        // 25% Velocity (spiking now?)
        const velocityScore = Math.min((trend.velocity / 500) * 25, 25);
        
        // 25% Client match (relevance score)
        const clientMatchScore = (watchlistItem.ai_relevance_score || 50) * 0.25;
        
        // 20% Time sensitivity (how recent are mentions?)
        const hoursSinceLastSeen = (Date.now() - new Date(trend.last_seen_at).getTime()) / (1000 * 60 * 60);
        const timeSensitivityScore = Math.max(20 - (hoursSinceLastSeen * 2), 0);
        
        // 15% Sentiment shift (absolute value of sentiment)
        const sentimentScore = Math.abs(trend.sentiment_avg) * 15;
        
        // 15% Historical SMS performance (placeholder - would use actual data)
        const smsPerformanceScore = 10; // Default medium score
        
        const actionableScore = velocityScore + clientMatchScore + timeSensitivityScore + sentimentScore + smsPerformanceScore;
        
        // Only create alert if actionable or threshold exceeded
        if (actionableScore > 50 || thresholdExceeded) {
          // Get sample sources
          const { data: sampleMentions } = await supabase
            .from('entity_mentions')
            .select('source_type, source_id, context')
            .eq('entity_name', trend.entity_name)
            .order('mentioned_at', { ascending: false })
            .limit(3);

          const severity = actionableScore > 75 ? 'high' : actionableScore > 50 ? 'medium' : 'low';
          const alertType = thresholdExceeded ? 'threshold_exceeded' : 'trending';

          alerts.push({
            organization_id: watchlistItem.organization_id,
            watchlist_id: watchlistItem.id,
            entity_name: watchlistItem.entity_name,
            alert_type: alertType,
            severity,
            actionable_score: Math.round(actionableScore),
            is_actionable: actionableScore > 60,
            current_mentions: trend.mentions_last_hour,
            velocity: trend.velocity,
            sample_sources: sampleMentions || [],
            triggered_at: now,
          });
        }
      }
    }

    console.log(`Generated ${alerts.length} alerts`);

    // Insert alerts
    if (alerts.length > 0) {
      const { error: alertsError } = await supabase
        .from('client_entity_alerts')
        .insert(alerts);

      if (alertsError) {
        console.error('Error inserting alerts:', alertsError);
        throw alertsError;
      }
    }

    // Log watchlist usage
    for (const item of watchlistItems || []) {
      await supabase
        .from('watchlist_usage_log')
        .insert({
          watchlist_id: item.id,
          organization_id: item.organization_id,
          action_type: 'check',
        });
    }

    console.log('Watchlist matching complete');

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertsGenerated: alerts.length,
        watchlistItemsProcessed: watchlistItems?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error matching watchlist:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
