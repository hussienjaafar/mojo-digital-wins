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
    const { organizationId, websiteUrl } = await req.json();

    if (!organizationId || !websiteUrl) {
      throw new Error('organizationId and websiteUrl are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`Scraping organization website: ${websiteUrl}`);

    // Fetch website content
    let websiteContent = '';
    try {
      const response = await fetch(websiteUrl);
      if (response.ok) {
        const html = await response.text();
        
        // Basic HTML cleanup (remove scripts, styles)
        websiteContent = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 10000); // Limit to first 10k chars
      }
    } catch (error) {
      console.error('Error fetching website:', error);
      websiteContent = 'Unable to fetch website content';
    }

    // Use Lovable AI to extract organization information
    const prompt = `Analyze this organization's website content and extract:

1. Mission statement (1-2 sentences)
2. Main focus areas (3-5 key areas)
3. Key issues they work on (5-10 specific issues)

Website content:
${websiteContent}

Return your analysis in JSON format:
{
  "mission": "...",
  "focus_areas": ["area1", "area2", ...],
  "key_issues": ["issue1", "issue2", ...]
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert at analyzing organization websites and extracting structured information.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error('Rate limited by Lovable AI');
      }
      if (aiResponse.status === 402) {
        throw new Error('Payment required for Lovable AI');
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = JSON.parse(aiData.choices[0].message.content);

    // Store organization profile
    const { error: upsertError } = await supabase
      .from('organization_profiles')
      .upsert({
        organization_id: organizationId,
        website_url: websiteUrl,
        mission: analysis.mission,
        focus_areas: analysis.focus_areas,
        key_issues: analysis.key_issues,
        last_scraped_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id',
      });

    if (upsertError) throw upsertError;

    // Generate suggested watchlist entities based on key issues
    const suggestedEntities = analysis.key_issues.map((issue: string) => ({
      entity_name: issue,
      entity_type: 'issue',
      ai_relevance_score: 80,
    }));

    console.log(`Website scraping complete for organization ${organizationId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        profile: analysis,
        suggestedEntities,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error scraping organization website:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
