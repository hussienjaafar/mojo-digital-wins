import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, content, id } = await req.json();
    
    if (!type || !content) {
      throw new Error('Missing required fields: type and content');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error('OPENAI_API_KEY or LOVABLE_API_KEY must be configured');
    }

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'article') {
      systemPrompt = 'You are a news summarizer. Create concise, accurate summaries of news articles in 2-3 sentences. Focus on key facts and impact.';
      userPrompt = `Summarize this article:\n\n${content}`;
    } else if (type === 'bill') {
      systemPrompt = 'You are a legislative analyst. Convert complex legal bill text into clear, plain English summaries. Explain what the bill does, who it affects, and its potential impact in 3-4 sentences.';
      userPrompt = `Explain this bill in plain English:\n\n${content}`;
    } else if (type === 'digest') {
      systemPrompt = 'You are a news analyst. Create an executive summary highlighting the most important trends and stories. Write in a professional, informative tone.';
      userPrompt = `Create a daily digest summary from these articles:\n\n${content}`;
    }

    let summary = '';

    // Prefer OpenAI (rate-limit fix); fall back to Lovable if not configured
    if (OPENAI_API_KEY) {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo-0125',
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
          return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const errorText = await response.text();
        console.error('OpenAI error:', response.status, errorText);
        throw new Error('AI generation failed');
      }

      const data = await response.json();
      summary = (data.choices?.[0]?.message?.content || '').toString();
    } else {
      const response = await fetch(LOVABLE_API_URL, {
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
          return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        throw new Error('AI generation failed');
      }

      const data = await response.json();
      summary = data.choices[0].message.content;
    }

    // If id is provided, update the database
    if (id && (type === 'article' || type === 'bill')) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const table = type === 'article' ? 'articles' : 'bills';
      await supabase
        .from(table)
        .update({ ai_summary: summary })
        .eq('id', id);
    }

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-ai-summary:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
