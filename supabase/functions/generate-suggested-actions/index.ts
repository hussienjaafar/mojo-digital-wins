import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SMS Compliance: Required opt-out language
const OPT_OUT_TEXT = "\n\nReply STOP to unsubscribe.";
const MAX_SMS_LENGTH = 160;
const MAX_COPY_LENGTH = MAX_SMS_LENGTH - OPT_OUT_TEXT.length; // ~130 chars for content

// Generate fallback suggestion without AI - includes SMS compliance
function generateFallbackSuggestion(alert: any, orgProfile: any): string {
  const { entity_name, alert_type, velocity, current_mentions, severity } = alert;
  
  let baseCopy = '';
  
  if (alert_type === 'trending_spike' || alert_type === 'breaking_trend') {
    baseCopy = `${entity_name} is trending now! Join us in taking action. Your support matters.`;
  } else if (alert_type === 'sentiment_shift') {
    baseCopy = `Important update on ${entity_name}. Stay informed and stand with us.`;
  } else if (alert_type === 'cross_source_breakthrough') {
    baseCopy = `${entity_name} is making waves. Now is the time to make your voice heard.`;
  } else if (severity === 'critical') {
    baseCopy = `URGENT: ${entity_name} needs immediate attention. Act now to make a difference.`;
  } else {
    baseCopy = `${entity_name} update: Your support can make an impact. Join us today.`;
  }
  
  // Truncate to fit SMS limit with opt-out
  if (baseCopy.length > MAX_COPY_LENGTH) {
    baseCopy = baseCopy.substring(0, MAX_COPY_LENGTH - 3) + '...';
  }
  
  return baseCopy + OPT_OUT_TEXT;
}

