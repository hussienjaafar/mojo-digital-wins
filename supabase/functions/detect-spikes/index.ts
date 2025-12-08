import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();
const SPIKE_THRESHOLD = 150;
const MIN_MENTIONS_FOR_SPIKE = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // SECURITY: Validate cron secret or admin JWT
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      console.error('[detect-spikes] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[detect-spikes] Authorized via ${authResult.isAdmin ? 'admin' : 'cron'}`);

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('detect-spikes', 20, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[detect-spikes] Starting spike detection (threshold: ${SPIKE_THRESHOLD}%, min mentions: ${MIN_MENTIONS_FOR_SPIKE})...`);

    const { data: trends, error: trendsError } = await supabase
      .from('trending_news_topics')
      .select('*')
      .gte('velocity', SPIKE_THRESHOLD)
      .gte('mentions_last_hour', MIN_MENTIONS_FOR_SPIKE)
      .order('velocity', { ascending: false })
      .limit(20);

    if (trendsError) {
      console.error('[detect-spikes] Error fetching trends:', trendsError);
      throw trendsError;
    }

    console.log(`[detect-spikes] Found ${trends?.length || 0} potential topic spikes`);

    const spikesDetected: string[] = [];
    const skipped: string[] = [];

    for (const trend of trends || []) {
      const { data: existingAlert } = await supabase
        .from('spike_alerts')
        .select('id')
        .eq('entity_type', 'topic')
        .eq('entity_name', trend.topic)
        .gte('detected_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existingAlert) {
        skipped.push(trend.topic);
        continue;
      }

      let severity = 'medium';
      if (trend.velocity >= 400 && trend.mentions_last_hour >= 8) {
        severity = 'critical';
      } else if (trend.velocity >= 250 || trend.mentions_last_hour >= 5) {
        severity = 'high';
      }

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

      const alert = {
        alert_type: 'topic_spike',
        entity_type: 'topic',
        entity_name: trend.topic,
        previous_mentions: Math.max(0, (trend.mentions_last_6_hours || 0) - (trend.mentions_last_hour || 0)),
        current_mentions: trend.mentions_last_hour || 0,
        velocity_increase: trend.velocity || 0,
        time_window: '1h',
        severity,
        context_summary: contextSummary,
        related_articles: trend.related_articles || [],
        related_posts: blueskyTrend ? [blueskyTrend.id] : [],
        status: 'pending',
        notification_channels: severity === 'critical' ? ['email', 'webhook', 'push'] : ['email'],
        detected_at: new Date().toISOString(),
        retry_count: 0
      };

      const { error: insertError } = await supabase.from('spike_alerts').insert(alert);

      if (insertError) {
        console.error(`[detect-spikes] Error creating alert for ${trend.topic}:`, insertError);
      } else {
        spikesDetected.push(trend.topic);
        console.log(`[detect-spikes] ✅ Created ${severity} alert for "${trend.topic}" (${Math.round(trend.velocity)}% velocity)`);
      }
    }

    // Check organization mention spikes
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

      for (const [org, data] of orgMentions) {
        if (data.count >= 4) {
          const { data: existingOrgAlert } = await supabase
            .from('spike_alerts')
            .select('id')
            .eq('entity_type', 'organization')
            .eq('entity_name', org)
            .gte('detected_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
            .maybeSingle();

          if (!existingOrgAlert) {
            const severity = data.count >= 8 ? 'critical' : data.count >= 6 ? 'high' : 'medium';
            
            await supabase.from('spike_alerts').insert({
              alert_type: 'organization_mention',
              entity_type: 'organization',
              entity_name: org,
              previous_mentions: 0,
              current_mentions: data.count,
              velocity_increase: data.count * 100,
              time_window: '1h',
              severity,
              context_summary: `"${org}" mentioned ${data.count} times in last hour across multiple sources`,
              related_articles: data.articles.slice(0, 10),
              status: 'pending',
              notification_channels: severity === 'critical' ? ['email', 'webhook'] : ['email'],
              detected_at: new Date().toISOString(),
              retry_count: 0
            });

            spikesDetected.push(`${org} (org)`);
            console.log(`[detect-spikes] ✅ Created ${severity} alert for org "${org}" (${data.count} mentions)`);
          }
        }
      }
    }

    if (skipped.length > 0) {
      console.log(`[detect-spikes] Skipped ${skipped.length} topics (already alerted within 2h)`);
    }
    
    console.log(`[detect-spikes] ✅ Complete: ${spikesDetected.length} new spikes detected`);

    return new Response(
      JSON.stringify({
        success: true,
        spikes_detected: spikesDetected.length,
        spikes: spikesDetected,
        skipped: skipped.length,
        threshold: SPIKE_THRESHOLD,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[detect-spikes] Error:', error);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await logJobFailure(supabase, 'detect-spikes', error?.message || 'Unknown error');
    
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
