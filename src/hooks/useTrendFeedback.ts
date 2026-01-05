import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type FeedbackType = 'relevant' | 'not_relevant' | 'follow_up';

interface TrendFeedback {
  id: string;
  trend_id: string;
  user_id: string;
  organization_id: string | null;
  feedback_type: FeedbackType;
  notes: string | null;
  created_at: string;
}

interface UseTrendFeedbackOptions {
  trendId?: string;
}

export function useTrendFeedback({ trendId }: UseTrendFeedbackOptions = {}) {
  const queryClient = useQueryClient();

  // Fetch feedback for a specific trend or all feedback for the user
  const { data: feedback, isLoading } = useQuery({
    queryKey: ['trend-feedback', trendId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      let query = supabase
        .from('trend_feedback')
        .select('*')
        .eq('user_id', user.id);

      if (trendId) {
        query = query.eq('trend_id', trendId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TrendFeedback[];
    },
    enabled: true,
  });

  // Submit feedback mutation
  const submitFeedbackMutation = useMutation({
    mutationFn: async ({ 
      trendId, 
      feedbackType, 
      notes,
      organizationId 
    }: { 
      trendId: string; 
      feedbackType: FeedbackType;
      notes?: string;
      organizationId?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if feedback already exists
      const { data: existing } = await supabase
        .from('trend_feedback')
        .select('id')
        .eq('trend_id', trendId)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        // Update existing feedback
        const { error } = await supabase
          .from('trend_feedback')
          .update({ 
            feedback_type: feedbackType,
            notes,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new feedback
        const { error } = await supabase
          .from('trend_feedback')
          .insert({
            trend_id: trendId,
            user_id: user.id,
            organization_id: organizationId || null,
            feedback_type: feedbackType,
            notes,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trend-feedback'] });
    },
    onError: (error) => {
      console.error('Failed to save feedback:', error);
      toast.error('Failed to save feedback');
    },
  });

  // Delete feedback mutation
  const deleteFeedbackMutation = useMutation({
    mutationFn: async (trendId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('trend_feedback')
        .delete()
        .eq('trend_id', trendId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trend-feedback'] });
    },
  });

  // Get feedback for a specific trend
  const getFeedbackForTrend = useCallback((trendId: string): FeedbackType | null => {
    if (!feedback) return null;
    const match = feedback.find(f => f.trend_id === trendId);
    return match?.feedback_type || null;
  }, [feedback]);

  // Get all follow-up trends
  const getFollowUpTrends = useCallback((): string[] => {
    if (!feedback) return [];
    return feedback
      .filter(f => f.feedback_type === 'follow_up')
      .map(f => f.trend_id);
  }, [feedback]);

  // Get all "not relevant" trends (for filtering)
  const getNotRelevantTrends = useCallback((): string[] => {
    if (!feedback) return [];
    return feedback
      .filter(f => f.feedback_type === 'not_relevant')
      .map(f => f.trend_id);
  }, [feedback]);

  return {
    feedback,
    isLoading,
    submitFeedback: submitFeedbackMutation.mutate,
    deleteFeedback: deleteFeedbackMutation.mutate,
    isSubmitting: submitFeedbackMutation.isPending,
    getFeedbackForTrend,
    getFollowUpTrends,
    getNotRelevantTrends,
  };
}
