import { useState, useMemo } from "react";
import { PortalCard, PortalCardHeader, PortalCardTitle, PortalCardContent } from "@/components/portal/PortalCard";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Target, Sparkles, DollarSign, BarChart3, Activity, GitBranch } from "lucide-react";
import { useDonorIntelligenceQuery, type AttributionData } from "@/queries";

interface DonorIntelligenceProps {
  organizationId: string;
  startDate: string;
  endDate: string;
}

export const DonorIntelligence = ({ organizationId, startDate, endDate }: DonorIntelligenceProps) => {
  const [deterministicOnly, setDeterministicOnly] = useState(false);

  const { data, isLoading } = useDonorIntelligenceQuery(organizationId, startDate, endDate);

  const attributionData = data?.attributionData || [];
  const segmentData = data?.segmentData || [];
  const smsFunnel = data?.smsFunnel || { sent: 0, delivered: 0, clicked: 0, donated: 0, optedOut: 0 };
  const journeyEvents = data?.journeyEvents || [];
  const smsCost = data?.smsCost || 0;
  const smsSent = data?.smsSent || 0;
  const ltvSummary = data?.ltvSummary || { avgLtv90: 0, avgLtv180: 0, highRisk: 0, total: 0 };
  const metaSpend = data?.metaSpend || 0;

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
    const byDonor: Record<string, typeof journeyEvents> = {};
    journeyEvents.forEach(ev => {
      if (!ev.donor_key) return;
      if (!byDonor[ev.donor_key]) byDonor[ev.donor_key] = [];
      byDonor[ev.donor_key].push(ev);
    });
    Object.values(byDonor).forEach(list => list.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()));
    return Object.entries(byDonor)
      .sort(([, a], [, b]) => (new Date(b[0]?.occurred_at || 0).getTime()) - (new Date(a[0]?.occurred_at || 0).getTime()))
      .slice(0, 10);
  }, [journeyEvents]);

  const platformRevenue = useMemo(() => {
    const byPlatform: Record<string, { revenue: number; netRevenue: number; count: number; deterministicCount: number }> = {};
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
  }, [filteredAttribution]);

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
  }, [filteredAttribution]);

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

  const rfmDistribution = useMemo(() => {
    const scores: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    segmentData.forEach(d => {
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
                    enableCrossHighlight
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
                    enableCrossHighlight
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center portal-text-muted">
                    No segment data available
                  </div>
                )}
              </PortalCardContent>
            </PortalCard>

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
                    enableCrossHighlight
                  />
                ) : (
                  <div className="h-[250px] flex items-center justify-center portal-text-muted">
                    No RFM data available
                  </div>
                )}
              </PortalCardContent>
            </PortalCard>
          </div>

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
                        {events.length > 6 && (
                          <div className="text-xs portal-text-muted mt-1">
                            +{events.length - 6} more events
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PortalCardContent>
          </PortalCard>
        </TabsContent>

        <TabsContent value="ltv" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="portal-card p-4">
              <div className="text-sm portal-text-muted mb-1">Avg LTV 90</div>
              <div className="text-2xl font-bold portal-text-primary">{formatCurrency(ltvSummary.avgLtv90)}</div>
            </div>
            <div className="portal-card p-4">
              <div className="text-sm portal-text-muted mb-1">Avg LTV 180</div>
              <div className="text-2xl font-bold portal-text-primary">{formatCurrency(ltvSummary.avgLtv180)}</div>
            </div>
            <div className="portal-card p-4">
              <div className="text-sm portal-text-muted mb-1">High Churn Risk</div>
              <div className="text-2xl font-bold text-[hsl(var(--portal-error))]">{ltvSummary.highRisk}</div>
              <div className="text-xs portal-text-muted">donors (≥70% risk)</div>
            </div>
            <div className="portal-card p-4">
              <div className="text-sm portal-text-muted mb-1">Total Predicted</div>
              <div className="text-2xl font-bold portal-text-primary">{ltvSummary.total}</div>
              <div className="text-xs portal-text-muted">donors with predictions</div>
            </div>
          </div>
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle>LTV Distribution</PortalCardTitle>
              <p className="text-sm portal-text-muted mt-1">
                Predicted lifetime value cohorts based on RFM scores and historical behavior.
              </p>
            </PortalCardHeader>
            <PortalCardContent>
              <div className="h-[200px] flex items-center justify-center portal-text-muted">
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>LTV distribution chart coming soon</p>
                  <p className="text-sm">Run ML predictions to populate this view</p>
                </div>
              </div>
            </PortalCardContent>
          </PortalCard>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DonorIntelligence;
