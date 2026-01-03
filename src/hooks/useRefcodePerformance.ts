import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// Types
// ============================================================================

export type ChannelType = "meta" | "sms" | "email" | "organic" | "direct";

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

export interface RetentionCohort {
  acquisitionMonth: string;
  totalDonors: number;
  repeatDonors: number;
  recurringDonors: number;
  repeatRate: number;
  recurringRate: number;
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
// Channel Inference
// ============================================================================

export function inferChannel(refcode: string | null): ChannelType {
  if (!refcode) return "direct";
  
  const lower = refcode.toLowerCase();
  
  // Meta/Facebook patterns
  if (lower.startsWith("meta_") || lower.startsWith("fb_") || 
      lower.startsWith("jp") || lower.startsWith("th")) {
    return "meta";
  }
  
  // SMS patterns
  if (lower.includes("sms")) {
    return "sms";
  }
  
  // Email patterns
  if (lower.includes("email") || lower.includes("eoy") || lower.includes("newsletter")) {
    return "email";
  }
  
  // Organic
  if (lower === "organic" || lower === "direct") {
    return "organic";
  }
  
  // Default to direct if unknown pattern
  return "direct";
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  meta: "Meta Ads",
  sms: "SMS",
  email: "Email",
  organic: "Organic",
  direct: "Direct/Other",
};

// ============================================================================
// Query Keys
// ============================================================================

export const refcodePerformanceKeys = {
  all: ["refcodePerformance"] as const,
  byOrg: (orgId: string) => [...refcodePerformanceKeys.all, orgId] as const,
};

// ============================================================================
// Fetch Function
// ============================================================================

async function fetchRefcodePerformance(organizationId: string): Promise<RefcodePerformanceData> {
  // Get refcode performance data
  const { data: refcodeData, error: refcodeError } = await supabase
    .from("actblue_transactions")
    .select("refcode, donor_email, amount, is_recurring")
    .eq("organization_id", organizationId)
    .neq("transaction_type", "refund");

  if (refcodeError) {
    throw refcodeError;
  }

  const transactions = refcodeData || [];

  // Aggregate by refcode
  const refcodeMap = new Map<string, {
    donationCount: number;
    donors: Set<string>;
    totalRevenue: number;
    recurringCount: number;
  }>();

  for (const t of transactions) {
    const refcode = t.refcode || "(no refcode)";
    
    if (!refcodeMap.has(refcode)) {
      refcodeMap.set(refcode, {
        donationCount: 0,
        donors: new Set(),
        totalRevenue: 0,
        recurringCount: 0,
      });
    }
    
    const entry = refcodeMap.get(refcode)!;
    entry.donationCount++;
    if (t.donor_email) entry.donors.add(t.donor_email);
    entry.totalRevenue += Number(t.amount || 0);
    if (t.is_recurring) entry.recurringCount++;
  }

  // Convert to array
  const refcodes: RefcodePerformance[] = Array.from(refcodeMap.entries())
    .map(([refcode, data]) => ({
      refcode,
      channel: inferChannel(refcode === "(no refcode)" ? null : refcode),
      donationCount: data.donationCount,
      uniqueDonors: data.donors.size,
      totalRevenue: data.totalRevenue,
      avgGift: data.donationCount > 0 ? data.totalRevenue / data.donationCount : 0,
      recurringCount: data.recurringCount,
      recurringRate: data.donationCount > 0 ? (data.recurringCount / data.donationCount) * 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Aggregate by channel
  const channelMap = new Map<ChannelType, {
    donationCount: number;
    donors: Set<string>;
    totalRevenue: number;
    refcodeCount: number;
  }>();

  for (const t of transactions) {
    const channel = inferChannel(t.refcode);
    
    if (!channelMap.has(channel)) {
      channelMap.set(channel, {
        donationCount: 0,
        donors: new Set(),
        totalRevenue: 0,
        refcodeCount: 0,
      });
    }
    
    const entry = channelMap.get(channel)!;
    entry.donationCount++;
    if (t.donor_email) entry.donors.add(t.donor_email);
    entry.totalRevenue += Number(t.amount || 0);
  }

  // Count refcodes per channel
  for (const ref of refcodes) {
    const entry = channelMap.get(ref.channel);
    if (entry) entry.refcodeCount++;
  }

  const channels: ChannelSummary[] = Array.from(channelMap.entries())
    .map(([channel, data]) => ({
      channel,
      label: CHANNEL_LABELS[channel],
      donationCount: data.donationCount,
      uniqueDonors: data.donors.size,
      totalRevenue: data.totalRevenue,
      avgGift: data.donationCount > 0 ? data.totalRevenue / data.donationCount : 0,
      refcodeCount: data.refcodeCount,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Calculate overall retention metrics
  const allDonors = new Set<string>();
  const repeatDonors = new Set<string>();
  const recurringDonors = new Set<string>();
  const donorDonationCounts = new Map<string, number>();

  for (const t of transactions) {
    if (!t.donor_email) continue;
    
    allDonors.add(t.donor_email);
    donorDonationCounts.set(
      t.donor_email,
      (donorDonationCounts.get(t.donor_email) || 0) + 1
    );
    
    if (t.is_recurring) {
      recurringDonors.add(t.donor_email);
    }
  }

  for (const [email, count] of donorDonationCounts) {
    if (count > 1) {
      repeatDonors.add(email);
    }
  }

  const totalDonorsCount = allDonors.size;
  const repeatDonorsCount = repeatDonors.size;
  const recurringDonorsCount = recurringDonors.size;

  // Top refcodes by recurring rate (proxy for LTV)
  const topRefcodesByLTV = [...refcodes]
    .filter(r => r.uniqueDonors >= 5) // Minimum sample size
    .sort((a, b) => b.recurringRate - a.recurringRate)
    .slice(0, 5);

  return {
    refcodes,
    channels,
    retention: {
      totalDonors: totalDonorsCount,
      repeatDonors: repeatDonorsCount,
      recurringDonors: recurringDonorsCount,
      repeatRate: totalDonorsCount > 0 ? (repeatDonorsCount / totalDonorsCount) * 100 : 0,
      recurringRate: totalDonorsCount > 0 ? (recurringDonorsCount / totalDonorsCount) * 100 : 0,
    },
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
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
