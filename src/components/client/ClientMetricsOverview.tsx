import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Users, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type AggregatedMetrics = {
  date: string;
  total_ad_spend: number;
  total_sms_cost: number;
  total_funds_raised: number;
  total_donations: number;
  roi_percentage: number;
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

const ClientMetricsOverview = ({ organizationId, startDate, endDate }: Props) => {
  const [metrics, setMetrics] = useState<AggregatedMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [organizationId, startDate, endDate]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('daily_aggregated_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;
      setMetrics(data || []);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalRaised = metrics.reduce((sum, m) => sum + Number(m.total_funds_raised || 0), 0);
  const totalSpent = metrics.reduce((sum, m) => sum + Number(m.total_ad_spend || 0) + Number(m.total_sms_cost || 0), 0);
  const totalDonations = metrics.reduce((sum, m) => sum + Number(m.total_donations || 0), 0);
  const avgROI = totalSpent > 0 ? ((totalRaised - totalSpent) / totalSpent * 100) : 0;

  const spendByChannel = [
    { name: 'Meta Ads', value: metrics.reduce((sum, m) => sum + Number(m.total_ad_spend || 0), 0) },
    { name: 'SMS', value: metrics.reduce((sum, m) => sum + Number(m.total_sms_cost || 0), 0) },
  ];

  if (isLoading) {
    return <div className="text-center py-8">Loading metrics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Raised</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRaised.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalDonations} donations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all channels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgROI.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Return on investment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Donation</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalDonations > 0 ? (totalRaised / totalDonations).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per donor
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Funds Raised Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="total_funds_raised" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Funds Raised"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spend by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={spendByChannel}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: $${value.toLocaleString()}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {spendByChannel.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ROI Trend */}
      <Card>
        <CardHeader>
          <CardTitle>ROI Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))' 
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="roi_percentage" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="ROI %"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientMetricsOverview;
