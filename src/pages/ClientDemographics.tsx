import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, MapPin, Briefcase, Users, DollarSign, TrendingUp, Share2 } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { ClientShell } from "@/components/client/ClientShell";
import {
  V3PageContainer,
  V3KPICard,
  V3ChartWrapper,
  V3LoadingState,
  V3EmptyState,
  V3Button,
  V3DataTable,
  type V3Column,
} from "@/components/v3";
import { EChartsBarChart, EChartsPieChart } from "@/components/charts/echarts";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

type DonorStats = {
  totalDonors: number;
  totalRevenue: number;
  averageDonation: number;
  locationData: Array<{ state: string; count: number; revenue: number }>;
  occupationData: Array<{ occupation: string; count: number; revenue: number }>;
  channelData: Array<{ channel: string; count: number; revenue: number }>;
};

const ClientDemographics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const { data: clientUser } = await (supabase as any)
        .from('client_users')
        .select('organization_id')
        .eq('id', session?.user?.id)
        .maybeSingle();

      if (!clientUser) throw new Error("Organization not found");

      const { data: org } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', clientUser.organization_id)
        .maybeSingle();

      setOrganization(org);

      const { data: transactions, error } = await (supabase as any)
        .from('actblue_transactions_secure')
        .select('*')
        .eq('organization_id', clientUser.organization_id);

      if (error) throw error;

      const totalDonors = new Set(transactions?.map((t: any) => t.donor_email).filter(Boolean)).size;
      const totalRevenue = transactions?.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0) || 0;
      const averageDonation = totalDonors > 0 ? totalRevenue / transactions.length : 0;

      const locationMap = new Map<string, { count: number; revenue: number }>();
      transactions?.forEach((t: any) => {
        if (t.state) {
          const existing = locationMap.get(t.state) || { count: 0, revenue: 0 };
          locationMap.set(t.state, {
            count: existing.count + 1,
            revenue: existing.revenue + Number(t.amount || 0),
          });
        }
      });
      const locationData = Array.from(locationMap.entries())
        .map(([state, data]) => ({ state, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const occupationMap = new Map<string, { count: number; revenue: number }>();
      transactions?.forEach((t: any) => {
        const occupation = t.occupation || 'Not Provided';
        const existing = occupationMap.get(occupation) || { count: 0, revenue: 0 };
        occupationMap.set(occupation, {
          count: existing.count + 1,
          revenue: existing.revenue + Number(t.amount || 0),
        });
      });
      const occupationData = Array.from(occupationMap.entries())
        .map(([occupation, data]) => ({ occupation, ...data }))
        .filter(item => item.occupation !== 'Not Provided')
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const channelMap = new Map<string, { count: number; revenue: number }>();
      transactions?.forEach((t: any) => {
        const channel = t.refcode ? 'Campaign' : t.is_express ? 'Express' : 'Direct';
        const existing = channelMap.get(channel) || { count: 0, revenue: 0 };
        channelMap.set(channel, {
          count: existing.count + 1,
          revenue: existing.revenue + Number(t.amount || 0),
        });
      });
      const channelData = Array.from(channelMap.entries())
        .map(([channel, data]) => ({ channel, ...data }));

      setStats({
        totalDonors,
        totalRevenue,
        averageDonation,
        locationData,
        occupationData,
        channelData,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const { data: clientUser } = await (supabase as any)
        .from('client_users')
        .select('organization_id')
        .eq('id', session?.user?.id)
        .maybeSingle();

      const { data: transactions } = await (supabase as any)
        .from('actblue_transactions_secure')
        .select('*')
        .eq('organization_id', clientUser.organization_id);

      const headers = ['Date', 'Donor Name', 'Email', 'Amount', 'State', 'City', 'Occupation', 'Employer'];
      const rows = transactions?.map((t: any) => [
        t.transaction_date,
        t.donor_name || '',
        t.donor_email || '',
        t.amount,
        t.state || '',
        t.city || '',
        t.occupation || '',
        t.employer || '',
      ]) || [];

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `donor-demographics-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      toast({
        title: "Success",
        description: "Donor demographics exported to CSV",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Table column definitions
  const locationColumns: V3Column<{ state: string; count: number; revenue: number }>[] = [
    {
      key: "state",
      header: "State",
      render: (row) => (
        <span className="font-medium">{row.state}</span>
      ),
      sortable: true,
      sortFn: (a, b) => a.state.localeCompare(b.state),
    },
    {
      key: "revenue",
      header: "Revenue",
      render: (row) => (
        <span className="font-semibold text-[hsl(var(--portal-success))]">
          ${row.revenue.toLocaleString()}
        </span>
      ),
      align: "right",
      sortable: true,
      sortFn: (a, b) => a.revenue - b.revenue,
    },
    {
      key: "count",
      header: "Donors",
      render: (row) => (
        <span className="text-[hsl(var(--portal-text-muted))]">
          {row.count.toLocaleString()}
        </span>
      ),
      align: "right",
      sortable: true,
      sortFn: (a, b) => a.count - b.count,
    },
  ];

  const occupationColumns: V3Column<{ occupation: string; count: number; revenue: number }>[] = [
    {
      key: "occupation",
      header: "Occupation",
      render: (row) => (
        <span className="font-medium truncate max-w-[200px] block">{row.occupation}</span>
      ),
      sortable: true,
      sortFn: (a, b) => a.occupation.localeCompare(b.occupation),
    },
    {
      key: "revenue",
      header: "Revenue",
      render: (row) => (
        <span className="font-semibold text-[hsl(var(--portal-success))]">
          ${row.revenue.toLocaleString()}
        </span>
      ),
      align: "right",
      sortable: true,
      sortFn: (a, b) => a.revenue - b.revenue,
    },
    {
      key: "count",
      header: "Donors",
      render: (row) => (
        <span className="text-[hsl(var(--portal-text-muted))]">
          {row.count.toLocaleString()}
        </span>
      ),
      align: "right",
      sortable: true,
      sortFn: (a, b) => a.count - b.count,
    },
  ];

  if (isLoading) {
    return (
      <ClientShell>
        <div className="p-6">
          <V3LoadingState variant="kpi-grid" count={3} />
          <div className="mt-6">
            <V3LoadingState variant="chart" />
          </div>
        </div>
      </ClientShell>
    );
  }

  if (!organization || !stats) {
    return (
      <ClientShell>
        <V3EmptyState
          title="No Donor Data"
          description="There is no transaction data available to analyze demographics."
          accent="blue"
        />
      </ClientShell>
    );
  }

  // Prepare pie chart data
  const occupationPieData = stats.occupationData.slice(0, 6).map(item => ({
    name: item.occupation.length > 20 ? item.occupation.slice(0, 20) + '...' : item.occupation,
    value: item.count,
  }));

  const channelPieData = stats.channelData.map(item => ({
    name: item.channel,
    value: item.revenue,
  }));

  return (
    <ClientShell>
      <V3PageContainer
        title="Donor Demographics"
        description="Analyze your donor base by location, occupation, and acquisition channel"
        actions={
          <V3Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </V3Button>
        }
      >
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <V3KPICard
            label="Total Donors"
            value={stats.totalDonors.toLocaleString()}
            icon={Users}
            accent="blue"
          />
          <V3KPICard
            label="Total Revenue"
            value={`$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            accent="green"
          />
          <V3KPICard
            label="Average Donation"
            value={`$${stats.averageDonation.toFixed(2)}`}
            icon={TrendingUp}
            accent="purple"
          />
        </div>

        {/* Location Breakdown - Bar Chart */}
        <V3ChartWrapper
          title="Top Donor Locations"
          icon={MapPin}
          ariaLabel="Bar chart showing donor distribution by state"
          className="mb-6"
        >
          <EChartsBarChart
            data={stats.locationData}
            xAxisKey="state"
            series={[
              { dataKey: "count", name: "Donors" }
            ]}
            height={300}
            valueType="number"
          />
        </V3ChartWrapper>

        {/* Pie Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Occupation Breakdown - Pie Chart */}
          <V3ChartWrapper
            title="Top Occupations"
            icon={Briefcase}
            ariaLabel="Pie chart showing donor distribution by occupation"
          >
            <EChartsPieChart
              data={occupationPieData}
              height={300}
              variant="donut"
              valueType="number"
              showLabels={true}
              labelThreshold={8}
              legendPosition="bottom"
            />
          </V3ChartWrapper>

          {/* Channel Breakdown - Pie Chart */}
          <V3ChartWrapper
            title="Acquisition Channels"
            icon={Share2}
            ariaLabel="Pie chart showing donor distribution by acquisition channel"
          >
            <EChartsPieChart
              data={channelPieData}
              height={300}
              variant="donut"
              valueType="currency"
              showLabels={true}
              legendPosition="bottom"
            />
          </V3ChartWrapper>
        </div>

        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <V3ChartWrapper
            title="Location Details"
            icon={MapPin}
            ariaLabel="Table showing detailed donor statistics by location"
          >
            <V3DataTable
              data={stats.locationData}
              columns={locationColumns}
              getRowKey={(row) => row.state}
              compact
              striped
            />
          </V3ChartWrapper>

          <V3ChartWrapper
            title="Occupation Details"
            icon={Briefcase}
            ariaLabel="Table showing detailed donor statistics by occupation"
          >
            <V3DataTable
              data={stats.occupationData}
              columns={occupationColumns}
              getRowKey={(row) => row.occupation}
              compact
              striped
              maxHeight="400px"
            />
          </V3ChartWrapper>
        </div>
      </V3PageContainer>
    </ClientShell>
  );
};

export default ClientDemographics;
