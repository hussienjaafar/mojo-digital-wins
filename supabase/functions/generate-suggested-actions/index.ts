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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Generating suggested actions for high-score alerts...');

    // Get high-scoring actionable alerts without suggested actions yet
    const { data: alerts, error: alertsError } = await supabase
      .from('client_entity_alerts')
      .select(`
        *,
        entity_watchlist(entity_type),
        client_organizations(name, slug)
      `)
      .eq('is_actionable', true)
      .is('suggested_action', null)
      .gte('actionable_score', 60)
      .order('actionable_score', { ascending: false })
      .limit(10);

    if (alertsError) throw alertsError;

    console.log(`Processing ${alerts?.length || 0} high-score alerts`);

    const suggestedActions = [];

    for (const alert of alerts || []) {
      // Get organization profile for context
      const { data: orgProfile } = await supabase
        .from('organization_profiles')
        .select('mission, focus_areas, key_issues')
        .eq('organization_id', alert.organization_id)
        .single();

      // Build context for AI
      const context = {
        entityName: alert.entity_name,
        entityType: alert.entity_watchlist?.entity_type,
        orgName: alert.client_organizations?.name,
        mission: orgProfile?.mission,
        focusAreas: orgProfile?.focus_areas,
        velocity: alert.velocity,
        mentions: alert.current_mentions,
        sentiment: alert.sample_sources?.[0]?.context,
      };

      // Generate SMS fundraising copy using Lovable AI
      const prompt = `You are a political fundraising expert. Generate a compelling SMS fundraising message (160 characters max) for "${context.orgName}" about "${context.entityName}".

Organization mission: ${context.mission || 'Political advocacy'}
Focus areas: ${context.focusAreas?.join(', ') || 'Policy advocacy'}
Current trend: ${context.mentions} mentions in last hour, velocity ${context.velocity}%

The message should:
1. Create urgency based on the trending topic
2. Connect to the organization's mission
3. Include a clear call-to-action to donate
4. Be under 160 characters
5. Sound authentic and conversational

Return ONLY the SMS text, nothing else.`;

      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a political fundraising SMS copywriter. Write concise, urgent, authentic messages.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 200,
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            console.warn('Rate limited by Lovable AI, skipping this alert');
            continue;
          }
          if (aiResponse.status === 402) {
            console.error('Payment required for Lovable AI');
            continue;
          }
          throw new Error(`AI API error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const smsText = aiData.choices[0].message.content.trim();

        // Calculate topic relevance score (based on context match)
        const topicRelevance = Math.min(alert.actionable_score, 100);

        // Calculate urgency score (based on velocity and mentions)
        const urgencyScore = Math.min((alert.velocity / 5) + (alert.current_mentions / 2), 100);

        suggestedActions.push({
          alert_id: alert.id,
          organization_id: alert.organization_id,
          action_type: 'sms_fundraising',
          suggested_copy: smsText,
          topic: alert.entity_name,
          topic_relevance_score: Math.round(topicRelevance),
          urgency_score: Math.round(urgencyScore),
        });

        // Update alert with suggested action preview
        await supabase
          .from('client_entity_alerts')
          .update({ suggested_action: smsText.substring(0, 100) })
          .eq('id', alert.id);

      } catch (error) {
        console.error(`Error generating action for alert ${alert.id}:`, error);
      }
    }

    console.log(`Generated ${suggestedActions.length} suggested actions`);

    // Insert suggested actions
    if (suggestedActions.length > 0) {
      const { error: insertError } = await supabase
        .from('suggested_actions')
        .insert(suggestedActions);

      if (insertError) {
        console.error('Error inserting suggested actions:', insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        actionsGenerated: suggestedActions.length,
        alertsProcessed: alerts?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating suggested actions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
