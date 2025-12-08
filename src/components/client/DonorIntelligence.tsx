import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PortalCard, PortalCardHeader, PortalCardTitle, PortalCardContent } from "@/components/portal/PortalCard";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Target, Sparkles, DollarSign, BarChart3, Activity } from "lucide-react";
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
}

interface SmsFunnel {
  sent: number;
  delivered: number;
  clicked: number;
  donated: number;
  optedOut: number;
}

export const DonorIntelligence = ({ organizationId, startDate, endDate }: DonorIntelligenceProps) => {
  const [attributionData, setAttributionData] = useState<AttributionData[]>([]);
  const [segmentData, setSegmentData] = useState<DonorSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deterministicOnly, setDeterministicOnly] = useState(false);
  const [smsFunnel, setSmsFunnel] = useState<SmsFunnel>({ sent: 0, delivered: 0, clicked: 0, donated: 0, optedOut: 0 });

  useEffect(() => {
    loadData();
  }, [organizationId, startDate, endDate]);

  const isDeterministic = (d: AttributionData) => {
    return Boolean(
      d.attributed_platform &&
      (d.attributed_campaign_id || d.attributed_ad_id || d.attributed_creative_id || d.refcode)
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

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load attribution data
      const { data: attrData, error: attrError } = await (supabase as any)
        .from('donation_attribution')
        .select('attributed_platform, attributed_campaign_id, attributed_ad_id, attributed_creative_id, refcode, creative_topic, creative_tone, amount, net_amount, transaction_type')
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
        .select('event_type')
        .eq('organization_id', organizationId)
        .gte('occurred_at', startDate)
        .lte('occurred_at', `${endDate}T23:59:59`);

      if (smsError) {
        logger.error('Failed to load SMS events', smsError);
      } else {
        const counts = (smsEvents || []).reduce((acc: any, ev: any) => {
          const type = ev.event_type || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        setSmsFunnel({
          sent: counts.sent || 0,
          delivered: counts.delivered || 0,
          clicked: counts.clicked || 0,
          donated: counts.donated || 0, // placeholder until donation linkage is added
          optedOut: counts.opted_out || 0,
        });
      }
    } catch (error) {
      logger.error('Failed to load donor intelligence data', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Revenue by platform - formatted for PortalBarChart
  const platformRevenue = useMemo(() => {
    const byPlatform: Record<string, { revenue: number; netRevenue: number; count: number }> = {};
    filteredAttribution.forEach(d => {
      const platform = d.attributed_platform || 'unattributed';
      if (!byPlatform[platform]) {
        byPlatform[platform] = { revenue: 0, netRevenue: 0, count: 0 };
      }
      byPlatform[platform].revenue += Number(d.amount || 0);
      byPlatform[platform].netRevenue += Number(d.net_amount ?? d.amount ?? 0);
      byPlatform[platform].count++;
    });

    return Object.entries(byPlatform)
      .map(([platform, data]) => ({
        name: platform.charAt(0).toUpperCase() + platform.slice(1),
        value: Math.round(data.revenue),
        netRevenue: Math.round(data.netRevenue),
        donations: data.count,
        avgDonation: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [attributionData]);

  // Revenue by creative topic
  const topicPerformance = useMemo(() => {
    const byTopic: Record<string, { revenue: number; count: number }> = {};
    filteredAttribution.forEach(d => {
      const topic = d.creative_topic || 'unknown';
      if (!byTopic[topic]) {
        byTopic[topic] = { revenue: 0, count: 0 };
      }
      byTopic[topic].revenue += Number(d.amount || 0);
      byTopic[topic].count++;
    });

    return Object.entries(byTopic)
      .filter(([topic]) => topic !== 'unknown')
      .map(([topic, data]) => ({
        topic,
        donations: data.count,
        revenue: Math.round(data.revenue),
        avgDonation: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [attributionData]);

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="topics">Creative Topics</TabsTrigger>
          <TabsTrigger value="segments">Donor Segments</TabsTrigger>
          <TabsTrigger value="sms">SMS Funnel</TabsTrigger>
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
              </PortalCardHeader>
              <PortalCardContent>
                {platformRevenue.length > 0 ? (
                  <PortalBarChart
                    data={platformRevenue}
                    height={250}
                    valueType="currency"
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center portal-text-muted">
                    No attributed donations yet
                  </div>
                )}
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
                          <div className="text-sm portal-text-muted">{platform.donations} donations</div>
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
                Revenue generated by AI-identified creative themes
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
                          <div className="text-sm portal-text-muted">{topic.donations} donations</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold portal-text-primary">{formatCurrency(topic.revenue)}</div>
                        <div className="text-sm portal-text-muted">Avg: {formatCurrency(topic.avgDonation)}</div>
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
                  { label: "Donated (placeholder)", value: smsFunnel.donated },
                  { label: "Opt-outs", value: smsFunnel.optedOut },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                    <div className="text-sm portal-text-muted">{item.label}</div>
                    <div className="text-2xl font-bold portal-text-primary">{item.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </PortalCardContent>
          </PortalCard>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DonorIntelligence;
