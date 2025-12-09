import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PortalCard, PortalCardHeader, PortalCardTitle, PortalCardContent } from "@/components/portal/PortalCard";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Target, Sparkles, DollarSign, BarChart3, Activity, GitBranch } from "lucide-react";
import { logger } from "@/lib/logger";

interface DonorIntelligenceProps {
  organizationId: string;
  startDate: string;
  endDate: string;
}

interface AttributionData {
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

interface DonorSegment {
  donor_tier: string;
  donor_frequency_segment: string;
  total_donated: number;
  donation_count: number;
  days_since_donation: number;
  monetary_score: number;
  frequency_score: number;
  recency_score: number;
}

interface CreativePerformance {
  topic: string;
  donations: number;
  revenue: number;
  avgDonation: number;
  deterministicRate: number;
  newDonors: number;
  returningDonors: number;
  netRevenue: number;
  cpa?: number | null;
  roas?: number | null;
}

interface SmsFunnel {
  sent: number;
  delivered: number;
  clicked: number;
  donated: number;
  optedOut: number;
}

interface JourneyEvent {
  donor_key: string;
  event_type: string;
  occurred_at: string;
  amount: number | null;
  net_amount: number | null;
  source: string | null;
  transaction_type: string | null;
  refcode: string | null;
}

interface LtvPrediction {
  donor_email_hash: string | null;
  donor_phone_hash: string | null;
  predicted_ltv_90: number | null;
  predicted_ltv_180: number | null;
  repeat_prob_90: number | null;
  repeat_prob_180: number | null;
  churn_risk: number | null;
}

export const DonorIntelligence = ({ organizationId, startDate, endDate }: DonorIntelligenceProps) => {
  const [attributionData, setAttributionData] = useState<AttributionData[]>([]);
  const [segmentData, setSegmentData] = useState<DonorSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deterministicOnly, setDeterministicOnly] = useState(false);
  const [smsFunnel, setSmsFunnel] = useState<SmsFunnel>({ sent: 0, delivered: 0, clicked: 0, donated: 0, optedOut: 0 });
  const [journeyEvents, setJourneyEvents] = useState<JourneyEvent[]>([]);
  const [smsCost, setSmsCost] = useState<number>(0);
  const [smsSent, setSmsSent] = useState<number>(0);
  const [ltvSummary, setLtvSummary] = useState<{ avgLtv90: number; avgLtv180: number; highRisk: number; total: number }>({ avgLtv90: 0, avgLtv180: 0, highRisk: 0, total: 0 });
  const [metaSpend, setMetaSpend] = useState<number>(0);
  const [ltvLinkHint] = useState("See LTV/Forecast tab for detailed cohorts.");

  useEffect(() => {
    loadData();
  }, [organizationId, startDate, endDate]);

  const isDeterministic = (d: AttributionData) => {
    if (d.attribution_method === 'refcode' || d.attribution_method === 'click_id') return true;
    return Boolean(
      d.attributed_platform &&
      (d.attributed_campaign_id || d.attributed_ad_id || d.attributed_creative_id || d.refcode || d.transaction_click_id || d.transaction_fbclid)
    );
  };

  const filteredAttribution = useMemo(() => {
    if (!deterministicOnly) return attributionData;
    return attributionData.filter(isDeterministic);
  }, [attributionData, deterministicOnly]);

  const deterministicRate = useMemo(() => {
    if (attributionData.length === 0) return 0;
    const deterministicCount = attributionData.filter(isDeterministic).length;
    return (deterministicCount / attributionData.length) * 100;
  }, [attributionData]);

