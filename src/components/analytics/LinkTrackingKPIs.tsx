import React from "react";
import { motion } from "framer-motion";
import {
  MousePointerClick,
  Users,
  Cookie,
  TrendingUp,
  DollarSign,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EnhancedClicksSummary, TrafficSourceBreakdown } from "@/hooks/useEnhancedRedirectClicksQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// Types
// ============================================================================

interface LinkTrackingKPIsProps {
  summary: EnhancedClicksSummary;
  trafficSource: TrafficSourceBreakdown;
  isLoading?: boolean;
  className?: string;
}

interface KPICardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: "blue" | "green" | "purple" | "amber";
  subtitle?: string;
  badge?: React.ReactNode;
}

// ============================================================================
// Styling
// ============================================================================

const accentStyles = {
  blue: {
    iconBg: "bg-[hsl(var(--portal-accent-blue))]/10",
    iconColor: "text-[hsl(var(--portal-accent-blue))]",
  },
  green: {
    iconBg: "bg-[hsl(var(--portal-success))]/10",
    iconColor: "text-[hsl(var(--portal-success))]",
  },
  purple: {
    iconBg: "bg-[hsl(var(--portal-accent-purple))]/10",
    iconColor: "text-[hsl(var(--portal-accent-purple))]",
  },
  amber: {
    iconBg: "bg-[hsl(var(--portal-warning))]/10",
    iconColor: "text-[hsl(var(--portal-warning))]",
  },
};

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function getCaptureQualityBadge(rate: number): React.ReactNode {
  if (rate >= 70) {
    return <Badge variant="default" className="bg-[hsl(var(--portal-success))] text-white text-[10px] px-1.5">Excellent</Badge>;
  } else if (rate >= 50) {
    return <Badge variant="default" className="bg-[hsl(var(--portal-accent-blue))] text-white text-[10px] px-1.5">Good</Badge>;
  } else if (rate >= 30) {
    return <Badge variant="default" className="bg-[hsl(var(--portal-warning))] text-white text-[10px] px-1.5">Fair</Badge>;
  } else {
    return <Badge variant="default" className="bg-[hsl(var(--portal-error))] text-white text-[10px] px-1.5">Low</Badge>;
  }
}

// ============================================================================
// KPI Card Component
// ============================================================================

const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  icon: Icon,
  accent,
  subtitle,
  badge,
}) => {
  const styles = accentStyles[accent];

  return (
    <div
      className={cn(
        "rounded-lg p-3 sm:p-4 border min-w-0",
        "bg-[hsl(var(--portal-bg-elevated))]",
        "border-[hsl(var(--portal-border))]",
        "hover:border-[hsl(var(--portal-border-hover))] hover:shadow-sm",
        "transition-all duration-200"
      )}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={cn("p-1 sm:p-1.5 rounded shrink-0", styles.iconBg)}>
            <Icon className={cn("h-3 w-3 sm:h-4 sm:w-4", styles.iconColor)} />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-[hsl(var(--portal-text-muted))] truncate">
            {label}
          </span>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      <div className="text-lg sm:text-xl font-bold text-[hsl(var(--portal-text-primary))] truncate">
        {value}
      </div>
      {subtitle && (
        <span className="text-[10px] sm:text-xs text-[hsl(var(--portal-text-muted))] mt-0.5 block truncate">
          {subtitle}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// Loading State
// ============================================================================

const KPICardSkeleton: React.FC = () => (
  <div className="rounded-lg p-3 sm:p-4 border bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
    <div className="flex items-center gap-2 mb-2">
      <Skeleton className="h-6 w-6 rounded" />
      <Skeleton className="h-3 w-16" />
    </div>
    <Skeleton className="h-6 w-20 mb-1" />
    <Skeleton className="h-3 w-14" />
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const LinkTrackingKPIs: React.FC<LinkTrackingKPIsProps> = ({
  summary,
  trafficSource,
  isLoading,
  className,
}) => {
  const totalTraffic = trafficSource.mobile + trafficSource.desktop + trafficSource.other;
  const mobilePercent = totalTraffic > 0 ? Math.round((trafficSource.mobile / totalTraffic) * 100) : 0;
  const metaPercent = summary.totalClicks > 0 
    ? Math.round((summary.metaAdClicks / summary.totalClicks) * 100) 
    : 0;
  const avgDonation = summary.conversions > 0 
    ? Math.round(summary.attributedRevenue / summary.conversions) 
    : 0;

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3", className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <KPICard
        label="Total Clicks"
        value={formatNumber(summary.totalClicks)}
        icon={MousePointerClick}
        accent="blue"
        subtitle={`${metaPercent}% from Meta ads`}
      />
      <KPICard
        label="Unique Sessions"
        value={formatNumber(summary.uniqueSessions)}
        icon={Users}
        accent="purple"
        subtitle={`${mobilePercent}% mobile`}
      />
      <KPICard
        label="Cookie Capture"
        value={`${summary.cookieCaptureRate}%`}
        icon={Cookie}
        accent="amber"
        badge={getCaptureQualityBadge(summary.cookieCaptureRate)}
      />
      <KPICard
        label="Conversions"
        value={formatNumber(summary.conversions)}
        icon={TrendingUp}
        accent="green"
        subtitle={`${summary.conversionRate}% of clicks`}
      />
      <KPICard
        label="Revenue"
        value={formatCurrency(summary.attributedRevenue)}
        icon={DollarSign}
        accent="green"
        subtitle={avgDonation > 0 ? `$${avgDonation} avg` : "No conversions"}
      />
      <KPICard
        label="Conversion Rate"
        value={`${summary.conversionRate}%`}
        icon={Percent}
        accent="blue"
        subtitle="Clicks → Donations"
      />
    </motion.div>
  );
};

LinkTrackingKPIs.displayName = "LinkTrackingKPIs";
