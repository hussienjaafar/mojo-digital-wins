import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, validateAuth, userBelongsToOrg, checkRateLimit } from "../_shared/security.ts";
import { callLovableAIWithTools, AIGatewayError } from "../_shared/ai-client.ts";
import { SMS_CAMPAIGN_SYSTEM_PROMPT, SMS_CAMPAIGN_TOOL } from "../_shared/prompts.ts";

const corsHeaders = getCorsHeaders();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SECURITY: Require authenticated user
    const authResult = await validateAuth(req, supabase);
    if (!authResult) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit(`generate-campaign-messages:${authResult.user.id}`, 20, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const canAccessOrg = authResult.isAdmin || await userBelongsToOrg(supabase, authResult.user.id, organization_id);
    if (!canAccessOrg) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    const historicalContext = historicalMessages?.map(m => ({
      text: m.sms_text,
      performance: m.performance_metrics
    })) || [];

    const correlationContext = correlations?.map(c => ({
      entity: c.entity_name,
      donations: c.donations_48h_after,
      amount: c.amount_raised_48h_after
    })) || [];

    // Build user message with context
    const userMessage = `Generate ${num_variants} SMS campaign message variants for political fundraising.

Context:
- Entity: ${entity_name} (${entity_type})
- Opportunity: ${opportunity_context || 'trending topic with high fundraising potential'}

Historical successful messages from this organization:
${historicalContext.map(h => `- "${h.text}"`).join('\n') || '- No historical data available'}

Past successful correlations:
${correlationContext.map(c => `- ${c.entity}: ${c.donations} donations, $${c.amount?.toFixed(0)} raised`).join('\n') || '- No correlation data available'}

Generate exactly ${num_variants} variants testing different approaches (emotional, factual, urgent, social_proof, identity).`;

    const { result } = await callLovableAIWithTools<{ messages: any[] }>({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SMS_CAMPAIGN_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
      tools: [SMS_CAMPAIGN_TOOL],
      toolChoice: { type: "function", function: { name: "generate_sms_messages" } },
    });

    const generatedMessages = result.messages || [];

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
      JSON.stringify({ success: true, messages: generatedMessages }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-campaign-messages:', error);

    if (error instanceof AIGatewayError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
