import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

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

    const { 
      organization_id, 
      entity_name,
      entity_type,
      opportunity_context,
      num_variants = 3 
    } = await req.json();

    if (!organization_id || !entity_name) {
      throw new Error('organization_id and entity_name are required');
    }

    console.log(`Generating campaign messages for ${entity_name} (${organization_id})`);

    // Get historical successful messages for this org
    const { data: historicalMessages } = await supabase
      .from('suggested_actions')
      .select('sms_text, performance_metrics')
      .eq('organization_id', organization_id)
      .eq('action_taken', true)
      .not('performance_metrics', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent high-performing correlations
    const { data: correlations } = await supabase
      .from('event_impact_correlations')
      .select('*')
      .eq('organization_id', organization_id)
      .gt('correlation_strength', 60)
      .order('correlation_strength', { ascending: false })
      .limit(5);

    // Build context for AI
    const historicalContext = historicalMessages?.map(m => ({
      text: m.sms_text,
      performance: m.performance_metrics
    })) || [];

    const correlationContext = correlations?.map(c => ({
      entity: c.entity_name,
      donations: c.donations_48h_after,
      amount: c.amount_raised_48h_after
    })) || [];

    // Call Lovable AI for message generation
    const aiPrompt = `Generate ${num_variants} SMS campaign message variants (160 chars max each) for a political fundraising campaign.

Context:
- Entity: ${entity_name} (${entity_type})
- Opportunity: ${opportunity_context || 'trending topic with high fundraising potential'}

Historical successful messages from this organization:
${historicalContext.map(h => `- "${h.text}"`).join('\n')}

Past successful correlations:
${correlationContext.map(c => `- ${c.entity}: ${c.donations} donations, $${c.amount?.toFixed(0)} raised`).join('\n')}

Requirements:
- Create urgency without being alarmist
- Include clear call-to-action
- Mention the specific entity/topic
- Keep under 160 characters
- Variants should test different approaches (emotional, factual, urgent)

Return ONLY a JSON array of ${num_variants} message objects with this structure:
[
  {
    "message": "the SMS text (max 160 chars)",
    "approach": "emotional|factual|urgent",
    "predicted_performance": 1-100 score
  }
]`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: aiPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse AI response
    let generatedMessages;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        generatedMessages = JSON.parse(jsonMatch[0]);
      } else {
        generatedMessages = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI-generated messages');
    }

    // Store generated messages
    const messagesToStore = generatedMessages.map((msg: any, index: number) => ({
      organization_id,
      entity_name,
      entity_type,
      message_text: msg.message,
      message_approach: msg.approach,
      predicted_performance: msg.predicted_performance || 70,
      variant_number: index + 1,
      context_used: {
        historical_messages: historicalContext.length,
        correlations: correlationContext.length,
        opportunity_context,
      },
      generated_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('generated_campaign_messages')
      .insert(messagesToStore);

    if (insertError) {
      console.error('Error storing generated messages:', insertError);
    }

    console.log(`Generated ${generatedMessages.length} message variants`);

    return new Response(
      JSON.stringify({ 
        success: true,
        messages: generatedMessages,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-campaign-messages:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
