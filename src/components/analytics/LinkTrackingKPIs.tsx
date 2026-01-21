import React from "react";
import { motion } from "framer-motion";
import {
  MousePointerClick,
  Users,
  Target,
  Cookie,
  TrendingUp,
  DollarSign,
  Smartphone,
  Monitor,
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
  accent: "blue" | "green" | "purple" | "amber" | "red";
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
  red: {
    iconBg: "bg-[hsl(var(--portal-error))]/10",
    iconColor: "text-[hsl(var(--portal-error))]",
  },
};

// ============================================================================
// Helper
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

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getCaptureQualityBadge(rate: number): React.ReactNode {
  if (rate >= 70) {
    return <Badge variant="default" className="bg-[hsl(var(--portal-success))] text-white">Excellent</Badge>;
  } else if (rate >= 50) {
    return <Badge variant="default" className="bg-[hsl(var(--portal-accent-blue))] text-white">Good</Badge>;
  } else if (rate >= 30) {
    return <Badge variant="default" className="bg-[hsl(var(--portal-warning))] text-white">Fair</Badge>;
  } else {
    return <Badge variant="default" className="bg-[hsl(var(--portal-error))] text-white">Low</Badge>;
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
        "rounded-lg p-4 border",
        "bg-[hsl(var(--portal-bg-elevated))]",
        "border-[hsl(var(--portal-border))]",
        "hover:border-[hsl(var(--portal-border-hover))] hover:shadow-sm",
        "transition-all duration-200"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded", styles.iconBg)}>
            <Icon className={cn("h-4 w-4", styles.iconColor)} />
          </div>
          <span className="text-xs font-medium text-[hsl(var(--portal-text-muted))]">
            {label}
          </span>
        </div>
        {badge}
      </div>
      <div className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">
        {value}
      </div>
      {subtitle && (
        <span className="text-xs text-[hsl(var(--portal-text-muted))] mt-1 block">
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
  <div className="rounded-lg p-4 border bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
    <div className="flex items-center gap-2 mb-2">
      <Skeleton className="h-7 w-7 rounded" />
      <Skeleton className="h-3 w-20" />
    </div>
    <Skeleton className="h-7 w-24 mb-1" />
    <Skeleton className="h-3 w-16" />
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

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <KPICard
        label="Total Clicks"
        value={formatNumber(summary.totalClicks)}
        icon={MousePointerClick}
        accent="blue"
        subtitle="All redirect clicks"
      />
      <KPICard
        label="Unique Sessions"
        value={formatNumber(summary.uniqueSessions)}
        icon={Users}
        accent="purple"
        subtitle="By session ID"
      />
      <KPICard
        label="Meta Ad Clicks"
        value={formatNumber(summary.metaAdClicks)}
        icon={Target}
        accent="blue"
        subtitle={`${summary.totalClicks > 0 ? Math.round((summary.metaAdClicks / summary.totalClicks) * 100) : 0}% of total`}
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
        subtitle={`${formatPercent(summary.conversionRate)} CVR`}
      />
      <KPICard
        label="Attributed Revenue"
        value={formatCurrency(summary.attributedRevenue)}
        icon={DollarSign}
        accent="green"
        subtitle="Matched donations"
      />
      <KPICard
        label="Mobile Traffic"
        value={`${mobilePercent}%`}
        icon={Smartphone}
        accent="purple"
        subtitle={`${formatNumber(trafficSource.mobile)} clicks`}
      />
      <KPICard
        label="Desktop Traffic"
        value={`${100 - mobilePercent - Math.round((trafficSource.other / totalTraffic) * 100 || 0)}%`}
        icon={Monitor}
        accent="blue"
        subtitle={`${formatNumber(trafficSource.desktop)} clicks`}
      />
    </motion.div>
  );
};

LinkTrackingKPIs.displayName = "LinkTrackingKPIs";
