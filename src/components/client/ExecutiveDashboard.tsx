import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Users, 
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  RefreshCw,
  Wifi,
  WifiOff,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";
import { useRealtimeMetrics } from "@/hooks/useRealtimeMetrics";
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from "recharts";
import { format, subDays, parseISO } from "date-fns";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type KPICardProps = {
  title: string;
  value: string | number;
  change: number;
  trend: "up" | "down" | "neutral";
  icon: React.ReactNode;
  description?: string;
  onClick?: () => void;
};

type Alert = {
  id: string;
  type: "warning" | "success" | "info" | "danger";
  title: string;
  message: string;
  timestamp: Date;
};

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const ExecutiveDashboard = ({ organizationId, startDate, endDate }: Props) => {
  const { 
    metaMetrics, 
    smsMetrics, 
    transactions, 
    roiAnalytics,
    isConnected, 
    lastUpdate, 
    isLoading 
  } = useRealtimeMetrics(organizationId, startDate, endDate);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalAdSpend = metaMetrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);
    const totalSmsCost = smsMetrics.reduce((sum, m) => sum + Number(m.cost || 0), 0);
    const totalSpend = totalAdSpend + totalSmsCost;
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
    const totalDonations = transactions.length;
    const avgDonation = totalDonations > 0 ? totalRevenue / totalDonations : 0;
    
    // Calculate engagement metrics
    const totalImpressions = metaMetrics.reduce((sum, m) => sum + Number(m.impressions || 0), 0);
    const totalClicks = metaMetrics.reduce((sum, m) => sum + Number(m.clicks || 0), 0);
    const metaCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    
    const totalSmsSent = smsMetrics.reduce((sum, m) => sum + Number(m.messages_sent || 0), 0);
    const totalSmsDelivered = smsMetrics.reduce((sum, m) => sum + Number(m.messages_delivered || 0), 0);
    const smsDeliveryRate = totalSmsSent > 0 ? (totalSmsDelivered / totalSmsSent) * 100 : 0;

    // Calculate previous period for comparison
    const midDate = new Date((new Date(startDate).getTime() + new Date(endDate).getTime()) / 2);
    const currentPeriodRevenue = transactions
      .filter(t => new Date(t.transaction_date) >= midDate)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const previousPeriodRevenue = transactions
      .filter(t => new Date(t.transaction_date) < midDate)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const revenueChange = previousPeriodRevenue > 0 
      ? ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100 
      : 0;

    return {
      totalRevenue,
      roi,
      totalDonations,
      avgDonation,
      totalSpend,
      metaCTR,
      smsDeliveryRate,
      revenueChange,
      totalAdSpend,
      totalSmsCost,
    };
  }, [metaMetrics, smsMetrics, transactions]);

  // Attribution analysis
  const attributionData = useMemo(() => {
    if (roiAnalytics.length === 0) return [];
    
    const platforms = ['meta', 'sms', 'actblue'];
    return platforms.map(platform => {
      const data = roiAnalytics.filter(r => r.platform === platform);
      const firstTouch = data.reduce((sum, r) => sum + Number(r.first_touch_attribution || 0), 0);
      const lastTouch = data.reduce((sum, r) => sum + Number(r.last_touch_attribution || 0), 0);
      const linear = data.reduce((sum, r) => sum + Number(r.linear_attribution || 0), 0);
      
      return {
        name: platform.toUpperCase(),
        firstTouch,
        lastTouch,
        linear,
      };
    });
  }, [roiAnalytics]);

  // Multi-platform performance timeline
  const performanceTimeline = useMemo(() => {
    const dateMap = new Map<string, any>();
    
    metaMetrics.forEach(m => {
      const date = m.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, metaSpend: 0, smsSpend: 0, revenue: 0 });
      }
      const entry = dateMap.get(date);
      entry.metaSpend += Number(m.spend || 0);
    });
    
    smsMetrics.forEach(m => {
      const date = m.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, metaSpend: 0, smsSpend: 0, revenue: 0 });
      }
      const entry = dateMap.get(date);
      entry.smsSpend += Number(m.cost || 0);
    });
    
    transactions.forEach(t => {
      const date = format(parseISO(t.transaction_date), 'yyyy-MM-dd');
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, metaSpend: 0, smsSpend: 0, revenue: 0 });
      }
      const entry = dateMap.get(date);
      entry.revenue += Number(t.amount || 0);
    });
    
    return Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }, [metaMetrics, smsMetrics, transactions]);

  // Generate intelligent alerts
  useEffect(() => {
    const newAlerts: Alert[] = [];
    
    // ROI threshold alert
    if (kpis.roi < 100) {
      newAlerts.push({
        id: 'roi-low',
        type: 'warning',
        title: 'ROI Below Target',
        message: `Current ROI is ${kpis.roi.toFixed(1)}%. Consider optimizing campaign spend.`,
        timestamp: new Date(),
      });
    } else if (kpis.roi > 200) {
      newAlerts.push({
        id: 'roi-high',
        type: 'success',
        title: 'Exceptional ROI',
        message: `ROI is ${kpis.roi.toFixed(1)}%. Campaigns are performing excellently!`,
        timestamp: new Date(),
      });
    }
    
    // SMS delivery rate alert
    if (kpis.smsDeliveryRate < 95 && kpis.smsDeliveryRate > 0) {
      newAlerts.push({
        id: 'sms-delivery',
        type: 'warning',
        title: 'Low SMS Delivery Rate',
        message: `SMS delivery rate is ${kpis.smsDeliveryRate.toFixed(1)}%. Check contact list quality.`,
        timestamp: new Date(),
      });
    }
    
    // Budget efficiency alert
    const efficiency = kpis.totalRevenue > 0 ? (kpis.totalSpend / kpis.totalRevenue) * 100 : 0;
    if (efficiency > 50) {
      newAlerts.push({
        id: 'budget-efficiency',
        type: 'info',
        title: 'Budget Efficiency Notice',
        message: `Spending ${efficiency.toFixed(1)}% of revenue. Review campaign allocations.`,
        timestamp: new Date(),
      });
    }
    
    // Recent donation alert
    const recentDonations = transactions.filter(t => 
      new Date(t.transaction_date) > subDays(new Date(), 1)
    );
    if (recentDonations.length > 10) {
      newAlerts.push({
        id: 'recent-activity',
        type: 'success',
        title: 'High Activity',
        message: `${recentDonations.length} donations in the last 24 hours!`,
        timestamp: new Date(),
      });
    }
    
    setAlerts(newAlerts);
  }, [kpis, transactions]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      // Trigger a subtle re-render
      setAlerts(prev => [...prev]);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const KPICard = ({ title, value, change, trend, icon, description, onClick }: KPICardProps) => (
    <Card 
      className={`transition-all hover:shadow-lg ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        <div className="flex items-center mt-2 text-xs">
          {trend === 'up' && (
            <>
              <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-500 font-medium">+{Math.abs(change).toFixed(1)}%</span>
            </>
          )}
          {trend === 'down' && (
            <>
              <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />
              <span className="text-red-500 font-medium">-{Math.abs(change).toFixed(1)}%</span>
            </>
          )}
          {trend === 'neutral' && (
            <>
              <Minus className="w-4 h-4 text-muted-foreground mr-1" />
              <span className="text-muted-foreground font-medium">0%</span>
            </>
          )}
          <span className="text-muted-foreground ml-2">vs previous period</span>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading executive dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Real-time Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Executive Dashboard</h2>
          <p className="text-muted-foreground">Real-time analytics and performance insights</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-green-500 font-medium">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-red-500 font-medium">Offline</span>
              </>
            )}
          </div>
          
          {/* Last Update */}
          {lastUpdate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{format(lastUpdate, 'HH:mm:ss')}</span>
            </div>
          )}
          
          {/* Auto-refresh Toggle */}
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Revenue"
          value={`$${kpis.totalRevenue.toLocaleString()}`}
          change={kpis.revenueChange}
          trend={kpis.revenueChange > 0 ? 'up' : kpis.revenueChange < 0 ? 'down' : 'neutral'}
          icon={<DollarSign className="w-4 h-4 text-muted-foreground" />}
          description={`${kpis.totalDonations} total donations`}
        />
        
        <KPICard
          title="ROI Performance"
          value={`${kpis.roi.toFixed(1)}%`}
          change={kpis.roi - 150} // Compare to 150% target
          trend={kpis.roi > 150 ? 'up' : kpis.roi < 100 ? 'down' : 'neutral'}
          icon={<Target className="w-4 h-4 text-muted-foreground" />}
          description="Multi-attribution model"
        />
        
        <KPICard
          title="Campaign Efficiency"
          value={`$${kpis.avgDonation.toFixed(2)}`}
          change={10.5}
          trend="up"
          icon={<Zap className="w-4 h-4 text-muted-foreground" />}
          description="Average donation amount"
        />
        
        <KPICard
          title="Audience Engagement"
          value={`${kpis.metaCTR.toFixed(2)}%`}
          change={kpis.metaCTR - 2} // Compare to 2% target
          trend={kpis.metaCTR > 2 ? 'up' : 'down'}
          icon={<Users className="w-4 h-4 text-muted-foreground" />}
          description={`${kpis.smsDeliveryRate.toFixed(1)}% SMS delivery`}
        />
      </div>

      {/* Alerts & Insights Panel */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Intelligent Alerts & Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    alert.type === 'success'
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                      : alert.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
                      : alert.type === 'danger'
                      ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                      : 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                  }`}
                >
                  {alert.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{alert.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-platform Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Multi-Platform Performance Timeline</CardTitle>
          <CardDescription>Revenue vs Marketing Spend (Last 30 Days)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={performanceTimeline}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(parseISO(value), 'MMM d')}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Legend />
                <Bar dataKey="metaSpend" fill={COLORS[0]} name="Meta Ads Spend" />
                <Bar dataKey="smsSpend" fill={COLORS[1]} name="SMS Spend" />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke={COLORS[2]} 
                  strokeWidth={3}
                  name="Revenue"
                  dot={{ fill: COLORS[2], r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Attribution Analysis */}
      {attributionData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Attribution Funnel Analysis</CardTitle>
              <CardDescription>Multi-touch attribution by platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attributionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))' 
                      }}
                    />
                    <Legend />
                    <Bar dataKey="firstTouch" fill={COLORS[0]} name="First Touch" />
                    <Bar dataKey="lastTouch" fill={COLORS[1]} name="Last Touch" />
                    <Bar dataKey="linear" fill={COLORS[2]} name="Linear" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Platform Distribution</CardTitle>
              <CardDescription>Revenue attribution breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attributionData}
                      dataKey="linear"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {attributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Real-time Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest donations and campaign updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-medium">${Number(tx.amount).toFixed(2)} donation</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.donor_name || 'Anonymous'} • {format(parseISO(tx.transaction_date), 'MMM d, HH:mm')}
                    </p>
                  </div>
                </div>
                {tx.is_recurring && (
                  <Badge variant="secondary" className="text-xs">Recurring</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutiveDashboard;
