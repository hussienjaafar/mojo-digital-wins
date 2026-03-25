import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronSecret } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// ============================================================================
// Auth Validation
// ============================================================================

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
    console.log('[compute-org-relevance] Authorized via cron');
    return { valid: true };
  }

  const auth = await validateAuth(req, supabase);
  if (auth?.isAdmin) {
    console.log('[compute-org-relevance] Authorized via admin JWT');
    return { valid: true, isAdmin: true, user: auth.user };
  }

  return { valid: false };
}

// ============================================================================
// Types
// ============================================================================

interface OrgProfile {
  organization_id: string;
  org_type?: string;
  mission_summary?: string;
  focus_areas?: string[];
  key_issues?: string[];
  geographies?: string[];
  stakeholders?: string[];
  allies?: string[];
  opponents?: string[];
  priority_lanes?: string[];
  embedding?: number[];
}

interface InterestTopic {
  topic: string;
  weight: number;
  source: string;
}

interface InterestEntity {
  entity_name: string;
  rule_type: 'allow' | 'deny';
  reason?: string;
}

interface TrendEvent {
  id: string;
  event_key: string;
  event_title: string;
  velocity?: number;
  is_trending?: boolean;
  is_breaking?: boolean;
  confidence_score?: number;
  current_1h?: number;
  current_6h?: number;
  current_24h?: number;
  source_count?: number;
  embedding?: number[] | null;
}

// Cosine similarity for semantic matching
function cosineSimilarity(a: number[] | null, b: number[] | null): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

// Parse pgvector format to number array
function parseEmbedding(embedding: any): number[] | null {
  if (!embedding) return null;
  
  try {
    // If already an array, return it
    if (Array.isArray(embedding)) return embedding;
    
    // If string format [x,y,z,...], parse it
    if (typeof embedding === 'string') {
      const cleaned = embedding.replace(/^\[|\]$/g, '');
      return cleaned.split(',').map(Number);
    }
    
    return null;
  } catch {
    return null;
  }
}

interface OrgRelevanceScore {
  organization_id: string;
  trend_event_id?: string;
  trend_key: string;
  relevance_score: number;
  urgency_score: number;
  priority_bucket: 'high' | 'medium' | 'low';
  is_blocked: boolean;
  is_allowlisted: boolean;
  matched_topics: string[];
  matched_entities: string[];
  matched_geographies: string[];
  explanation: {
    reasons: string[];
    score_breakdown: Record<string, number>;
    topic_matches: Array<{ topic: string; weight: number }>;
    entity_match?: { name: string; type: 'allow' | 'ally' | 'opponent' | 'stakeholder' };
    geo_match?: string;
  };
}

// ============================================================================
// Matching Utilities
// ============================================================================

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function textContains(haystack: string, needle: string): boolean {
  const normHaystack = normalizeText(haystack);
  const normNeedle = normalizeText(needle);
  return normHaystack.includes(normNeedle) || normNeedle.includes(normHaystack);
}

function fuzzyMatch(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.85;
  
  const tokensA = new Set(normA.split(' ').filter(t => t.length > 2));
  const tokensB = new Set(normB.split(' ').filter(t => t.length > 2));
  
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap++;
  }
  
  return overlap / Math.max(tokensA.size, tokensB.size);
}

// ============================================================================
// Relevance Scoring Engine
// ============================================================================

interface OutcomeCorrelation {
  trend_key: string;
  should_boost_relevance: boolean;
  learning_signal: string;
  performance_delta: number;
  response_rate: number;
}

