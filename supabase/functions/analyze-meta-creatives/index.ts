import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetaCreativeInsight {
  id: string;
  organization_id: string;
  campaign_id: string;
  primary_text: string | null;
  headline: string | null;
  description: string | null;
  call_to_action_type: string | null;
  video_url: string | null;
  creative_type: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
}

interface AIAnalysisResult {
  topic: string;
  tone: string;
  sentiment_score: number;
  sentiment_label: string;
  urgency_level: string;
  emotional_appeal: string;
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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { organization_id, batch_size = 15, include_transcription = true } = await req.json();

    console.log(`Starting Meta creative analysis${organization_id ? ` for org: ${organization_id}` : ' (all orgs)'}`);

    // Fetch unanalyzed Meta creatives
    let query = supabase
      .from('meta_creative_insights')
      .select('*')
      .is('analyzed_at', null)
      .limit(batch_size);

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    const { data: creatives, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Error fetching creatives: ${fetchError.message}`);
    }

    if (!creatives || creatives.length === 0) {
      console.log('No unanalyzed Meta creatives found');
      return new Response(
        JSON.stringify({ success: true, analyzed: 0, message: 'No unanalyzed creatives found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${creatives.length} Meta creatives to analyze`);

    let analyzed = 0;
    let errors = 0;
    let transcribed = 0;

    for (const creative of creatives) {
      try {
        console.log(`Analyzing Meta creative ${creative.id} (type: ${creative.creative_type})`);

        // Combine all text content
        let textContent = '';
        if (creative.primary_text) textContent += `Primary Text: ${creative.primary_text}\n`;
        if (creative.headline) textContent += `Headline: ${creative.headline}\n`;
        if (creative.description) textContent += `Description: ${creative.description}\n`;
        if (creative.call_to_action_type) textContent += `CTA: ${creative.call_to_action_type}\n`;

        // If video and transcription is enabled, try to get audio transcript
        let audioTranscript = creative.audio_transcript;
        
        if (creative.creative_type === 'video' && 
            creative.video_url && 
            !audioTranscript && 
            include_transcription && 
            openaiApiKey) {
          try {
            console.log(`Attempting to transcribe video for creative ${creative.id}`);
            // Note: Direct video transcription from URL would require downloading the video first
            // For now, we'll skip this if there's no transcript already
            // In production, you'd need to download the video and send to Whisper API
            console.log('Video transcription skipped - requires video download implementation');
          } catch (transcribeError) {
            console.error(`Transcription error for creative ${creative.id}:`, transcribeError);
          }
        }

        if (audioTranscript) {
          textContent += `\nVideo Audio Transcript: ${audioTranscript}\n`;
          transcribed++;
        }

        // Skip if no text content at all
        if (!textContent.trim()) {
          console.log(`Skipping creative ${creative.id} - no text content`);
          continue;
        }

        // Call AI to analyze the creative
        const analysisPrompt = `Analyze this Meta (Facebook/Instagram) ad creative and extract the following information. Return ONLY a valid JSON object with no additional text.

Ad Creative Content:
${textContent}

Creative Type: ${creative.creative_type}

Extract:
1. topic: The main topic/subject (e.g., "healthcare", "immigration", "voting rights", "climate", "education", "fundraising general", "candidate promotion")
2. tone: The emotional tone (e.g., "urgent", "emotional", "factual", "grateful", "angry", "hopeful", "fearful", "inspiring", "celebratory")
3. sentiment_score: A number from -1.0 (very negative) to 1.0 (very positive)
4. sentiment_label: "positive", "negative", or "neutral"
5. urgency_level: "low", "medium", "high", or "critical"
6. emotional_appeal: Primary emotional appeal type (e.g., "fear", "hope", "anger", "pride", "urgency", "compassion", "solidarity", "outrage")
7. key_themes: Array of 2-5 key themes/keywords in the creative

Return only valid JSON in this exact format:
{"topic":"string","tone":"string","sentiment_score":0.0,"sentiment_label":"string","urgency_level":"string","emotional_appeal":"string","key_themes":["theme1","theme2"]}`;

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
                content: 'You are an expert political advertising analyst. Analyze ad creatives and return structured JSON analysis. Be accurate and consistent in your categorizations.' 
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
          if (aiResponse.status === 402) {
            console.log('Payment required, stopping batch processing');
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
          .from('meta_creative_insights')
          .update({
            topic: analysis.topic,
            tone: analysis.tone,
            sentiment_score: analysis.sentiment_score,
            sentiment_label: analysis.sentiment_label,
            urgency_level: analysis.urgency_level,
            emotional_appeal: analysis.emotional_appeal,
            key_themes: analysis.key_themes,
            audio_transcript: audioTranscript || creative.audio_transcript,
            analyzed_at: new Date().toISOString(),
            ai_model_used: 'google/gemini-2.5-flash',
            analysis_confidence: 0.85,
          })
          .eq('id', creative.id);

        if (updateError) {
          console.error(`Error updating creative ${creative.id}:`, updateError);
          errors++;
          continue;
        }

        analyzed++;
        console.log(`Successfully analyzed Meta creative ${creative.id}: topic=${analysis.topic}, tone=${analysis.tone}, emotional_appeal=${analysis.emotional_appeal}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 250));

      } catch (creativeError) {
        console.error(`Error processing creative ${creative.id}:`, creativeError);
        errors++;
      }
    }

    console.log(`Meta creative analysis complete. Analyzed: ${analyzed}, Transcribed: ${transcribed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analyzed,
        transcribed,
        errors,
        total: creatives.length,
        message: `Analyzed ${analyzed} Meta creatives` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in analyze-meta-creatives:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});