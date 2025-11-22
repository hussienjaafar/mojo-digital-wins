import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];
    console.log(`[aggregate-sentiment] Aggregating sentiment for ${today}`);

    // Aggregate news sentiment by affected group
    const { data: newsData, error: newsError } = await supabase
      .from('articles')
      .select('affected_groups, sentiment_label')
      .gte('published_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .not('affected_groups', 'is', null)
      .not('sentiment_label', 'is', null);

    if (newsError) throw newsError;

    // Aggregate Bluesky sentiment by affected group
    const { data: blueskyData, error: blueskyError } = await supabase
      .from('bluesky_posts')
      .select('affected_groups, ai_sentiment_label')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .not('affected_groups', 'is', null)
      .not('ai_sentiment_label', 'is', null);

    if (blueskyError) throw blueskyError;

    // Process news sentiment
    const newsAgg = new Map<string, { pos: number; neu: number; neg: number; total: number }>();
    newsData?.forEach(article => {
      article.affected_groups?.forEach((group: string) => {
        if (!newsAgg.has(group)) {
          newsAgg.set(group, { pos: 0, neu: 0, neg: 0, total: 0 });
        }
        const agg = newsAgg.get(group)!;
        agg.total++;
        if (article.sentiment_label === 'positive') agg.pos++;
        else if (article.sentiment_label === 'negative') agg.neg++;
        else agg.neu++;
      });
    });

    // Process Bluesky sentiment
    const blueskyAgg = new Map<string, { pos: number; neu: number; neg: number; total: number }>();
    blueskyData?.forEach(post => {
      post.affected_groups?.forEach((group: string) => {
        if (!blueskyAgg.has(group)) {
          blueskyAgg.set(group, { pos: 0, neu: 0, neg: 0, total: 0 });
        }
        const agg = blueskyAgg.get(group)!;
        agg.total++;
        if (post.ai_sentiment_label === 'positive') agg.pos++;
        else if (post.ai_sentiment_label === 'negative') agg.neg++;
        else agg.neu++;
      });
    });

    // Upsert sentiment snapshots
    const snapshots = [];

    // News snapshots
    for (const [group, stats] of newsAgg.entries()) {
      const avgSentiment = (stats.pos - stats.neg) / stats.total;
      snapshots.push({
        snapshot_date: today,
        affected_group: group,
        platform: 'news',
        positive_count: stats.pos,
        neutral_count: stats.neu,
        negative_count: stats.neg,
        avg_sentiment: avgSentiment,
        total_mentions: stats.total,
      });
    }

    // Bluesky snapshots
    for (const [group, stats] of blueskyAgg.entries()) {
      const avgSentiment = (stats.pos - stats.neg) / stats.total;
      snapshots.push({
        snapshot_date: today,
        affected_group: group,
        platform: 'bluesky',
        positive_count: stats.pos,
        neutral_count: stats.neu,
        negative_count: stats.neg,
        avg_sentiment: avgSentiment,
        total_mentions: stats.total,
      });
    }

    // Combined snapshots
    const combinedAgg = new Map<string, { pos: number; neu: number; neg: number; total: number }>();
    for (const [group, stats] of newsAgg.entries()) {
      combinedAgg.set(group, { ...stats });
    }
    for (const [group, stats] of blueskyAgg.entries()) {
      if (!combinedAgg.has(group)) {
        combinedAgg.set(group, { pos: 0, neu: 0, neg: 0, total: 0 });
      }
      const agg = combinedAgg.get(group)!;
      agg.pos += stats.pos;
      agg.neu += stats.neu;
      agg.neg += stats.neg;
      agg.total += stats.total;
    }

    for (const [group, stats] of combinedAgg.entries()) {
      const avgSentiment = (stats.pos - stats.neg) / stats.total;
      snapshots.push({
        snapshot_date: today,
        affected_group: group,
        platform: 'combined',
        positive_count: stats.pos,
        neutral_count: stats.neu,
        negative_count: stats.neg,
        avg_sentiment: avgSentiment,
        total_mentions: stats.total,
      });
    }

    if (snapshots.length > 0) {
      const { error: upsertError } = await supabase
        .from('sentiment_snapshots')
        .upsert(snapshots, {
          onConflict: 'snapshot_date,affected_group,platform',
          ignoreDuplicates: false,
        });

      if (upsertError) throw upsertError;
    }

    console.log(`[aggregate-sentiment] Created ${snapshots.length} sentiment snapshots`);

    return new Response(
      JSON.stringify({
        success: true,
        snapshots_created: snapshots.length,
        groups_tracked: combinedAgg.size,
        date: today,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[aggregate-sentiment] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
