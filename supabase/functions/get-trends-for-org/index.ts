import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  calculateOrgRelevanceV3,
  type EnhancedTrendEvent,
  type OrgProfile,
  type WatchlistEntity,
  type OrgTopicAffinity,
  type RelevanceResult,
} from "../_shared/orgRelevanceV3.ts";
import { ensureDomainDiversity, type OrgTrend } from "../_shared/trendDiversity.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Get Trends for Organization
 *
 * Main API endpoint for fetching personalized trends using V3 scoring:
 * - 70% profile-based (policy domains, focus areas, watchlist)
 * - 30% learned + exploration (affinities, new opportunity bonus)
 * - Anti-filter-bubble diversity safeguards
 */

interface GetTrendsOptions {
  limit?: number;
  minRelevance?: number;
  includeFilterLog?: boolean;
  hoursBack?: number;
}

async function validateAuth(req: Request, supabase: any): Promise<{ user: any; orgId?: string; token?: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;

  // Get user's organization
  const { data: clientUser } = await supabase
    .from('client_users')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  return { user, orgId: clientUser?.organization_id, token };
}

async function getOrgProfile(supabase: any, orgId: string): Promise<OrgProfile | null> {
  const { data } = await supabase
    .from('organization_profiles')
    .select('*')
    .eq('organization_id', orgId)
    .single();

  return data;
}

async function getOrgWatchlist(supabase: any, orgId: string): Promise<WatchlistEntity[]> {
  const { data } = await supabase
    .from('entity_watchlist')
    .select('entity_name, entity_type, is_active')
    .eq('organization_id', orgId)
    .eq('is_active', true);

  return data || [];
}

async function getOrgTopicAffinities(supabase: any, orgId: string): Promise<OrgTopicAffinity[]> {
  const { data } = await supabase
    .from('org_topic_affinities')
    .select('topic, affinity_score, times_used, avg_performance, source')
    .eq('organization_id', orgId);

  return data || [];
}

async function getRecentTrends(supabase: any, hoursBack: number): Promise<EnhancedTrendEvent[]> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('trend_events')
    .select(`
      id,
      event_key,
      event_title,
      policy_domains,
      geographies,
      geo_level,
      politicians_mentioned,
      organizations_mentioned,
      legislation_mentioned,
      context_terms,
      is_breaking,
      confidence_score,
      top_headline,
      velocity,
      source_count,
      is_trending
    `)
    .eq('is_trending', true)
    .gte('last_seen_at', cutoff)
    .order('confidence_score', { ascending: false })
    .limit(200);

  return data || [];
}

async function logFilteredTrends(
  supabase: any,
  orgId: string,
  shown: OrgTrend[],
  filtered: OrgTrend[]
): Promise<void> {
  const logs = filtered.slice(0, 50).map(trend => ({
    organization_id: orgId,
    trend_event_id: trend.id,
    relevance_score: trend.org_relevance_score,
    filter_reason: trend.org_relevance_score < 25 ? 'below_threshold' : 'lower_priority',
    matched_domains: trend.matchedDomains,
    was_new_opportunity: trend.isNewOpportunity,
    logged_at: new Date().toISOString(),
  }));

  if (logs.length > 0) {
    await supabase.from('trend_filter_log').insert(logs);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service role ONLY for initial auth validation
    const authClient = createClient(supabaseUrl, supabaseServiceKey);

    // Validate user auth
    const auth = await validateAuth(req, authClient);
    if (!auth?.orgId || !auth?.token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - must be logged in with organization access' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user-scoped client for data queries (respects RLS)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${auth.token}` }
      }
    });

    const orgId = auth.orgId;
    const body = await req.json().catch(() => ({}));
    const options: GetTrendsOptions = {
      limit: body.limit || 20,
      minRelevance: body.min_relevance || 25,
      includeFilterLog: body.include_filter_log || false,
      hoursBack: body.hours_back || 48,
    };

    console.log(`📊 Getting trends for org ${orgId}`);

    // Get org data in parallel
    const [profile, watchlist, affinities, allTrends] = await Promise.all([
      getOrgProfile(supabase, orgId),
      getOrgWatchlist(supabase, orgId),
      getOrgTopicAffinities(supabase, orgId),
      getRecentTrends(supabase, options.hoursBack!),
    ]);

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Organization profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`   Profile: ${profile.display_name || orgId}`);
    console.log(`   Watchlist: ${watchlist.length} entities`);
    console.log(`   Affinities: ${affinities.length} topics`);
    console.log(`   Trends: ${allTrends.length} total`);

    // Score each trend for this org
    const scoredTrends: OrgTrend[] = allTrends.map(trend => {
      const relevance = calculateOrgRelevanceV3(trend, profile, watchlist, affinities);
      return {
        ...trend,
        org_relevance_score: relevance.score,
        org_relevance_reasons: relevance.reasons,
        org_relevance_flags: relevance.flags,
        isNewOpportunity: relevance.isNewOpportunity,
        isProvenTopic: relevance.isProvenTopic,
        matchedDomains: relevance.matchedDomains,
        matchedWatchlist: relevance.matchedWatchlist,
        priorityBucket: relevance.priorityBucket,
        score: relevance.score,
        reasons: relevance.reasons,
        flags: relevance.flags,
      };
    });

    // Filter by minimum relevance
    const relevantTrends = scoredTrends.filter(t => t.org_relevance_score >= options.minRelevance!);
    const filteredOut = scoredTrends.filter(t => t.org_relevance_score < options.minRelevance!);

    // Apply diversity requirement
    const diverseTrends = ensureDomainDiversity(relevantTrends, profile, options.limit!);

    // Log filtered trends (for debugging filter bubbles)
    if (options.includeFilterLog && filteredOut.length > 0) {
      await logFilteredTrends(supabase, orgId, diverseTrends, filteredOut);
    }

    // Calculate summary stats
    const newOpportunityCount = diverseTrends.filter(t => t.isNewOpportunity).length;
    const provenTopicCount = diverseTrends.filter(t => t.isProvenTopic).length;
    const uniqueDomains = [...new Set(diverseTrends.flatMap(t => t.matchedDomains || []))];

    console.log(`✅ Returning ${diverseTrends.length} trends (${newOpportunityCount} new opportunities)`);

    return new Response(
      JSON.stringify({
        trends: diverseTrends,
        meta: {
          total_available: allTrends.length,
          total_relevant: relevantTrends.length,
          returned: diverseTrends.length,
          filtered_out: filteredOut.length,
          new_opportunity_count: newOpportunityCount,
          proven_topic_count: provenTopicCount,
          unique_domains: uniqueDomains,
          min_relevance_threshold: options.minRelevance,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error getting trends:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
