import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// Types
// ============================================================================

export type ChannelType = "meta" | "sms" | "email" | "organic" | "direct" | "other";

export interface RefcodePerformance {
  refcode: string;
  channel: ChannelType;
  donationCount: number;
  uniqueDonors: number;
  totalRevenue: number;
  avgGift: number;
  recurringCount: number;
  recurringRate: number;
}

export interface ChannelSummary {
  channel: ChannelType;
  label: string;
  donationCount: number;
  uniqueDonors: number;
  totalRevenue: number;
  avgGift: number;
  refcodeCount: number;
}

export interface RefcodePerformanceData {
  refcodes: RefcodePerformance[];
  channels: ChannelSummary[];
  retention: {
    totalDonors: number;
    repeatDonors: number;
    recurringDonors: number;
    repeatRate: number;
    recurringRate: number;
  };
  topRefcodesByLTV: RefcodePerformance[];
}

// ============================================================================
// Channel Inference (fallback only)
// ============================================================================

export function inferChannel(refcode: string | null): ChannelType {
  if (!refcode) return "other";
  const lower = refcode.toLowerCase();
  if (lower.startsWith("meta_") || lower.startsWith("fb_") || lower.startsWith("jp") || lower.startsWith("th")) return "meta";
  if (lower.includes("sms")) return "sms";
  if (lower.includes("email") || lower.includes("eoy") || lower.includes("newsletter")) return "email";
  if (lower === "organic" || lower === "direct") return "organic";
  return "other";
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  meta: "Meta Ads",
  sms: "SMS",
  email: "Email",
  organic: "Organic",
  direct: "Direct",
  other: "Other",
};

// ============================================================================
// Query Keys
// ============================================================================

export const refcodePerformanceKeys = {
  all: ["refcodePerformance"] as const,
  byOrg: (orgId: string) => [...refcodePerformanceKeys.all, orgId] as const,
};

// ============================================================================
// Fetch Function (uses server-side RPC)
// ============================================================================

async function fetchRefcodePerformance(organizationId: string): Promise<RefcodePerformanceData> {
  const { data, error } = await supabase.rpc("get_refcode_channel_performance", {
    p_organization_id: organizationId,
  });

  if (error) throw error;

  const result = data as {
    refcodes: RefcodePerformance[];
    channels: ChannelSummary[];
    retention: {
      totalDonors: number;
      repeatDonors: number;
      recurringDonors: number;
      repeatRate: number;
      recurringRate: number;
    };
  };

  // Top refcodes by recurring rate (proxy for LTV)
  const topRefcodesByLTV = [...result.refcodes]
    .filter(r => r.uniqueDonors >= 5)
    .sort((a, b) => b.recurringRate - a.recurringRate)
    .slice(0, 5);

  return {
    refcodes: result.refcodes,
    channels: result.channels,
    retention: result.retention,
    topRefcodesByLTV,
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useRefcodePerformance(organizationId: string | undefined) {
  return useQuery({
    queryKey: refcodePerformanceKeys.byOrg(organizationId || ""),
    queryFn: () => fetchRefcodePerformance(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });
}
