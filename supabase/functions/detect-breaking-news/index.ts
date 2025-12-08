import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();

function calculateSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.toLowerCase().split(/\s+/));
  const words2 = new Set(title2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  const patterns = [
    /(?:President|Senator|Representative|Governor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
    /(Gaza|Israel|Palestine|Ukraine|Russia|China|Iran|Syria|Iraq)/gi,
    /(Congress|Senate|House|White House|Pentagon|State Department)/gi,
    /(Biden|Trump|Harris|Netanyahu|Putin|Xi)/gi
  ];
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      entities.push(match[1] || match[0]);
    }
  }
  return [...new Set(entities)];
}

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
      console.error('[detect-breaking-news] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[detect-breaking-news] Authorized via ${authResult.isAdmin ? 'admin' : 'cron'}`);

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('detect-breaking-news', 20, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[detect-breaking-news] Starting breaking news detection...');

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, description, source_name, threat_level, published_date, tags, affected_organizations')
      .gte('published_date', oneHourAgo)
      .order('published_date', { ascending: false });

    if (articlesError) throw articlesError;

    if (!articles || articles.length < 5) {
      console.log('[detect-breaking-news] Not enough recent articles to detect breaking news');
      return new Response(
        JSON.stringify({ success: true, clusters_found: 0, message: 'Insufficient articles for clustering' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[detect-breaking-news] Analyzing ${articles.length} recent articles`);

    const clusters: Map<number, {
      articles: typeof articles,
      title: string,
      similarity: number,
      entities: Set<string>
    }> = new Map();

    let clusterIndex = 0;

    for (let i = 0; i < articles.length; i++) {
      const article1 = articles[i];
      let assignedToCluster = false;

      for (const [clusterId, cluster] of clusters) {
        for (const article2 of cluster.articles) {
          const similarity = calculateSimilarity(article1.title, article2.title);
          if (similarity > 0.4) {
            cluster.articles.push(article1);
            assignedToCluster = true;
            const entities1 = extractEntities(article1.title + ' ' + (article1.description || ''));
            entities1.forEach(e => cluster.entities.add(e));
            break;
          }
        }
        if (assignedToCluster) break;
      }

      if (!assignedToCluster) {
        const entities = new Set(extractEntities(article1.title + ' ' + (article1.description || '')));
        clusters.set(clusterIndex++, {
          articles: [article1],
          title: article1.title,
          similarity: 1.0,
          entities
        });
      }
    }

    console.log(`[detect-breaking-news] Found ${clusters.size} potential clusters`);

    const breakingClusters = [];
    for (const [_, cluster] of clusters) {
      if (cluster.articles.length >= 5) {
        const sources = new Set(cluster.articles.map(a => a.source_name));
        
        if (sources.size >= 5) {
          const severity = cluster.articles.some(a => a.threat_level === 'critical') ? 'critical'
            : cluster.articles.some(a => a.threat_level === 'high') ? 'high' : 'medium';

          const articleIds = cluster.articles.map(a => a.id);
          const { data: existing } = await supabase
            .from('breaking_news_clusters')
            .select('id')
            .contains('article_ids', articleIds.slice(0, 3))
            .eq('is_resolved', false)
            .maybeSingle();

          if (!existing) {
            const allTags = cluster.articles.flatMap(a => a.tags || []);
            const tagCounts = new Map<string, number>();
            allTags.forEach(tag => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
            const topTags = [...tagCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([tag]) => tag);

            const newCluster = {
              cluster_title: cluster.title,
              summary: `Breaking: ${cluster.articles.length} sources reporting on ${[...cluster.entities].slice(0, 3).join(', ')}`,
              article_ids: articleIds,
              source_count: sources.size,
              similarity_threshold: 0.4,
              first_detected_at: new Date().toISOString(),
              last_updated_at: new Date().toISOString(),
              time_window_hours: 1,
              severity,
              threat_level: severity === 'critical' ? 100 : severity === 'high' ? 75 : 50,
              key_entities: [...cluster.entities].slice(0, 10),
              geographic_scope: topTags.filter(t => ['national', 'international', 'state', 'local'].includes(t)),
              is_resolved: false
            };

            const { error: insertError } = await supabase.from('breaking_news_clusters').insert(newCluster);

            if (!insertError) {
              breakingClusters.push(newCluster);
              console.log(`[detect-breaking-news] ✅ Created breaking news cluster: "${cluster.title}" (${sources.size} sources)`);

              await supabase.from('spike_alerts').insert({
                alert_type: 'breaking_news',
                entity_type: 'news_cluster',
                entity_name: cluster.title,
                previous_mentions: 0,
                current_mentions: sources.size,
                velocity_increase: 1000,
                time_window: '1h',
                severity,
                context_summary: `BREAKING: ${sources.size} sources reporting "${cluster.title}"`,
                related_articles: articleIds,
                status: 'pending',
                notification_channels: ['email', 'webhook', 'push'],
                detected_at: new Date().toISOString()
              });
            } else {
              console.error('[detect-breaking-news] Error creating cluster:', insertError);
            }
          }
        }
      }
    }

    console.log(`[detect-breaking-news] ✅ Detected ${breakingClusters.length} breaking news clusters`);

    return new Response(
      JSON.stringify({
        success: true,
        clusters_found: breakingClusters.length,
        clusters: breakingClusters.map(c => ({
          title: c.cluster_title,
          sources: c.source_count,
          severity: c.severity
        })),
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[detect-breaking-news] Error:', error);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await logJobFailure(supabase, 'detect-breaking-news', error?.message || 'Unknown error');
    
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
