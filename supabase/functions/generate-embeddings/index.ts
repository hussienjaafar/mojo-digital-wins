import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Generate Embeddings for Semantic Matching
 * 
 * Generates 768-dimensional embeddings for:
 * 1. Organization profiles (mission + focus areas + issues + geos)
 * 2. Trend events (title + top_headline + evidence summaries)
 * 
 * Uses Lovable AI (Gemini) for text-to-embedding generation.
 * Caches embeddings to avoid recomputation.
 */

// Simple authentication check
function validateCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured - allowing request');
    return true;
  }
  const providedSecret = req.headers.get('x-cron-secret');
  return providedSecret === cronSecret;
}

async function validateAuth(req: Request, supabase: any): Promise<{ user: any; isAdmin: boolean } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (error || !user) return null;

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const isAdmin = roles?.some((r: any) => r.role === 'admin') || false;
  return { user, isAdmin };
}

async function validateCronOrAdmin(req: Request, supabase: any): Promise<{ valid: boolean }> {
  if (validateCronSecret(req)) {
    return { valid: true };
  }

  const auth = await validateAuth(req, supabase);
  if (auth?.isAdmin) {
    return { valid: true };
  }

  return { valid: false };
}

// Generate embedding using Lovable AI
async function generateEmbedding(text: string): Promise<number[] | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    return null;
  }

  try {
    // Truncate text to avoid token limits (approx 8k chars = ~2k tokens)
    const truncatedText = text.substring(0, 8000);
    
    // Use Gemini for embedding generation via chat completion
    // We'll ask it to return a normalized embedding representation
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `You are an embedding generator. Given text, generate a 768-dimensional normalized embedding vector that captures the semantic meaning. Output ONLY a JSON array of 768 floating point numbers between -1 and 1, no other text. The embedding should capture: topics, entities, sentiment, urgency, and domain relevance for political/advocacy content.`
          },
          {
            role: 'user',
            content: `Generate a 768-dimensional embedding for this text:\n\n${truncatedText}`
          }
        ],
        temperature: 0.0,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    
    if (!content) {
      console.error('No content in AI response');
      return null;
    }

    // Parse the JSON array
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content;
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      
      const embedding = JSON.parse(cleanContent);
      
      if (!Array.isArray(embedding) || embedding.length !== 768) {
        console.error(`Invalid embedding dimensions: expected 768, got ${embedding?.length}`);
        // If we got a shorter array, pad with zeros
        if (Array.isArray(embedding) && embedding.length > 0) {
          while (embedding.length < 768) {
            embedding.push(0);
          }
          return embedding.slice(0, 768);
        }
        return null;
      }
      
      // Normalize the embedding
      const magnitude = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
      if (magnitude > 0) {
        return embedding.map((v: number) => v / magnitude);
      }
      return embedding;
    } catch (parseError) {
      console.error('Failed to parse embedding JSON:', parseError, 'Content:', content.substring(0, 200));
      return null;
    }
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

// Build embedding text from organization profile
function buildOrgProfileText(profile: any): string {
  const parts: string[] = [];
  
  if (profile.display_name) {
    parts.push(`Organization: ${profile.display_name}`);
  }
  
  if (profile.mission_summary) {
    parts.push(`Mission: ${profile.mission_summary}`);
  }
  
  if (profile.org_type) {
    parts.push(`Type: ${profile.org_type}`);
  }
  
  if (profile.focus_areas?.length) {
    parts.push(`Focus Areas: ${profile.focus_areas.join(', ')}`);
  }
  
  if (profile.key_issues?.length) {
    parts.push(`Key Issues: ${profile.key_issues.join(', ')}`);
  }
  
  if (profile.primary_goals?.length) {
    parts.push(`Primary Goals: ${profile.primary_goals.join(', ')}`);
  }
  
  if (profile.geographies?.length) {
    parts.push(`Geographic Focus: ${profile.geographies.join(', ')}`);
  }
  
  if (profile.stakeholders?.length) {
    parts.push(`Key Stakeholders: ${profile.stakeholders.join(', ')}`);
  }
  
  if (profile.allies?.length) {
    parts.push(`Allied Organizations: ${profile.allies.join(', ')}`);
  }
  
  if (profile.opponents?.length) {
    parts.push(`Opposition: ${profile.opponents.join(', ')}`);
  }
  
  if (profile.priority_lanes?.length) {
    parts.push(`Priority Lanes: ${profile.priority_lanes.join(', ')}`);
  }
  
  if (profile.interest_topics?.length) {
    parts.push(`Interest Topics: ${profile.interest_topics.join(', ')}`);
  }
  
  return parts.join('\n');
}

// Build embedding text from trend event
function buildTrendEventText(event: any, evidence: any[]): string {
  const parts: string[] = [];
  
  parts.push(`Trend: ${event.event_title}`);
  
  if (event.top_headline) {
    parts.push(`Headline: ${event.top_headline}`);
  }
  
  if (event.sentiment_label) {
    parts.push(`Sentiment: ${event.sentiment_label}`);
  }
  
  if (event.entity_type) {
    parts.push(`Entity Type: ${event.entity_type}`);
  }
  
  if (event.related_topics?.length) {
    parts.push(`Related Topics: ${event.related_topics.join(', ')}`);
  }
  
  // Add top evidence summaries (limit to 5)
  const topEvidence = evidence.slice(0, 5);
  if (topEvidence.length > 0) {
    const evidenceTitles = topEvidence
      .map(e => e.source_title || e.headline)
      .filter(Boolean)
      .join('; ');
    if (evidenceTitles) {
      parts.push(`Evidence Sources: ${evidenceTitles}`);
    }
  }
  
  return parts.join('\n');
}

