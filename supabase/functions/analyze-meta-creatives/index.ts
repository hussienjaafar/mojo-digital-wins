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
  thumbnail_url: string | null;
  creative_type: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  roas: number | null;
  audio_transcript: string | null;
}

interface AIAnalysisResult {
  topic: string;
  tone: string;
  sentiment_score: number;
  sentiment_label: string;
  urgency_level: string;
  emotional_appeal: string;
  key_themes: string[];
  verbal_themes?: string[];
}

interface VisualAnalysisResult {
  detected_text: string | null;
  color_palette: string[];
  has_faces: boolean;
  composition_style: string;
  visual_elements: string[];
  brand_visibility: string;
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

    const { organization_id, batch_size = 15, include_visual_analysis = true } = await req.json();

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
    let visualAnalyzed = 0;

    for (const creative of creatives) {
      try {
        console.log(`Analyzing Meta creative ${creative.id} (type: ${creative.creative_type})`);

        // Combine all text content
        let textContent = '';
        if (creative.primary_text) textContent += `Primary Text: ${creative.primary_text}\n`;
        if (creative.headline) textContent += `Headline: ${creative.headline}\n`;
        if (creative.description) textContent += `Description: ${creative.description}\n`;
        if (creative.call_to_action_type) textContent += `CTA: ${creative.call_to_action_type}\n`;

        // Include audio transcript if available
        if (creative.audio_transcript) {
          textContent += `\nVideo Audio Transcript: ${creative.audio_transcript}\n`;
        }

        // Skip if no text content at all and no image to analyze
        if (!textContent.trim() && !creative.thumbnail_url) {
          console.log(`Skipping creative ${creative.id} - no content`);
          continue;
        }

        let analysis: AIAnalysisResult | null = null;
        let visualAnalysis: VisualAnalysisResult | null = null;

        // Text analysis if we have text
        if (textContent.trim()) {
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
${creative.audio_transcript ? '8. verbal_themes: Array of 2-4 key themes specifically from the spoken audio' : ''}

Return only valid JSON in this exact format:
{"topic":"string","tone":"string","sentiment_score":0.0,"sentiment_label":"string","urgency_level":"string","emotional_appeal":"string","key_themes":["theme1","theme2"]${creative.audio_transcript ? ',"verbal_themes":["theme1"]' : ''}}`;

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
            
            if (aiResponse.status === 429 || aiResponse.status === 402) {
              console.log('Rate limited or payment required, stopping batch');
              break;
            }
            errors++;
            continue;
          }

          const aiData = await aiResponse.json();
          const responseText = aiData.choices?.[0]?.message?.content;

          if (responseText) {
            try {
              const jsonMatch = responseText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
              }
            } catch (parseError) {
              console.error(`Error parsing AI response for creative ${creative.id}:`, parseError);
            }
          }
        }

        // Visual analysis if thumbnail is available and enabled
        if (include_visual_analysis && creative.thumbnail_url) {
          try {
            console.log(`Performing visual analysis for creative ${creative.id}`);

            const visualPrompt = `Analyze this ad creative image and extract visual elements. Return ONLY valid JSON.

Extract:
1. detected_text: Any text visible in the image (null if none)
2. color_palette: Array of 3-5 dominant colors (e.g., ["red", "white", "blue"])
3. has_faces: true if human faces are visible, false otherwise
4. composition_style: The visual style (e.g., "photo-realistic", "graphic design", "text-heavy", "product-focused", "portrait", "action shot")
5. visual_elements: Array of 3-5 key visual elements (e.g., ["american flag", "diverse crowd", "donation button"])
6. brand_visibility: "high", "medium", "low", or "none" - how prominent is branding

Return only valid JSON:
{"detected_text":"text or null","color_palette":["color1"],"has_faces":false,"composition_style":"style","visual_elements":["element1"],"brand_visibility":"level"}`;

            const visualResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-pro',
                messages: [
                  { 
                    role: 'system', 
                    content: 'You are an expert at analyzing advertising visuals. Return structured JSON analysis of images.' 
                  },
                  { 
                    role: 'user', 
                    content: [
                      { type: 'text', text: visualPrompt },
                      { type: 'image_url', image_url: { url: creative.thumbnail_url } }
                    ]
                  }
                ],
              }),
            });

            if (visualResponse.ok) {
              const visualData = await visualResponse.json();
              const visualText = visualData.choices?.[0]?.message?.content;
              
              if (visualText) {
                try {
                  const jsonMatch = visualText.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    visualAnalysis = JSON.parse(jsonMatch[0]);
                    visualAnalyzed++;
                    console.log(`Visual analysis complete for ${creative.id}`);
                  }
                } catch (parseError) {
                  console.error(`Error parsing visual analysis for ${creative.id}:`, parseError);
                }
              }
            } else {
              console.error(`Visual API error for ${creative.id}:`, await visualResponse.text());
            }
          } catch (visualError) {
            console.error(`Visual analysis error for ${creative.id}:`, visualError);
          }
        }

        // Calculate effectiveness score based on performance
        const ctr = creative.ctr || (creative.impressions > 0 ? creative.clicks / creative.impressions : 0);
        const roas = creative.roas || 0;
        const convRate = creative.impressions > 0 ? creative.conversions / creative.impressions : 0;
        
        // Normalize and weight the metrics
        const ctrScore = Math.min(ctr * 100, 10) * 10; // CTR up to 10% = 100 points
        const roasScore = Math.min(roas, 5) * 20; // ROAS up to 5x = 100 points
        const convScore = Math.min(convRate * 1000, 10) * 10; // Conv rate normalized
        
        const effectivenessScore = Math.round((ctrScore * 0.3 + roasScore * 0.5 + convScore * 0.2));
        
        // Determine performance tier
        let performanceTier = 'low';
        if (effectivenessScore >= 70) performanceTier = 'top';
        else if (effectivenessScore >= 50) performanceTier = 'high';
        else if (effectivenessScore >= 30) performanceTier = 'medium';

        // Prepare update object
        const updateData: any = {
          analyzed_at: new Date().toISOString(),
          ai_model_used: 'google/gemini-2.5-flash',
          analysis_confidence: 0.85,
          effectiveness_score: effectivenessScore,
          performance_tier: performanceTier,
        };

        if (analysis) {
          updateData.topic = analysis.topic;
          updateData.tone = analysis.tone;
          updateData.sentiment_score = analysis.sentiment_score;
          updateData.sentiment_label = analysis.sentiment_label;
          updateData.urgency_level = analysis.urgency_level;
          updateData.emotional_appeal = analysis.emotional_appeal;
          updateData.key_themes = analysis.key_themes;
          if (analysis.verbal_themes) {
            updateData.verbal_themes = analysis.verbal_themes;
          }
        }

        if (visualAnalysis) {
          updateData.visual_analysis = visualAnalysis;
          updateData.detected_text = visualAnalysis.detected_text;
          updateData.color_palette = visualAnalysis.color_palette;
          updateData.has_faces = visualAnalysis.has_faces;
        }

        // Update the creative
        const { error: updateError } = await supabase
          .from('meta_creative_insights')
          .update(updateData)
          .eq('id', creative.id);

        if (updateError) {
          console.error(`Error updating creative ${creative.id}:`, updateError);
          errors++;
          continue;
        }

        analyzed++;
        console.log(`Successfully analyzed creative ${creative.id}: topic=${analysis?.topic || 'N/A'}, tier=${performanceTier}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (creativeError) {
        console.error(`Error processing creative ${creative.id}:`, creativeError);
        errors++;
      }
    }

    console.log(`Analysis complete. Analyzed: ${analyzed}, Visual: ${visualAnalyzed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analyzed,
        visualAnalyzed,
        errors,
        total: creatives.length,
        message: `Analyzed ${analyzed} Meta creatives (${visualAnalyzed} with visual analysis)` 
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