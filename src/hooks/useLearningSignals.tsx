import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LearningSignal {
  id: string;
  signal_type: string;
  pattern_key: string;
  weight_adjustment: number;
  sample_count: number;
  last_calculated_at: string;
  metadata: Record<string, unknown>;
}

export interface ActionEffectiveness {
  trend_label: string;
  action_type: string;
  total_actions: number;
  successful_actions: number;
  success_rate: number;
  total_outcome_value: number;
  avg_outcome_value: number;
}

export function useLearningSignals() {
  return useQuery({
    queryKey: ['learning-signals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('learning_signals')
        .select('*')
        .order('weight_adjustment', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as LearningSignal[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useActionEffectiveness() {
  return useQuery({
    queryKey: ['action-effectiveness'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_effectiveness_summary')
        .select('*')
        .order('success_rate', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as ActionEffectiveness[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useSemanticClusters() {
  return useQuery({
    queryKey: ['semantic-clusters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trend_semantic_clusters')
        .select('*')
        .order('avg_confidence', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Helper to get learning weight for a pattern
export function getLearningWeight(
  signals: LearningSignal[],
  signalType: string,
  patternKey: string
): number {
  const signal = signals.find(
    s => s.signal_type === signalType && s.pattern_key === patternKey
  );
  return signal?.weight_adjustment || 0;
}

// Helper to determine if pattern has enough samples for confidence
export function hasConfidentSignal(
  signals: LearningSignal[],
  signalType: string,
  patternKey: string,
  minSamples = 10
): boolean {
  const signal = signals.find(
    s => s.signal_type === signalType && s.pattern_key === patternKey
  );
  return (signal?.sample_count || 0) >= minSamples;
}
