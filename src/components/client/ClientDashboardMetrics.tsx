import { PortalMetric } from "@/components/portal/PortalMetric";
import { PortalCard, PortalCardHeader, PortalCardTitle, PortalCardContent } from "@/components/portal/PortalCard";
import { PortalLineChart } from "@/components/portal/PortalLineChart";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { PortalCircularProgress } from "@/components/portal/PortalCircularProgress";
import { TrendingUp, DollarSign, Users, Target, Star } from "lucide-react";

interface ClientDashboardMetricsProps {
  organizationId: string;
  startDate: string;
  endDate: string;
}

export const ClientDashboardMetrics = ({ organizationId, startDate, endDate }: ClientDashboardMetricsProps) => {
  // Mock data for demo - would be fetched from API
  const kpiCards = [
    {
      label: "Engagement Rate",
      value: "68%",
      icon: TrendingUp,
      trend: { value: 12.5, isPositive: true },
      subtitle: "vs. last month",
    },
    {
      label: "Donor Conversion",
      value: "3.4%",
      icon: DollarSign,
      trend: { value: 8.2, isPositive: true },
      subtitle: "30-day average",
    },
    {
      label: "Active Supporters",
      value: "1,284",
      icon: Users,
      trend: { value: 15.3, isPositive: true },
      subtitle: "Growing monthly",
    },
    {
      label: "Campaign Reach",
      value: "42.3K",
      icon: Target,
      trend: { value: 2.1, isPositive: false },
      subtitle: "Total impressions",
    },
  ];

  const lineChartData = [
    { name: "2022-08", loyalty: 500, new: 200, repeated: 850 },
    { name: "2022-09", loyalty: 400, new: 450, repeated: 520 },
    { name: "2022-10", loyalty: 200, new: 380, repeated: 450 },
    { name: "2022-11", loyalty: 900, new: 450, repeated: 380 },
    { name: "2022-12", loyalty: 450, new: 750, repeated: 480 },
    { name: "2023-01", loyalty: 850, new: 350, repeated: 850 },
    { name: "2023-02", loyalty: 350, new: 800, repeated: 350 },
    { name: "2023-03", loyalty: 850, new: 250, repeated: 900 },
  ];

  const barChartData = [
    { name: "Jan", value: 20, label: "20%" },
    { name: "Feb", value: 30, label: "30%" },
    { name: "Mar", value: 25, label: "25%" },
    { name: "Apr", value: 50, label: "50%" },
    { name: "May", value: 65, label: "65%" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards Row - Simplified 4-card layout with staggered animations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((metric, index) => (
          <PortalMetric
            key={index}
            label={metric.label}
            value={metric.value}
            icon={metric.icon}
            trend={metric.trend}
            subtitle={metric.subtitle}
            className={`portal-delay-${index * 100}`}
          />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loyalty Order Analysis - Large Chart */}
        <PortalCard className="lg:col-span-2 portal-animate-slide-in-left">
          <PortalCardHeader>
            <PortalCardTitle>Loyalty driven order analysis</PortalCardTitle>
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold portal-text-primary">$ 541.00</div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#0D84FF]"></div>
                  <span className="text-xs portal-text-muted">Loyalty</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold portal-text-primary">$ 324.76</div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#FF6B6B]"></div>
                  <span className="text-xs portal-text-muted">New</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold portal-text-primary">$ 376.34</div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#A78BFA]"></div>
                  <span className="text-xs portal-text-muted">Repeated</span>
                </div>
              </div>
            </div>
          </PortalCardHeader>
          <PortalCardContent>
            <PortalLineChart
              data={lineChartData}
              lines={[
                { dataKey: "loyalty", stroke: "#0D84FF", name: "Loyalty Orders" },
                { dataKey: "new", stroke: "#FF6B6B", name: "New Orders" },
                { dataKey: "repeated", stroke: "#A78BFA", name: "Repeat Orders" },
              ]}
              height={280}
            />
          </PortalCardContent>
        </PortalCard>

        {/* Total Reviews Card */}
        <PortalCard className="portal-animate-slide-in-right portal-delay-100">
          <PortalCardHeader>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-[#FFB020] flex items-center justify-center">
                <Star className="h-5 w-5 text-white fill-white" />
              </div>
              <div className="text-3xl font-bold portal-text-primary">70</div>
            </div>
            <PortalCardTitle className="text-base">Total Reviews</PortalCardTitle>
          </PortalCardHeader>
          <PortalCardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm portal-text-muted">Excellent</span>
                <span className="text-sm font-semibold portal-text-primary">50%</span>
              </div>
              <div className="h-2 w-full bg-portal-bg-elevated rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-[#0D84FF] rounded-full" 
                     style={{ boxShadow: "0 0 8px hsl(var(--portal-accent-blue) / 0.6)" }}></div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm portal-text-muted">Good</span>
                <span className="text-sm font-semibold portal-text-primary">78%</span>
              </div>
              <div className="h-2 w-full bg-portal-bg-elevated rounded-full overflow-hidden">
                <div className="h-full w-[78%] bg-[#0D84FF] rounded-full"
                     style={{ boxShadow: "0 0 8px hsl(var(--portal-accent-blue) / 0.6)" }}></div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm portal-text-muted">Poor</span>
                <span className="text-sm font-semibold portal-text-primary">30%</span>
              </div>
              <div className="h-2 w-full bg-portal-bg-elevated rounded-full overflow-hidden">
                <div className="h-full w-[30%] bg-[#0D84FF] rounded-full"
                     style={{ boxShadow: "0 0 8px hsl(var(--portal-accent-blue) / 0.6)" }}></div>
              </div>
            </div>
          </PortalCardContent>
        </PortalCard>
      </div>

      {/* Bottom Row - Bar Chart and Profit Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rewards Utilization */}
        <PortalCard className="lg:col-span-2 portal-animate-fade-in portal-delay-200">
          <PortalCardHeader>
            <PortalCardTitle>Rewards Utilization</PortalCardTitle>
          </PortalCardHeader>
          <PortalCardContent>
            <PortalBarChart data={barChartData} height={240} />
          </PortalCardContent>
        </PortalCard>

        {/* Sales Report / Total Profit */}
        <PortalCard className="portal-animate-scale-in portal-delay-300">
          <PortalCardHeader>
            <PortalCardTitle>Sales Report</PortalCardTitle>
            <p className="text-sm portal-text-muted mt-1">Quarterly Sales Performance Analysis</p>
          </PortalCardHeader>
          <PortalCardContent className="flex flex-col items-center justify-center py-8">
            <PortalCircularProgress value={68} size="lg" showLabel={false} />
            <div className="mt-6 text-center">
              <div className="text-3xl font-bold portal-text-primary">$2,119.54</div>
              <div className="text-sm portal-text-muted mt-1">Total Profit</div>
            </div>
            <div className="w-full mt-6 pt-6 border-t border-portal-border grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-sm portal-text-muted">Monthly Profit</div>
                <div className="text-lg font-semibold portal-text-primary mt-1">$ 1,654.54</div>
              </div>
              <div className="text-center">
                <div className="text-sm portal-text-muted">Yearly Profit</div>
                <div className="text-lg font-semibold portal-text-primary mt-1">$ 8,732.87</div>
              </div>
            </div>
          </PortalCardContent>
        </PortalCard>
      </div>
    </div>
  );
};
