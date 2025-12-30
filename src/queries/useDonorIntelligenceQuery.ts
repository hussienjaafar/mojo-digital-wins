import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { intelligenceKeys } from "./queryKeys";
import { logger } from "@/lib/logger";
import { 
  formatEndDateFull, 
  QUERY_LIMITS, 
  createResultMeta, 
  safeExtractData,
  isRecoverableError,
  type QueryResultMeta 
} from "@/lib/query-utils";

export interface AttributionData {
  attributed_platform: string | null;
  attributed_campaign_id?: string | null;
  attributed_ad_id?: string | null;
  attributed_creative_id?: string | null;
  refcode?: string | null;
  attribution_method?: string | null;
  creative_topic: string | null;
  creative_tone: string | null;
  amount: number;
  net_amount: number | null;
  transaction_type: string;
  donor_id_hash?: string | null;
}

export interface DonorFirstDonation {
  donor_key: string;
  first_donation_at: string;
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
  donorFirstDonations: DonorFirstDonation[]; // Lifetime first donation dates for new/returning classification
}

async function fetchDonorIntelligenceData(
  organizationId: string,
  startDate: string,
  endDate: string,
  campaignId: string | null = null,
  creativeId: string | null = null
): Promise<DonorIntelligenceData> {
  const sb = supabase as any;
  const endDateFull = formatEndDateFull(endDate);

  // Build attribution query from actblue_transactions directly (donation_attribution is a restricted view)
  const buildAttrQuery = () => {
    let query = sb
      .from('actblue_transactions')
      .select(`
        refcode,
        amount,
        net_amount,
        transaction_type,
        donor_email,
        click_id,
        fbclid,
        refcode_mappings!left(platform, campaign_id, ad_id, creative_id)
      `)
      .eq('organization_id', organizationId)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDateFull)
      .eq('transaction_type', 'donation');
    return query;
  };

  // Build segment query from donor_demographics directly (donor_segments is a restricted view)
  const buildSegmentQuery = () => {
    return sb
      .from('donor_demographics')
      .select('total_donated, donation_count, last_donation_date, first_donation_date, is_recurring')
      .eq('organization_id', organizationId);
  };

  // Run all queries in parallel
  const [
    attrResult,
    segResult,
    smsEventsResult,
    smsCampaignsResult,
    metaSpendResult,
    journeysResult,
    ltvResult,
    donorFirstResult,
  ] = await Promise.all([
    // Attribution data from actblue_transactions
    buildAttrQuery(),

    // Segment data from donor_demographics (we'll compute tiers client-side)
    buildSegmentQuery(),

    // SMS events (excluded when campaign or creative filter active)
    // Rationale: SMS campaigns don't map to Meta campaigns or creatives
    (campaignId || creativeId)
      ? Promise.resolve({ data: [], error: null })
      : sb
          .from('sms_events')
          .select('event_type, phone_hash')
          .eq('organization_id', organizationId)
          .gte('occurred_at', startDate)
          .lte('occurred_at', endDateFull),

    // SMS campaigns (excluded when campaign or creative filter active)
    (campaignId || creativeId)
      ? Promise.resolve({ data: [], error: null })
      : sb
          .from('sms_campaigns')
          .select('cost, messages_sent, send_date, status')
          .eq('organization_id', organizationId)
          .gte('send_date', startDate)
          .lte('send_date', endDateFull)
          .neq('status', 'draft'),

    // Meta spend (filtered by campaign and/or creative if applicable)
    (() => {
      let query = sb
        .from('meta_ad_metrics')
        .select('spend, campaign_id, ad_creative_id')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate);
      if (campaignId) query = query.eq('campaign_id', campaignId);
      if (creativeId) query = query.eq('ad_creative_id', creativeId);
      return query;
    })(),

    // Donor journeys - fetch ALL data regardless of date range for this page
    // This ensures the intelligence page always shows available lifecycle data
    (campaignId || creativeId)
      ? Promise.resolve({ data: [], error: null })
      : sb
          .from('donor_journeys')
          .select('donor_key, event_type, occurred_at, amount, net_amount, source, refcode')
          .eq('organization_id', organizationId)
          .order('occurred_at', { ascending: false })
          .limit(QUERY_LIMITS.journeys),

    // LTV predictions - include churn_risk_label for proper categorization
    sb
      .from('donor_ltv_predictions')
      .select('predicted_ltv_90, predicted_ltv_180, churn_risk, churn_risk_label')
      .eq('organization_id', organizationId)
      .limit(QUERY_LIMITS.predictions),

    // Donor first donation dates (for lifetime-based new/returning classification)
    sb
      .from('donor_first_donation')
      .select('donor_key, first_donation_at')
      .eq('organization_id', organizationId),
  ]);

  // Log errors but continue with empty data for recoverable errors
  const logError = (name: string, error: any) => {
    if (error) {
      if (isRecoverableError(error)) {
        logger.warn(`No ${name} data available (table may be empty or not populated yet)`);
      } else {
        logger.error(`Failed to load ${name}`, error);
      }
    }
  };

  logError('attribution', attrResult.error);
  logError('segment', segResult.error);
  logError('SMS events', smsEventsResult.error);
  logError('SMS campaigns', smsCampaignsResult.error);
  logError('meta spend', metaSpendResult.error);
  logError('donor journeys', journeysResult.error);
  logError('LTV predictions', ltvResult.error);
  logError('donor first donations', donorFirstResult.error);

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

  // Transform attribution data from actblue_transactions format
  const rawAttrData = attrResult.data || [];
  const attributionData: AttributionData[] = rawAttrData.map((tx: any) => {
    const mapping = tx.refcode_mappings;
    return {
      attributed_platform: mapping?.platform || null,
      attributed_campaign_id: mapping?.campaign_id || null,
      attributed_ad_id: mapping?.ad_id || null,
      attributed_creative_id: mapping?.creative_id || null,
      refcode: tx.refcode,
      creative_topic: null,
      creative_tone: null,
      amount: tx.amount,
      net_amount: tx.net_amount,
      transaction_type: tx.transaction_type,
      attribution_method: mapping?.platform ? 'refcode' : (tx.click_id ? 'click_id' : (tx.fbclid ? 'fbclid' : null)),
    };
  });

  // Transform segment data from donor_demographics format
  const rawSegData = segResult.data || [];
  const segmentData: DonorSegment[] = rawSegData.map((d: any) => {
    const daysSince = d.last_donation_date 
      ? Math.floor((Date.now() - new Date(d.last_donation_date).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    return {
      donor_tier: d.total_donated >= 1000 ? 'major' : (d.donation_count >= 5 ? 'repeat' : 'grassroots'),
      donor_frequency_segment: d.donation_count >= 5 ? 'frequent' : (d.donation_count >= 2 ? 'repeat' : 'one-time'),
      total_donated: d.total_donated || 0,
      donation_count: d.donation_count || 0,
      days_since_donation: daysSince,
      monetary_score: d.total_donated >= 1000 ? 5 : (d.total_donated >= 500 ? 4 : (d.total_donated >= 100 ? 3 : (d.total_donated >= 25 ? 2 : 1))),
      frequency_score: d.donation_count >= 10 ? 5 : (d.donation_count >= 5 ? 4 : (d.donation_count >= 3 ? 3 : (d.donation_count >= 2 ? 2 : 1))),
      recency_score: daysSince <= 30 ? 5 : (daysSince <= 60 ? 4 : (daysSince <= 90 ? 3 : (daysSince <= 180 ? 2 : 1))),
    };
  });

  return {
    attributionData,
    segmentData,
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
    donorFirstDonations: donorFirstResult.data || [],
  };
}

export function useDonorIntelligenceQuery(
  organizationId: string,
  startDate: string,
  endDate: string,
  campaignId: string | null = null,
  creativeId: string | null = null
) {
  return useQuery({
    queryKey: intelligenceKeys.donors(
      organizationId,
      { startDate, endDate },
      { campaignId, creativeId }
    ),
    queryFn: () => fetchDonorIntelligenceData(
      organizationId,
      startDate,
      endDate,
      campaignId,
      creativeId
    ),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!organizationId && !!startDate && !!endDate,
  });
}
