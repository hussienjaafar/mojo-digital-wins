import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractAllEntities,
  matchEntities,
  WELL_KNOWN_POLITICIANS,
  WELL_KNOWN_ORGANIZATIONS,
  GOVERNMENT_AGENCIES,
  type PoliticalEntity,
} from "../_shared/politicalEntities.ts";
import { validateCronSecret } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Extract Trend Entities
 *
 * Extracts politicians, organizations, and legislation mentioned in trends
 * using both hardcoded knowledge base and database-stored entities.
 */

interface TrendEvent {
  id: string;
  event_title: string;
  top_headline?: string;
  context_terms?: string[];
}

interface DbPoliticalEntity {
  canonical_name: string;
  entity_type: string;
  aliases: string[];
}

function extractTrendEntities(
  trend: TrendEvent,
  dbEntities: PoliticalEntity[]
): {
  politicians: string[];
  organizations: string[];
  legislation: string[];
} {
  const trendText = `${trend.event_title} ${trend.top_headline || ''}`;

  // First, use hardcoded knowledge base
  const hardcodedResults = extractAllEntities(trendText);

  // Then, match against database entities
  const dbMatches = matchEntities(trendText, dbEntities);

  const politicians = new Set<string>(hardcodedResults.politicians);
  const organizations = new Set<string>(hardcodedResults.organizations);
  const legislation = new Set<string>();

  for (const match of dbMatches) {
    if (match.entity.entity_type === 'politician') {
      politicians.add(match.entity.canonical_name);
    } else if (match.entity.entity_type === 'organization') {
      organizations.add(match.entity.canonical_name);
    } else if (match.entity.entity_type === 'legislation') {
      legislation.add(match.entity.canonical_name);
    }
  }

  // Also add agencies to organizations
  for (const agency of hardcodedResults.agencies) {
    organizations.add(agency);
  }

  return {
    politicians: Array.from(politicians),
    organizations: Array.from(organizations),
    legislation: Array.from(legislation),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!validateCronSecret(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const trendId = body.trend_id;
    const batchSize = body.batch_size || 100;

    console.log('🔍 Starting entity extraction...');

    // Load database political entities
    const { data: dbEntitiesRaw } = await supabase
      .from('political_entities')
      .select('canonical_name, entity_type, aliases')
      .eq('active', true);

    const dbEntities: PoliticalEntity[] = (dbEntitiesRaw || []).map(e => ({
      canonical_name: e.canonical_name,
      entity_type: e.entity_type as any,
      aliases: e.aliases || [],
    }));

    console.log(`📚 Loaded ${dbEntities.length} entities from database`);

    // Get trends to process
    let query = supabase
      .from('trend_events')
      .select('id, event_title, top_headline, context_terms')
      .or('politicians_mentioned.is.null,politicians_mentioned.eq.{}');

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

    let extractedCount = 0;
    let politicianCount = 0;
    let orgCount = 0;

    for (const trend of trends || []) {
      const entities = extractTrendEntities(trend, dbEntities);

      const { error: updateError } = await supabase
        .from('trend_events')
        .update({
          politicians_mentioned: entities.politicians,
          organizations_mentioned: entities.organizations,
          legislation_mentioned: entities.legislation,
        })
        .eq('id', trend.id);

      if (!updateError) {
        extractedCount++;
        politicianCount += entities.politicians.length;
        orgCount += entities.organizations.length;
      }
    }

    console.log(`✅ Extracted entities for ${extractedCount} trends`);
    console.log(`   Politicians: ${politicianCount}, Organizations: ${orgCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        trendsProcessed: trends?.length || 0,
        trendsWithEntities: extractedCount,
        totalPoliticians: politicianCount,
        totalOrganizations: orgCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error extracting entities:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
