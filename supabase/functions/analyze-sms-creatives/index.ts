import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { callLovableAIWithTools, AIGatewayError } from "../_shared/ai-client.ts";
import { SMS_ANALYSIS_SYSTEM_PROMPT, SMS_ANALYSIS_TOOL } from "../_shared/prompts.ts";

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

    if (fetchError) throw new Error(`Error fetching creatives: ${fetchError.message}`);

    if (!creatives || creatives.length === 0) {
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

        const { result } = await callLovableAIWithTools<{
          topic: string;
          tone: string;
          sentiment_score: number;
          sentiment_label: string;
          call_to_action: string;
          urgency_level: string;
          key_themes: string[];
        }>({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: SMS_ANALYSIS_SYSTEM_PROMPT },
            { role: 'user', content: `Analyze this SMS fundraising message:\n\n"${creative.message_text}"` },
          ],
          temperature: 0.1,
          tools: [SMS_ANALYSIS_TOOL],
          toolChoice: { type: "function", function: { name: "analyze_sms_creative" } },
        });

        const { error: updateError } = await supabase
          .from('sms_creative_insights')
          .update({
            topic: result.topic,
            tone: result.tone,
            sentiment_score: result.sentiment_score,
            sentiment_label: result.sentiment_label,
            call_to_action: result.call_to_action,
            urgency_level: result.urgency_level,
            key_themes: result.key_themes,
            analyzed_at: new Date().toISOString(),
            ai_model_used: 'google/gemini-2.5-flash',
          })
          .eq('id', creative.id);

        if (updateError) {
          console.error(`Error updating creative ${creative.id}:`, updateError);
          errors++;
          continue;
        }

        analyzed++;
        console.log(`Analyzed SMS creative ${creative.id}: topic=${result.topic}, tone=${result.tone}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (creativeError) {
        console.error(`Error processing creative ${creative.id}:`, creativeError);
        if (creativeError instanceof AIGatewayError && creativeError.status === 429) {
          console.log('Rate limited, stopping batch processing');
          break;
        }
        errors++;
      }
    }

    console.log(`SMS creative analysis complete. Analyzed: ${analyzed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ success: true, analyzed, errors, total: creatives.length, message: `Analyzed ${analyzed} SMS creatives` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in analyze-sms-creatives:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error instanceof AIGatewayError ? error.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
