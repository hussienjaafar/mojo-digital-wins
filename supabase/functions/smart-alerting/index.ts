import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Running smart alerting analysis...');

    // 1. Detect breaking news clusters from recent articles
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentArticles } = await supabase
      .from('articles')
      .select('*')
      .gte('published_date', oneDayAgo)
      .order('published_date', { ascending: false })
      .limit(100);

    console.log(`Analyzing ${recentArticles?.length || 0} recent articles`);

    // Group articles by similar tags and keywords
    const clusters: Map<string, any[]> = new Map();
    
    for (const article of recentArticles || []) {
      const tags = article.tags || [];
      const clusterKey = tags.slice(0, 2).sort().join('-') || 'general';
      
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      clusters.get(clusterKey)!.push(article);
    }

    let clustersCreated = 0;
    let alertsQueued = 0;

    // Create breaking news clusters for groups with 3+ articles
    for (const [key, articles] of clusters.entries()) {
      if (articles.length >= 3) {
        const severity = articles.length >= 10 ? 'critical' : 
                        articles.length >= 5 ? 'high' : 'medium';
        
        const { data: cluster, error } = await supabase
          .from('breaking_news_clusters')
          .insert({
            cluster_title: articles[0].title,
            severity,
            threat_level: Math.min(articles.length * 2, 10),
            article_ids: articles.map(a => a.id),
            summary: articles[0].description,
            key_entities: articles.flatMap(a => a.tags || []).slice(0, 10),
            geographic_scope: ['national']
          })
          .select()
          .maybeSingle();

        if (!error) {
          clustersCreated++;
          
          // Queue alert for high severity clusters
          if (severity === 'critical' || severity === 'high') {
            await supabase
              .from('alert_queue')
              .insert({
                alert_type: 'breaking_news',
                severity,
                title: `Breaking: ${articles[0].title}`,
                message: `${articles.length} related articles detected`,
                data: { cluster_id: cluster?.id, article_count: articles.length }
              });
            
            alertsQueued++;
          }
        }
      }
    }

    // 2. Track organization mentions
    const organizationKeywords = [
      'CAIR', 'ADC', 'MPAC', 'AAI', 'Arab American',
      'Muslim American', 'Islamic', 'Mosque'
    ];

    for (const article of recentArticles || []) {
      const content = `${article.title} ${article.description || ''}`.toLowerCase();
      
      for (const org of organizationKeywords) {
        if (content.includes(org.toLowerCase())) {
          await supabase
            .from('organization_mentions')
            .insert({
              organization_name: org,
              mention_context: article.description?.substring(0, 200) || '',
              sentiment: article.sentiment_label,
              source_type: 'article',
              source_id: article.id,
              mentioned_at: article.published_date,
              relevance_score: article.sentiment_score || 0
            })
            .select()
            .maybeSingle();
        }
      }
    }

    console.log(`Created ${clustersCreated} clusters, queued ${alertsQueued} alerts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        clustersCreated,
        alertsQueued
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in smart-alerting:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
