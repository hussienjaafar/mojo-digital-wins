import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectGeographies, STATE_PATTERNS, MAJOR_CITIES, INTERNATIONAL_LOCATIONS } from "../_shared/politicalEntities.ts";
import { validateCronSecret } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Tag Trend Geographies
 *
 * Detects and tags geographic scope for trend events:
 * - State level (US states)
 * - Local level (major cities)
 * - National level (US-wide)
 * - International (other countries)
 */

interface TrendEvent {
  id: string;
  event_title: string;
  top_headline?: string;
  context_terms?: string[];
}

function detectTrendGeographies(trend: TrendEvent): {
  geographies: string[];
  geo_level: string;
} {
  const trendText = `${trend.event_title} ${trend.top_headline || ''} ${(trend.context_terms || []).join(' ')}`;
  return detectGeographies(trendText);
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

    console.log('🌍 Starting geography tagging...');

    // Get trends to tag
    let query = supabase
      .from('trend_events')
      .select('id, event_title, top_headline, context_terms')
      .or('geographies.is.null,geographies.eq.{}');

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
    const geoLevelCounts: Record<string, number> = {};

    for (const trend of trends || []) {
      const { geographies, geo_level } = detectTrendGeographies(trend);

      const { error: updateError } = await supabase
        .from('trend_events')
        .update({
          geographies,
          geo_level,
        })
        .eq('id', trend.id);

      if (!updateError) {
        taggedCount++;
        geoLevelCounts[geo_level] = (geoLevelCounts[geo_level] || 0) + 1;
      }
    }

    console.log(`✅ Tagged ${taggedCount} trends with geographies`);
    console.log('Geo level distribution:', geoLevelCounts);

    return new Response(
      JSON.stringify({
        success: true,
        trendsProcessed: trends?.length || 0,
        trendsTagged: taggedCount,
        geoLevelDistribution: geoLevelCounts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error tagging geographies:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
