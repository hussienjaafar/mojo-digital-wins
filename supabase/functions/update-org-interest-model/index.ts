import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Update Org Interest Model
 * 
 * Nightly job that aggregates feedback events and adjusts topic weights.
 * Learning signals:
 * - used/completed: +0.05 weight
 * - copied: +0.02 weight
 * - relevant_feedback: +0.03 weight
 * - dismissed/irrelevant_feedback: -0.03 weight
 * - muted_topic/muted_entity: -0.1 weight (strong signal)
 * 
 * Time decay: events older than 14 days have 50% weight
 */

interface FeedbackEvent {
  id: string;
  organization_id: string;
  event_type: string;
  entity_name: string | null;
  topic_tags: string[];
  created_at: string;
}

interface TopicAdjustment {
  topic: string;
  delta: number;
  eventCount: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Create audit record
  const auditData = {
    started_at: new Date().toISOString(),
    finished_at: null as string | null,
    orgs_processed: 0,
    topics_updated: 0,
    feedback_events_processed: 0,
    error_count: 0,
    errors: [] as any[],
    metadata: { version: '1.0.0' },
  };

  const { data: auditRun, error: auditCreateError } = await supabase
    .from('org_interest_model_runs')
    .insert(auditData)
    .select('id')
    .single();

  if (auditCreateError) {
    console.error('Failed to create audit record:', auditCreateError);
  }

  const auditId = auditRun?.id;
  const errors: any[] = [];

  try {
    console.log('🧠 Running org interest model update...');

    // Get feedback events from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: feedbackEvents, error: feedbackError } = await supabase
      .from('org_feedback_events')
      .select('*')
      .gte('created_at', thirtyDaysAgo)
      .order('organization_id');

    if (feedbackError) {
      errors.push({ phase: 'fetch_feedback', error: feedbackError.message });
      throw feedbackError;
    }

    if (!feedbackEvents || feedbackEvents.length === 0) {
      console.log('No feedback events to process');
      if (auditId) {
        await supabase
          .from('org_interest_model_runs')
          .update({
            finished_at: new Date().toISOString(),
            metadata: { ...auditData.metadata, message: 'No feedback events' },
          })
          .eq('id', auditId);
      }
      return new Response(
        JSON.stringify({ success: true, message: 'No feedback events to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    auditData.feedback_events_processed = feedbackEvents.length;
    console.log(`📊 Processing ${feedbackEvents.length} feedback events`);

    // Group events by org
    const eventsByOrg = new Map<string, FeedbackEvent[]>();
    for (const event of feedbackEvents) {
      const existing = eventsByOrg.get(event.organization_id) || [];
      existing.push(event);
      eventsByOrg.set(event.organization_id, existing);
    }

    auditData.orgs_processed = eventsByOrg.size;
    let topicsUpdated = 0;

    // Weight adjustments by event type
    const eventWeights: Record<string, number> = {
      'used': 0.05,
      'completed': 0.05,
      'copied': 0.02,
      'relevant_feedback': 0.03,
      'dismissed': -0.03,
      'irrelevant_feedback': -0.03,
      'muted_topic': -0.1,
      'muted_entity': -0.1,
      'viewed': 0, // No weight change for views
    };

    // Process each org
    for (const [orgId, events] of eventsByOrg) {
      try {
        // Calculate topic adjustments
        const topicAdjustments = new Map<string, TopicAdjustment>();
        const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

        for (const event of events) {
          const baseWeight = eventWeights[event.event_type] || 0;
          if (baseWeight === 0) continue;

          // Apply time decay (50% weight for events older than 14 days)
          const eventTime = new Date(event.created_at).getTime();
          const timeMultiplier = eventTime < fourteenDaysAgo ? 0.5 : 1;
          const adjustedWeight = baseWeight * timeMultiplier;

          // Apply to all topic tags
          const topics = event.topic_tags || [];
          if (event.entity_name) {
            topics.push(event.entity_name.toLowerCase());
          }

          for (const topic of topics) {
            const existing = topicAdjustments.get(topic) || { topic, delta: 0, eventCount: 0 };
            existing.delta += adjustedWeight;
            existing.eventCount++;
            topicAdjustments.set(topic, existing);
          }
        }

        // Fetch current topic weights
        const { data: currentTopics, error: topicsError } = await supabase
          .from('org_interest_topics')
          .select('*')
          .eq('organization_id', orgId);

        if (topicsError) {
          errors.push({ phase: 'fetch_topics', org: orgId, error: topicsError.message });
          continue;
        }

        const currentTopicMap = new Map(
          (currentTopics || []).map(t => [t.topic.toLowerCase(), t])
        );

        // Apply adjustments
        for (const [topic, adjustment] of topicAdjustments) {
          const existing = currentTopicMap.get(topic);
          
          if (existing) {
            // Update existing topic
            let newWeight = existing.weight + adjustment.delta;
            // Clamp to [0.1, 1.0]
            newWeight = Math.max(0.1, Math.min(1.0, newWeight));

            // Only update if weight changed significantly
            if (Math.abs(newWeight - existing.weight) >= 0.01) {
              const { error: updateError } = await supabase
                .from('org_interest_topics')
                .update({
                  weight: newWeight,
                  source: 'learned_implicit',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

              if (updateError) {
                errors.push({ phase: 'update_topic', topic, org: orgId, error: updateError.message });
              } else {
                topicsUpdated++;
                console.log(`📈 ${orgId}: ${topic} weight ${existing.weight.toFixed(2)} → ${newWeight.toFixed(2)}`);
              }
            }
          } else if (adjustment.delta > 0 && adjustment.eventCount >= 2) {
            // Create new topic if positive signal and multiple events
            const initialWeight = Math.min(0.3 + adjustment.delta, 0.7);
            
            const { error: insertError } = await supabase
              .from('org_interest_topics')
              .insert({
                organization_id: orgId,
                topic: topic,
                weight: initialWeight,
                source: 'learned_implicit',
              });

            if (insertError && !insertError.message.includes('duplicate')) {
              errors.push({ phase: 'insert_topic', topic, org: orgId, error: insertError.message });
            } else if (!insertError) {
              topicsUpdated++;
              console.log(`➕ ${orgId}: Added new topic "${topic}" (weight: ${initialWeight.toFixed(2)})`);
            }
          }
        }
      } catch (orgError: any) {
        console.error(`Error processing org ${orgId}:`, orgError);
        errors.push({ phase: 'process_org', org: orgId, error: orgError.message });
      }
    }

    auditData.topics_updated = topicsUpdated;
    console.log(`✨ Interest model update complete. Orgs: ${eventsByOrg.size}, Topics updated: ${topicsUpdated}`);

    // Finalize audit
    if (auditId) {
      await supabase
        .from('org_interest_model_runs')
        .update({
          finished_at: new Date().toISOString(),
          orgs_processed: eventsByOrg.size,
          topics_updated: topicsUpdated,
          feedback_events_processed: feedbackEvents.length,
          error_count: errors.length,
          errors: errors.length > 0 ? errors : null,
          metadata: { ...auditData.metadata, success: true },
        })
        .eq('id', auditId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        orgs_processed: eventsByOrg.size,
        topics_updated: topicsUpdated,
        feedback_events_processed: feedbackEvents.length,
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in update-org-interest-model:', error);
    errors.push({ phase: 'main', error: error.message });

    if (auditId) {
      await supabase
        .from('org_interest_model_runs')
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