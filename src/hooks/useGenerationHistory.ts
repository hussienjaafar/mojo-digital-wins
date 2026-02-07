/**
 * useGenerationHistory - Fetches past ad copy generations for an organization
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GenerationHistoryItem {
  id: string;
  generated_at: string | null;
  actblue_form_name: string;
  refcode: string;
  audience_segments: Array<{ id: string; name: string; description: string }>;
  generated_copy: Record<string, {
    primary_texts: string[];
    headlines: string[];
    descriptions: string[];
  }> | null;
  meta_ready_copy: Record<string, unknown> | null;
  tracking_url: string | null;
  generation_model: string | null;
  generation_prompt_version: string | null;
  recurring_default: boolean | null;
  amount_preset: number | null;
  video_name: string | null;
}

export interface GenerationCounts {
  [organizationId: string]: number;
}

export function useGenerationHistory(organizationId: string | null) {
  const [generations, setGenerations] = useState<GenerationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGenerations = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch generations with video name via join
      const { data, error: fetchError } = await (supabase as any)
        .from('ad_copy_generations')
        .select(`
          id, generated_at, actblue_form_name, refcode,
          audience_segments, generated_copy, meta_ready_copy,
          tracking_url, generation_model, generation_prompt_version,
          recurring_default, amount_preset,
          meta_ad_videos!ad_copy_generations_video_ref_fkey ( original_filename )
        `)
        .eq('organization_id', organizationId)
        .not('generated_copy', 'is', null)
        .order('generated_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      const mapped: GenerationHistoryItem[] = (data || []).map((row: any) => ({
        id: row.id,
        generated_at: row.generated_at,
        actblue_form_name: row.actblue_form_name,
        refcode: row.refcode,
        audience_segments: Array.isArray(row.audience_segments) ? row.audience_segments : [],
        generated_copy: row.generated_copy,
        meta_ready_copy: row.meta_ready_copy,
        tracking_url: row.tracking_url,
        generation_model: row.generation_model,
        generation_prompt_version: row.generation_prompt_version,
        recurring_default: row.recurring_default,
        amount_preset: row.amount_preset,
        video_name: row.meta_ad_videos?.original_filename || null,
      }));

      setGenerations(mapped);
    } catch (err: any) {
      console.error('[useGenerationHistory] Error:', err);
      setError(err.message || 'Failed to load generation history');
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  return { generations, isLoading, error, refetch: fetchGenerations };
}

export function useGenerationCounts(organizationIds: string[]) {
  const [counts, setCounts] = useState<GenerationCounts>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (organizationIds.length === 0) return;

    let isMounted = true;
    setIsLoading(true);

    const fetchCounts = async () => {
      try {
        // Use RPC or raw query - supabase JS doesn't support GROUP BY natively
        // So we fetch all org_ids and count client-side (limited to orgs we care about)
        const { data, error } = await (supabase as any)
          .from('ad_copy_generations')
          .select('organization_id')
          .in('organization_id', organizationIds)
          .not('generated_copy', 'is', null);

        if (error) throw error;

        const countMap: GenerationCounts = {};
        (data || []).forEach((row: { organization_id: string }) => {
          countMap[row.organization_id] = (countMap[row.organization_id] || 0) + 1;
        });

        if (isMounted) setCounts(countMap);
      } catch (err) {
        console.error('[useGenerationCounts] Error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCounts();
    return () => { isMounted = false; };
  }, [organizationIds.join(',')]);

  return { counts, isLoading };
}