// Calculate cosine similarity between two embeddings
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - requires cron secret or admin role' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for options
    let options = { 
      maxProfiles: 10, 
      maxTrends: 50,
      forceRegenerate: false,
      onlyMissing: true,
    };
    
    try {
      const body = await req.json();
      options = { ...options, ...body };
    } catch {
      // Use defaults
    }

    console.log(`[generate-embeddings] Starting with options:`, options);

    let profilesProcessed = 0;
    let profilesSkipped = 0;
    let trendsProcessed = 0;
    let trendsSkipped = 0;
    let errors = 0;

    // ========================================
    // STEP 1: Generate embeddings for org profiles
    // ========================================
    
    // Get profiles that need embeddings
    let profileQuery = supabase
      .from('organization_profiles')
      .select('*')
      .limit(options.maxProfiles);
    
    if (options.onlyMissing && !options.forceRegenerate) {
      profileQuery = profileQuery.is('embedding', null);
    }
    
    const { data: profiles } = await profileQuery;
    
    console.log(`[generate-embeddings] Found ${profiles?.length || 0} org profiles to process`);
    
    for (const profile of profiles || []) {
      try {
        const embeddingText = buildOrgProfileText(profile);
        
        if (embeddingText.length < 50) {
          console.log(`[generate-embeddings] Skipping profile ${profile.id} - insufficient text`);
          profilesSkipped++;
          continue;
        }
        
        console.log(`[generate-embeddings] Generating embedding for org profile: ${profile.display_name || profile.organization_id}`);
        
        const embedding = await generateEmbedding(embeddingText);
        
        if (embedding) {
          // Convert to pgvector format
          const embeddingStr = `[${embedding.join(',')}]`;
          
          const { error: updateError } = await supabase
            .from('organization_profiles')
            .update({
              embedding: embeddingStr,
              embedding_text: embeddingText.substring(0, 2000),
              embedding_generated_at: new Date().toISOString(),
            })
            .eq('id', profile.id);
          
          if (updateError) {
            console.error(`Error updating profile ${profile.id}:`, updateError);
            errors++;
          } else {
            profilesProcessed++;
          }
        } else {
          console.error(`Failed to generate embedding for profile ${profile.id}`);
          errors++;
        }
        
        // Rate limit: wait 500ms between API calls
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error processing profile ${profile.id}:`, error);
        errors++;
      }
    }

    // ========================================
    // STEP 2: Generate embeddings for trend events
    // ========================================
    
    // Get trending events that need embeddings
    let trendQuery = supabase
      .from('trend_events')
      .select('*')
      .eq('is_trending', true)
      .gte('last_seen_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('velocity', { ascending: false })
      .limit(options.maxTrends);
    
    if (options.onlyMissing && !options.forceRegenerate) {
      trendQuery = trendQuery.is('embedding', null);
    }
    
    const { data: trendEvents } = await trendQuery;
    
    console.log(`[generate-embeddings] Found ${trendEvents?.length || 0} trend events to process`);
    
    // Get evidence for all trend events
    const trendIds = (trendEvents || []).map(t => t.id);
    const { data: allEvidence } = await supabase
      .from('trend_evidence')
      .select('trend_event_id, source_title, headline, source_type')
      .in('trend_event_id', trendIds.length > 0 ? trendIds : ['_none_'])
      .order('discovered_at', { ascending: false });
    
    const evidenceByTrend = new Map<string, any[]>();
    for (const e of allEvidence || []) {
      if (!evidenceByTrend.has(e.trend_event_id)) {
        evidenceByTrend.set(e.trend_event_id, []);
      }
      evidenceByTrend.get(e.trend_event_id)!.push(e);
    }
    
    for (const event of trendEvents || []) {
      try {
        const evidence = evidenceByTrend.get(event.id) || [];
        const embeddingText = buildTrendEventText(event, evidence);
        
        if (embeddingText.length < 20) {
          console.log(`[generate-embeddings] Skipping trend ${event.id} - insufficient text`);
          trendsSkipped++;
          continue;
        }
        
        console.log(`[generate-embeddings] Generating embedding for trend: ${event.event_title}`);
        
        const embedding = await generateEmbedding(embeddingText);
        
        if (embedding) {
          // Convert to pgvector format
          const embeddingStr = `[${embedding.join(',')}]`;
          
          const { error: updateError } = await supabase
            .from('trend_events')
            .update({
              embedding: embeddingStr,
              embedding_text: embeddingText.substring(0, 2000),
              embedding_generated_at: new Date().toISOString(),
            })
            .eq('id', event.id);
          
          if (updateError) {
            console.error(`Error updating trend ${event.id}:`, updateError);
            errors++;
          } else {
            trendsProcessed++;
          }
        } else {
          console.error(`Failed to generate embedding for trend ${event.id}`);
          errors++;
        }
        
        // Rate limit: wait 500ms between API calls
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error processing trend ${event.id}:`, error);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`[generate-embeddings] Complete in ${duration}ms:`, {
      profilesProcessed,
      profilesSkipped,
      trendsProcessed,
      trendsSkipped,
      errors,
    });

    return new Response(
      JSON.stringify({
        success: true,
        profilesProcessed,
        profilesSkipped,
        trendsProcessed,
        trendsSkipped,
        errors,
        durationMs: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-embeddings] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