  const groupedJourneys = useMemo(() => {
    const byDonor: Record<string, JourneyEvent[]> = {};
    journeyEvents.forEach(ev => {
      if (!ev.donor_key) return;
      if (!byDonor[ev.donor_key]) byDonor[ev.donor_key] = [];
      byDonor[ev.donor_key].push(ev);
    });
    // Sort events per donor by time desc
    Object.values(byDonor).forEach(list => list.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()));
    // Sort donors by most recent event
    return Object.entries(byDonor)
      .sort(([, a], [, b]) => (new Date(b[0]?.occurred_at || 0).getTime()) - (new Date(a[0]?.occurred_at || 0).getTime()))
      .slice(0, 10); // limit to top 10 donors for display
  }, [journeyEvents]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load attribution data
      const { data: attrData, error: attrError } = await (supabase as any)
        .from('donation_attribution')
        .select('attributed_platform, attributed_campaign_id, attributed_ad_id, attributed_creative_id, refcode, creative_topic, creative_tone, amount, net_amount, transaction_type, attribution_method, transaction_click_id, transaction_fbclid, mapped_click_id, mapped_fbclid')
        .eq('organization_id', organizationId)
        .gte('transaction_date', startDate)
        .lte('transaction_date', `${endDate}T23:59:59`)
        .eq('transaction_type', 'donation');

      if (attrError) {
        logger.error('Failed to load attribution data', attrError);
      } else {
        setAttributionData(attrData || []);
      }

      // Load segment data
      const { data: segData, error: segError } = await (supabase as any)
        .from('donor_segments')
        .select('donor_tier, donor_frequency_segment, total_donated, donation_count, days_since_donation, monetary_score, frequency_score, recency_score')
        .eq('organization_id', organizationId);

      if (segError) {
        logger.error('Failed to load segment data', segError);
      } else {
        setSegmentData(segData || []);
      }

      // Load SMS funnel (counts by event_type)
      const { data: smsEvents, error: smsError } = await (supabase as any)
        .from('sms_events')
        .select('event_type, phone_hash')
        .eq('organization_id', organizationId)
        .gte('occurred_at', startDate)
        .lte('occurred_at', `${endDate}T23:59:59`);

