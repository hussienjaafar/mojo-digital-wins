import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { POLICY_DOMAIN_KEYWORDS, getMatchingDomains, type PolicyDomain } from "../_shared/policyDomainKeywords.ts";
import { validateCronSecret } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Tag Trend Policy Domains
 *
 * Classifies trend events by policy domain using:
 * 1. Source policy domains (from RSS sources)
 * 2. Keyword matching
 * 3. AI classification fallback (optional)
 */

interface TrendEvent {
  id: string;
  event_title: string;
  top_headline?: string;
  context_terms?: string[];
  evidence?: Array<{ source_id?: string; source_domain?: string }>;
}

interface RssSource {
  id: string;
  url: string;
  policy_domains: string[];
}

async function classifyTrendPolicyDomains(
  trend: TrendEvent,
  sourceMap: Map<string, RssSource>
): Promise<string[]> {
  const domains = new Set<string>();

  // Method 1: From source policy domains (most reliable)
  for (const evidence of trend.evidence || []) {
    if (evidence.source_domain) {
      // Find source by domain
      for (const [, source] of sourceMap) {
        try {
          const sourceUrl = new URL(source.url);
          if (sourceUrl.hostname.includes(evidence.source_domain) ||
              evidence.source_domain.includes(sourceUrl.hostname)) {
            if (source.policy_domains) {
              source.policy_domains.forEach(d => domains.add(d));
            }
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }
  }

  // Method 2: From keyword matching
  const trendText = `${trend.event_title} ${trend.top_headline || ''} ${(trend.context_terms || []).join(' ')}`;
  const keywordMatches = getMatchingDomains(trendText, 2); // Require 2+ keyword matches

  for (const domain of keywordMatches) {
    domains.add(domain);
  }

  // If still no domains, try with lower threshold
  if (domains.size === 0) {
    const singleMatches = getMatchingDomains(trendText, 1);
    for (const domain of singleMatches.slice(0, 2)) { // Max 2 domains from single matches
      domains.add(domain);
    }
  }

  return Array.from(domains);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate cron secret
    if (!validateCronSecret(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const trendId = body.trend_id;
    const batchSize = body.batch_size || 100;

    console.log('🏷️ Starting policy domain tagging...');

    // Get RSS sources with policy domains
    const { data: sources } = await supabase
      .from('rss_sources')
      .select('id, url, policy_domains')
      .eq('is_active', true);

    const sourceMap = new Map<string, RssSource>();
    for (const source of sources || []) {
      sourceMap.set(source.id, source);
    }

    // Get trends to tag
    let query = supabase
      .from('trend_events')
      .select('id, event_title, top_headline, context_terms, evidence')
      .or('policy_domains.is.null,policy_domains.eq.{}');

    if (trendId) {
      query = query.eq('id', trendId);
    } else {
      query = query
        .gte('last_seen_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .limit(batchSize);
    }

    const { data: trends, error: trendsError } = await query;

    if (trendsError) throw trendsError;

    console.log(`📊 Processing ${trends?.length || 0} trends`);

    let taggedCount = 0;
    const domainCounts: Record<string, number> = {};

    for (const trend of trends || []) {
      const domains = await classifyTrendPolicyDomains(trend, sourceMap);

      if (domains.length > 0) {
        const { error: updateError } = await supabase
          .from('trend_events')
          .update({ policy_domains: domains })
          .eq('id', trend.id);

        if (!updateError) {
          taggedCount++;
          for (const domain of domains) {
            domainCounts[domain] = (domainCounts[domain] || 0) + 1;
          }
        }
      }
    }

    console.log(`✅ Tagged ${taggedCount} trends with policy domains`);
    console.log('Domain distribution:', domainCounts);

    return new Response(
      JSON.stringify({
        success: true,
        trendsProcessed: trends?.length || 0,
        trendsTagged: taggedCount,
        domainDistribution: domainCounts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error tagging policy domains:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
