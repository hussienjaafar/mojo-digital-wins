import { useMemo, useState, useEffect } from "react";
import { V3Card, V3CardContent, V3CardHeader, V3CardTitle } from "@/components/v3/V3Card";
import { V3KPICard } from "@/components/v3/V3KPICard";
import { V3ChartWrapper } from "@/components/v3/V3ChartWrapper";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EChartsLineChart } from "@/components/charts/echarts/EChartsLineChart";
import { EChartsBarChart } from "@/components/charts/echarts/EChartsBarChart";
import { EChartsPieChart } from "@/components/charts/echarts/EChartsPieChart";
import {
  TrendingUp, TrendingDown, DollarSign, Eye, MousePointer,
  Target, AlertCircle, ChevronDown, ChevronUp, Download,
  Filter, RefreshCw, Wifi, WifiOff, Image, Video, Grid3x3,
  Smartphone, Monitor, TabletSmartphone
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useRealtimeMetrics } from "@/hooks/useRealtimeMetrics";
import PullToRefresh from "@/components/PullToRefresh";
import { toast } from "sonner";
import { MetaDataFreshnessIndicator } from "./MetaDataFreshnessIndicator";
import { cssVar, colors, getChartColors } from "@/lib/design-tokens";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type AggregatedMetric = {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cost_per_result: number;
  frequency: number;
  relevance_score: number;
  creative_count: number;
  top_creative_type?: string;
  top_placement?: string;
  top_device?: string;
};

// Chart colors using design system tokens
const CHART_COLORS = {
  primary: cssVar(colors.accent.blue),
  secondary: cssVar(colors.accent.purple),
  accent: cssVar(colors.status.info),
  success: cssVar(colors.status.success),
  warning: cssVar(colors.status.warning),
  danger: cssVar(colors.status.error),
  muted: cssVar(colors.text.muted),
};

const CREATIVE_TYPE_COLORS = {
  image: CHART_COLORS.primary,
  video: CHART_COLORS.secondary,
  carousel: CHART_COLORS.accent,
  collection: CHART_COLORS.success,
  slideshow: CHART_COLORS.warning,
};

