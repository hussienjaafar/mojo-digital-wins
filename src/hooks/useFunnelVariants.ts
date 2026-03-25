import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VariantContent {
  headline: string;
  subheadline: string | null;
  cta: string;
  body: Record<string, any> | null;
}

export type VariantMap = Record<string, VariantContent>;

export function useFunnelVariants(variant: string) {
  return useQuery<VariantMap>({
    queryKey: ['funnel-variants', variant],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_optimization')
        .select('step_key, headline_text, subheadline_text, cta_text, body_content')
        .eq('variant_label', variant)
        .eq('is_active', true);

      if (error) throw error;

      const map: VariantMap = {};
      for (const row of data || []) {
        map[(row as any).step_key] = {
          headline: (row as any).headline_text,
          subheadline: (row as any).subheadline_text,
          cta: (row as any).cta_text,
          body: (row as any).body_content,
        };
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
}
