import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter 
} from "recharts";
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

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  success: "hsl(142, 76%, 36%)",
  warning: "hsl(38, 92%, 50%)",
  danger: "hsl(0, 84%, 60%)",
  muted: "hsl(var(--muted-foreground))",
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
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-32 mb-2" />
                <div className="h-3 bg-muted rounded w-20" />
              </CardContent>
            </Card>
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
            <h2 className="text-2xl font-bold">Meta Ads Analytics</h2>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-success" />
                  <span className="hidden sm:inline">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Spend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${kpis.totalSpend.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg CPM: ${kpis.averageCPM.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Impressions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalImpressions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                CTR: {kpis.averageCTR.toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Conversions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalConversions}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg CPC: ${kpis.averageCPC.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Average ROAS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {kpis.averageROAS.toFixed(2)}x
                {kpis.averageROAS >= 3 ? (
                  <TrendingUp className="h-5 w-5 text-success" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-danger" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.averageROAS >= 3 ? "Strong performance" : "Needs optimization"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section - Collapsible on Mobile */}
        <Collapsible open={chartsPanelOpen} onOpenChange={setChartsPanelOpen}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <CardTitle>Performance Analytics</CardTitle>
                {chartsPanelOpen ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Performance Trends */}
                <div>
                  <h3 className="text-sm font-semibold mb-4">Performance Over Time</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={performanceTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(value) => format(parseISO(value), "MMM d")}
                      />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Legend />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="spend"
                        fill={CHART_COLORS.primary}
                        fillOpacity={0.3}
                        stroke={CHART_COLORS.primary}
                        name="Spend ($)"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="roas"
                        stroke={CHART_COLORS.success}
                        strokeWidth={2}
                        name="ROAS"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="ctr"
                        stroke={CHART_COLORS.accent}
                        strokeWidth={2}
                        name="CTR (%)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Creative Performance & Device Performance - Responsive Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Creative Performance */}
                  <div>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Creative Type Performance
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={creativePerformance}
                          dataKey="spend"
                          nameKey="type"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label={(entry) => `${entry.type}: $${entry.spend.toFixed(0)}`}
                        >
                          {creativePerformance.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CREATIVE_TYPE_COLORS[entry.type as keyof typeof CREATIVE_TYPE_COLORS] || CHART_COLORS.muted}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Device Performance */}
                  <div>
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Device Platform Performance
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={devicePerformance}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="device" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                        />
                        <Bar dataKey="conversions" fill={CHART_COLORS.primary} name="Conversions" />
                        <Bar dataKey="clicks" fill={CHART_COLORS.accent} name="Clicks" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Campaign Performance Table - Desktop */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
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
                      className="cursor-pointer hover:bg-muted/50"
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
                          <span className="text-xs text-muted-foreground">{campaign.creative_count}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Performance Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {sortedCampaigns.map((campaign) => (
            <Card
              key={campaign.campaign_id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleMobileDetails(campaign)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{campaign.campaign_name}</CardTitle>
                  <Badge variant={campaign.roas >= 3 ? "default" : "secondary"}>
                    {campaign.roas.toFixed(2)}x
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Spend</p>
                    <p className="font-semibold">${campaign.spend.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Conversions</p>
                    <p className="font-semibold">{campaign.conversions}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Impressions</p>
                    <p className="font-semibold">{campaign.impressions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">CTR</p>
                    <p className="font-semibold">{campaign.ctr.toFixed(2)}%</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    {campaign.top_creative_type === "video" && <Video className="h-4 w-4" />}
                    {campaign.top_creative_type === "image" && <Image className="h-4 w-4" />}
                    {campaign.top_creative_type === "carousel" && <Grid3x3 className="h-4 w-4" />}
                    <span className="text-xs text-muted-foreground">
                      {campaign.creative_count} creatives
                    </span>
                  </div>
                  {campaign.top_device && (
                    <div className="flex items-center gap-1">
                      {campaign.top_device === "mobile" && <Smartphone className="h-4 w-4" />}
                      {campaign.top_device === "desktop" && <Monitor className="h-4 w-4" />}
                      {campaign.top_device === "tablet" && <TabletSmartphone className="h-4 w-4" />}
                      <span className="text-xs text-muted-foreground capitalize">{campaign.top_device}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
