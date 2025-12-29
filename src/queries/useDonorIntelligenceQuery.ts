import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { intelligenceKeys } from "./queryKeys";
import { logger } from "@/lib/logger";
import { formatEndDateFull, QUERY_LIMITS, createResultMeta, type QueryResultMeta } from "@/lib/query-utils";
export interface AttributionData {
  attributed_platform: string | null;
  attributed_campaign_id?: string | null;
  attributed_ad_id?: string | null;
  attributed_creative_id?: string | null;
  refcode?: string | null;
  attribution_method?: string | null;
  transaction_click_id?: string | null;
  transaction_fbclid?: string | null;
  mapped_click_id?: string | null;
  mapped_fbclid?: string | null;
  creative_topic: string | null;
  creative_tone: string | null;
  amount: number;
  net_amount: number | null;
  transaction_type: string;
}

export interface DonorSegment {
  donor_tier: string;
  donor_frequency_segment: string;
  total_donated: number;
  donation_count: number;
  days_since_donation: number;
  monetary_score: number;
  frequency_score: number;
  recency_score: number;
}

export interface SmsFunnel {
  sent: number;
  delivered: number;
  clicked: number;
  donated: number;
  optedOut: number;
}

export interface JourneyEvent {
  donor_key: string;
  event_type: string;
  occurred_at: string;
  amount: number | null;
  net_amount: number | null;
  source: string | null;
  transaction_type: string | null;
  refcode: string | null;
}

export interface LtvSummary {
  avgLtv90: number;
  avgLtv180: number;
  highRisk: number;
  total: number;
}

export interface DonorIntelligenceData {
  attributionData: AttributionData[];
  segmentData: DonorSegment[];
  smsFunnel: SmsFunnel;
  journeyEvents: JourneyEvent[];
  smsCost: number;
  smsSent: number;
  ltvSummary: LtvSummary;
  metaSpend: number;
  meta: {
    journeys: QueryResultMeta;
    ltv: QueryResultMeta;
  };
}

