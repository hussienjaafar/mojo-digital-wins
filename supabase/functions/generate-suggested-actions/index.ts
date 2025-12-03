import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate fallback suggestion without AI
function generateFallbackSuggestion(alert: any, orgProfile: any): string {
  const { entity_name, alert_type, velocity, current_mentions, severity } = alert;
  
  if (alert_type === 'trending_spike' || alert_type === 'breaking_trend') {
    return `${entity_name} is trending with ${velocity?.toFixed(0) || 'high'}% velocity increase. Consider sending a timely SMS or email to capitalize on this momentum. Frame your message around this trend while attention is high.`;
  }
  
  if (alert_type === 'sentiment_shift') {
    return `Public sentiment around ${entity_name} is shifting. Review recent coverage and prepare a strategic response that addresses the changing narrative. Monitor closely over the next 24 hours.`;
  }
  
  if (alert_type === 'cross_source_breakthrough') {
    return `${entity_name} is being discussed across multiple platforms simultaneously. This cross-source activity signals a significant moment. Consider a coordinated multi-channel response.`;
  }
  
  if (severity === 'critical') {
    return `URGENT: ${entity_name} requires immediate attention with ${current_mentions || 'significant'} mentions. Evaluate whether rapid response messaging is appropriate.`;
  }
  
  return `${entity_name} has ${current_mentions || 'notable'} recent mentions. Continue monitoring and be prepared to respond if momentum increases.`;
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

    console.log('🎯 Generating suggested actions for high-score alerts...');

    // Get high-scoring actionable alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('client_entity_alerts')
      .select(`
        id,
        organization_id,
        entity_name,
        alert_type,
        severity,
        actionable_score,
        current_mentions,
        velocity,
        sample_sources,
        suggested_action
      `)
      .eq('is_actionable', true)
      .gte('actionable_score', 60)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('actionable_score', { ascending: false })
      .limit(15);

    if (alertsError) throw alertsError;

    console.log(`📋 Processing ${alerts?.length || 0} high-score alerts`);

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, actionsGenerated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization profiles for context
    const orgIds = [...new Set(alerts.map(a => a.organization_id))];
    const { data: orgProfiles } = await supabase
      .from('organization_profiles')
      .select('organization_id, mission, focus_areas, key_issues')
      .in('organization_id', orgIds);

    const profileMap = new Map(
      (orgProfiles || []).map(p => [p.organization_id, p])
    );

    // Get watchlist items for entity types
    const watchlistIds = [...new Set(alerts.map((a: any) => a.watchlist_id).filter(Boolean))];
    const { data: watchlistItems } = await supabase
      .from('entity_watchlist')
      .select('id, entity_type')
      .in('id', watchlistIds.length > 0 ? watchlistIds : ['00000000-0000-0000-0000-000000000000']);

    const watchlistMap = new Map(
      (watchlistItems || []).map(w => [w.id, w])
    );

    const suggestedActions = [];
    let aiGeneratedCount = 0;

    for (const alert of alerts) {
      const orgProfile = profileMap.get(alert.organization_id);
      
      let suggestion = null;
      
      // Try AI generation for high-score alerts
      if (lovableApiKey && alert.actionable_score >= 70) {
        try {
          const prompt = `You are a political communications strategist. Generate a brief, actionable suggestion for a nonprofit organization.

Context:
- Entity being tracked: ${alert.entity_name}
- Alert type: ${alert.alert_type}
- Current mentions (24h): ${alert.current_mentions || 'Unknown'}
- Velocity (% increase): ${alert.velocity?.toFixed(0) || 0}%
- Severity: ${alert.severity}
${orgProfile ? `- Organization mission: ${orgProfile.mission || 'Political advocacy'}` : ''}
${orgProfile?.key_issues ? `- Key issues: ${(orgProfile.key_issues as string[]).join(', ')}` : ''}
${alert.sample_sources?.length > 0 ? `- Recent coverage: ${alert.sample_sources.map((s: any) => s.title).slice(0, 2).join('; ')}` : ''}

Generate a 2-3 sentence actionable recommendation focusing on:
1. Immediate tactical action (email, SMS, social post)
2. Strategic framing based on the trend
3. Urgency level

Keep it concise and actionable.`;

          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'You are a political communications expert. Be concise and actionable.' },
                { role: 'user', content: prompt }
              ],
              max_tokens: 200,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            suggestion = data.choices?.[0]?.message?.content;
            aiGeneratedCount++;
            console.log(`🤖 Generated AI suggestion for ${alert.entity_name}`);
          } else if (response.status === 429) {
            console.warn('Rate limited, using fallback');
          } else if (response.status === 402) {
            console.warn('Payment required, using fallback');
          }
        } catch (aiError) {
          console.error('AI suggestion error:', aiError);
        }
      }

      // Use fallback if no AI suggestion
      if (!suggestion) {
        suggestion = generateFallbackSuggestion(alert, orgProfile);
      }

      // Calculate scores
      const topicRelevance = Math.min(alert.actionable_score, 100);
      const urgencyScore = Math.min((alert.velocity || 0) / 5 + (alert.current_mentions || 0) / 2, 100);

      // Map alert type to action type
      let actionType = 'monitoring';
      if (alert.alert_type === 'trending_spike' || alert.alert_type === 'breaking_trend') {
        actionType = 'rapid_response';
      } else if (alert.alert_type === 'sentiment_shift') {
        actionType = 'strategic_message';
      } else if (alert.alert_type === 'cross_source_breakthrough') {
        actionType = 'multi_channel';
      }

      suggestedActions.push({
        alert_id: alert.id,
        organization_id: alert.organization_id,
        action_type: actionType,
        suggested_copy: suggestion,
        topic: alert.entity_name,
        topic_relevance_score: Math.round(topicRelevance),
        urgency_score: Math.round(urgencyScore),
      });

      // Update alert with suggested action preview
      if (suggestion !== alert.suggested_action) {
        await supabase
          .from('client_entity_alerts')
          .update({ suggested_action: suggestion.substring(0, 500) })
          .eq('id', alert.id);
      }
    }

    console.log(`📝 Generated ${suggestedActions.length} suggested actions (${aiGeneratedCount} AI-powered)`);

    // Insert suggested actions
    if (suggestedActions.length > 0) {
      const { error: insertError } = await supabase
        .from('suggested_actions')
        .insert(suggestedActions);

      if (insertError && !insertError.message.includes('duplicate')) {
        console.error('Error inserting suggested actions:', insertError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        actionsGenerated: suggestedActions.length,
        aiGeneratedCount,
        alertsProcessed: alerts?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error generating suggested actions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
