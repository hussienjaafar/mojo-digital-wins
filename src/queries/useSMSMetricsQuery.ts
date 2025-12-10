import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { smsKeys } from "./queryKeys";
import { useDateRange } from "@/stores/dashboardStore";
import { format, subDays, parseISO } from "date-fns";

export interface SMSMetric {
  campaign_id: string;
  campaign_name: string;
  messages_sent: number;
  messages_delivered: number;
  messages_failed: number;
  opt_outs: number;
  clicks: number;
  conversions: number;
  amount_raised: number;
  cost: number;
  roi: number;
  delivery_rate: number;
  ctr: number;
  opt_out_rate: number;
}

export interface SMSDailyMetric {
  date: string;
  messages_sent: number;
  conversions: number;
  amount_raised: number;
}

export interface SMSMetricsResult {
  metrics: Record<string, SMSMetric>;
  dailyMetrics: SMSDailyMetric[];
  previousPeriodMetrics: Record<string, SMSMetric>;
  campaigns: SMSMetric[];
  previousCampaigns: SMSMetric[];
  totals: {
    sent: number;
    delivered: number;
    raised: number;
    cost: number;
    conversions: number;
    clicks: number;
    optOuts: number;
  };
  previousTotals: {
    sent: number;
    delivered: number;
    raised: number;
    cost: number;
    conversions: number;
  };
  lastSentDate: string | null;
}

function aggregateMetrics(data: any[]): Record<string, SMSMetric> {
  const aggregated: Record<string, SMSMetric> = {};
  data?.forEach((campaign) => {
    const id = campaign.campaign_id || campaign.id;
    if (!aggregated[id]) {
      aggregated[id] = {
        campaign_id: id,
        campaign_name: campaign.campaign_name || id,
        messages_sent: 0,
        messages_delivered: 0,
        messages_failed: 0,
        opt_outs: 0,
        clicks: 0,
        conversions: 0,
        amount_raised: 0,
        cost: 0,
        roi: 0,
        delivery_rate: 0,
        ctr: 0,
        opt_out_rate: 0,
      };
    }
    aggregated[id].messages_sent += campaign.messages_sent || 0;
    aggregated[id].messages_delivered += campaign.messages_delivered || 0;
    aggregated[id].messages_failed += campaign.messages_failed || 0;
    aggregated[id].opt_outs += campaign.opt_outs || 0;
    aggregated[id].clicks += campaign.clicks || 0;
    aggregated[id].conversions += campaign.conversions || 0;
    aggregated[id].amount_raised += Number(campaign.amount_raised || 0);
    aggregated[id].cost += Number(campaign.cost || 0);
  });

  // Calculate derived metrics
  Object.values(aggregated).forEach((m) => {
    if (m.cost > 0) m.roi = m.amount_raised / m.cost;
    if (m.messages_sent > 0) m.delivery_rate = (m.messages_delivered / m.messages_sent) * 100;
    if (m.messages_delivered > 0) {
      m.ctr = (m.clicks / m.messages_delivered) * 100;
      m.opt_out_rate = (m.opt_outs / m.messages_delivered) * 100;
    }
  });

  return aggregated;
}

function aggregateDailyMetrics(data: any[]): SMSDailyMetric[] {
  const byDate: Record<string, SMSDailyMetric> = {};
  data?.forEach((campaign) => {
    const date = campaign.send_date?.split("T")[0];
    if (!date) return;
    if (!byDate[date]) {
      byDate[date] = { date, messages_sent: 0, conversions: 0, amount_raised: 0 };
    }
    byDate[date].messages_sent += campaign.messages_sent || 0;
    byDate[date].conversions += campaign.conversions || 0;
    byDate[date].amount_raised += Number(campaign.amount_raised || 0);
  });
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function calculateTotals(campaigns: SMSMetric[]) {
  return {
    sent: campaigns.reduce((sum, m) => sum + m.messages_sent, 0),
    delivered: campaigns.reduce((sum, m) => sum + m.messages_delivered, 0),
    raised: campaigns.reduce((sum, m) => sum + m.amount_raised, 0),
    cost: campaigns.reduce((sum, m) => sum + m.cost, 0),
    conversions: campaigns.reduce((sum, m) => sum + m.conversions, 0),
    clicks: campaigns.reduce((sum, m) => sum + m.clicks, 0),
    optOuts: campaigns.reduce((sum, m) => sum + m.opt_outs, 0),
  };
}

async function fetchSMSMetrics(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<SMSMetricsResult> {
  // Calculate previous period
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const prevEnd = subDays(start, 1);
  const prevStart = subDays(prevEnd, daysDiff);

  // Parallel fetch all data
  const [currentRes, prevRes, latestRes] = await Promise.all([
    supabase
      .from("sms_campaigns")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("send_date", startDate)
      .lte("send_date", `${endDate}T23:59:59`)
      .neq("status", "draft")
      .order("send_date", { ascending: true }),
    supabase
      .from("sms_campaigns")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("send_date", format(prevStart, "yyyy-MM-dd"))
      .lte("send_date", `${format(prevEnd, "yyyy-MM-dd")}T23:59:59`)
      .neq("status", "draft"),
    supabase
      .from("sms_campaigns")
      .select("send_date")
      .eq("organization_id", organizationId)
      .neq("status", "draft")
      .order("send_date", { ascending: false })
      .limit(1),
  ]);

  if (currentRes.error) throw currentRes.error;

  const metrics = aggregateMetrics(currentRes.data || []);
  const dailyMetrics = aggregateDailyMetrics(currentRes.data || []);
  const previousPeriodMetrics = aggregateMetrics(prevRes.data || []);
  const campaigns = Object.values(metrics);
  const previousCampaigns = Object.values(previousPeriodMetrics);
  const totals = calculateTotals(campaigns);
  const previousTotals = {
    sent: previousCampaigns.reduce((sum, m) => sum + m.messages_sent, 0),
    delivered: previousCampaigns.reduce((sum, m) => sum + m.messages_delivered, 0),
    raised: previousCampaigns.reduce((sum, m) => sum + m.amount_raised, 0),
    cost: previousCampaigns.reduce((sum, m) => sum + m.cost, 0),
    conversions: previousCampaigns.reduce((sum, m) => sum + m.conversions, 0),
  };

  const lastSentDate = latestRes.data?.[0]?.send_date?.split("T")[0] || null;

  return {
    metrics,
    dailyMetrics,
    previousPeriodMetrics,
    campaigns,
    previousCampaigns,
    totals,
    previousTotals,
    lastSentDate,
  };
}

export function useSMSMetricsQuery(organizationId: string | undefined) {
  const dateRange = useDateRange();

  return useQuery({
    queryKey: smsKeys.metrics(organizationId || "", dateRange),
    queryFn: () =>
      fetchSMSMetrics(organizationId!, dateRange.startDate, dateRange.endDate),
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
