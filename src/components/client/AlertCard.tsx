import { memo } from "react";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Info,
  TrendingUp,
  Activity,
  CheckCircle,
  X,
  ChevronRight,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClientAlert, AlertSeverity, AlertType } from "@/queries/useClientAlertsQuery";

// ============================================================================
// Configuration
// ============================================================================

const severityConfig: Record<AlertSeverity, {
  icon: typeof AlertTriangle;
  bg: string;
  text: string;
  border: string;
  label: string;
}> = {
  high: {
    icon: AlertTriangle,
    bg: "bg-[hsl(var(--portal-error)/0.1)]",
    text: "text-[hsl(var(--portal-error))]",
    border: "border-[hsl(var(--portal-error)/0.3)]",
    label: "Critical",
  },
  medium: {
    icon: Info,
    bg: "bg-[hsl(var(--portal-warning)/0.1)]",
    text: "text-[hsl(var(--portal-warning))]",
    border: "border-[hsl(var(--portal-warning)/0.3)]",
    label: "Medium",
  },
  low: {
    icon: Info,
    bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
    text: "text-[hsl(var(--portal-accent-blue))]",
    border: "border-[hsl(var(--portal-accent-blue)/0.3)]",
    label: "Low",
  },
};

const typeConfig: Record<AlertType, {
  icon: typeof TrendingUp;
  label: string;
}> = {
  watchlist_match: { icon: Activity, label: "Watchlist" },
  velocity_spike: { icon: Zap, label: "Velocity Spike" },
  trending: { icon: TrendingUp, label: "Trending" },
  sentiment_shift: { icon: Activity, label: "Sentiment Shift" },
};

// ============================================================================
// Component Props
// ============================================================================

export interface AlertCardProps {
  alert: ClientAlert;
  onSelect: (alert: ClientAlert) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  isMarkingRead?: boolean;
  isDismissing?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const AlertCard = memo(
  ({
    alert,
    onSelect,
    onMarkRead,
    onDismiss,
    isMarkingRead = false,
    isDismissing = false,
  }: AlertCardProps) => {
    const severity = severityConfig[alert.severity] || severityConfig.low;
    const alertType = typeConfig[alert.alert_type] || typeConfig.watchlist_match;
    const SeverityIcon = severity.icon;
    const TypeIcon = alertType.icon;

    const timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true });

    return (
      <motion.article
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "group relative rounded-xl border bg-[hsl(var(--portal-bg-elevated))]",
          "border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-hover))]",
          "transition-all duration-200 hover:shadow-md cursor-pointer",
          !alert.is_read && "ring-2 ring-[hsl(var(--portal-accent-blue))] ring-offset-2 ring-offset-[hsl(var(--portal-bg-primary))]"
        )}
        onClick={() => onSelect(alert)}
        role="article"
        aria-label={`${alert.entity_name} - ${severity.label} ${alertType.label} alert`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(alert);
          }
        }}
      >
        {/* Accent border top */}
        <div
          className={cn(
            "absolute top-0 left-4 right-4 h-0.5 rounded-full",
            alert.severity === "high"
              ? "bg-[hsl(var(--portal-error)/0.5)]"
              : alert.severity === "medium"
              ? "bg-[hsl(var(--portal-warning)/0.5)]"
              : "bg-[hsl(var(--portal-accent-blue)/0.5)]"
          )}
        />

        <div className="p-4">
          {/* Header: Badges + Score */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              {!alert.is_read && (
                <Badge className="bg-[hsl(var(--portal-accent-blue))] text-white text-xs">
                  New
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn("text-xs", severity.border, severity.text, severity.bg)}
              >
                <SeverityIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                {severity.label}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))]"
              >
                <TypeIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                {alertType.label}
              </Badge>
              {alert.is_actionable && (
                <Badge className="text-xs bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border border-[hsl(var(--portal-success)/0.2)]">
                  Actionable
                </Badge>
              )}
            </div>

            {alert.actionable_score > 0 && (
              <div className="text-right shrink-0">
                <div className="text-xs text-[hsl(var(--portal-text-muted))]">Score</div>
                <div className="text-xl font-bold text-[hsl(var(--portal-accent-blue))] tabular-nums">
                  {alert.actionable_score}
                </div>
              </div>
            )}
          </div>

          {/* Entity Name */}
          <h3 className="font-semibold text-[hsl(var(--portal-text-primary))] mb-1 pr-8">
            {alert.entity_name}
          </h3>

          {/* Metrics Row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-[hsl(var(--portal-text-muted))] mb-3">
            <span className="flex items-center gap-1">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              {alert.current_mentions || 0} mentions
            </span>
            {alert.velocity && alert.velocity > 0 && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                {alert.velocity.toFixed(1)}/hr
              </span>
            )}
            <span className="text-xs">{timeAgo}</span>
          </div>

          {/* Suggested Action Preview */}
          {alert.suggested_action && (
            <p className="text-sm text-[hsl(var(--portal-text-secondary))] line-clamp-2 mb-3">
              {alert.suggested_action}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--portal-border)/0.5)]">
            <div className="flex items-center gap-2">
              {!alert.is_read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(alert.id);
                  }}
                  disabled={isMarkingRead}
                  className="h-8 px-2 gap-1 text-[hsl(var(--portal-accent-blue))] hover:text-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.1)]"
                  aria-label="Mark as read"
                >
                  <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Mark read</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(alert.id);
                }}
                disabled={isDismissing}
                className="h-8 px-2 gap-1 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)]"
                aria-label="Dismiss alert"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Dismiss</span>
              </Button>
            </div>

            <div className="flex items-center gap-1 text-sm text-[hsl(var(--portal-text-muted))] group-hover:text-[hsl(var(--portal-accent-blue))] transition-colors">
              <span className="hidden sm:inline">View details</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
        </div>
      </motion.article>
    );
  }
);

AlertCard.displayName = "AlertCard";
