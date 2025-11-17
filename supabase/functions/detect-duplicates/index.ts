import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate Levenshtein distance for string similarity
function levenshtein(a: string, b: string): number {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Calculate similarity score (0-1) between two strings
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshtein(longer, shorter);
  return (longer.length - distance) / longer.length;
}

// Calculate content similarity using TF-IDF approach (simplified)
function contentSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lookbackHours = 24, similarityThreshold = 0.75 } = await req.json().catch(() => ({}));

    console.log(`Detecting duplicates from last ${lookbackHours} hours with threshold ${similarityThreshold}`);

    // Fetch recent articles
    const lookbackDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, description, content, published_date, source_name')
      .gte('published_date', lookbackDate)
      .order('published_date', { ascending: false });

    if (fetchError) throw fetchError;
    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No articles to process', clustersCreated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${articles.length} articles for duplicates`);

    const clusters: Map<string, string[]> = new Map();
    const processed = new Set<string>();

    // Compare each article with others
    for (let i = 0; i < articles.length; i++) {
      const article1 = articles[i];
      
      if (processed.has(article1.id)) continue;

      const relatedArticles: string[] = [article1.id];

      for (let j = i + 1; j < articles.length; j++) {
        const article2 = articles[j];
        
        if (processed.has(article2.id)) continue;

        // Calculate title similarity
        const titleSim = similarity(article1.title, article2.title);
        
        // Calculate content similarity if content exists
        const contentSim = article1.content && article2.content
          ? contentSimilarity(article1.content, article2.content)
          : 0;

        // Combined similarity score (weighted average)
        const combinedSim = (titleSim * 0.6) + (contentSim * 0.4);

        if (combinedSim >= similarityThreshold) {
          relatedArticles.push(article2.id);
          processed.add(article2.id);
        }
      }

      // If we found duplicates, create a cluster
      if (relatedArticles.length > 1) {
        clusters.set(article1.id, relatedArticles);
        processed.add(article1.id);
      }
    }

    console.log(`Found ${clusters.size} clusters`);

    // Save clusters to database
    let clustersCreated = 0;
    for (const [primaryId, relatedIds] of clusters.entries()) {
      const primaryArticle = articles.find(a => a.id === primaryId);
      
      if (!primaryArticle) continue;

      // Check if cluster already exists
      const { data: existingCluster } = await supabase
        .from('article_clusters')
        .select('id')
        .eq('primary_article_id', primaryId)
        .single();

      if (existingCluster) {
        // Update existing cluster
        await supabase
          .from('article_clusters')
          .update({
            related_article_ids: relatedIds,
            similarity_threshold: similarityThreshold,
          })
          .eq('id', existingCluster.id);
      } else {
        // Create new cluster
        const { error: insertError } = await supabase
          .from('article_clusters')
          .insert({
            primary_article_id: primaryId,
            related_article_ids: relatedIds,
            cluster_title: primaryArticle.title,
            cluster_summary: `${relatedIds.length} similar articles found`,
            similarity_threshold: similarityThreshold,
          });

        if (!insertError) clustersCreated++;
      }
    }

    // Mark duplicate articles
    for (const relatedIds of clusters.values()) {
      const [primaryId, ...duplicateIds] = relatedIds;
      
      if (duplicateIds.length > 0) {
        await supabase
          .from('articles')
          .update({
            is_duplicate: true,
            duplicate_of: primaryId,
          })
          .in('id', duplicateIds);
      }
    }

    console.log(`Created/updated ${clustersCreated} clusters`);

    return new Response(
      JSON.stringify({
        success: true,
        articlesProcessed: articles.length,
        clustersFound: clusters.size,
        clustersCreated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error detecting duplicates:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
