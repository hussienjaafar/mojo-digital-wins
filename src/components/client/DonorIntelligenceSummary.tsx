import { Link } from "react-router-dom";
import { Brain, Target, Users, AlertTriangle, ArrowRight } from "lucide-react";
import { V3Card, V3KPICard } from "@/components/v3";
import { Button } from "@/components/ui/button";
import { useDonorIntelligenceQuery } from "@/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DonorIntelligenceSummaryProps {
  organizationId: string;
  startDate: string;
  endDate: string;
}

export const DonorIntelligenceSummary = ({
  organizationId,
  startDate,
  endDate,
}: DonorIntelligenceSummaryProps) => {
  const { data, isLoading } = useDonorIntelligenceQuery(
    organizationId,
    startDate,
    endDate
  );

  const attributionData = data?.attributionData || [];
  const segmentData = data?.segmentData || [];
  const ltvSummary = data?.ltvSummary || { avgLtv90: 0, avgLtv180: 0, highRisk: 0, total: 0 };

  const attributedCount = attributionData.filter(d => d.attributed_platform).length;
  const attributionRate = attributionData.length > 0 
    ? Math.round((attributedCount / attributionData.length) * 100) 
    : 0;
  const majorDonors = segmentData.filter(d => d.donor_tier === 'major').length;

  if (isLoading) {
    return (
      <V3Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </V3Card>
    );
  }

  return (
    <V3Card className="p-6 border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[hsl(var(--portal-accent-green)/0.1)]">
            <Brain className="h-5 w-5 text-[hsl(var(--portal-accent-green))]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
              Donor Intelligence
            </h3>
            <p className="text-sm text-[hsl(var(--portal-text-muted))]">
              Attribution, segments & RFM analysis
            </p>
          </div>
        </div>
        <Link to="/client/donor-intelligence">
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "gap-2",
              "bg-[hsl(var(--portal-bg-elevated))]",
              "border-[hsl(var(--portal-border))]",
              "text-[hsl(var(--portal-text-primary))]",
              "hover:bg-[hsl(var(--portal-bg-hover))]"
            )}
          >
            View Full Analysis
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <V3KPICard
          icon={Target}
          label="Attribution Rate"
          value={`${attributionRate}%`}
          subtitle={`${attributedCount} of ${attributionData.length} donations`}
          accent="blue"
        />
        <V3KPICard
          icon={Users}
          label="Total Donors"
          value={segmentData.length.toLocaleString()}
          subtitle="in database"
          accent="green"
        />
        <V3KPICard
          icon={Brain}
          label="Major Donors"
          value={majorDonors}
          subtitle="$1,000+ lifetime"
          accent="purple"
        />
        <V3KPICard
          icon={AlertTriangle}
          label="High Churn Risk"
          value={ltvSummary.highRisk}
          subtitle="donors at risk"
          accent="amber"
        />
      </div>
    </V3Card>
  );
};
