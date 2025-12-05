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
  Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  TrendingUp, TrendingDown, MessageSquare, Users, 
  DollarSign, AlertCircle, Clock, Target, ChevronDown,
  ChevronUp, Download, Filter, RefreshCw, Wifi, WifiOff
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useRealtimeMetrics } from "@/hooks/useRealtimeMetrics";
import PullToRefresh from "@/components/PullToRefresh";
import { toast } from "sonner";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type AggregatedMetric = {
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
  delivery_rate: number;
  opt_out_rate: number;
  click_through_rate: number;
  conversion_rate: number;
  bounce_rate: number;
  cost_per_conversion: number;
  time_to_conversion: number;
  audience_segment: string;
  a_b_test_variant: string;
};

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  destructive: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground))",
};

export default function EnhancedSMSMetrics({ organizationId, startDate, endDate }: Props) {
  const { smsMetrics, isConnected, lastUpdate, isLoading } = useRealtimeMetrics(organizationId, startDate, endDate);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof AggregatedMetric>("messages_sent");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState<"all" | "high-performers" | "needs-attention" | "ab-tests">("all");
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

  // Aggregate metrics by campaign - works with sms_campaigns table
  const aggregatedMetrics = useMemo(() => {
    const aggregated: Record<string, AggregatedMetric> = {};
    
    smsMetrics.forEach(metric => {
      const key = metric.campaign_id || metric.id;
      if (!key) return;
      
      if (!aggregated[key]) {
        aggregated[key] = {
          campaign_id: key,
          campaign_name: metric.campaign_name || metric.message_text?.substring(0, 50) || key,
          messages_sent: 0,
          messages_delivered: 0,
          messages_failed: 0,
          opt_outs: 0,
          clicks: 0,
          conversions: 0,
          amount_raised: 0,
          cost: 0,
          delivery_rate: 0,
          opt_out_rate: 0,
          click_through_rate: 0,
          conversion_rate: 0,
          bounce_rate: 0,
          cost_per_conversion: 0,
          time_to_conversion: 0,
          audience_segment: metric.phone_list_name || "General",
          a_b_test_variant: "",
        };
      }
      
      const agg = aggregated[key];
      agg.messages_sent += metric.messages_sent || 0;
      agg.messages_delivered += metric.messages_delivered || 0;
      agg.messages_failed += metric.messages_failed || metric.skipped || 0;
      agg.opt_outs += metric.opt_outs || metric.previously_opted_out || 0;
      agg.clicks += metric.clicks || 0;
      agg.conversions += metric.conversions || 0;
      agg.amount_raised += Number(metric.amount_raised || 0);
      agg.cost += Number(metric.cost || 0);
    });

    // Calculate derived metrics
    Object.values(aggregated).forEach(agg => {
      agg.delivery_rate = agg.messages_sent > 0 
        ? (agg.messages_delivered / agg.messages_sent) * 100 
        : 0;
      agg.opt_out_rate = agg.messages_delivered > 0 
        ? (agg.opt_outs / agg.messages_delivered) * 100 
        : 0;
      agg.click_through_rate = agg.messages_delivered > 0 
        ? (agg.clicks / agg.messages_delivered) * 100 
        : 0;
      agg.conversion_rate = agg.clicks > 0 
        ? (agg.conversions / agg.clicks) * 100 
        : 0;
      agg.bounce_rate = agg.messages_sent > 0 
        ? (agg.messages_failed / agg.messages_sent) * 100 
        : 0;
      agg.cost_per_conversion = agg.conversions > 0 
        ? agg.cost / agg.conversions 
        : 0;
    });

    return Object.values(aggregated).sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortDirection === "asc" 
        ? (aVal > bVal ? 1 : -1)
        : (aVal < bVal ? 1 : -1);
    });
  }, [smsMetrics, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    return aggregatedMetrics.reduce((acc, metric) => ({
      messages_sent: acc.messages_sent + metric.messages_sent,
      messages_delivered: acc.messages_delivered + metric.messages_delivered,
      messages_failed: acc.messages_failed + metric.messages_failed,
      clicks: acc.clicks + metric.clicks,
      conversions: acc.conversions + metric.conversions,
      opt_outs: acc.opt_outs + metric.opt_outs,
      amount_raised: acc.amount_raised + metric.amount_raised,
      cost: acc.cost + metric.cost,
    }), {
      messages_sent: 0,
      messages_delivered: 0,
      messages_failed: 0,
      clicks: 0,
      conversions: 0,
      opt_outs: 0,
      amount_raised: 0,
      cost: 0,
    });
  }, [aggregatedMetrics]);

  const avgDeliveryRate = totals.messages_sent > 0 
    ? (totals.messages_delivered / totals.messages_sent) * 100 
    : 0;
  const avgConversionRate = totals.clicks > 0 
    ? (totals.conversions / totals.clicks) * 100 
    : 0;
  const avgOptOutRate = totals.messages_delivered > 0 
    ? (totals.opt_outs / totals.messages_delivered) * 100 
    : 0;
  const avgCostPerConversion = totals.conversions > 0 
    ? totals.cost / totals.conversions 
    : 0;

  // Prepare funnel data
  const funnelData = [
    { stage: "Sent", value: totals.messages_sent, percentage: 100 },
    { 
      stage: "Delivered", 
      value: totals.messages_delivered, 
      percentage: totals.messages_sent > 0 ? (totals.messages_delivered / totals.messages_sent) * 100 : 0 
    },
    { 
      stage: "Clicked", 
      value: totals.clicks, 
      percentage: totals.messages_delivered > 0 ? (totals.clicks / totals.messages_delivered) * 100 : 0 
    },
    { 
      stage: "Converted", 
      value: totals.conversions, 
      percentage: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0 
    },
  ];

  // Time series data for trends - use send_date from sms_campaigns
  const timeSeriesData = useMemo(() => {
    const dataByDate: Record<string, any> = {};
    
    smsMetrics.forEach(metric => {
      // Use send_date from sms_campaigns table, fallback to date for backwards compat
      const dateKey = metric.send_date 
        ? format(new Date(metric.send_date), 'yyyy-MM-dd')
        : metric.date || '';
      if (!dateKey) return;
      
      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = {
          date: dateKey,
          messages_sent: 0,
          messages_delivered: 0,
          clicks: 0,
          conversions: 0,
          amount_raised: 0,
          count: 0,
        };
      }
      
      const data = dataByDate[dateKey];
      data.messages_sent += metric.messages_sent || 0;
      data.messages_delivered += metric.messages_delivered || 0;
      data.clicks += metric.clicks || 0;
      data.conversions += metric.conversions || 0;
      data.amount_raised += Number(metric.amount_raised || 0);
      data.count++;
    });

    return Object.values(dataByDate)
      .map(d => ({
        ...d,
        delivery_rate: d.messages_sent > 0 ? (d.messages_delivered / d.messages_sent) * 100 : 0,
        conversion_rate: d.clicks > 0 ? (d.conversions / d.clicks) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [smsMetrics]);

  // Audience segment performance
  const segmentPerformance = useMemo(() => {
    const bySegment: Record<string, any> = {};
    
    aggregatedMetrics.forEach(metric => {
      const segment = metric.audience_segment || "General";
      if (!bySegment[segment]) {
        bySegment[segment] = {
          segment,
          conversions: 0,
          amount_raised: 0,
          cost: 0,
        };
      }
      bySegment[segment].conversions += metric.conversions;
      bySegment[segment].amount_raised += metric.amount_raised;
      bySegment[segment].cost += metric.cost;
    });

    return Object.values(bySegment).map(s => ({
      ...s,
      roi: s.cost > 0 ? ((s.amount_raised - s.cost) / s.cost) * 100 : 0,
    }));
  }, [aggregatedMetrics]);

  // Optimization recommendations
  const recommendations = useMemo(() => {
    const recs: { type: string; severity: "high" | "medium" | "low"; message: string }[] = [];

    if (avgOptOutRate > 5) {
      recs.push({
        type: "opt-out",
        severity: "high",
        message: `High opt-out rate (${avgOptOutRate.toFixed(1)}%). Review message content and frequency.`
      });
    }

    if (avgDeliveryRate < 90) {
      recs.push({
        type: "delivery",
        severity: "high",
        message: `Low delivery rate (${avgDeliveryRate.toFixed(1)}%). Check contact list quality.`
      });
    }

    if (avgCostPerConversion > 50) {
      recs.push({
        type: "cost",
        severity: "medium",
        message: `High cost per conversion ($${avgCostPerConversion.toFixed(2)}). Optimize targeting.`
      });
    }

    const bestSegment = segmentPerformance.reduce((best, current) => 
      current.roi > best.roi ? current : best
    , { segment: "", roi: -Infinity });

    if (bestSegment.roi > 100) {
      recs.push({
        type: "opportunity",
        severity: "low",
        message: `Segment "${bestSegment.segment}" shows ${bestSegment.roi.toFixed(0)}% ROI. Consider scaling.`
      });
    }

    return recs;
  }, [avgOptOutRate, avgDeliveryRate, avgCostPerConversion, segmentPerformance]);

  const handleSort = (field: keyof AggregatedMetric) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading SMS analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Last Update Indicator */}
      {lastUpdate && (
        <div className="text-xs text-muted-foreground text-right">
          Last updated: {format(lastUpdate, "PPp")}
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.messages_sent.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {avgDeliveryRate.toFixed(1)}% delivered
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-secondary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Conversions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.conversions.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {avgConversionRate.toFixed(1)}% conversion rate
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-accent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cost per Conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgCostPerConversion.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              ${totals.cost.toLocaleString()} total cost
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${avgOptOutRate > 5 ? 'border-l-destructive' : 'border-l-muted'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Opt-out Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgOptOutRate.toFixed(2)}%</div>
            <div className="text-xs text-muted-foreground mt-1">
              {totals.opt_outs.toLocaleString()} opt-outs
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Optimization Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Optimization Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((rec, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded-md border-l-4 ${
                  rec.severity === 'high' 
                    ? 'bg-destructive/10 border-l-destructive' 
                    : rec.severity === 'medium'
                    ? 'bg-accent/10 border-l-accent'
                    : 'bg-secondary/10 border-l-secondary'
                }`}
              >
                <div className="flex items-start gap-2">
                  <Badge variant={rec.severity === 'high' ? 'destructive' : 'secondary'}>
                    {rec.severity.toUpperCase()}
                  </Badge>
                  <p className="text-sm flex-1">{rec.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
              <YAxis dataKey="stage" type="category" stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)"
                }}
                formatter={(value: number, name: string) => {
                  const item = funnelData.find(d => d.value === value);
                  return [
                    `${value.toLocaleString()} (${item?.percentage.toFixed(1)}%)`,
                    name === "value" ? "Count" : name
                  ];
                }}
              />
              <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Trends Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)"
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="delivery_rate" 
                stroke={CHART_COLORS.primary} 
                name="Delivery Rate %" 
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="conversion_rate" 
                stroke={CHART_COLORS.secondary} 
                name="Conversion Rate %" 
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="opt_out_rate" 
                fill={CHART_COLORS.destructive} 
                stroke={CHART_COLORS.destructive}
                fillOpacity={0.2}
                name="Opt-out Rate %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Audience Segment Performance */}
      {segmentPerformance.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Audience Segment Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={segmentPerformance}
                    dataKey="conversions"
                    nameKey="segment"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.segment}: ${entry.conversions}`}
                  >
                    {segmentPerformance.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-3">
                {segmentPerformance.map((seg, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                    <div>
                      <div className="font-medium">{seg.segment}</div>
                      <div className="text-sm text-muted-foreground">
                        {seg.conversions} conversions
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${seg.roi > 0 ? 'text-secondary' : 'text-destructive'}`}>
                        {seg.roi > 0 ? '+' : ''}{seg.roi.toFixed(0)}% ROI
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${seg.amount_raised.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign Details Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Campaign Details</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSort("campaign_name")}>
                    Campaign {sortField === "campaign_name" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("messages_sent")}>
                    Sent {sortField === "messages_sent" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("delivery_rate")}>
                    Delivery % {sortField === "delivery_rate" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("conversions")}>
                    Conversions {sortField === "conversions" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("conversion_rate")}>
                    Conv. Rate {sortField === "conversion_rate" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("cost_per_conversion")}>
                    Cost/Conv. {sortField === "cost_per_conversion" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort("opt_out_rate")}>
                    Opt-out % {sortField === "opt_out_rate" && (sortDirection === "asc" ? "↑" : "↓")}
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregatedMetrics.map((metric) => (
                  <Collapsible
                    key={metric.campaign_id}
                    open={expandedCampaign === metric.campaign_id}
                    onOpenChange={() => setExpandedCampaign(
                      expandedCampaign === metric.campaign_id ? null : metric.campaign_id
                    )}
                    asChild
                  >
                    <>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div>
                            {metric.campaign_name}
                            {metric.a_b_test_variant && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {metric.a_b_test_variant}
                              </Badge>
                            )}
                          </div>
                          {metric.audience_segment !== "General" && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {metric.audience_segment}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {metric.messages_sent.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={metric.delivery_rate < 90 ? 'text-destructive font-medium' : ''}>
                            {metric.delivery_rate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {metric.conversions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {metric.conversion_rate.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          ${metric.cost_per_conversion.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={metric.opt_out_rate > 5 ? 'text-destructive font-medium' : ''}>
                            {metric.opt_out_rate.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {expandedCampaign === metric.campaign_id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/20">
                            <div className="p-4 space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <div className="text-muted-foreground">Delivered</div>
                                  <div className="font-medium">{metric.messages_delivered.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Failed</div>
                                  <div className="font-medium">{metric.messages_failed.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Clicks</div>
                                  <div className="font-medium">{metric.clicks.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Click Rate</div>
                                  <div className="font-medium">{metric.click_through_rate.toFixed(2)}%</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Amount Raised</div>
                                  <div className="font-medium text-secondary">${metric.amount_raised.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Total Cost</div>
                                  <div className="font-medium">${metric.cost.toLocaleString()}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Bounce Rate</div>
                                  <div className="font-medium">{metric.bounce_rate.toFixed(2)}%</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Opt-outs</div>
                                  <div className="font-medium">{metric.opt_outs.toLocaleString()}</div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
