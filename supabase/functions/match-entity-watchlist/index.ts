import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Levenshtein distance for fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1] + 1, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
      }
    }
  }
  return dp[m][n];
}

// Calculate similarity score (0-1)
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
}

// Common synonyms for political/social topics
const SYNONYM_MAP: Record<string, string[]> = {
  'immigration': ['migrants', 'immigrants', 'border', 'asylum', 'deportation', 'ice', 'dhs'],
  'healthcare': ['health care', 'medical', 'medicare', 'medicaid', 'aca', 'obamacare'],
  'climate': ['climate change', 'global warming', 'environment', 'green energy', 'carbon', 'emissions'],
  'abortion': ['reproductive rights', 'roe', 'pro-choice', 'pro-life', 'planned parenthood'],
  'gun control': ['gun rights', 'second amendment', '2nd amendment', 'firearms', 'nra'],
  'voting': ['voter', 'election', 'ballot', 'electoral', 'suffrage', 'voter id'],
  'lgbtq': ['lgbt', 'gay rights', 'transgender', 'same-sex', 'marriage equality', 'pride'],
  'racial justice': ['blm', 'black lives matter', 'civil rights', 'police reform', 'racism', 'dei'],
  'education': ['schools', 'teachers', 'students', 'curriculum', 'college', 'university'],
  'economy': ['jobs', 'unemployment', 'inflation', 'wages', 'labor', 'workers'],
};

// Expand entity name with synonyms
function expandWithSynonyms(entityName: string): string[] {
  const lower = entityName.toLowerCase();
  const expanded = [entityName];
  
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (lower.includes(key) || synonyms.some(s => lower.includes(s))) {
      expanded.push(key, ...synonyms);
    }
  }
  
  return [...new Set(expanded)];
}

