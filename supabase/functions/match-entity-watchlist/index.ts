import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// ============================================================================
// Auth Validation (from shared security)
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
    console.log('[match-entity-watchlist] Authorized via cron');
    return { valid: true };
  }

  const auth = await validateAuth(req, supabase);
  if (auth?.isAdmin) {
    console.log('[match-entity-watchlist] Authorized via admin JWT');
    return { valid: true, isAdmin: true, user: auth.user };
  }

  return { valid: false };
}

// ============================================================================
// Matching Utilities
// ============================================================================

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

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

// ============================================================================
// Entity Type Context Gating
// ============================================================================

interface EntityTypeContext {
  expectedTerms: string[];
  excludeTerms: string[];
}

const ENTITY_TYPE_CONTEXTS: Record<string, EntityTypeContext> = {
  'person': {
    expectedTerms: ['said', 'told', 'announced', 'senator', 'representative', 'secretary', 'president', 'governor'],
    excludeTerms: ['inc', 'corp', 'llc', 'foundation', 'institute', 'organization'],
  },
  'organization': {
    expectedTerms: ['inc', 'corp', 'llc', 'foundation', 'institute', 'organization', 'company', 'group'],
    excludeTerms: [],
  },
  'bill': {
    expectedTerms: ['bill', 'act', 'hr', 'h.r.', 's.', 'resolution', 'congress', 'legislation'],
    excludeTerms: [],
  },
  'committee': {
    expectedTerms: ['committee', 'subcommittee', 'hearing', 'oversight'],
    excludeTerms: [],
  },
  'agency': {
    expectedTerms: ['agency', 'department', 'bureau', 'administration', 'federal'],
    excludeTerms: [],
  },
};

function validateEntityTypeContext(
  entityType: string | null,
  contentText: string,
  contextKeywords: string[] = []
): { isValid: boolean; confidence: number } {
  if (!entityType || !ENTITY_TYPE_CONTEXTS[entityType]) {
    return { isValid: true, confidence: 0.5 };
  }

  const context = ENTITY_TYPE_CONTEXTS[entityType];
  const lowerContent = contentText.toLowerCase();
  
  const hasExcludeTerm = context.excludeTerms.some(term => lowerContent.includes(term));
  if (hasExcludeTerm) {
    return { isValid: false, confidence: 0.2 };
  }
  
  const hasExpectedContext = context.expectedTerms.some(term => lowerContent.includes(term));
  const hasCustomContext = contextKeywords.length > 0 && 
    contextKeywords.some(kw => lowerContent.includes(kw.toLowerCase()));
  
  if (hasExpectedContext || hasCustomContext) {
    return { isValid: true, confidence: 0.9 };
  }
  
  return { isValid: true, confidence: 0.6 };
}

function validateGeoContext(
  geoFocus: string[] = [],
  contentText: string
): { matches: boolean; matchedGeo: string | null } {
  if (geoFocus.length === 0) {
    return { matches: true, matchedGeo: null };
  }
  
  const lowerContent = contentText.toLowerCase();
  for (const geo of geoFocus) {
    if (lowerContent.includes(geo.toLowerCase())) {
      return { matches: true, matchedGeo: geo };
    }
  }
  
  return { matches: false, matchedGeo: null };
}

// ============================================================================
// Alias Matching
// ============================================================================

interface AliasMatch {
  matchedAlias: string;
  canonicalName: string;
  confidence: number;
  isExactMatch: boolean;
}

function findAliasMatch(
  searchTerm: string,
  entityName: string,
  aliases: string[] = [],
  entityAliases: Map<string, { canonical: string; confidence: number }> = new Map()
): AliasMatch | null {
  const normalizedSearch = normalizeText(searchTerm);
  
  if (normalizeText(entityName) === normalizedSearch) {
    return {
      matchedAlias: entityName,
      canonicalName: entityName,
      confidence: 1.0,
      isExactMatch: true,
    };
  }
  
  for (const alias of aliases) {
    if (normalizeText(alias) === normalizedSearch) {
      return {
        matchedAlias: alias,
        canonicalName: entityName,
        confidence: 0.95,
        isExactMatch: true,
      };
    }
  }
  
  const dbAlias = entityAliases.get(normalizedSearch);
  if (dbAlias && normalizeText(dbAlias.canonical) === normalizeText(entityName)) {
    return {
      matchedAlias: searchTerm,
      canonicalName: dbAlias.canonical,
      confidence: dbAlias.confidence,
      isExactMatch: true,
    };
  }
  
  const expandedTerms = [entityName, ...aliases, ...expandWithSynonyms(entityName)];
  let bestMatch: AliasMatch | null = null;
  
  for (const term of expandedTerms) {
    const similarity = stringSimilarity(term, searchTerm);
    if (similarity >= 0.75 && (!bestMatch || similarity > bestMatch.confidence)) {
      bestMatch = {
        matchedAlias: term,
        canonicalName: entityName,
        confidence: similarity,
        isExactMatch: false,
      };
    }
  }
  
  return bestMatch;
}

// ============================================================================
// Actionable Score Calculation
// ============================================================================

