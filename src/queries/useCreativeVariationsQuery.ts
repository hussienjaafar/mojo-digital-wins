import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CreativeVariation } from "@/components/client/CreativeVariationTable";

export const variationKeys = {
  all: ["creative-variations"] as const,
  byOrg: (orgId: string) => [...variationKeys.all, "org", orgId] as const,
  byAd: (adId: string) => [...variationKeys.all, "ad", adId] as const,
};

async function fetchVariationsByOrg(organizationId: string): Promise<CreativeVariation[]> {
  const { data, error } = await supabase
    .from("meta_creative_variations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("roas", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Error fetching creative variations:", error);
    throw error;
  }

  return (data || []) as CreativeVariation[];
}

async function fetchVariationsByAd(adId: string): Promise<CreativeVariation[]> {
  const { data, error } = await supabase
    .from("meta_creative_variations")
    .select("*")
    .eq("ad_id", adId)
    .order("asset_type")
    .order("roas", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Error fetching creative variations for ad:", error);
    throw error;
  }

  return (data || []) as CreativeVariation[];
}

export function useCreativeVariationsQuery(organizationId: string | undefined) {
  return useQuery({
    queryKey: variationKeys.byOrg(organizationId || ""),
    queryFn: () => fetchVariationsByOrg(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAdVariationsQuery(adId: string | undefined) {
  return useQuery({
    queryKey: variationKeys.byAd(adId || ""),
    queryFn: () => fetchVariationsByAd(adId!),
    enabled: !!adId,
    staleTime: 5 * 60 * 1000,
  });
}