// Enhanced actionable score calculation
function calculateActionableScore(
  velocity: number,
  sentimentChange: number,
  mentions24h: number,
  matchStrength: number,
  entityType: string,
  isBreakthrough: boolean
): { score: number; breakdown: Record<string, number> } {
  const weights = {
    velocity: 0.30,
    sentiment: 0.20,
    volume: 0.20,
    matchStrength: 0.20,
    typeBonus: 0.10,
  };

  const velocityScore = Math.min(100, Math.max(0, velocity / 3));
  const sentimentScore = Math.min(100, Math.abs(sentimentChange) * 200);
  const volumeScore = Math.min(100, (mentions24h / 20) * 100);
  const matchScore = matchStrength * 100;
  const typeBonus = ['opposition', 'issue', 'topic'].includes(entityType) ? 100 : 60;

  const breakdown = {
    velocity: Math.round(velocityScore * weights.velocity),
    sentiment: Math.round(sentimentScore * weights.sentiment),
    volume: Math.round(volumeScore * weights.volume),
    match: Math.round(matchScore * weights.matchStrength),
    type: Math.round(typeBonus * weights.typeBonus),
  };

  let totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0);
  
  // Breakthrough bonus
  if (isBreakthrough) {
    totalScore = Math.min(100, totalScore * 1.2);
  }

  return { score: Math.round(totalScore), breakdown };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Starting enhanced watchlist matching...');

    // Get all active watchlist items
    const { data: watchlistItems, error: watchlistError } = await supabase
      .from('entity_watchlist')
      .select('id, organization_id, entity_name, entity_type, aliases, alert_threshold, sentiment_alert')
      .eq('is_active', true);

    if (watchlistError) throw watchlistError;

    console.log(`📋 Processing ${watchlistItems?.length || 0} watchlist items`);

    // Get all current trends
    const { data: entityTrends } = await supabase
      .from('entity_trends')
      .select('*')
      .or('is_trending.eq.true,velocity.gt.30')
      .order('velocity', { ascending: false });

    // Get unified trends for cross-source detection
    const { data: unifiedTrends } = await supabase
      .from('mv_unified_trends')
      .select('*')
      .order('unified_score', { ascending: false })
      .limit(100);

    // Get recent mentions for sample sources
    const { data: recentMentions } = await supabase
      .from('entity_mentions')
      .select('entity_name, source_type, source_title, source_url, mentioned_at')
      .gte('mentioned_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('mentioned_at', { ascending: false })
      .limit(500);

    const mentionsByEntity = new Map<string, any[]>();
    for (const mention of recentMentions || []) {
      if (!mention.entity_name) continue; // Skip null entity names
      const key = mention.entity_name.toLowerCase();
      if (!mentionsByEntity.has(key)) mentionsByEntity.set(key, []);
      mentionsByEntity.get(key)!.push(mention);
    }

    // Get recent alerts to avoid duplicates (last 4 hours)
    const { data: recentAlerts } = await supabase
      .from('client_entity_alerts')
      .select('organization_id, entity_name, alert_type')
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());

    const recentAlertKeys = new Set(
      (recentAlerts || [])
        .filter(a => a.entity_name) // Filter out null entity names
        .map(a => `${a.organization_id}-${a.entity_name.toLowerCase()}-${a.alert_type}`)
    );

    const alerts: any[] = [];
    const SIMILARITY_THRESHOLD = 0.7;
    const now = new Date().toISOString();

    for (const watchItem of watchlistItems || []) {
      // Skip watchlist items with no entity name
      if (!watchItem.entity_name) {
        console.warn(`Skipping watchlist item ${watchItem.id} - no entity_name`);
        continue;
      }

      // Build list of terms to match (entity name + aliases + synonyms)
      const termsToMatch = [
        watchItem.entity_name,
        ...(watchItem.aliases || []),
        ...expandWithSynonyms(watchItem.entity_name),
      ].filter(t => t).map(t => t.toLowerCase()); // Filter nulls before toLowerCase

      // Match against entity_trends
      for (const trend of entityTrends || []) {
        if (!trend.entity_name) continue; // Skip null trend names
        const trendNameLower = trend.entity_name.toLowerCase();
        
        // Check for fuzzy matches
        let bestMatch = 0;
        for (const term of termsToMatch) {
          const similarity = stringSimilarity(term, trendNameLower);
          if (similarity > bestMatch) bestMatch = similarity;
        }

        if (bestMatch >= SIMILARITY_THRESHOLD) {
          const { score, breakdown } = calculateActionableScore(
            trend.velocity || 0,
            trend.sentiment_change || 0,
            trend.mentions_24h || 0,
            bestMatch,
            watchItem.entity_type,
            false
          );

          if (score >= (watchItem.alert_threshold || 50)) {
            let severity = 'low';
            if (score >= 80) severity = 'critical';
            else if (score >= 60) severity = 'high';
            else if (score >= 40) severity = 'medium';

            // Map to valid alert types from check constraint
            let alertType = 'spike'; // default
            if (trend.velocity > 200) alertType = 'trending_spike';
            else if (Math.abs(trend.sentiment_change || 0) > 0.3) alertType = 'sentiment_shift';
            else if (trend.is_trending && trend.velocity > 100) alertType = 'breaking';

            const alertKey = `${watchItem.organization_id}-${watchItem.entity_name.toLowerCase()}-${alertType}`;
            if (recentAlertKeys.has(alertKey)) continue;

            const sources = mentionsByEntity.get(trendNameLower)?.slice(0, 3) || [];
            const sampleSources = sources.map(s => ({
              type: s.source_type,
              title: s.source_title,
              url: s.source_url,
            }));

            let suggestedAction = '';
            if (alertType === 'trending_spike') {
              suggestedAction = `${watchItem.entity_name} is trending with ${trend.velocity?.toFixed(0)}% velocity. Consider capitalizing on this momentum.`;
            } else if (alertType === 'sentiment_shift') {
              const direction = (trend.sentiment_change || 0) > 0 ? 'positive' : 'negative';
              suggestedAction = `Sentiment around ${watchItem.entity_name} has shifted ${direction}. Review recent coverage.`;
            } else {
              suggestedAction = `${watchItem.entity_name} has ${trend.mentions_24h} mentions in 24h. Monitor for developments.`;
            }

            alerts.push({
              organization_id: watchItem.organization_id,
              watchlist_id: watchItem.id,
              entity_name: watchItem.entity_name,
              alert_type: alertType,
              severity,
              is_actionable: score >= 60,
              actionable_score: score,
              current_mentions: trend.mentions_24h,
              velocity: trend.velocity,
              sample_sources: sampleSources,
              suggested_action: suggestedAction,
              triggered_at: now,
            });

            recentAlertKeys.add(alertKey);
          }
        }
      }

      // Check unified trends for cross-source breakthroughs
      for (const unified of unifiedTrends || []) {
        if (!unified.topic) continue; // Skip null topics
        const unifiedNameLower = unified.topic.toLowerCase();
        
        let bestMatch = 0;
        for (const term of termsToMatch) {
          if (!term) continue;
          bestMatch = Math.max(bestMatch, stringSimilarity(term, unifiedNameLower));
        }

        if (bestMatch >= SIMILARITY_THRESHOLD && unified.is_breakthrough) {
          const alertKey = `${watchItem.organization_id}-${(watchItem.entity_name || '').toLowerCase()}-breaking`;
          if (recentAlertKeys.has(alertKey)) continue;

          const score = Math.min(100, (unified.unified_score || 50) + 20);
          
          if (score >= (watchItem.alert_threshold || 50)) {
            alerts.push({
              organization_id: watchItem.organization_id,
              watchlist_id: watchItem.id,
              entity_name: watchItem.entity_name,
              alert_type: 'breaking', // cross-source breakthrough mapped to 'breaking'
              severity: score >= 80 ? 'critical' : score >= 60 ? 'high' : 'medium',
              is_actionable: true,
              actionable_score: score,
              current_mentions: unified.total_mentions,
              velocity: unified.max_velocity,
              sample_sources: [],
              suggested_action: `${watchItem.entity_name} detected across ${unified.source_count} sources. This cross-platform signal warrants attention.`,
              triggered_at: now,
            });

            recentAlertKeys.add(alertKey);
          }
        }
      }
    }

    console.log(`🚨 Generated ${alerts.length} alerts`);

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

    console.log('✅ Watchlist matching complete');

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertsGenerated: alerts.length,
        watchlistItemsProcessed: watchlistItems?.length || 0,
        trendsChecked: (entityTrends?.length || 0) + (unifiedTrends?.length || 0)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error matching watchlist:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
