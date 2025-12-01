import { PortalMetric } from "@/components/portal/PortalMetric";
import { TrendingUp, DollarSign, Users, Target } from "lucide-react";

interface ClientDashboardMetricsProps {
  organizationId: string;
  startDate: string;
  endDate: string;
}

export const ClientDashboardMetrics = ({ organizationId, startDate, endDate }: ClientDashboardMetricsProps) => {
  // This would normally fetch real data - using mock data for now
  const metrics = [
    {
      label: "Total Revenue",
      value: "$124.5K",
      icon: DollarSign,
      trend: { value: 12.5, isPositive: true },
    },
    {
      label: "Active Campaigns",
      value: "23",
      icon: Target,
      trend: { value: 8.2, isPositive: true },
    },
    {
      label: "New Donors",
      value: "1,284",
      icon: Users,
      trend: { value: 15.3, isPositive: true },
    },
    {
      label: "Conversion Rate",
      value: "3.42%",
      icon: TrendingUp,
      trend: { value: 2.1, isPositive: false },
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {metrics.map((metric, index) => (
        <PortalMetric
          key={index}
          label={metric.label}
          value={metric.value}
          icon={metric.icon}
          trend={metric.trend}
        />
      ))}
    </div>
  );
};