      if (smsError) {
        logger.error('Failed to load SMS events', smsError);
      } else {
        const phoneHashes = Array.from(
          new Set(
            (smsEvents || [])
              .map((ev: any) => ev.phone_hash)
              .filter(Boolean)
          )
        );

        // Count donations from donors who received SMS in window (uses donor_journeys view keyed by phone hash)
        let smsDonations = 0;
        if (phoneHashes.length > 0) {
          const { data: journeyDonations, error: journeyError } = await (supabase as any)
            .from('donor_journeys')
            .select('donor_key')
            .eq('organization_id', organizationId)
            .in('donor_key', phoneHashes)
            .eq('event_type', 'donation')
            .gte('occurred_at', startDate)
            .lte('occurred_at', `${endDate}T23:59:59`);

          if (journeyError) {
            logger.error('Failed to load donor_journeys for SMS donations', journeyError);
          } else {
            smsDonations = new Set((journeyDonations || []).map((d: any) => d.donor_key)).size;
          }
        }

        const counts = (smsEvents || []).reduce((acc: any, ev: any) => {
          const type = ev.event_type || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        setSmsFunnel({
          sent: counts.sent || 0,
          delivered: counts.delivered || 0,
          clicked: counts.clicked || 0,
          donated: smsDonations,
          optedOut: counts.opted_out || 0,
        });
      }

      // Load SMS cost/sent from sms_campaigns for CAC calculations
      const { data: smsCampaigns, error: smsCostErr } = await (supabase as any)
        .from('sms_campaigns')
        .select('cost, messages_sent, send_date, status')
        .eq('organization_id', organizationId)
        .gte('send_date', startDate)
        .lte('send_date', `${endDate}T23:59:59`)
        .neq('status', 'draft');

      if (smsCostErr) {
        logger.error('Failed to load sms_campaigns cost', smsCostErr);
      } else {
        const totalCost = smsCampaigns?.reduce((sum: number, c: any) => sum + Number(c.cost || 0), 0) || 0;
        const totalSent = smsCampaigns?.reduce((sum: number, c: any) => sum + Number(c.messages_sent || 0), 0) || 0;
        setSmsCost(totalCost);
        setSmsSent(totalSent);
      }

      // Load Meta spend for ROAS/CPA
      const { data: metaSpendData, error: metaSpendErr } = await (supabase as any)
        .from('meta_ad_metrics')
        .select('spend')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (metaSpendErr) {
        logger.error('Failed to load meta spend', metaSpendErr);
      } else {
        const spend = metaSpendData?.reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0) || 0;
        setMetaSpend(spend);
      }

      // Load donor journeys (limited for performance)
      const { data: journeys, error: journeyErr } = await (supabase as any)
        .from('donor_journeys')
        .select('donor_key, event_type, occurred_at, amount, net_amount, source, transaction_type, refcode')
        .eq('organization_id', organizationId)
        .gte('occurred_at', startDate)
        .lte('occurred_at', `${endDate}T23:59:59`)
        .order('occurred_at', { ascending: false })
        .limit(200);

      if (journeyErr) {
        logger.error('Failed to load donor journeys', journeyErr);
      } else {
        setJourneyEvents(journeys || []);
      }

      // Load LTV predictions
      const { data: ltvData, error: ltvErr } = await (supabase as any)
        .from('donor_ltv_predictions')
        .select('predicted_ltv_90, predicted_ltv_180, churn_risk')
        .eq('organization_id', organizationId)
        .limit(500);

      if (ltvErr) {
        logger.error('Failed to load LTV predictions', ltvErr);
      } else {
        const total = ltvData?.length || 0;
        const avgLtv90 = total > 0 ? ltvData.reduce((sum: number, d: any) => sum + Number(d.predicted_ltv_90 || 0), 0) / total : 0;
        const avgLtv180 = total > 0 ? ltvData.reduce((sum: number, d: any) => sum + Number(d.predicted_ltv_180 || 0), 0) / total : 0;
        const highRisk = ltvData?.filter((d: any) => Number(d.churn_risk || 0) >= 0.7).length || 0;
        setLtvSummary({ avgLtv90, avgLtv180, highRisk, total });
      }
    } catch (error) {
      logger.error('Failed to load donor intelligence data', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Revenue by platform - formatted for PortalBarChart
  const platformRevenue = useMemo(() => {
    const byPlatform: Record<string, { revenue: number; netRevenue: number; count: number; deterministicCount: number }> = {};
    const seenDonors: Record<string, { platform: string; hash: string }> = {};
    filteredAttribution.forEach(d => {
      const platform = d.attributed_platform || 'unattributed';
      if (!byPlatform[platform]) {
        byPlatform[platform] = { revenue: 0, netRevenue: 0, count: 0, deterministicCount: 0 };
      }
      byPlatform[platform].revenue += Number(d.amount || 0);
      byPlatform[platform].netRevenue += Number(d.net_amount ?? d.amount ?? 0);
      byPlatform[platform].count++;
      if (isDeterministic(d)) byPlatform[platform].deterministicCount++;
    });

    return Object.entries(byPlatform)
      .map(([platform, data]) => ({
        name: platform.charAt(0).toUpperCase() + platform.slice(1),
        value: Math.round(data.revenue),
        netRevenue: Math.round(data.netRevenue),
        donations: data.count,
        avgDonation: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
        deterministicRate: data.count > 0 ? Math.round((data.deterministicCount / data.count) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredAttribution, attributionData]);

  // Revenue by creative topic
  const topicPerformance = useMemo(() => {
    const byTopic: Record<string, { revenue: number; netRevenue: number; count: number; deterministicCount: number; newDonors: number; returningDonors: number }> = {};
    const donorFirstTopic: Record<string, string> = {};
    filteredAttribution.forEach(d => {
      const topic = d.creative_topic || 'unknown';
      if (!byTopic[topic]) {
        byTopic[topic] = { revenue: 0, netRevenue: 0, count: 0, deterministicCount: 0, newDonors: 0, returningDonors: 0 };
      }
      byTopic[topic].revenue += Number(d.amount || 0);
    byTopic[topic].netRevenue += Number(d.net_amount ?? d.amount ?? 0);
      byTopic[topic].count++;
      if (isDeterministic(d)) byTopic[topic].deterministicCount++;

      const donorHash = d.attributed_creative_id || d.refcode || d.transaction_click_id || d.transaction_fbclid || '';
      if (donorHash && !donorFirstTopic[donorHash]) {
        donorFirstTopic[donorHash] = topic;
        // naive split: treat first time seen in this range as "new" relative to other topics
        byTopic[topic].newDonors += 1;
      } else if (donorHash) {
        byTopic[topic].returningDonors += 1;
      }
    });

    return Object.entries(byTopic)
      .filter(([topic]) => topic !== 'unknown')
      .map(([topic, data]) => ({
        topic,
        donations: data.count,
        revenue: Math.round(data.revenue),
        avgDonation: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
        deterministicRate: data.count > 0 ? Math.round((data.deterministicCount / data.count) * 100) : 0,
        newDonors: data.newDonors,
        returningDonors: data.returningDonors,
        netRevenue: Math.round(data.netRevenue),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredAttribution, attributionData]);

  // Donor segments breakdown - formatted for PortalBarChart
  const segmentBreakdown = useMemo(() => {
    const byTier: Record<string, { count: number; totalValue: number }> = {};
    segmentData.forEach(d => {
      const tier = d.donor_tier;
      if (!byTier[tier]) {
        byTier[tier] = { count: 0, totalValue: 0 };
      }
      byTier[tier].count++;
      byTier[tier].totalValue += Number(d.total_donated || 0);
    });

    const tierOrder = ['major', 'repeat', 'active', 'lapsing', 'lapsed'];
    return tierOrder
      .filter(tier => byTier[tier])
      .map(tier => ({
        name: tier.charAt(0).toUpperCase() + tier.slice(1),
        value: byTier[tier]?.count || 0,
        totalValue: Math.round(byTier[tier]?.totalValue || 0),
      }));
  }, [segmentData]);

  // RFM score distribution - formatted for PortalBarChart
  const rfmDistribution = useMemo(() => {
    const scores: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    segmentData.forEach(d => {
      // Calculate combined RFM score (average of 3 scores)
      const avgScore = Math.round((d.monetary_score + d.frequency_score + d.recency_score) / 3);
      scores[String(avgScore)]++;
    });
    return Object.entries(scores).map(([score, count]) => ({
      name: `Score ${score}`,
      value: count,
    }));
  }, [segmentData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const platformEfficiency = useMemo(() => {
    const metaDonations = filteredAttribution.filter(d => d.attributed_platform === 'meta');
    const metaNet = metaDonations.reduce((sum, d) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
    const metaCpa = metaDonations.length > 0 ? metaSpend / metaDonations.length : 0;
    const metaRoas = metaSpend > 0 ? metaNet / metaSpend : 0;
    return {
      meta: {
        donations: metaDonations.length,
        net: metaNet,
        spend: metaSpend,
        cpa: metaCpa,
        roas: metaRoas,
      },
    };
  }, [filteredAttribution, metaSpend]);

  const formatShare = (a: number, b: number) => {
    if (b === 0) return '0%';
    return `${Math.round((a / b) * 100)}%`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="portal-card p-6 animate-pulse">
            <div className="h-4 w-32 bg-[hsl(var(--portal-bg-elevated))] rounded mb-4" />
            <div className="h-48 bg-[hsl(var(--portal-bg-elevated))] rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="portal-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-[hsl(var(--portal-accent))]" />
            <span className="text-sm portal-text-muted">Attributed</span>
          </div>
          <div className="text-2xl font-bold portal-text-primary">
            {attributionData.filter(d => d.attributed_platform).length}
          </div>
          <div className="text-xs portal-text-muted">
            of {attributionData.length} donations
          </div>
        </div>
        <div className="portal-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--portal-accent))]" />
            <span className="text-sm portal-text-muted">Topics Linked</span>
          </div>
          <div className="text-2xl font-bold portal-text-primary">
            {attributionData.filter(d => d.creative_topic).length}
          </div>
          <div className="text-xs portal-text-muted">
            donations with creative topic
          </div>
        </div>
        <div className="portal-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-[hsl(var(--portal-accent))]" />
            <span className="text-sm portal-text-muted">Total Donors</span>
          </div>
          <div className="text-2xl font-bold portal-text-primary">
            {segmentData.length.toLocaleString()}
          </div>
          <div className="text-xs portal-text-muted">
            in database
          </div>
        </div>
        <div className="portal-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-[hsl(var(--portal-accent))]" />
            <span className="text-sm portal-text-muted">Major Donors</span>
          </div>
          <div className="text-2xl font-bold portal-text-primary">
            {segmentData.filter(d => d.donor_tier === 'major').length}
          </div>
          <div className="text-xs portal-text-muted">
            $1,000+ lifetime
          </div>
        </div>
      </div>

      <Tabs defaultValue="attribution" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-[hsl(var(--portal-bg-elevated))]">
            Deterministic: {deterministicRate.toFixed(0)}%
          </Badge>
          <span className="text-sm portal-text-muted">
              Deterministic when refcode/campaign/ad/creative mapping is present
            </span>
          </div>
          <Badge
            variant={deterministicOnly ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setDeterministicOnly(!deterministicOnly)}
          >
            {deterministicOnly ? "Showing deterministic only" : "Filter to deterministic"}
          </Badge>
        </div>
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="topics">Creative Topics</TabsTrigger>
          <TabsTrigger value="segments">Donor Segments</TabsTrigger>
          <TabsTrigger value="sms">SMS Funnel</TabsTrigger>
          <TabsTrigger value="journeys">Journeys</TabsTrigger>
          <TabsTrigger value="ltv">LTV/Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="attribution" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by Platform */}
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Revenue by Platform
                </PortalCardTitle>
                <p className="text-sm portal-text-muted mt-1">
                  CPA/ROAS shown when spend is available (Meta).
                </p>
              </PortalCardHeader>
              <PortalCardContent>
                {platformRevenue.length > 0 ? (
                  <PortalBarChart
                    data={platformRevenue}
                    height={250}
                    valueType="currency"
                    showValues
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center portal-text-muted">
                    No attributed donations yet
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                    <div className="portal-text-muted text-xs mb-1">Meta CPA</div>
                    <div className="font-semibold portal-text-primary">
                      {platformEfficiency.meta.donations > 0 ? formatCurrency(platformEfficiency.meta.cpa) : 'N/A'}
                    </div>
                    <div className="portal-text-muted text-[11px]">Spend / Meta donations</div>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                    <div className="portal-text-muted text-xs mb-1">Meta ROAS (net)</div>
                    <div className="font-semibold portal-text-primary">
                      {platformEfficiency.meta.spend > 0 ? `${platformEfficiency.meta.roas.toFixed(1)}x` : 'N/A'}
                    </div>
                    <div className="portal-text-muted text-[11px]">Net revenue / spend</div>
                  </div>
                </div>
              </PortalCardContent>
            </PortalCard>

            {/* Platform Breakdown Table */}
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Platform Performance</PortalCardTitle>
              </PortalCardHeader>
              <PortalCardContent>
                <div className="space-y-3">
                  {platformRevenue.map((platform, idx) => (
                    <div 
                      key={platform.name} 
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: 'hsl(var(--portal-bg-elevated))' }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold portal-text-muted">#{idx + 1}</div>
                        <div>
                          <div className="font-medium portal-text-primary">{platform.name}</div>
                          <div className="text-sm portal-text-muted">
                            {platform.donations} donations · {platform.deterministicRate}% deterministic
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold portal-text-primary">{formatCurrency(platform.value)}</div>
                        <div className="text-sm portal-text-muted">Avg: {formatCurrency(platform.avgDonation)}</div>
                      </div>
                    </div>
                  ))}
                  {platformRevenue.length === 0 && (
                    <div className="text-center py-8 portal-text-muted">
                      No platform data available
                    </div>
                  )}
                </div>
              </PortalCardContent>
            </PortalCard>
          </div>
        </TabsContent>

        <TabsContent value="topics" className="space-y-6">
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Top Performing Creative Topics
              </PortalCardTitle>
              <p className="text-sm portal-text-muted mt-1">
                Revenue generated by AI-identified creative themes; includes deterministic % and new vs returning donors.
              </p>
            </PortalCardHeader>
            <PortalCardContent>
              {topicPerformance.length > 0 ? (
                <div className="space-y-3">
                  {topicPerformance.map((topic, idx) => (
                    <div 
                      key={topic.topic} 
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: 'hsl(var(--portal-bg-elevated))' }}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          #{idx + 1}
                        </Badge>
                        <div>
                          <div className="font-medium portal-text-primary capitalize">{topic.topic}</div>
                          <div className="text-sm portal-text-muted">
                            {topic.donations} donations • {topic.deterministicRate}% deterministic • New {topic.newDonors} / Returning {topic.returningDonors}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold portal-text-primary">{formatCurrency(topic.netRevenue)}</div>
                        <div className="text-sm portal-text-muted">
                          Net: {formatCurrency(topic.netRevenue)} · Avg: {formatCurrency(topic.avgDonation)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center portal-text-muted">
                  <Sparkles className="h-8 w-8 mb-2 opacity-50" />
                  <p>No creative topic data available</p>
                  <p className="text-sm">Sync Meta ads with refcodes to see topic performance</p>
                </div>
              )}
            </PortalCardContent>
          </PortalCard>
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donor Tiers */}
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Donor Tiers
                </PortalCardTitle>
              </PortalCardHeader>
              <PortalCardContent>
                {segmentBreakdown.length > 0 ? (
                  <PortalBarChart
                    data={segmentBreakdown}
                    height={250}
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center portal-text-muted">
                    No segment data available
                  </div>
                )}
              </PortalCardContent>
            </PortalCard>

            {/* RFM Score Distribution */}
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  RFM Score Distribution
                </PortalCardTitle>
                <p className="text-sm portal-text-muted mt-1">
                  Combined Recency, Frequency, Monetary scores (1-5)
                </p>
              </PortalCardHeader>
              <PortalCardContent>
                {rfmDistribution.some(d => d.value > 0) ? (
                  <PortalBarChart
                    data={rfmDistribution}
                    height={250}
                    barColor="hsl(var(--portal-success))"
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center portal-text-muted">
                    No RFM data available
                  </div>
                )}
              </PortalCardContent>
            </PortalCard>
          </div>

          {/* Segment Details Table */}
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle>Segment Breakdown</PortalCardTitle>
            </PortalCardHeader>
            <PortalCardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {segmentBreakdown.map(segment => (
                  <div 
                    key={segment.name}
                    className="p-4 rounded-lg text-center"
                    style={{ background: 'hsl(var(--portal-bg-elevated))' }}
                  >
                    <div className="text-2xl font-bold portal-text-primary">{segment.value}</div>
                    <div className="text-sm font-medium portal-text-primary">{segment.name}</div>
                    <div className="text-xs portal-text-muted">{formatCurrency(segment.totalValue)} LTV</div>
                  </div>
                ))}
              </div>
            </PortalCardContent>
          </PortalCard>
        </TabsContent>

        <TabsContent value="sms" className="space-y-6">
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                SMS Funnel
              </PortalCardTitle>
            </PortalCardHeader>
            <PortalCardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Sent", value: smsFunnel.sent },
                  { label: "Delivered", value: smsFunnel.delivered },
                  { label: "Clicked", value: smsFunnel.clicked },
                  { label: "Donated (via journeys)", value: smsFunnel.donated },
                  { label: "Opt-outs", value: smsFunnel.optedOut },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                    <div className="text-sm portal-text-muted">{item.label}</div>
                    <div className="text-2xl font-bold portal-text-primary">{item.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                  <div className="text-sm portal-text-muted">SMS Spend</div>
                  <div className="text-2xl font-bold portal-text-primary">
                    {smsCost >= 1000 ? `$${(smsCost / 1000).toFixed(1)}K` : `$${smsCost.toFixed(0)}`}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                  <div className="text-sm portal-text-muted">Cost / Send</div>
                  <div className="text-2xl font-bold portal-text-primary">
                    {smsSent > 0 ? `$${(smsCost / smsSent).toFixed(3)}` : '$0'}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                  <div className="text-sm portal-text-muted">SMS CAC</div>
                  <div className="text-2xl font-bold portal-text-primary">
                    {smsFunnel.donated > 0 ? `$${(smsCost / smsFunnel.donated).toFixed(0)}` : 'N/A'}
                  </div>
                  <div className="text-xs portal-text-muted">Cost per donating recipient</div>
                </div>
              </div>
            </PortalCardContent>
          </PortalCard>
        </TabsContent>

        <TabsContent value="journeys" className="space-y-6">
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Recent Journeys (top 10)
              </PortalCardTitle>
            </PortalCardHeader>
            <PortalCardContent>
              {groupedJourneys.length === 0 ? (
                <div className="h-[120px] flex items-center justify-center portal-text-muted">
                  No journeys found for this range
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedJourneys.map(([donorKey, events]) => (
                    <div key={donorKey} className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold portal-text-primary">
                          Donor {donorKey.slice(0, 6)}…{donorKey.slice(-4)}
                        </div>
                        <div className="text-xs portal-text-muted">
                          {new Date(events[0].occurred_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {events.slice(0, 6).map((ev, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 portal-text-muted">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--portal-bg-tertiary))] text-[10px] font-semibold">
                                {ev.event_type === 'donation' ? '$' : ev.event_type === 'sms' ? 'SMS' : 'TP'}
                              </span>
                              <span className="portal-text-primary">
                                {ev.event_type === 'donation'
                                  ? `Donation ${ev.net_amount ? `$${Number(ev.net_amount).toFixed(0)}` : ''}`
                                  : ev.event_type === 'sms'
                                  ? `SMS ${ev.source || ''}` 
                                  : `Touchpoint ${ev.source || ''}`}
                              </span>
                            </div>
                            <div className="text-xs portal-text-muted">
                              {new Date(ev.occurred_at).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PortalCardContent>
          </PortalCard>
        </TabsContent>

        <TabsContent value="ltv" className="space-y-6">
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                LTV & Forecast Signals
              </PortalCardTitle>
            </PortalCardHeader>
            <PortalCardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                  <div className="text-sm portal-text-muted">Avg LTV (90d)</div>
                  <div className="text-2xl font-bold portal-text-primary">
                    {ltvSummary.avgLtv90 >= 1000 ? `$${(ltvSummary.avgLtv90 / 1000).toFixed(1)}K` : `$${ltvSummary.avgLtv90.toFixed(0)}`}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                  <div className="text-sm portal-text-muted">Avg LTV (180d)</div>
                  <div className="text-2xl font-bold portal-text-primary">
                    {ltvSummary.avgLtv180 >= 1000 ? `$${(ltvSummary.avgLtv180 / 1000).toFixed(1)}K` : `$${ltvSummary.avgLtv180.toFixed(0)}`}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                  <div className="text-sm portal-text-muted">High Churn Risk</div>
                  <div className="text-2xl font-bold portal-text-primary">
                    {ltvSummary.highRisk.toLocaleString()}
                  </div>
                  <div className="text-xs portal-text-muted">churn_risk ≥ 0.7</div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                  <div className="text-sm portal-text-muted">Profiles scored</div>
                  <div className="text-2xl font-bold portal-text-primary">
                    {ltvSummary.total.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="mt-4 text-sm portal-text-muted">
                Forecasting uses the latest donor_ltv_predictions (heuristic v1, refresh with the LTV refresh function).
              </div>
            </PortalCardContent>
          </PortalCard>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DonorIntelligence;
