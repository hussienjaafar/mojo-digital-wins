/**
 * React Query mutations for recording org feedback events
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { orgProfileKeys } from "./useOrgProfileQuery";

// ============================================================================
// Types
// ============================================================================

export type FeedbackEventType = 
  | 'viewed' 
  | 'copied' 
  | 'used' 
  | 'dismissed' 
  | 'completed' 
  | 'relevant_feedback' 
  | 'irrelevant_feedback'
  | 'muted_topic'
  | 'muted_entity';

export type FeedbackObjectType = 'opportunity' | 'suggested_action';

export interface RecordFeedbackInput {
  event_type: FeedbackEventType;
  object_type: FeedbackObjectType;
  object_id: string;
  entity_name?: string;
  topic_tags?: string[];
  relevance_score_at_time?: number;
  urgency_score_at_time?: number;
}

// ============================================================================
// Hook: Record Feedback Event
// ============================================================================

export function useRecordFeedback(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecordFeedbackInput) => {
      if (!organizationId) throw new Error('No organization ID');

      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const { error } = await supabase
        .from('org_feedback_events')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          event_type: input.event_type,
          object_type: input.object_type,
          object_id: input.object_id,
          entity_name: input.entity_name,
          topic_tags: input.topic_tags || [],
          relevance_score_at_time: input.relevance_score_at_time,
          urgency_score_at_time: input.urgency_score_at_time,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      // Optionally invalidate profile to show feedback was recorded
      // We don't need to refetch immediately since learning happens nightly
    },
  });
}

// ============================================================================
// Hook: Record Relevant Feedback (thumbs up)
// ============================================================================

export function useRecordRelevantFeedback(organizationId: string | undefined) {
  const recordFeedback = useRecordFeedback(organizationId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      objectType,
      objectId,
      entityName,
      topicTags,
      relevanceScore,
    }: {
      objectType: FeedbackObjectType;
      objectId: string;
      entityName?: string;
      topicTags?: string[];
      relevanceScore?: number;
    }) => {
      await recordFeedback.mutateAsync({
        event_type: 'relevant_feedback',
        object_type: objectType,
        object_id: objectId,
        entity_name: entityName,
        topic_tags: topicTags,
        relevance_score_at_time: relevanceScore,
      });
    },
  });
}

// ============================================================================
// Hook: Record Irrelevant Feedback (thumbs down)
// ============================================================================

export function useRecordIrrelevantFeedback(organizationId: string | undefined) {
  const recordFeedback = useRecordFeedback(organizationId);

  return useMutation({
    mutationFn: async ({
      objectType,
      objectId,
      entityName,
      topicTags,
      relevanceScore,
    }: {
      objectType: FeedbackObjectType;
      objectId: string;
      entityName?: string;
      topicTags?: string[];
      relevanceScore?: number;
    }) => {
      await recordFeedback.mutateAsync({
        event_type: 'irrelevant_feedback',
        object_type: objectType,
        object_id: objectId,
        entity_name: entityName,
        topic_tags: topicTags,
        relevance_score_at_time: relevanceScore,
      });
    },
  });
}

// ============================================================================
// Hook: Mute Topic
// ============================================================================

export function useMuteTopic(organizationId: string | undefined) {
  const recordFeedback = useRecordFeedback(organizationId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      objectType,
      objectId,
      topic,
    }: {
      objectType: FeedbackObjectType;
      objectId: string;
      topic: string;
    }) => {
      // Record the feedback event
      await recordFeedback.mutateAsync({
        event_type: 'muted_topic',
        object_type: objectType,
        object_id: objectId,
        topic_tags: [topic],
      });

      // Add topic to deny list (or set weight to 0)
      const { error } = await supabase
        .from('org_interest_topics')
        .upsert({
          organization_id: organizationId,
          topic: topic,
          weight: 0,
          source: 'learned_implicit',
        }, {
          onConflict: 'organization_id,topic',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgProfileKeys.full(organizationId!) });
    },
  });
}

// ============================================================================
// Hook: Mute Entity
// ============================================================================

export function useMuteEntity(organizationId: string | undefined) {
  const recordFeedback = useRecordFeedback(organizationId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      objectType,
      objectId,
      entityName,
    }: {
      objectType: FeedbackObjectType;
      objectId: string;
      entityName: string;
    }) => {
      // Record the feedback event
      await recordFeedback.mutateAsync({
        event_type: 'muted_entity',
        object_type: objectType,
        object_id: objectId,
        entity_name: entityName,
      });

      // Add entity to deny list
      const { error } = await supabase
        .from('org_interest_entities')
        .upsert({
          organization_id: organizationId,
          entity_name: entityName,
          rule_type: 'deny',
          reason: 'Muted by user feedback',
        }, {
          onConflict: 'organization_id,entity_name',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgProfileKeys.full(organizationId!) });
    },
  });
}
