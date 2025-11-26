import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Spike detection threshold (300% increase = 3x growth)
const SPIKE_THRESHOLD = 300;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[detect-spikes] Starting spike detection...');

    // Get currently trending topics with high velocity
    const { data: trends, error: trendsError } = await supabase
      .from('trending_news_topics')
      .select('*')
      .gte('velocity', SPIKE_THRESHOLD)
      .order('velocity', { ascending: false });

    if (trendsError) throw trendsError;

    console.log(`[detect-spikes] Found ${trends?.length || 0} potential spikes`);

    const spikesDetected = [];

    for (const trend of trends || []) {
      // Check if we already alerted for this spike in last hour
      const { data: existingAlert } = await supabase
        .from('spike_alerts')
        .select('id')
        .eq('entity_type', 'topic')
        .eq('entity_name', trend.topic)
        .gte('detected_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existingAlert) {
        console.log(`[detect-spikes] Already alerted for ${trend.topic} in last hour, skipping`);
        continue;
      }

      // Calculate severity based on velocity and mention count
      let severity = 'medium';
      if (trend.velocity >= 500 && trend.mentions_last_hour >= 10) {
        severity = 'critical';
      } else if (trend.velocity >= 400 || trend.mentions_last_hour >= 7) {
        severity = 'high';
      }

      // Get related Bluesky trends if they exist
      const { data: blueskyTrend } = await supabase
        .from('bluesky_trends')
        .select('id, mentions_last_hour, velocity')
        .eq('topic', trend.topic)
        .maybeSingle();

      const contextSummary = `"${trend.topic}" is spiking: ${trend.mentions_last_hour} mentions in last hour (${Math.round(trend.velocity)}% velocity). ${
        blueskyTrend 
          ? `Also trending on Bluesky with ${blueskyTrend.mentions_last_hour} posts.`
          : 'No Bluesky correlation yet.'
      }`;

      // Create spike alert
      const alert = {
        alert_type: 'topic_spike',
        entity_type: 'topic',
        entity_name: trend.topic,
        previous_mentions: trend.mentions_last_6_hours - trend.mentions_last_hour,
        current_mentions: trend.mentions_last_hour,
        velocity_increase: trend.velocity,
        time_window: '1h',
        severity,
        context_summary: contextSummary,
        related_articles: trend.related_articles || [],
        related_posts: blueskyTrend ? [blueskyTrend.id] : [],
        status: 'pending',
        notification_channels: severity === 'critical' ? ['email', 'webhook', 'push'] : ['webhook'],
        detected_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('spike_alerts')
        .insert(alert);

      if (insertError) {
        console.error(`[detect-spikes] Error creating alert for ${trend.topic}:`, insertError);
      } else {
        spikesDetected.push(trend.topic);
        console.log(`[detect-spikes] ✅ Created ${severity} alert for "${trend.topic}"`);
      }
    }

    // Also check for organization mention spikes
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('affected_organizations, id, title, source_name, created_at')
      .not('affected_organizations', 'is', null)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (!articlesError && articles) {
      const orgMentions = new Map<string, { count: number, articles: string[] }>();
      
      for (const article of articles) {
        for (const org of article.affected_organizations || []) {
          if (!orgMentions.has(org)) {
            orgMentions.set(org, { count: 0, articles: [] });
          }
          const data = orgMentions.get(org)!;
          data.count++;
          data.articles.push(article.id);
        }
      }

      // Alert if org mentioned 5+ times in last hour
      for (const [org, data] of orgMentions) {
        if (data.count >= 5) {
          const { data: existingOrgAlert } = await supabase
            .from('spike_alerts')
            .select('id')
            .eq('entity_type', 'organization')
            .eq('entity_name', org)
            .gte('detected_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
            .maybeSingle();

          if (!existingOrgAlert) {
            await supabase.from('spike_alerts').insert({
              alert_type: 'organization_mention',
              entity_type: 'organization',
              entity_name: org,
              previous_mentions: 0,
              current_mentions: data.count,
              velocity_increase: 500,
              time_window: '1h',
              severity: data.count >= 10 ? 'critical' : 'high',
              context_summary: `"${org}" mentioned ${data.count} times in last hour across multiple sources`,
              related_articles: data.articles,
              status: 'pending',
              notification_channels: ['email', 'webhook'],
              detected_at: new Date().toISOString()
            });

            spikesDetected.push(`${org} (org)`);
            console.log(`[detect-spikes] ✅ Created alert for org "${org}"`);
          }
        }
      }
    }

    console.log(`[detect-spikes] ✅ Detected ${spikesDetected.length} total spikes`);

    return new Response(
      JSON.stringify({
        success: true,
        spikes_detected: spikesDetected.length,
        spikes: spikesDetected,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[detect-spikes] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
