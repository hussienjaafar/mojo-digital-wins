import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSCreativeInsight {
  id: string;
  organization_id: string;
  campaign_id: string;
  message_text: string;
  messages_sent: number;
  messages_delivered: number;
  clicks: number;
  conversions: number;
  amount_raised: number;
}

interface AIAnalysisResult {
  topic: string;
  tone: string;
  sentiment_score: number;
  sentiment_label: string;
  call_to_action: string;
  urgency_level: string;
  key_themes: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { organization_id, batch_size = 20 } = await req.json();

    console.log(`Starting SMS creative analysis${organization_id ? ` for org: ${organization_id}` : ' (all orgs)'}`);

    // Fetch unanalyzed SMS creatives
    let query = supabase
      .from('sms_creative_insights')
      .select('*')
      .is('analyzed_at', null)
      .not('message_text', 'is', null)
      .limit(batch_size);

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    const { data: creatives, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Error fetching creatives: ${fetchError.message}`);
    }

    if (!creatives || creatives.length === 0) {
      console.log('No unanalyzed SMS creatives found');
      return new Response(
        JSON.stringify({ success: true, analyzed: 0, message: 'No unanalyzed creatives found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${creatives.length} SMS creatives to analyze`);

    let analyzed = 0;
    let errors = 0;

    for (const creative of creatives) {
      try {
        console.log(`Analyzing SMS creative ${creative.id}`);

        // Call AI to analyze the message
        const analysisPrompt = `Analyze this SMS fundraising message and extract the following information. Return ONLY a valid JSON object with no additional text.

SMS Message:
"${creative.message_text}"

Extract:
1. topic: The main topic/subject (e.g., "healthcare", "immigration", "voting rights", "climate", "education", "fundraising general")
2. tone: The emotional tone (e.g., "urgent", "emotional", "factual", "grateful", "angry", "hopeful", "fearful", "inspiring")
3. sentiment_score: A number from -1.0 (very negative) to 1.0 (very positive)
4. sentiment_label: "positive", "negative", or "neutral"
5. call_to_action: The main CTA type (e.g., "donate", "sign petition", "share", "vote", "volunteer", "attend event", "contact representative")
6. urgency_level: "low", "medium", "high", or "critical"
7. key_themes: Array of 2-4 key themes/keywords in the message

Return only valid JSON in this exact format:
{"topic":"string","tone":"string","sentiment_score":0.0,"sentiment_label":"string","call_to_action":"string","urgency_level":"string","key_themes":["theme1","theme2"]}`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { 
                role: 'system', 
                content: 'You are an expert political campaign analyst. Analyze SMS messages and return structured JSON analysis. Be accurate and consistent in your categorizations.' 
              },
              { role: 'user', content: analysisPrompt }
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI API error for creative ${creative.id}:`, errorText);
          
          if (aiResponse.status === 429) {
            console.log('Rate limited, stopping batch processing');
            break;
          }
          errors++;
          continue;
        }

        const aiData = await aiResponse.json();
        const responseText = aiData.choices?.[0]?.message?.content;

        if (!responseText) {
          console.error(`No response content for creative ${creative.id}`);
          errors++;
          continue;
        }

        // Parse the JSON response
        let analysis: AIAnalysisResult;
        try {
          // Extract JSON from response (handle potential markdown wrapping)
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON object found in response');
          }
          analysis = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.error(`Error parsing AI response for creative ${creative.id}:`, parseError);
          console.error('Raw response:', responseText);
          errors++;
          continue;
        }

        // Update the creative with analysis results
        const { error: updateError } = await supabase
          .from('sms_creative_insights')
          .update({
            topic: analysis.topic,
            tone: analysis.tone,
            sentiment_score: analysis.sentiment_score,
            sentiment_label: analysis.sentiment_label,
            call_to_action: analysis.call_to_action,
            urgency_level: analysis.urgency_level,
            key_themes: analysis.key_themes,
            analyzed_at: new Date().toISOString(),
            ai_model_used: 'google/gemini-2.5-flash',
            analysis_confidence: 0.85, // Default confidence for this model
          })
          .eq('id', creative.id);

        if (updateError) {
          console.error(`Error updating creative ${creative.id}:`, updateError);
          errors++;
          continue;
        }

        analyzed++;
        console.log(`Successfully analyzed SMS creative ${creative.id}: topic=${analysis.topic}, tone=${analysis.tone}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (creativeError) {
        console.error(`Error processing creative ${creative.id}:`, creativeError);
        errors++;
      }
    }

    console.log(`SMS creative analysis complete. Analyzed: ${analyzed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analyzed,
        errors,
        total: creatives.length,
        message: `Analyzed ${analyzed} SMS creatives` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in analyze-sms-creatives:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});