interface ScoreBreakdown {
  velocity: number;
  sentiment: number;
  volume: number;
  match: number;
  type: number;
  context: number;
}

function calculateActionableScore(
  velocity: number,
  sentimentChange: number,
  mentions24h: number,
  matchStrength: number,
  entityType: string,
  contextConfidence: number,
  isBreakthrough: boolean
): { score: number; breakdown: ScoreBreakdown } {
  const weights = {
    velocity: 0.25,
    sentiment: 0.15,
    volume: 0.20,
    matchStrength: 0.20,
    typeBonus: 0.10,
    context: 0.10,
  };

  const velocityScore = Math.min(100, Math.max(0, velocity / 3));
  const sentimentScore = Math.min(100, Math.abs(sentimentChange) * 200);
  const volumeScore = Math.min(100, (mentions24h / 20) * 100);
  const matchScore = matchStrength * 100;
  const typeBonus = ['opposition', 'issue', 'topic'].includes(entityType) ? 100 : 60;
  const contextScore = contextConfidence * 100;

  const breakdown: ScoreBreakdown = {
    velocity: Math.round(velocityScore * weights.velocity),
    sentiment: Math.round(sentimentScore * weights.sentiment),
    volume: Math.round(volumeScore * weights.volume),
    match: Math.round(matchScore * weights.matchStrength),
    type: Math.round(typeBonus * weights.typeBonus),
    context: Math.round(contextScore * weights.context),
  };

  let totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0);
  
  if (isBreakthrough) {
    totalScore = Math.min(100, totalScore * 1.2);
  }

  return { score: Math.round(totalScore), breakdown };
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

    console.log('🔍 Starting watchlist matching with trend_events...');

    // Fetch data in parallel - NOW USING trend_events + trend_evidence
    const [
      watchlistResult,
      trendEventsResult,
      trendEvidenceResult,
      recentAlertsResult,
      entityAliasesResult,
    ] = await Promise.all([
      supabase
        .from('entity_watchlist')
        .select('id, organization_id, entity_name, entity_type, aliases, alert_threshold, sentiment_alert, geo_focus, context_keywords, disambiguation_hint')
        .eq('is_active', true),
      // Use trend_events instead of entity_trends/mv_unified_trends
      supabase
        .from('trend_events')
        .select('id, event_key, event_title, velocity, is_trending, is_breaking, confidence_score, current_1h, current_6h, current_24h, source_count, last_seen_at')
        .eq('is_trending', true)
        .gte('last_seen_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
        .order('velocity', { ascending: false })
        .limit(200),
      // Get evidence for active trends
      supabase
        .from('trend_evidence')
        .select('id, event_id, source_type, source_url, source_title, source_domain, published_at, canonical_url, content_hash, sentiment_label')
        .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('published_at', { ascending: false })
        .limit(1000),
      supabase
        .from('client_entity_alerts')
        .select('organization_id, entity_name, alert_type')
        .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('entity_aliases')
        .select('raw_name, canonical_name, confidence_score')
        .order('confidence_score', { ascending: false })
        .limit(1000),
    ]);

    if (watchlistResult.error) throw watchlistResult.error;

    const watchlistItems = watchlistResult.data || [];
    const trendEvents = trendEventsResult.data || [];
    const trendEvidence = trendEvidenceResult.data || [];
    const recentAlerts = recentAlertsResult.data || [];
    const entityAliases = entityAliasesResult.data || [];

    console.log(`📋 Processing ${watchlistItems.length} watchlist items`);
    console.log(`📊 ${trendEvents.length} trend events, ${trendEvidence.length} evidence items`);
    console.log(`🔗 ${entityAliases.length} entity aliases loaded`);

    // Build alias lookup map
    const aliasMap = new Map<string, { canonical: string; confidence: number }>();
    for (const alias of entityAliases) {
      aliasMap.set(normalizeText(alias.raw_name), {
        canonical: alias.canonical_name,
        confidence: alias.confidence_score || 0.8,
      });
    }

    // Build evidence by event_id map
    const evidenceByEvent = new Map<string, any[]>();
    for (const evidence of trendEvidence) {
      if (!evidence.event_id) continue;
      if (!evidenceByEvent.has(evidence.event_id)) {
        evidenceByEvent.set(evidence.event_id, []);
      }
      evidenceByEvent.get(evidence.event_id)!.push(evidence);
    }

    // Build recent alerts set
    const recentAlertKeys = new Set(
      recentAlerts
        .filter(a => a.entity_name)
        .map(a => `${a.organization_id}-${a.entity_name.toLowerCase()}-${a.alert_type}`)
    );

    const alerts: any[] = [];
    const SIMILARITY_THRESHOLD = 0.70;
    const now = new Date().toISOString();

    for (const watchItem of watchlistItems) {
      if (!watchItem.entity_name) {
        console.warn(`Skipping watchlist item ${watchItem.id} - no entity_name`);
        continue;
      }

      // Match against trend_events
      for (const event of trendEvents) {
        if (!event.event_title) continue;
        
        // Try alias matching against event title
        const aliasMatch = findAliasMatch(
          event.event_title,
          watchItem.entity_name,
          watchItem.aliases || [],
          aliasMap
        );
        
        if (!aliasMatch || aliasMatch.confidence < SIMILARITY_THRESHOLD) continue;
        
        // Get evidence for this event
        const eventEvidence = evidenceByEvent.get(event.id) || [];
        const evidenceText = eventEvidence.map(e => e.source_title || '').join(' ');
        
        // Context gating - validate entity type
        const trendContent = event.event_title + ' ' + evidenceText;
        const typeContext = validateEntityTypeContext(
          watchItem.entity_type,
          trendContent,
          watchItem.context_keywords || []
        );
        
        if (!typeContext.isValid) {
          console.log(`⚠️ Context mismatch for ${watchItem.entity_name} (type: ${watchItem.entity_type})`);
          continue;
        }
        
        // Geo context check
        const geoContext = validateGeoContext(
          watchItem.geo_focus || [],
          trendContent
        );

        // Combined confidence
        const combinedConfidence = aliasMatch.confidence * typeContext.confidence * 
          (geoContext.matches ? 1.0 : 0.8);

        // Calculate sentiment change from evidence
        const sentimentScores: number[] = eventEvidence
          .filter(e => e.sentiment_label)
          .map(e => e.sentiment_label === 'positive' ? 0.5 : e.sentiment_label === 'negative' ? -0.5 : 0);
        const avgSentiment = sentimentScores.length > 0 
          ? sentimentScores.reduce((a: number, b: number) => a + b, 0) / sentimentScores.length 
          : 0;

        const { score, breakdown } = calculateActionableScore(
          event.velocity || 0,
          avgSentiment,
          event.current_24h || 0,
          aliasMatch.confidence,
          watchItem.entity_type || 'topic',
          typeContext.confidence,
          event.is_breaking || false
        );

        if (score >= (watchItem.alert_threshold || 50)) {
          let severity = 'low';
          if (score >= 80) severity = 'critical';
          else if (score >= 60) severity = 'high';
          else if (score >= 40) severity = 'medium';

          // Map to valid alert types
          let alertType = 'spike';
          if (event.is_breaking) alertType = 'breaking';
          else if (event.velocity > 200) alertType = 'trending_spike';
          else if (Math.abs(avgSentiment) > 0.3) alertType = 'sentiment_shift';

          const alertKey = `${watchItem.organization_id}-${watchItem.entity_name.toLowerCase()}-${alertType}`;
          if (recentAlertKeys.has(alertKey)) continue;

          // Build sample sources from evidence
          const sampleSources = eventEvidence.slice(0, 3).map(e => ({
            type: e.source_type,
            title: e.source_title,
            url: e.source_url || e.canonical_url,
            domain: e.source_domain,
            content_hash: e.content_hash,
          }));

          // Enhanced suggested action with context
          let suggestedAction = '';
          if (alertType === 'breaking') {
            suggestedAction = `🚨 BREAKING: ${watchItem.entity_name} is in breaking news with ${event.source_count || 1} sources. Immediate attention recommended.`;
          } else if (alertType === 'trending_spike') {
            suggestedAction = `${watchItem.entity_name} is trending with ${event.velocity?.toFixed(0)}% velocity. Consider capitalizing on this momentum.`;
          } else if (alertType === 'sentiment_shift') {
            const direction = avgSentiment > 0 ? 'positive' : 'negative';
            suggestedAction = `Sentiment around ${watchItem.entity_name} has shifted ${direction}. Review recent coverage.`;
          } else {
            suggestedAction = `${watchItem.entity_name} has ${event.current_24h || 0} mentions in 24h across ${event.source_count || 1} sources. Monitor for developments.`;
          }
          
          if (geoContext.matchedGeo) {
            suggestedAction += ` (Geo: ${geoContext.matchedGeo})`;
          }

          alerts.push({
            organization_id: watchItem.organization_id,
            watchlist_id: watchItem.id,
            entity_name: watchItem.entity_name,
            alert_type: alertType,
            severity,
            is_actionable: score >= 60,
            actionable_score: score,
            current_mentions: event.current_24h || 0,
            velocity: event.velocity,
            sample_sources: sampleSources,
            suggested_action: suggestedAction,
            triggered_at: now,
            trend_event_id: event.id, // Link to trend_event
          });

          recentAlertKeys.add(alertKey);
        }
      }
    }

    console.log(`🚨 Generated ${alerts.length} alerts from trend_events`);

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
    const usageLogs = watchlistItems.map(item => ({
      watchlist_id: item.id,
      organization_id: item.organization_id,
      action_type: 'check',
    }));

    if (usageLogs.length > 0) {
      await supabase.from('watchlist_usage_log').insert(usageLogs);
    }

    console.log('✅ Watchlist matching complete (trend_events source)');

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertsGenerated: alerts.length,
        watchlistItemsProcessed: watchlistItems.length,
        trendEventsChecked: trendEvents.length,
        evidenceItemsLoaded: trendEvidence.length,
        aliasesLoaded: entityAliases.length,
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