// Map alert type to action type
function mapAlertToActionType(alertType: string): string {
  switch (alertType) {
    case 'trending_spike':
    case 'breaking_trend':
      return 'rapid_response';
    case 'sentiment_shift':
      return 'strategic_message';
    case 'cross_source_breakthrough':
      return 'multi_channel';
    default:
      return 'monitoring';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Create audit record at START (fail-safe pattern)
  const auditData = {
    organization_id: null as string | null,
    started_at: new Date().toISOString(),
    finished_at: null as string | null,
    alerts_processed: 0,
    actions_created: 0,
    ai_generated_count: 0,
    template_generated_count: 0,
    skipped_count: 0,
    error_count: 0,
    errors: [] as any[],
    metadata: { version: '2.0.0', trigger: 'scheduled' },
  };

  const { data: auditRun, error: auditCreateError } = await supabase
    .from('action_generator_runs')
    .insert(auditData)
    .select('id')
    .single();

  if (auditCreateError) {
    console.error('Failed to create audit record:', auditCreateError);
  }

  const auditId = auditRun?.id;
  const errors: any[] = [];

  try {
    console.log('🎯 Generating suggested actions for high-score alerts...');

    // Get high-scoring actionable alerts from last 24h
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
      .limit(30);

    if (alertsError) {
      errors.push({ phase: 'fetch_alerts', error: alertsError.message });
      throw alertsError;
    }

    auditData.alerts_processed = alerts?.length || 0;
    console.log(`📋 Processing ${alerts?.length || 0} high-score alerts`);

    if (!alerts || alerts.length === 0) {
      if (auditId) {
        await supabase
          .from('action_generator_runs')
          .update({
            finished_at: new Date().toISOString(),
            alerts_processed: 0,
            metadata: { ...auditData.metadata, message: 'No actionable alerts found' },
          })
          .eq('id', auditId);
      }
      return new Response(
        JSON.stringify({ success: true, actionsGenerated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organization profiles for context
    const orgIds = [...new Set(alerts.map(a => a.organization_id).filter(Boolean))];
    const { data: orgProfiles } = await supabase
      .from('organization_profiles')
      .select('organization_id, mission, focus_areas, key_issues')
      .in('organization_id', orgIds);

    const profileMap = new Map(
      (orgProfiles || []).map(p => [p.organization_id, p])
    );

    const suggestedActions = [];
    let aiGeneratedCount = 0;
    let templateGeneratedCount = 0;
    let skippedCount = 0;

    for (const alert of alerts) {
      try {
        const orgProfile = profileMap.get(alert.organization_id);
        
        let suggestion = null;
        let generationMethod = 'template';
        
        // Try AI generation for high-score alerts (>= 70)
        if (lovableApiKey && alert.actionable_score >= 70) {
          try {
            const prompt = `Generate a brief SMS message (under 130 characters) for a nonprofit organization.

Context:
- Topic: ${alert.entity_name}
- Alert type: ${alert.alert_type}
- Mentions (24h): ${alert.current_mentions || 'Unknown'}
- Urgency: ${alert.severity}
${orgProfile?.mission ? `- Organization mission: ${orgProfile.mission}` : ''}

Requirements:
- Keep under 130 characters (opt-out text will be added)
- Be actionable and urgent
- Include a clear call to action
- Do NOT include opt-out language (it will be added automatically)

Generate only the SMS text, nothing else.`;

            const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  { role: 'system', content: 'You are an expert political communications copywriter. Generate concise, compliant SMS messages.' },
                  { role: 'user', content: prompt }
                ],
                max_tokens: 100,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              let aiCopy = data.choices?.[0]?.message?.content?.trim();
              
              if (aiCopy) {
                // Truncate if needed and add opt-out
                if (aiCopy.length > MAX_COPY_LENGTH) {
                  aiCopy = aiCopy.substring(0, MAX_COPY_LENGTH - 3) + '...';
                }
                suggestion = aiCopy + OPT_OUT_TEXT;
                generationMethod = 'ai';
                aiGeneratedCount++;
                console.log(`🤖 AI-generated suggestion for ${alert.entity_name}`);
              }
            } else if (response.status === 429) {
              console.warn('Rate limited, using fallback');
            } else if (response.status === 402) {
              console.warn('Payment required, using fallback');
            } else {
              console.warn(`AI API error: ${response.status}`);
            }
          } catch (aiError: any) {
            console.error('AI suggestion error:', aiError);
            errors.push({ phase: 'ai_generation', alert_id: alert.id, error: aiError.message });
          }
        }

        // Use fallback if no AI suggestion
        if (!suggestion) {
          suggestion = generateFallbackSuggestion(alert, orgProfile);
          generationMethod = 'template';
          templateGeneratedCount++;
        }

        // Calculate scores
        const topicRelevance = Math.min(alert.actionable_score || 50, 100);
        const urgencyScore = Math.min(
          ((alert.velocity || 0) / 5) + ((alert.current_mentions || 0) / 2) + 
          (alert.severity === 'critical' ? 30 : alert.severity === 'high' ? 20 : 10),
          100
        );

        const actionType = mapAlertToActionType(alert.alert_type);

        // Prepare action record with all required fields
        suggestedActions.push({
          alert_id: alert.id,
          organization_id: alert.organization_id,
          action_type: actionType,
          entity_name: alert.entity_name,
          suggested_copy: suggestion,
          topic_relevance: Math.round(topicRelevance),
          urgency_score: Math.round(urgencyScore),
          value_prop: `Trending with ${alert.velocity?.toFixed(0) || 0}% velocity increase`,
          audience_segment: 'Active supporters',
          status: 'pending',
          is_used: false,
          is_dismissed: false,
          generation_method: generationMethod,
          character_count: suggestion.length,
          estimated_impact: `${alert.current_mentions || 0} mentions, ${alert.severity} severity`,
        });

        // Update alert with suggested action preview
        if (suggestion !== alert.suggested_action) {
          await supabase
            .from('client_entity_alerts')
            .update({ suggested_action: suggestion.substring(0, 500) })
            .eq('id', alert.id);
        }
      } catch (alertError: any) {
        console.error(`Error processing alert ${alert.id}:`, alertError);
        errors.push({ phase: 'process_alert', alert_id: alert.id, error: alertError.message });
        skippedCount++;
      }
    }

    console.log(`📝 Generated ${suggestedActions.length} suggested actions (${aiGeneratedCount} AI, ${templateGeneratedCount} template)`);

    // Insert suggested actions with UPSERT
    let actionsCreated = 0;
    if (suggestedActions.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from('suggested_actions')
        .upsert(suggestedActions, {
          onConflict: 'organization_id,alert_id',
          ignoreDuplicates: false,
        })
        .select('id');

      if (insertError) {
        console.error('Error inserting suggested actions:', insertError);
        errors.push({ phase: 'insert_actions', error: insertError.message });
      } else {
        actionsCreated = insertedData?.length || suggestedActions.length;
        console.log(`✅ Inserted/updated ${actionsCreated} suggested actions`);
      }
    }

    // Finalize audit record
    if (auditId) {
      await supabase
        .from('action_generator_runs')
        .update({
          finished_at: new Date().toISOString(),
          alerts_processed: alerts?.length || 0,
          actions_created: actionsCreated,
          ai_generated_count: aiGeneratedCount,
          template_generated_count: templateGeneratedCount,
          skipped_count: skippedCount,
          error_count: errors.length,
          errors: errors.length > 0 ? errors : null,
          metadata: { ...auditData.metadata, success: true },
        })
        .eq('id', auditId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        actionsGenerated: actionsCreated,
        aiGeneratedCount,
        templateGeneratedCount,
        alertsProcessed: alerts?.length || 0,
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error generating suggested actions:', error);
    errors.push({ phase: 'main', error: error.message });

    // Finalize audit record with error
    if (auditId) {
      await supabase
        .from('action_generator_runs')
        .update({
          finished_at: new Date().toISOString(),
          error_count: errors.length,
          errors: errors,
          metadata: { ...auditData.metadata, success: false, fatal_error: error.message },
        })
        .eq('id', auditId);
    }

    return new Response(
      JSON.stringify({ error: error.message, errors }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
