import { memo } from "react";
import { motion } from "framer-motion";
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronRight,
  Heart,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DonorSegmentSummary, SegmentHealth } from "@/queries/useDonorJourneyQuery";

// ============================================================================
// Health Configuration
// ============================================================================

interface HealthConfig {
  icon: LucideIcon;
  bg: string;
  text: string;
  border: string;
  label: string;
}

const healthConfig: Record<SegmentHealth, HealthConfig> = {
  healthy: {
    icon: CheckCircle,
    bg: "bg-[hsl(var(--portal-success)/0.1)]",
    text: "text-[hsl(var(--portal-success))]",
    border: "border-[hsl(var(--portal-success)/0.3)]",
    label: "Healthy",
  },
  growing: {
    icon: ArrowUpRight,
    bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
    text: "text-[hsl(var(--portal-accent-blue))]",
    border: "border-[hsl(var(--portal-accent-blue)/0.3)]",
    label: "Growing",
  },
  at_risk: {
    icon: AlertTriangle,
    bg: "bg-[hsl(var(--portal-warning)/0.1)]",
    text: "text-[hsl(var(--portal-warning))]",
    border: "border-[hsl(var(--portal-warning)/0.3)]",
    label: "At Risk",
  },
  churned: {
    icon: TrendingDown,
    bg: "bg-[hsl(var(--portal-error)/0.1)]",
    text: "text-[hsl(var(--portal-error))]",
    border: "border-[hsl(var(--portal-error)/0.3)]",
    label: "Churned",
  },
};

// ============================================================================
// Tier Configuration
// ============================================================================

type TierType = "whale" | "dolphin" | "fish" | "minnow" | "default";

const tierConfig: Record<TierType, { icon: LucideIcon; accent: string }> = {
  whale: {
    icon: Heart,
    accent: "text-[hsl(var(--portal-accent-purple))]",
  },
  dolphin: {
    icon: Users,
    accent: "text-[hsl(var(--portal-accent-blue))]",
  },
  fish: {
    icon: Users,
    accent: "text-[hsl(var(--portal-success))]",
  },
  minnow: {
    icon: Users,
    accent: "text-[hsl(var(--portal-text-muted))]",
  },
  default: {
    icon: Users,
    accent: "text-[hsl(var(--portal-text-secondary))]",
  },
};

// ============================================================================
// Component Props
// ============================================================================

export interface DonorSegmentCardProps {
  segment: DonorSegmentSummary;
  onSelect?: (segment: DonorSegmentSummary) => void;
  onExplore?: (segment: DonorSegmentSummary) => void;
  onInviteToCampaign?: (segment: DonorSegmentSummary) => void;
}

// ============================================================================
// Component
// ============================================================================

export const DonorSegmentCard = memo(
  ({
    segment,
    onSelect,
    onExplore,
    onInviteToCampaign,
  }: DonorSegmentCardProps) => {
    const health = healthConfig[segment.health] || healthConfig.at_risk;
    const HealthIcon = health.icon;

    const tierKey = segment.tier.toLowerCase() as TierType;
    const tier = tierConfig[tierKey] || tierConfig.default;
    const TierIcon = tier.icon;

    const formattedValue = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(segment.totalValue);

    const formattedAvg = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(segment.avgDonation);

    return (
      <motion.article
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "group relative rounded-xl border bg-[hsl(var(--portal-bg-elevated))]",
          "border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-hover))]",
          "transition-all duration-200 hover:shadow-md cursor-pointer"
        )}
        onClick={() => onSelect?.(segment)}
        role="article"
        aria-label={`${segment.name} segment - ${segment.count} donors`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.(segment);
          }
        }}
      >
        {/* Accent top border based on health */}
        <div
          className={cn(
            "absolute top-0 left-4 right-4 h-0.5 rounded-full",
            segment.health === "healthy"
              ? "bg-[hsl(var(--portal-success)/0.5)]"
              : segment.health === "growing"
              ? "bg-[hsl(var(--portal-accent-blue)/0.5)]"
              : segment.health === "at_risk"
              ? "bg-[hsl(var(--portal-warning)/0.5)]"
              : "bg-[hsl(var(--portal-error)/0.5)]"
          )}
        />

        <div className="p-4 space-y-3">
          {/* Header: Name + Health Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <motion.div
                className={cn(
                  "p-2 rounded-lg shrink-0",
                  "bg-[hsl(var(--portal-bg-tertiary))]"
                )}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <TierIcon className={cn("h-4 w-4", tier.accent)} aria-hidden="true" />
              </motion.div>

              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[hsl(var(--portal-text-primary))] truncate">
                  {segment.name}
                </h3>
                <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-0.5 line-clamp-2">
                  {segment.description}
                </p>
              </div>
            </div>

            <Badge
              variant="outline"
              className={cn("text-xs shrink-0", health.border, health.text, health.bg)}
            >
              <HealthIcon className="h-3 w-3 mr-1" aria-hidden="true" />
              {health.label}
            </Badge>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Donor Count */}
            <div className="bg-[hsl(var(--portal-bg-tertiary)/0.5)] rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--portal-text-muted))]">
                <Users className="h-3 w-3" aria-hidden="true" />
                Donors
              </div>
              <div className="text-lg font-semibold text-[hsl(var(--portal-text-primary))] tabular-nums mt-0.5">
                {segment.count.toLocaleString()}
              </div>
            </div>

            {/* Total Value */}
            <div className="bg-[hsl(var(--portal-bg-tertiary)/0.5)] rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--portal-text-muted))]">
                <DollarSign className="h-3 w-3" aria-hidden="true" />
                Total Value
              </div>
              <div className="text-lg font-semibold text-[hsl(var(--portal-success))] tabular-nums mt-0.5">
                {formattedValue}
              </div>
            </div>

            {/* Avg Donation */}
            <div className="bg-[hsl(var(--portal-bg-tertiary)/0.5)] rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--portal-text-muted))]">
                Avg Donation
              </div>
              <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))] tabular-nums mt-0.5">
                {formattedAvg}
              </div>
            </div>

            {/* Retention + Trend */}
            <div className="bg-[hsl(var(--portal-bg-tertiary)/0.5)] rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--portal-text-muted))]">
                Retention
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))] tabular-nums">
                  {segment.retentionRate.toFixed(0)}%
                </span>
                <span
                  className={cn(
                    "inline-flex items-center text-xs font-medium",
                    segment.trend >= 0
                      ? "text-[hsl(var(--portal-success))]"
                      : "text-[hsl(var(--portal-error))]"
                  )}
                >
                  {segment.trend >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-0.5" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-0.5" aria-hidden="true" />
                  )}
                  {segment.trend > 0 ? "+" : ""}
                  {segment.trend.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--portal-border)/0.5)]">
            <div className="flex items-center gap-2">
              {onInviteToCampaign && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInviteToCampaign(segment);
                  }}
                  className="h-8 px-2.5 gap-1.5 text-[hsl(var(--portal-accent-blue))] hover:text-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.1)]"
                >
                  <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Invite to Campaign</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1 text-sm text-[hsl(var(--portal-text-muted))] group-hover:text-[hsl(var(--portal-accent-blue))] transition-colors">
              <span className="hidden sm:inline">Explore</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
        </div>
      </motion.article>
    );
  }
);

DonorSegmentCard.displayName = "DonorSegmentCard";
