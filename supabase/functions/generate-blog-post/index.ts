import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, keywords, tone, length } = await req.json();
    console.log('Generating blog post for:', { topic, keywords, tone, length });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const keywordList = Array.isArray(keywords) ? keywords.join(', ') : keywords;
    const wordCount = length === 'short' ? '500-700' : length === 'medium' ? '800-1200' : '1500-2000';
    
    const systemPrompt = `You are an expert political campaign content writer specializing in progressive causes. 
Create engaging, informative blog posts that resonate with progressive audiences and drive action.
Focus on practical advice, data-driven insights, and compelling storytelling.`;

    const userPrompt = `Write a comprehensive blog post about "${topic}" that incorporates these keywords: ${keywordList}.

Tone: ${tone || 'professional and engaging'}
Length: ${wordCount} words

Structure the post with:
1. An attention-grabbing title
2. A compelling 2-3 sentence excerpt/summary
3. Well-organized sections with H2 and H3 headings
4. Data points and statistics where relevant
5. Actionable takeaways
6. A strong call-to-action at the end

Format the content in Markdown. Include the title as an H1 at the start.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Failed to generate content');
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;
    
    console.log('Successfully generated blog post');

    // Extract title and content
    const lines = generatedContent.split('\n');
    const titleLine = lines.find((line: string) => line.startsWith('# '));
    const title = titleLine ? titleLine.replace('# ', '').trim() : topic;
    
    // Generate excerpt from first paragraph after title
    const contentWithoutTitle = generatedContent.replace(titleLine || '', '').trim();
    const firstParagraph = contentWithoutTitle.split('\n\n')[0].replace(/^#+\s+/, '').trim();
    const excerpt = firstParagraph.length > 200 
      ? firstParagraph.substring(0, 197) + '...' 
      : firstParagraph;

    return new Response(JSON.stringify({ 
      title,
      excerpt,
      content: generatedContent,
      keywords: Array.isArray(keywords) ? keywords : keywords.split(',').map((k: string) => k.trim())
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-blog-post function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
