import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CAPIStatus {
  isConfigured: boolean;
  isEnabled: boolean;
  pixelId: string | null;
}

export function useCAPIStatus(organizationId: string | null) {
  return useQuery({
    queryKey: ['capi-status', organizationId],
    queryFn: async (): Promise<CAPIStatus> => {
      if (!organizationId) {
        return { isConfigured: false, isEnabled: false, pixelId: null };
      }
      
      const { data, error } = await (supabase as any)
        .from('meta_capi_config')
        .select('is_enabled, pixel_id')
        .eq('organization_id', organizationId)
        .maybeSingle();
      
      if (error || !data) {
        return { isConfigured: false, isEnabled: false, pixelId: null };
      }
      
      return {
        isConfigured: true,
        isEnabled: data.is_enabled,
        pixelId: data.pixel_id,
      };
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