function calculateRelevance(
  trendTitle: string,
  trendVelocity: number,
  trendIsBreaking: boolean,
  trendSourceCount: number,
  profile: OrgProfile | null,
  interestTopics: InterestTopic[],
  interestEntities: InterestEntity[],
  outcomeCorrelation?: OutcomeCorrelation,
  trendEmbedding?: number[] | null
): OrgRelevanceScore {
  const result: OrgRelevanceScore = {
    organization_id: profile?.organization_id || '',
    trend_key: normalizeText(trendTitle),
    relevance_score: 0,
    urgency_score: 0,
    priority_bucket: 'low',
    is_blocked: false,
    is_allowlisted: false,
    matched_topics: [],
    matched_entities: [],
    matched_geographies: [],
    explanation: {
      reasons: [],
      score_breakdown: {},
      topic_matches: [],
    },
  };

  const normalizedTitle = normalizeText(trendTitle);
  let score = 0;

  // 1. Check deny list first (hard block)
  const deniedEntity = interestEntities.find(
    e => e.rule_type === 'deny' && textContains(trendTitle, e.entity_name)
  );
  
  if (deniedEntity) {
    result.is_blocked = true;
    result.explanation.reasons.push(`Blocked: "${deniedEntity.entity_name}" is on deny list`);
    return result;
  }

  // 2. Interest topics matching (up to 50 points)
  const matchedTopics: Array<{ topic: string; weight: number }> = [];
  
  for (const interestTopic of interestTopics) {
    const matchScore = fuzzyMatch(trendTitle, interestTopic.topic);
    if (matchScore >= 0.5) {
      matchedTopics.push({ topic: interestTopic.topic, weight: interestTopic.weight * matchScore });
      result.matched_topics.push(interestTopic.topic);
    }
  }

  if (matchedTopics.length > 0) {
    const maxWeight = Math.max(...matchedTopics.map(t => t.weight));
    const topicPoints = Math.round(maxWeight * 50);
    score += topicPoints;
    result.explanation.score_breakdown.topic_match = topicPoints;
    result.explanation.topic_matches = matchedTopics;
    result.explanation.reasons.push(
      `Topic match: ${matchedTopics.map(t => t.topic).slice(0, 3).join(', ')} (+${topicPoints})`
    );
  }

  // 3. Profile-based matching (focus_areas, key_issues, priority_lanes)
  if (profile) {
    const profileTopics = [
      ...(profile.focus_areas || []),
      ...(profile.key_issues || []),
      ...(profile.priority_lanes || []),
    ];
    
    const matchedProfileTopics = profileTopics.filter(pt => 
      fuzzyMatch(trendTitle, pt) >= 0.5
    );
    
    if (matchedProfileTopics.length > 0 && matchedTopics.length === 0) {
      const profilePoints = Math.min(matchedProfileTopics.length * 12, 35);
      score += profilePoints;
      result.explanation.score_breakdown.profile_match = profilePoints;
      result.matched_topics.push(...matchedProfileTopics);
      result.explanation.reasons.push(
        `Profile topic: ${matchedProfileTopics.slice(0, 3).join(', ')} (+${profilePoints})`
      );
    }
  }

  // 4. Allowlist entities (15 points)
  const allowedEntity = interestEntities.find(
    e => e.rule_type === 'allow' && textContains(trendTitle, e.entity_name)
  );
  
  if (allowedEntity) {
    score += 15;
    result.is_allowlisted = true;
    result.matched_entities.push(allowedEntity.entity_name);
    result.explanation.score_breakdown.allowlist = 15;
    result.explanation.entity_match = { name: allowedEntity.entity_name, type: 'allow' };
    result.explanation.reasons.push(`Allowlisted: "${allowedEntity.entity_name}" (+15)`);
  }

  // 5. Stakeholders, allies, opponents matching (10 points each)
  if (profile) {
    const matchedStakeholder = (profile.stakeholders || []).find(s => 
      textContains(trendTitle, s)
    );
    if (matchedStakeholder) {
      score += 10;
      result.matched_entities.push(matchedStakeholder);
      result.explanation.score_breakdown.stakeholder = 10;
      result.explanation.entity_match = { name: matchedStakeholder, type: 'stakeholder' };
      result.explanation.reasons.push(`Stakeholder: "${matchedStakeholder}" (+10)`);
    }

    const matchedAlly = (profile.allies || []).find(a => textContains(trendTitle, a));
    if (matchedAlly) {
      score += 10;
      result.matched_entities.push(matchedAlly);
      result.explanation.score_breakdown.ally = 10;
      result.explanation.entity_match = { name: matchedAlly, type: 'ally' };
      result.explanation.reasons.push(`Allied org: "${matchedAlly}" (+10)`);
    }

    const matchedOpponent = (profile.opponents || []).find(o => textContains(trendTitle, o));
    if (matchedOpponent) {
      score += 12;
      result.matched_entities.push(matchedOpponent);
      result.explanation.score_breakdown.opponent = 12;
      result.explanation.entity_match = { name: matchedOpponent, type: 'opponent' };
      result.explanation.reasons.push(`Opposition: "${matchedOpponent}" (+12)`);
    }
  }

  // 6. Geographic relevance (8 points)
  if (profile?.geographies && profile.geographies.length > 0) {
    const matchedGeo = profile.geographies.find(geo => 
      textContains(trendTitle, geo)
    );
    
    if (matchedGeo) {
      score += 8;
      result.matched_geographies.push(matchedGeo);
      result.explanation.score_breakdown.geography = 8;
      result.explanation.geo_match = matchedGeo;
      result.explanation.reasons.push(`Geographic: ${matchedGeo} (+8)`);
    }
  }

  // 7. Velocity urgency bonus (up to 15 points)
  if (trendVelocity > 50) {
    const velocityBonus = Math.min(Math.round(trendVelocity / 20), 15);
    score += velocityBonus;
    result.explanation.score_breakdown.velocity = velocityBonus;
    result.explanation.reasons.push(`High velocity: ${trendVelocity.toFixed(0)}% (+${velocityBonus})`);
  }

  // 8. Breaking news bonus (10 points)
  if (trendIsBreaking) {
    score += 10;
    result.explanation.score_breakdown.breaking = 10;
    result.explanation.reasons.push(`Breaking news (+10)`);
  }

  // 9. Multi-source bonus (5 points if >= 3 sources)
  if (trendSourceCount >= 3) {
    score += 5;
    result.explanation.score_breakdown.multi_source = 5;
    result.explanation.reasons.push(`Multi-source: ${trendSourceCount} sources (+5)`);
  }

  // 10. Semantic similarity boost (up to 20 points)
  // Uses embedding cosine similarity for deeper semantic matching
  if (profile?.embedding && trendEmbedding) {
    const similarity = cosineSimilarity(profile.embedding, trendEmbedding);
    
    if (similarity > 0.3) {
      // Scale similarity (0.3 to 0.9 range) to points (5 to 20)
      const semanticBoost = Math.min(20, Math.round((similarity - 0.3) * 33.33) + 5);
      score += semanticBoost;
      result.explanation.score_breakdown.semantic_match = semanticBoost;
      result.explanation.reasons.push(
        `Semantic match: ${(similarity * 100).toFixed(0)}% similarity (+${semanticBoost})`
      );
    }
  }

  // 11. Outcome-based learning boost (up to 10 points)
  // Conservative boost based on positive outcome signals
  if (outcomeCorrelation?.should_boost_relevance) {
    let outcomeBoost = 0;
    
    if (outcomeCorrelation.learning_signal === 'strong_positive') {
      outcomeBoost = 10;
    } else if (outcomeCorrelation.learning_signal === 'positive') {
      outcomeBoost = 6;
    }
    
    if (outcomeBoost > 0) {
      score += outcomeBoost;
      result.explanation.score_breakdown.outcome_boost = outcomeBoost;
      result.explanation.reasons.push(
        `Outcome signal: ${outcomeCorrelation.learning_signal} (${outcomeCorrelation.performance_delta > 0 ? '+' : ''}${outcomeCorrelation.performance_delta.toFixed(1)}% vs baseline) (+${outcomeBoost})`
      );
    }
  }

  // Calculate urgency score based on velocity + breaking
  result.urgency_score = Math.min(100, Math.round(trendVelocity / 2) + (trendIsBreaking ? 25 : 0));

  // Final score capping
  result.relevance_score = Math.min(100, Math.round(score));
  
  // Determine priority bucket
  if (result.relevance_score >= 65) {
    result.priority_bucket = 'high';
  } else if (result.relevance_score >= 35) {
    result.priority_bucket = 'medium';
  } else {
    result.priority_bucket = 'low';
  }

  if (result.explanation.reasons.length === 0) {
    result.explanation.reasons.push('No specific matches found');
  }

  return result;
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

    console.log('🎯 Starting org relevance computation (trend_events only)...');

    // Get active organizations with profiles
    const { data: orgs, error: orgsError } = await supabase
      .from('client_organizations')
      .select('id, name')
      .eq('is_active', true);

    if (orgsError) throw orgsError;
    console.log(`📊 Processing ${orgs?.length || 0} active organizations`);

    // Get all org profiles WITH embeddings
    const { data: profiles } = await supabase
      .from('organization_profiles')
      .select('*');

    const profileMap = new Map<string, OrgProfile>();
    for (const p of profiles || []) {
      // Parse embedding from pgvector format
      const profile: OrgProfile = {
        ...p,
        embedding: parseEmbedding(p.embedding),
      };
      profileMap.set(p.organization_id, profile);
    }

    // Get interest topics for all orgs
    const { data: allTopics } = await supabase
      .from('org_interest_topics')
      .select('organization_id, topic, weight, source');

    const topicsMap = new Map<string, InterestTopic[]>();
    for (const t of allTopics || []) {
      if (!topicsMap.has(t.organization_id)) {
        topicsMap.set(t.organization_id, []);
      }
      topicsMap.get(t.organization_id)!.push(t as InterestTopic);
    }

    // Get interest entities for all orgs
    const { data: allEntities } = await supabase
      .from('org_interest_entities')
      .select('organization_id, entity_name, rule_type, reason');

    const entitiesMap = new Map<string, InterestEntity[]>();
    for (const e of allEntities || []) {
      if (!entitiesMap.has(e.organization_id)) {
        entitiesMap.set(e.organization_id, []);
      }
      entitiesMap.get(e.organization_id)!.push(e as InterestEntity);
    }

    // Get current trends from trend_events WITH embeddings
    const { data: trendEvents } = await supabase
      .from('trend_events')
      .select('id, event_key, event_title, velocity, is_trending, is_breaking, confidence_score, current_1h, current_6h, current_24h, source_count, embedding')
      .eq('is_trending', true)
      .gte('last_seen_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order('velocity', { ascending: false })
      .limit(150);
    
    // Parse trend embeddings
    const trends: TrendEvent[] = (trendEvents || []).map(t => ({
      ...t,
      embedding: parseEmbedding(t.embedding),
    }));
    console.log(`📈 Scoring ${trends.length} trend_events for ${orgs?.length || 0} orgs`);

    // Fetch recent outcome correlations for learning signal (last 7 days)
    const correlationWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: outcomeCorrelations } = await supabase
      .from('trend_outcome_correlation')
      .select('organization_id, trend_key, should_boost_relevance, learning_signal, performance_delta, response_rate')
      .gte('window_start', correlationWindowStart)
      .eq('should_boost_relevance', true);

    // Build a map: org_id -> trend_key -> correlation
    const correlationMap = new Map<string, Map<string, OutcomeCorrelation>>();
    for (const corr of outcomeCorrelations || []) {
      if (!correlationMap.has(corr.organization_id)) {
        correlationMap.set(corr.organization_id, new Map());
      }
      // Keep the most recent/strongest signal per trend_key
      const existing = correlationMap.get(corr.organization_id)!.get(corr.trend_key);
      if (!existing || corr.performance_delta > existing.performance_delta) {
        correlationMap.get(corr.organization_id)!.set(corr.trend_key, corr as OutcomeCorrelation);
      }
    }
    console.log(`📊 Loaded ${outcomeCorrelations?.length || 0} outcome correlations for learning boosts`);

    // Compute relevance for each org x trend
    const scoresToUpsert: any[] = [];
    let highPriorityCount = 0;
    let outcomeBoostCount = 0;
    let semanticMatchCount = 0;

    for (const org of orgs || []) {
      const profile = profileMap.get(org.id) || null;
      const interestTopics = topicsMap.get(org.id) || [];
      const interestEntities = entitiesMap.get(org.id) || [];
      const orgCorrelations = correlationMap.get(org.id);

      for (const trend of trends) {
        // Look up outcome correlation for this trend
        const trendKeyNormalized = trend.event_title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
        const outcomeCorrelation = orgCorrelations?.get(trendKeyNormalized);

        const relevance = calculateRelevance(
          trend.event_title,
          trend.velocity || 0,
          trend.is_breaking || false,
          trend.source_count || 1,
          profile ? { ...profile, organization_id: org.id } : { organization_id: org.id },
          interestTopics,
          interestEntities,
          outcomeCorrelation,
          trend.embedding
        );

        if (outcomeCorrelation && relevance.explanation.score_breakdown.outcome_boost) {
          outcomeBoostCount++;
        }
        
        // Track semantic match count
        if (relevance.explanation.score_breakdown.semantic_match !== undefined) {
          semanticMatchCount++;
        }

        // Only store scores above minimum threshold
        if (relevance.relevance_score >= 10 || relevance.is_blocked) {
          scoresToUpsert.push({
            organization_id: org.id,
            trend_event_id: trend.id,
            trend_cluster_id: null, // No longer using clusters
            trend_key: relevance.trend_key,
            relevance_score: relevance.relevance_score,
            urgency_score: relevance.urgency_score,
            priority_bucket: relevance.priority_bucket,
            is_blocked: relevance.is_blocked,
            is_allowlisted: relevance.is_allowlisted,
            matched_topics: relevance.matched_topics,
            matched_entities: relevance.matched_entities,
            matched_geographies: relevance.matched_geographies,
            explanation: relevance.explanation,
            computed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });

          if (relevance.priority_bucket === 'high') {
            highPriorityCount++;
          }
        }
      }
    }

    console.log(`💾 Upserting ${scoresToUpsert.length} org-trend scores (${highPriorityCount} high priority, ${outcomeBoostCount} with outcome boost, ${semanticMatchCount} with semantic match)`);

    // Upsert in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < scoresToUpsert.length; i += BATCH_SIZE) {
      const batch = scoresToUpsert.slice(i, i + BATCH_SIZE);
      
      const { error: upsertError } = await supabase
        .from('org_trend_scores')
        .upsert(batch, { 
          onConflict: 'organization_id,trend_key',
          ignoreDuplicates: false 
        });
      
      if (upsertError) {
        console.error(`Error upserting batch ${i / BATCH_SIZE}:`, upsertError);
      }
    }

    // Clean up expired scores
    const { error: cleanupError } = await supabase
      .from('org_trend_scores')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (cleanupError) {
      console.warn('Cleanup error:', cleanupError);
    }

    console.log('✅ Org relevance computation complete (with outcome learning)');

    return new Response(
      JSON.stringify({ 
        success: true,
        orgsProcessed: orgs?.length || 0,
        trendsScored: trends.length,
        scoresCreated: scoresToUpsert.length,
        highPriorityScores: highPriorityCount,
        outcomeBoosts: outcomeBoostCount,
        semanticMatches: semanticMatchCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error computing org relevance:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