async function fetchDonorIntelligenceData(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<DonorIntelligenceData> {
  const sb = supabase as any;
  const endDateFull = formatEndDateFull(endDate);
  // Run all queries in parallel
  const [
    attrResult,
    segResult,
    smsEventsResult,
    smsCampaignsResult,
    metaSpendResult,
    journeysResult,
    ltvResult,
  ] = await Promise.all([
    // Attribution data
    sb
      .from('donation_attribution')
      .select('attributed_platform, attributed_campaign_id, attributed_ad_id, attributed_creative_id, refcode, creative_topic, creative_tone, amount, net_amount, transaction_type, attribution_method, transaction_click_id, transaction_fbclid, mapped_click_id, mapped_fbclid')
      .eq('organization_id', organizationId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDateFull)
      .eq('transaction_type', 'donation'),

    // Segment data
    sb
      .from('donor_segments')
      .select('donor_tier, donor_frequency_segment, total_donated, donation_count, days_since_donation, monetary_score, frequency_score, recency_score')
      .eq('organization_id', organizationId),

    // SMS events
    sb
      .from('sms_events')
      .select('event_type, phone_hash')
      .eq('organization_id', organizationId)
      .gte('occurred_at', startDate)
      .lte('occurred_at', endDateFull),

    // SMS campaigns
    sb
      .from('sms_campaigns')
      .select('cost, messages_sent, send_date, status')
      .eq('organization_id', organizationId)
      .gte('send_date', startDate)
      .lte('send_date', endDateFull)
      .neq('status', 'draft'),

    // Meta spend
    sb
      .from('meta_ad_metrics')
      .select('spend')
      .eq('organization_id', organizationId)
      .gte('date', startDate)
      .lte('date', endDate),

    // Donor journeys - increased limit for better data coverage
    sb
      .from('donor_journeys')
      .select('donor_key, event_type, occurred_at, amount, net_amount, source, transaction_type, refcode')
      .eq('organization_id', organizationId)
      .gte('occurred_at', startDate)
      .lte('occurred_at', endDateFull)
      .order('occurred_at', { ascending: false })
      .limit(QUERY_LIMITS.journeys),

    // LTV predictions - increased limit
    sb
      .from('donor_ltv_predictions')
      .select('predicted_ltv_90, predicted_ltv_180, churn_risk')
      .eq('organization_id', organizationId)
      .limit(QUERY_LIMITS.predictions),
  ]);

  // Log any errors
  if (attrResult.error) logger.error('Failed to load attribution data', attrResult.error);
  if (segResult.error) logger.error('Failed to load segment data', segResult.error);
  if (smsEventsResult.error) logger.error('Failed to load SMS events', smsEventsResult.error);
  if (smsCampaignsResult.error) logger.error('Failed to load SMS campaigns', smsCampaignsResult.error);
  if (metaSpendResult.error) logger.error('Failed to load meta spend', metaSpendResult.error);
  if (journeysResult.error) logger.error('Failed to load donor journeys', journeysResult.error);
  if (ltvResult.error) logger.error('Failed to load LTV predictions', ltvResult.error);

  // Process SMS funnel
  const smsEvents = smsEventsResult.data || [];
  const phoneHashes = Array.from(
    new Set(smsEvents.map((ev: any) => ev.phone_hash).filter(Boolean))
  );

  let smsDonations = 0;
  if (phoneHashes.length > 0) {
    const { data: journeyDonations } = await sb
      .from('donor_journeys')
      .select('donor_key')
      .eq('organization_id', organizationId)
      .in('donor_key', phoneHashes)
      .eq('event_type', 'donation')
      .gte('occurred_at', startDate)
      .lte('occurred_at', endDateFull);
    
    smsDonations = new Set((journeyDonations || []).map((d: any) => d.donor_key)).size;
  }

  const eventCounts = smsEvents.reduce((acc: any, ev: any) => {
    const type = ev.event_type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  // Process SMS cost
  const smsCampaigns = smsCampaignsResult.data || [];
  const smsCost = smsCampaigns.reduce((sum: number, c: any) => sum + Number(c.cost || 0), 0);
  const smsSent = smsCampaigns.reduce((sum: number, c: any) => sum + Number(c.messages_sent || 0), 0);

  // Process Meta spend
  const metaSpend = (metaSpendResult.data || []).reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0);

  // Process LTV summary
  const ltvData = ltvResult.data || [];
  const ltvTotal = ltvData.length;
  const avgLtv90 = ltvTotal > 0 ? ltvData.reduce((sum: number, d: any) => sum + Number(d.predicted_ltv_90 || 0), 0) / ltvTotal : 0;
  const avgLtv180 = ltvTotal > 0 ? ltvData.reduce((sum: number, d: any) => sum + Number(d.predicted_ltv_180 || 0), 0) / ltvTotal : 0;
  const highRisk = ltvData.filter((d: any) => Number(d.churn_risk || 0) >= 0.7).length;

  const journeyData = journeysResult.data || [];
  const ltvDataResult = ltvResult.data || [];

  return {
    attributionData: attrResult.data || [],
    segmentData: segResult.data || [],
    smsFunnel: {
      sent: eventCounts.sent || 0,
      delivered: eventCounts.delivered || 0,
      clicked: eventCounts.clicked || 0,
      donated: smsDonations,
      optedOut: eventCounts.opted_out || 0,
    },
    journeyEvents: journeyData,
    smsCost,
    smsSent,
    ltvSummary: { avgLtv90, avgLtv180, highRisk, total: ltvTotal },
    metaSpend,
    meta: {
      journeys: createResultMeta('journey events', journeyData.length, QUERY_LIMITS.journeys),
      ltv: createResultMeta('LTV predictions', ltvDataResult.length, QUERY_LIMITS.predictions),
    },
  };
}

export function useDonorIntelligenceQuery(
  organizationId: string,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: intelligenceKeys.donors(organizationId, { startDate, endDate }),
    queryFn: () => fetchDonorIntelligenceData(organizationId, startDate, endDate),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!organizationId && !!startDate && !!endDate,
  });
}
