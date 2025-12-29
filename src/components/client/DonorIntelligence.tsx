import { useState, useMemo } from "react";
import { 
  V3Card, 
  V3CardHeader, 
  V3CardTitle, 
  V3CardContent, 
  V3KPICard, 
  V3LoadingState, 
  V3ChartWrapper 
} from "@/components/v3";
import { EChartsBarChart } from "@/components/charts/echarts";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
      <div className="space-y-6">
        <V3LoadingState variant="kpi-grid" count={4} />
        <V3LoadingState variant="chart" height={280} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <V3KPICard
          icon={Target}
          label="Attributed"
          value={attributionData.filter(d => d.attributed_platform).length}
          subtitle={`of ${attributionData.length} donations`}
          accent="blue"
        />
        <V3KPICard
          icon={Sparkles}
          label="Topics Linked"
          value={attributionData.filter(d => d.creative_topic).length}
          subtitle="donations with creative topic"
          accent="purple"
        />
        <V3KPICard
          icon={Users}
          label="Total Donors"
          value={segmentData.length.toLocaleString()}
          subtitle="in database"
          accent="green"
        />
        <V3KPICard
          icon={DollarSign}
          label="Major Donors"
          value={segmentData.filter(d => d.donor_tier === 'major').length}
          subtitle="$1,000+ lifetime"
          accent="amber"
        />
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
          <button
            type="button"
            className={cn(badgeVariants({ variant: deterministicOnly ? "default" : "outline" }), "cursor-pointer")}
            aria-pressed={deterministicOnly}
            onClick={() => setDeterministicOnly(!deterministicOnly)}
          >
            {deterministicOnly ? "Showing deterministic only" : "Filter to deterministic"}
          </button>
        </div>
        <TabsList className="flex w-full overflow-x-auto scrollbar-thin scrollbar-thumb-[hsl(var(--portal-border))] scrollbar-track-transparent">
          <TabsTrigger value="attribution" className="flex-shrink-0">Attribution</TabsTrigger>
          <TabsTrigger value="topics" className="flex-shrink-0">Topics</TabsTrigger>
          <TabsTrigger value="segments" className="flex-shrink-0">Segments</TabsTrigger>
          <TabsTrigger value="sms" className="flex-shrink-0">SMS</TabsTrigger>
          <TabsTrigger value="journeys" className="flex-shrink-0">Journeys</TabsTrigger>
          <TabsTrigger value="ltv" className="flex-shrink-0">LTV</TabsTrigger>
        </TabsList>

        <TabsContent value="attribution" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <V3Card>
              <V3CardHeader>
                <V3CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Revenue by Platform
                </V3CardTitle>
                <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
                  CPA/ROAS shown when spend is available (Meta).
                </p>
              </V3CardHeader>
              <V3CardContent>
                {platformRevenue.length > 0 ? (
                  <div
                    role="figure"
                    aria-label="Bar chart showing revenue by platform"
                    tabIndex={0}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))] rounded-lg"
                  >
                    <EChartsBarChart
                      data={platformRevenue}
                      xAxisKey="name"
                      series={[{ dataKey: "value", name: "Revenue" }]}
                      height={250}
                      valueType="currency"
                    />
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
                    No attributed donations yet
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                    <div className="text-[hsl(var(--portal-text-muted))] text-xs mb-1">Meta CPA</div>
                    <div className="font-semibold text-[hsl(var(--portal-text-primary))]">
                      {platformEfficiency.meta.donations > 0 ? formatCurrency(platformEfficiency.meta.cpa) : 'N/A'}
                    </div>
                    <div className="text-[hsl(var(--portal-text-muted))] text-[11px]">Spend / Meta donations</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                    <div className="text-[hsl(var(--portal-text-muted))] text-xs mb-1">Meta ROAS (net)</div>
                    <div className="font-semibold text-[hsl(var(--portal-text-primary))]">
                      {platformEfficiency.meta.spend > 0 ? `${platformEfficiency.meta.roas.toFixed(1)}x` : 'N/A'}
                    </div>
                    <div className="text-[hsl(var(--portal-text-muted))] text-[11px]">Net revenue / spend</div>
                  </div>
                </div>
              </V3CardContent>
            </V3Card>

            <V3Card>
              <V3CardHeader>
                <V3CardTitle>Platform Performance</V3CardTitle>
              </V3CardHeader>
              <V3CardContent>
                <div className="space-y-3">
                  {platformRevenue.map((platform, idx) => (
                    <div 
                      key={platform.name} 
                      className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-[hsl(var(--portal-text-muted))]">#{idx + 1}</div>
                        <div>
                          <div className="font-medium text-[hsl(var(--portal-text-primary))]">{platform.name}</div>
                          <div className="text-sm text-[hsl(var(--portal-text-muted))]">
                            {platform.donations} donations | {platform.deterministicRate}% deterministic
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[hsl(var(--portal-text-primary))]">{formatCurrency(platform.value)}</div>
                        <div className="text-sm text-[hsl(var(--portal-text-muted))]">Avg: {formatCurrency(platform.avgDonation)}</div>
                      </div>
                    </div>
                  ))}
                  {platformRevenue.length === 0 && (
                    <div className="text-center py-8 text-[hsl(var(--portal-text-muted))]">
                      No platform data available
                    </div>
                  )}
                </div>
              </V3CardContent>
            </V3Card>
          </div>
        </TabsContent>

        <TabsContent value="topics" className="space-y-6">
          <V3Card>
            <V3CardHeader>
              <V3CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Top Performing Creative Topics
              </V3CardTitle>
              <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
                Revenue generated by AI-identified creative themes; includes deterministic % and new vs returning donors.
              </p>
            </V3CardHeader>
            <V3CardContent>
              {topicPerformance.length > 0 ? (
                <div className="space-y-3">
                  {topicPerformance.map((topic, idx) => (
                    <div 
                      key={topic.topic} 
                      className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          #{idx + 1}
                        </Badge>
                        <div>
                          <div className="font-medium text-[hsl(var(--portal-text-primary))] capitalize">{topic.topic}</div>
                          <div className="text-sm text-[hsl(var(--portal-text-muted))]">
                            {topic.donations} donations | {topic.deterministicRate}% deterministic | New {topic.newDonors} / Returning {topic.returningDonors}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[hsl(var(--portal-text-primary))]">{formatCurrency(topic.netRevenue)}</div>
                        <div className="text-sm text-[hsl(var(--portal-text-muted))]">
                          Net: {formatCurrency(topic.netRevenue)} | Avg: {formatCurrency(topic.avgDonation)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-[hsl(var(--portal-text-muted))]">
                  <Sparkles className="h-8 w-8 mb-2 opacity-50" />
                  <p>No creative topic data available</p>
                  <p className="text-sm">Sync Meta ads with refcodes to see topic performance</p>
                </div>
              )}
            </V3CardContent>
          </V3Card>
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <V3Card>
              <V3CardHeader>
                <V3CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Donor Tiers
                </V3CardTitle>
              </V3CardHeader>
              <V3CardContent>
                {segmentBreakdown.length > 0 ? (
                  <div
                    role="figure"
                    aria-label="Bar chart showing donor tiers by count"
                    tabIndex={0}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))] rounded-lg"
                  >
                    <EChartsBarChart
                      data={segmentBreakdown}
                      xAxisKey="name"
                      series={[{ dataKey: "value", name: "Donors" }]}
                      height={250}
                    />
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
                    No segment data available
                  </div>
                )}
              </V3CardContent>
            </V3Card>

            <V3Card>
              <V3CardHeader>
                <V3CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  RFM Score Distribution
                </V3CardTitle>
                <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
                  Combined Recency, Frequency, Monetary scores (1-5)
                </p>
              </V3CardHeader>
              <V3CardContent>
                {rfmDistribution.some(d => d.value > 0) ? (
                  <div
                    role="figure"
                    aria-label="Bar chart showing RFM score distribution"
                    tabIndex={0}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))] rounded-lg"
                  >
                    <EChartsBarChart
                      data={rfmDistribution}
                      xAxisKey="name"
                      series={[{ dataKey: "value", name: "Donors", color: "hsl(var(--portal-success))" }]}
                      height={250}
                    />
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
                    No RFM data available
                  </div>
                )}
              </V3CardContent>
            </V3Card>
          </div>

          <V3Card>
            <V3CardHeader>
              <V3CardTitle>Segment Breakdown</V3CardTitle>
            </V3CardHeader>
            <V3CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {segmentBreakdown.map(segment => (
                  <div 
                    key={segment.name}
                    className="p-4 rounded-lg text-center bg-[hsl(var(--portal-bg-elevated))]"
                  >
                    <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{segment.value}</div>
                    <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">{segment.name}</div>
                    <div className="text-xs text-[hsl(var(--portal-text-muted))]">{formatCurrency(segment.totalValue)} LTV</div>
                  </div>
                ))}
              </div>
            </V3CardContent>
          </V3Card>
        </TabsContent>

        <TabsContent value="sms" className="space-y-6">
          <V3Card>
            <V3CardHeader>
              <V3CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                SMS Funnel
              </V3CardTitle>
            </V3CardHeader>
            <V3CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Sent", value: smsFunnel.sent },
                  { label: "Delivered", value: smsFunnel.delivered },
                  { label: "Clicked", value: smsFunnel.clicked },
                  { label: "Donated (via journeys)", value: smsFunnel.donated },
                  { label: "Opt-outs", value: smsFunnel.optedOut },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                    <div className="text-sm text-[hsl(var(--portal-text-muted))]">{item.label}</div>
                    <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{item.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                  <div className="text-sm text-[hsl(var(--portal-text-muted))]">SMS Spend</div>
                  <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                    {smsCost >= 1000 ? `$${(smsCost / 1000).toFixed(1)}K` : `$${smsCost.toFixed(0)}`}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                  <div className="text-sm text-[hsl(var(--portal-text-muted))]">Cost / Send</div>
                  <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                    {smsSent > 0 ? `$${(smsCost / smsSent).toFixed(3)}` : '$0'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                  <div className="text-sm text-[hsl(var(--portal-text-muted))]">SMS CAC</div>
                  <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                    {smsFunnel.donated > 0 ? `$${(smsCost / smsFunnel.donated).toFixed(0)}` : 'N/A'}
                  </div>
                  <div className="text-xs text-[hsl(var(--portal-text-muted))]">Cost per donating recipient</div>
                </div>
              </div>
            </V3CardContent>
          </V3Card>
        </TabsContent>

        <TabsContent value="journeys" className="space-y-6">
          <V3Card>
            <V3CardHeader>
              <V3CardTitle className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Recent Journeys (top 10)
              </V3CardTitle>
            </V3CardHeader>
            <V3CardContent>
              {groupedJourneys.length === 0 ? (
                <div className="h-[120px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
                  No journeys found for this range
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedJourneys.map(([donorKey, events]) => (
                    <div key={donorKey} className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">
                          Donor {donorKey.slice(0, 6)}…{donorKey.slice(-4)}
                        </div>
                        <div className="text-xs text-[hsl(var(--portal-text-muted))]">
                          {new Date(events[0].occurred_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {events.slice(0, 6).map((ev, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-[hsl(var(--portal-text-muted))]">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--portal-bg-surface))] text-[10px] font-semibold">
                                {ev.event_type === 'donation' ? '$' : ev.event_type === 'sms' ? 'SMS' : 'TP'}
                              </span>
                              <span className="text-[hsl(var(--portal-text-primary))]">
                                {ev.event_type === 'donation'
                                  ? `Donation ${ev.net_amount ? `$${Number(ev.net_amount).toFixed(0)}` : ''}`
                                  : ev.event_type === 'sms'
                                  ? `SMS ${ev.source || ''}` 
                                  : `Touchpoint ${ev.source || ''}`}
                              </span>
                            </div>
                            <div className="text-xs text-[hsl(var(--portal-text-muted))]">
                              {new Date(ev.occurred_at).toLocaleString()}
                            </div>
                          </div>
                        ))}
                        {events.length > 6 && (
                          <div className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
                            +{events.length - 6} more events
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </V3CardContent>
          </V3Card>
        </TabsContent>

        <TabsContent value="ltv" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <V3Card className="p-4">
              <div className="text-sm text-[hsl(var(--portal-text-muted))] mb-1">Avg LTV 90</div>
              <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{formatCurrency(ltvSummary.avgLtv90)}</div>
            </V3Card>
            <V3Card className="p-4">
              <div className="text-sm text-[hsl(var(--portal-text-muted))] mb-1">Avg LTV 180</div>
              <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{formatCurrency(ltvSummary.avgLtv180)}</div>
            </V3Card>
            <V3Card className="p-4">
              <div className="text-sm text-[hsl(var(--portal-text-muted))] mb-1">High Churn Risk</div>
              <div className="text-2xl font-bold text-[hsl(var(--portal-error))]">{ltvSummary.highRisk}</div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))]">donors (≥70% risk)</div>
            </V3Card>
            <V3Card className="p-4">
              <div className="text-sm text-[hsl(var(--portal-text-muted))] mb-1">Total Predicted</div>
              <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{ltvSummary.total}</div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))]">donors with predictions</div>
            </V3Card>
          </div>
          <V3Card>
            <V3CardHeader>
              <V3CardTitle>LTV Distribution</V3CardTitle>
              <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
                Predicted lifetime value cohorts based on RFM scores and historical behavior.
              </p>
            </V3CardHeader>
            <V3CardContent>
              <div className="h-[200px] flex items-center justify-center text-[hsl(var(--portal-text-muted))]">
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>LTV distribution chart coming soon</p>
                  <p className="text-sm">Run ML predictions to populate this view</p>
                </div>
              </div>
            </V3CardContent>
          </V3Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DonorIntelligence;