export default function EnhancedMetaAdsMetrics({ organizationId, startDate, endDate }: Props) {
  const { metaMetrics, isConnected, lastUpdate, isLoading } = useRealtimeMetrics(organizationId, startDate, endDate);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof AggregatedMetric>("spend");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState<"all" | "high-roas" | "low-frequency" | "mobile-winners">("all");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [mobileDetailsCampaign, setMobileDetailsCampaign] = useState<AggregatedMetric | null>(null);
  const [chartsPanelOpen, setChartsPanelOpen] = useState(true);

  // Auto-collapse charts on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setChartsPanelOpen(false);
      } else {
        setChartsPanelOpen(true);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Aggregate metrics by campaign
  const aggregatedMetrics = useMemo(() => {
    const campaignMap = new Map<string, AggregatedMetric>();

    metaMetrics.forEach((metric) => {
      const key = metric.campaign_id;
      const existing: any = campaignMap.get(key) || {
        campaign_id: metric.campaign_id,
        campaign_name: metric.campaign_id,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversion_value: 0,
        roas: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        cost_per_result: 0,
        frequency: 0,
        relevance_score: 0,
        creative_count: 0,
      };

      existing.spend += metric.spend || 0;
      existing.impressions += metric.impressions || 0;
      existing.clicks += metric.clicks || 0;
      existing.conversions += metric.conversions || 0;
      existing.conversion_value += metric.conversion_value || 0;
      existing.creative_count += 1;

      // Track most common creative type, placement, device
      if (metric.creative_type && !existing.top_creative_type) {
        existing.top_creative_type = metric.creative_type;
      }
      if (metric.placement && !existing.top_placement) {
        existing.top_placement = metric.placement;
      }
      if (metric.device_platform && !existing.top_device) {
        existing.top_device = metric.device_platform;
      }

      campaignMap.set(key, existing);
    });

    // Calculate derived metrics
    return Array.from(campaignMap.values()).map((metric) => ({
      ...metric,
      roas: metric.spend > 0 ? metric.conversion_value / metric.spend : 0,
      ctr: metric.impressions > 0 ? (metric.clicks / metric.impressions) * 100 : 0,
      cpc: metric.clicks > 0 ? metric.spend / metric.clicks : 0,
      cpm: metric.impressions > 0 ? (metric.spend / metric.impressions) * 1000 : 0,
      cost_per_result: metric.conversions > 0 ? metric.spend / metric.conversions : 0,
      frequency: metric.impressions > 0 && metric.clicks > 0 ? metric.impressions / metric.clicks : 0,
    }));
  }, [metaMetrics]);

  // Apply filters
  const filteredMetrics = useMemo(() => {
    let filtered = aggregatedMetrics;

    switch (filterType) {
      case "high-roas":
        filtered = filtered.filter((m) => m.roas >= 3.0);
        break;
      case "low-frequency":
        filtered = filtered.filter((m) => m.frequency < 2.0);
        break;
      case "mobile-winners":
        filtered = filtered.filter((m) => m.top_device === "mobile");
        break;
    }

    return filtered;
  }, [aggregatedMetrics, filterType]);

  // Sort campaigns
  const sortedCampaigns = useMemo(() => {
    return [...filteredMetrics].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDirection === "asc" 
        ? (aVal > bVal ? 1 : -1) 
        : (aVal < bVal ? 1 : -1);
    });
  }, [filteredMetrics, sortField, sortDirection]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalSpend = aggregatedMetrics.reduce((sum, m) => sum + m.spend, 0);
    const totalImpressions = aggregatedMetrics.reduce((sum, m) => sum + m.impressions, 0);
    const totalClicks = aggregatedMetrics.reduce((sum, m) => sum + m.clicks, 0);
    const totalConversions = aggregatedMetrics.reduce((sum, m) => sum + m.conversions, 0);
    const totalConversionValue = aggregatedMetrics.reduce((sum, m) => sum + m.conversion_value, 0);

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      averageROAS: totalSpend > 0 ? totalConversionValue / totalSpend : 0,
      averageCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      averageCPC: totalClicks > 0 ? totalSpend / totalClicks : 0,
      averageCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
    };
  }, [aggregatedMetrics]);

  // Creative performance by type
  const creativePerformance = useMemo(() => {
    const typeMap = new Map<string, { spend: number; conversions: number; impressions: number }>();

    metaMetrics.forEach((metric) => {
      if (!metric.creative_type) return;
      const existing = typeMap.get(metric.creative_type) || { spend: 0, conversions: 0, impressions: 0 };
      existing.spend += metric.spend || 0;
      existing.conversions += metric.conversions || 0;
      existing.impressions += metric.impressions || 0;
      typeMap.set(metric.creative_type, existing);
    });

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      spend: data.spend,
      conversions: data.conversions,
      roas: data.spend > 0 ? data.conversions / data.spend : 0,
      impressions: data.impressions,
    }));
  }, [metaMetrics]);

  // Device performance
  const devicePerformance = useMemo(() => {
    const deviceMap = new Map<string, { spend: number; conversions: number; clicks: number }>();

    metaMetrics.forEach((metric) => {
      if (!metric.device_platform) return;
      const existing = deviceMap.get(metric.device_platform) || { spend: 0, conversions: 0, clicks: 0 };
      existing.spend += metric.spend || 0;
      existing.conversions += metric.conversions || 0;
      existing.clicks += metric.clicks || 0;
      deviceMap.set(metric.device_platform, existing);
    });

    return Array.from(deviceMap.entries()).map(([device, data]) => ({
      device,
      spend: data.spend,
      conversions: data.conversions,
      clicks: data.clicks,
      roas: data.spend > 0 ? data.conversions / data.spend : 0,
    }));
  }, [metaMetrics]);

  // Performance trends over time
  const performanceTrends = useMemo(() => {
    const dateMap = new Map<string, { spend: number; conversions: number; impressions: number; clicks: number }>();

    metaMetrics.forEach((metric) => {
      const date = metric.date;
      const existing = dateMap.get(date) || { spend: 0, conversions: 0, impressions: 0, clicks: 0 };
      existing.spend += metric.spend || 0;
      existing.conversions += metric.conversions || 0;
      existing.impressions += metric.impressions || 0;
      existing.clicks += metric.clicks || 0;
      dateMap.set(date, existing);
    });

    return Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        spend: data.spend,
        conversions: data.conversions,
        roas: data.spend > 0 ? data.conversions / data.spend : 0,
        ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metaMetrics]);

  const handleSort = (field: keyof AggregatedMetric) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleExportCSV = () => {
    const headers = ["Campaign", "Spend", "Impressions", "Clicks", "Conversions", "ROAS", "CTR", "CPC"];
    const rows = sortedCampaigns.map((c) => [
      c.campaign_name,
      c.spend.toFixed(2),
      c.impressions,
      c.clicks,
      c.conversions,
      c.roas.toFixed(2),
      c.ctr.toFixed(2),
      c.cpc.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meta-ads-performance-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Report exported successfully");
  };

  const handleRefresh = async () => {
    toast.success("Data refreshed");
  };

  const handleCampaignToggle = (campaignId: string) => {
    if (compareMode) {
      setSelectedCampaigns((prev) =>
        prev.includes(campaignId)
          ? prev.filter((id) => id !== campaignId)
          : prev.length < 3
          ? [...prev, campaignId]
          : prev
      );
    } else {
      setExpandedCampaign(expandedCampaign === campaignId ? null : campaignId);
    }
  };

  const handleMobileDetails = (campaign: AggregatedMetric) => {
    setMobileDetailsCampaign(campaign);
    setShowMobileDetails(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <V3KPICard key={i} icon={DollarSign} label="Loading..." value="--" isLoading />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6">
        {/* Header with connection status */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">Meta Ads Analytics</h2>
            <div className="flex items-center gap-1 text-sm text-[hsl(var(--portal-text-muted))]">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                  <span className="hidden sm:inline">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <MetaDataFreshnessIndicator organizationId={organizationId} compact />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareMode(!compareMode)}
              className={compareMode ? "bg-primary/10" : ""}
            >
              <Filter className="h-4 w-4 mr-2" />
              {compareMode ? "Exit Compare" : "Compare"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* Smart Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { value: "all", label: "All Campaigns" },
            { value: "high-roas", label: "High ROAS (3.0+)" },
            { value: "low-frequency", label: "Low Frequency" },
            { value: "mobile-winners", label: "Mobile Winners" },
          ].map((filter) => (
            <Button
              key={filter.value}
              variant={filterType === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(filter.value as any)}
              className="whitespace-nowrap"
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* KPI Cards - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <V3KPICard
            icon={DollarSign}
            label="Total Spend"
            value={`$${kpis.totalSpend.toFixed(2)}`}
            subtitle={`Avg CPM: $${kpis.averageCPM.toFixed(2)}`}
            accent="blue"
          />
          <V3KPICard
            icon={Eye}
            label="Impressions"
            value={kpis.totalImpressions.toLocaleString()}
            subtitle={`CTR: ${kpis.averageCTR.toFixed(2)}%`}
            accent="purple"
          />
          <V3KPICard
            icon={Target}
            label="Conversions"
            value={kpis.totalConversions.toString()}
            subtitle={`Avg CPC: $${kpis.averageCPC.toFixed(2)}`}
            accent="green"
          />
          <V3KPICard
            icon={TrendingUp}
            label="Average ROAS"
            value={`${kpis.averageROAS.toFixed(2)}x`}
            subtitle={kpis.averageROAS >= 3 ? "Strong performance" : "Needs optimization"}
            accent={kpis.averageROAS >= 3 ? "green" : "amber"}
          />
        </div>

        {/* Charts Section - Collapsible on Mobile */}
        <Collapsible open={chartsPanelOpen} onOpenChange={setChartsPanelOpen}>
          <V3Card>
            <V3CardHeader>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <V3CardTitle>Performance Analytics</V3CardTitle>
                {chartsPanelOpen ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </CollapsibleTrigger>
            </V3CardHeader>
            <CollapsibleContent>
              <V3CardContent className="space-y-6">
                {/* Performance Trends */}
                <div>
                  <h3 className="text-sm font-semibold mb-4 text-[hsl(var(--portal-text-primary))]">Performance Over Time</h3>
                  <EChartsLineChart
                    data={performanceTrends as Record<string, any>[]}
                    xAxisKey="date"
                    xAxisType="time"
                    height={250}
                    dualYAxis
                    yAxisValueTypeLeft="currency"
                    yAxisValueTypeRight="number"
                    series={[
                      {
                        dataKey: "spend",
                        name: "Spend ($)",
                        color: CHART_COLORS.primary,
                        type: "area",
                        areaStyle: { opacity: 0.3 },
                        yAxisIndex: 0,
                        valueType: "currency",
                      },
                      {
                        dataKey: "roas",
                        name: "ROAS",
                        color: CHART_COLORS.success,
                        yAxisIndex: 1,
                        valueType: "number",
                      },
                      {
                        dataKey: "ctr",
                        name: "CTR (%)",
                        color: CHART_COLORS.accent,
                        yAxisIndex: 1,
                        valueType: "percent",
                      },
                    ]}
                  />
                </div>

                {/* Creative Performance & Device Performance - Responsive Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Creative Performance */}
                  <div>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
                      <Image className="h-4 w-4" />
                      Creative Type Performance
                    </h3>
                    <EChartsPieChart
                      data={creativePerformance.map((entry) => ({
                        name: entry.type,
                        value: entry.spend,
                        color: CREATIVE_TYPE_COLORS[entry.type as keyof typeof CREATIVE_TYPE_COLORS] || CHART_COLORS.muted,
                      }))}
                      height={200}
                      valueType="currency"
                    />
                  </div>

                  {/* Device Performance */}
                  <div>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
                      <Smartphone className="h-4 w-4" />
                      Device Platform Performance
                    </h3>
                    <EChartsBarChart
                      data={devicePerformance as unknown as Record<string, unknown>[]}
                      xAxisKey="device"
                      series={[
                        { dataKey: "conversions", name: "Conversions", color: CHART_COLORS.primary },
                        { dataKey: "clicks", name: "Clicks", color: CHART_COLORS.accent },
                      ]}
                      height={200}
                      disableHoverEmphasis
                    />
                  </div>
                </div>
              </V3CardContent>
            </CollapsibleContent>
          </V3Card>
        </Collapsible>

        {/* Campaign Performance Table - Desktop */}
        <V3Card className="hidden md:block" title="Campaign Performance">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("campaign_name")}>
                    Campaign {sortField === "campaign_name" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("spend")}>
                    Spend {sortField === "spend" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("impressions")}>
                    Impressions {sortField === "impressions" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("clicks")}>
                    Clicks {sortField === "clicks" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("conversions")}>
                    Conversions {sortField === "conversions" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("roas")}>
                    ROAS {sortField === "roas" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("ctr")}>
                    CTR {sortField === "ctr" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="text-right">Creative</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCampaigns.map((campaign) => (
                  <TableRow
                    key={campaign.campaign_id}
                    className="cursor-pointer hover:bg-[hsl(var(--portal-bg-hover))]"
                    onClick={() => handleCampaignToggle(campaign.campaign_id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {compareMode && (
                          <input
                            type="checkbox"
                            checked={selectedCampaigns.includes(campaign.campaign_id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleCampaignToggle(campaign.campaign_id);
                            }}
                            className="h-4 w-4"
                          />
                        )}
                        {campaign.campaign_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">${campaign.spend.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{campaign.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{campaign.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{campaign.conversions}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={campaign.roas >= 3 ? "default" : "secondary"}>
                        {campaign.roas.toFixed(2)}x
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{campaign.ctr.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {campaign.top_creative_type === "video" && <Video className="h-4 w-4" />}
                        {campaign.top_creative_type === "image" && <Image className="h-4 w-4" />}
                        {campaign.top_creative_type === "carousel" && <Grid3x3 className="h-4 w-4" />}
                        <span className="text-xs text-[hsl(var(--portal-text-muted))]">{campaign.creative_count}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </V3Card>

        {/* Campaign Performance Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {sortedCampaigns.map((campaign) => (
            <V3Card
              key={campaign.campaign_id}
              interactive
              className="cursor-pointer"
              onClick={() => handleMobileDetails(campaign)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-[hsl(var(--portal-text-primary))]">{campaign.campaign_name}</span>
                <Badge variant={campaign.roas >= 3 ? "default" : "secondary"}>
                  {campaign.roas.toFixed(2)}x
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[hsl(var(--portal-text-muted))] text-xs">Spend</p>
                  <p className="font-semibold text-[hsl(var(--portal-text-primary))]">${campaign.spend.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[hsl(var(--portal-text-muted))] text-xs">Conversions</p>
                  <p className="font-semibold text-[hsl(var(--portal-text-primary))]">{campaign.conversions}</p>
                </div>
                <div>
                  <p className="text-[hsl(var(--portal-text-muted))] text-xs">Impressions</p>
                  <p className="font-semibold text-[hsl(var(--portal-text-primary))]">{campaign.impressions.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[hsl(var(--portal-text-muted))] text-xs">CTR</p>
                  <p className="font-semibold text-[hsl(var(--portal-text-primary))]">{campaign.ctr.toFixed(2)}%</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-[hsl(var(--portal-border))]">
                <div className="flex items-center gap-2">
                  {campaign.top_creative_type === "video" && <Video className="h-4 w-4" />}
                  {campaign.top_creative_type === "image" && <Image className="h-4 w-4" />}
                  {campaign.top_creative_type === "carousel" && <Grid3x3 className="h-4 w-4" />}
                  <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                    {campaign.creative_count} creatives
                  </span>
                </div>
                {campaign.top_device && (
                  <div className="flex items-center gap-1">
                    {campaign.top_device === "mobile" && <Smartphone className="h-4 w-4" />}
                    {campaign.top_device === "desktop" && <Monitor className="h-4 w-4" />}
                    {campaign.top_device === "tablet" && <TabletSmartphone className="h-4 w-4" />}
                    <span className="text-xs text-[hsl(var(--portal-text-muted))] capitalize">{campaign.top_device}</span>
                  </div>
                )}
              </div>
            </V3Card>
          ))}
        </div>

        {/* Mobile Details Sheet */}
        <Sheet open={showMobileDetails} onOpenChange={setShowMobileDetails}>
          <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{mobileDetailsCampaign?.campaign_name}</SheetTitle>
            </SheetHeader>
            {mobileDetailsCampaign && (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Spend</p>
                    <p className="text-2xl font-bold">${mobileDetailsCampaign.spend.toFixed(2)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">ROAS</p>
                    <p className="text-2xl font-bold">{mobileDetailsCampaign.roas.toFixed(2)}x</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Impressions</p>
                    <p className="text-xl font-semibold">{mobileDetailsCampaign.impressions.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Clicks</p>
                    <p className="text-xl font-semibold">{mobileDetailsCampaign.clicks.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Conversions</p>
                    <p className="text-xl font-semibold">{mobileDetailsCampaign.conversions}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">CTR</p>
                    <p className="text-xl font-semibold">{mobileDetailsCampaign.ctr.toFixed(2)}%</p>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <h3 className="font-semibold">Performance Metrics</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPC:</span>
                      <span className="font-medium">${mobileDetailsCampaign.cpc.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPM:</span>
                      <span className="font-medium">${mobileDetailsCampaign.cpm.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost/Result:</span>
                      <span className="font-medium">${mobileDetailsCampaign.cost_per_result.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequency:</span>
                      <span className="font-medium">{mobileDetailsCampaign.frequency.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {mobileDetailsCampaign.top_creative_type && (
                  <div className="space-y-2 pt-4 border-t">
                    <h3 className="font-semibold">Creative Details</h3>
                    <div className="flex items-center gap-2">
                      {mobileDetailsCampaign.top_creative_type === "video" && <Video className="h-5 w-5" />}
                      {mobileDetailsCampaign.top_creative_type === "image" && <Image className="h-5 w-5" />}
                      {mobileDetailsCampaign.top_creative_type === "carousel" && <Grid3x3 className="h-5 w-5" />}
                      <span className="capitalize">{mobileDetailsCampaign.top_creative_type}</span>
                      <Badge variant="outline">{mobileDetailsCampaign.creative_count} creatives</Badge>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Last Update Indicator */}
        {lastUpdate && (
          <p className="text-xs text-muted-foreground text-center">
            Last updated: {format(lastUpdate, "MMM d, yyyy 'at' h:mm a")}
          </p>
        )}
      </div>
    </PullToRefresh>
  );
}
