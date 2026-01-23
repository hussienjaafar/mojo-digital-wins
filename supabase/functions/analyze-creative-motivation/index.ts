import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreativeData {
  id: string;
  organization_id: string;
  creative_id: string;
  ad_id: string;
  body_text: string | null;
  title_text: string | null;
  transcript_text?: string | null;
}

interface MotivationAnalysis {
  donor_pain_points: string[];
  values_appealed: string[];
  issue_specifics: string[];
  emotional_triggers: string[];
  urgency_drivers: string[];
  topic_primary: string;
  tone_primary: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, batch_size = 20, creative_id, include_transcripts = true } = await req.json();

    console.log(`Starting creative motivation analysis${organization_id ? ` for org: ${organization_id}` : ' (all orgs)'}`);

    // Fetch unanalyzed creatives - those without motivation data
    let query = supabase
      .from('meta_creative_insights')
      .select('id, organization_id, creative_id, ad_id, body_text, title_text')
      .or('donor_pain_points.is.null,donor_pain_points.eq.{}')
      .not('body_text', 'is', null)
      .limit(batch_size);

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    if (creative_id) {
      query = query.eq('creative_id', creative_id);
    }

    const { data: creatives, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Error fetching creatives: ${fetchError.message}`);
    }

    if (!creatives || creatives.length === 0) {
      console.log('No unanalyzed creatives found');
      return new Response(
        JSON.stringify({ success: true, analyzed: 0, message: 'No unanalyzed creatives found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${creatives.length} creatives to analyze for motivation`);

    // Optionally fetch transcripts for video ads
    let transcriptMap = new Map<string, string>();
    if (include_transcripts) {
      const adIds = creatives.map(c => c.ad_id).filter(Boolean);
      if (adIds.length > 0) {
        const { data: transcripts } = await supabase
          .from('meta_ad_transcripts')
          .select('ad_id, transcript_text')
          .in('ad_id', adIds);
        
        if (transcripts) {
          for (const t of transcripts) {
            if (t.transcript_text) {
              transcriptMap.set(t.ad_id, t.transcript_text);
            }
          }
        }
        console.log(`Found ${transcriptMap.size} video transcripts to include`);
      }
    }

    let analyzed = 0;
    let errors = 0;

    for (const creative of creatives) {
      try {
        // Combine ad text with transcript if available
        const transcript = transcriptMap.get(creative.ad_id);
        const adContent = [
          creative.title_text ? `Title: ${creative.title_text}` : '',
          creative.body_text ? `Body: ${creative.body_text}` : '',
          transcript ? `Video Transcript: ${transcript.slice(0, 2000)}` : '',
        ].filter(Boolean).join('\n\n');

        if (!adContent.trim()) {
          console.log(`Skipping creative ${creative.id} - no content`);
          continue;
        }

        const prompt = `You are an expert at understanding what motivates political donors to give money.

Analyze this political ad content and extract SPECIFIC insights about donor psychology.

Ad Content:
"""
${adContent.slice(0, 3000)}
"""

Focus on extracting:

1. DONOR_PAIN_POINTS: What specific problems, injustices, or threats are highlighted that would compel someone to donate?
   - Be VERY SPECIFIC (not "foreign policy" but "US military aid enabling civilian deaths in Gaza")
   - What keeps donors up at night that this ad addresses?
   - Examples: "AIPAC buying elections", "Bronx families can't afford groceries", "Corrupt politicians ignoring constituents"

2. VALUES_APPEALED: What core values are being triggered?
   - Examples: justice, community empowerment, anti-establishment, protecting vulnerable, religious duty, solidarity, representation

3. ISSUE_SPECIFICS: What exact policies, events, or situations are mentioned?
   - Examples: "End US military aid to Israel", "Medicare for All", "Replace AIPAC-backed incumbents"

4. EMOTIONAL_TRIGGERS: What emotions are being activated?
   - Examples: anger at being ignored, hope for political voice, solidarity with oppressed, pride in community

5. URGENCY_DRIVERS: What creates the sense of "I must act NOW"?
   - Examples: primary election deadline, matching gift, crisis moment, opponent threat

Also identify:
- topic_primary: Main topic (Foreign Policy, Healthcare, Economy, Elections, Civil Rights, Immigration, etc.)
- tone_primary: Overall tone (urgent, hopeful, angry, inspiring, alarming, etc.)

Respond with ONLY valid JSON:
{
  "donor_pain_points": ["specific pain point 1", "specific pain point 2"],
  "values_appealed": ["value 1", "value 2"],
  "issue_specifics": ["specific issue 1"],
  "emotional_triggers": ["emotion 1", "emotion 2"],
  "urgency_drivers": ["urgency reason 1"],
  "topic_primary": "string",
  "tone_primary": "string"
}`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are an expert political campaign analyst who understands donor psychology. Identify what SPECIFICALLY motivates donations - exact pain points, values, and emotions, not generic categories. Always respond with valid JSON only.'
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 1000,
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
        let analysis: MotivationAnalysis;
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON object found in response');
          }
          analysis = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.error(`Error parsing AI response for creative ${creative.id}:`, parseError);
          errors++;
          continue;
        }

        // Update the creative with motivation analysis
        const { error: updateError } = await supabase
          .from('meta_creative_insights')
          .update({
            donor_pain_points: analysis.donor_pain_points || [],
            values_appealed: analysis.values_appealed || [],
            issue_specifics: analysis.issue_specifics || [],
            emotional_triggers: analysis.emotional_triggers || [],
            urgency_drivers: analysis.urgency_drivers || [],
            // Also update topic/tone if we got better data
            topic: analysis.topic_primary || undefined,
            tone: analysis.tone_primary || undefined,
          })
          .eq('id', creative.id);

        if (updateError) {
          console.error(`Error updating creative ${creative.id}:`, updateError);
          errors++;
          continue;
        }

        analyzed++;
        console.log(`Analyzed creative ${creative.id}: pain_points=${analysis.donor_pain_points?.length || 0}, values=${analysis.values_appealed?.length || 0}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (creativeError) {
        console.error(`Error processing creative ${creative.id}:`, creativeError);
        errors++;
      }
    }

    console.log(`Creative motivation analysis complete. Analyzed: ${analyzed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed,
        errors,
        total: creatives.length,
        message: `Analyzed ${analyzed} creatives for donor motivation`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in analyze-creative-motivation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
