import React from "react";
import { motion } from "framer-motion";
import {
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CAPIEventsData, MatchQuality, CAPIEvent } from "@/hooks/useCAPIEventsQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

// ============================================================================
// Types
// ============================================================================

interface CAPIHealthPanelProps {
  data: CAPIEventsData;
  isLoading?: boolean;
  className?: string;
}

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

function getMatchQualityColor(quality: MatchQuality | null): string {
  switch (quality) {
    case "excellent": return "bg-[hsl(var(--portal-success))]";
    case "good": return "bg-[hsl(var(--portal-accent-blue))]";
    case "fair": return "bg-[hsl(var(--portal-warning))]";
    case "poor": return "bg-[hsl(var(--portal-error))]";
    default: return "bg-[hsl(var(--portal-text-muted))]";
  }
}

function getStatusIcon(status: "pending" | "delivered" | "failed"): React.ReactNode {
  switch (status) {
    case "delivered":
      return <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--portal-success))]" />;
    case "pending":
      return <Clock className="h-3.5 w-3.5 text-[hsl(var(--portal-warning))]" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-[hsl(var(--portal-error))]" />;
  }
}

function getStatusBadge(status: "pending" | "delivered" | "failed"): React.ReactNode {
  const styles = {
    delivered: "bg-[hsl(var(--portal-success))]/10 text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success))]/20",
    pending: "bg-[hsl(var(--portal-warning))]/10 text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning))]/20",
    failed: "bg-[hsl(var(--portal-error))]/10 text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error))]/20",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] border", styles[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// ============================================================================
// Loading State
// ============================================================================

const PanelSkeleton: React.FC = () => (
  <Card className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
    <CardHeader className="pb-2">
      <Skeleton className="h-5 w-48" />
    </CardHeader>
    <CardContent className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
    </CardContent>
  </Card>
);

// ============================================================================
// Stat Card
// ============================================================================

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, color }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
    <div className={cn("p-2 rounded-lg", `bg-[${color}]/10`)}>
      <Icon className={cn("h-4 w-4", `text-[${color}]`)} />
    </div>
    <div>
      <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-[hsl(var(--portal-text-muted))]">{label}</div>
    </div>
  </div>
);

// ============================================================================
// Match Quality Distribution
// ============================================================================

interface MatchQualityBarProps {
  distribution: CAPIEventsData["matchQualityDistribution"];
  total: number;
}

const MatchQualityBar: React.FC<MatchQualityBarProps> = ({ distribution, total }) => {
  if (total === 0) {
    return (
      <div className="text-sm text-[hsl(var(--portal-text-muted))] text-center py-2">
        No match quality data yet
      </div>
    );
  }

  const qualities: { key: keyof typeof distribution; label: string; color: string }[] = [
    { key: "excellent", label: "Excellent", color: "hsl(var(--portal-success))" },
    { key: "good", label: "Good", color: "hsl(var(--portal-accent-blue))" },
    { key: "fair", label: "Fair", color: "hsl(var(--portal-warning))" },
    { key: "poor", label: "Poor", color: "hsl(var(--portal-error))" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden bg-[hsl(var(--portal-bg-tertiary))]">
        {qualities.map(({ key, color }) => {
          const percent = (distribution[key] / total) * 100;
          if (percent === 0) return null;
          return (
            <div
              key={key}
              className="h-full transition-all"
              style={{
                width: `${percent}%`,
                backgroundColor: color,
              }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {qualities.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-[hsl(var(--portal-text-muted))]">
              {label}: {distribution[key]} ({Math.round((distribution[key] / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Recent Events List
// ============================================================================

interface RecentEventsProps {
  events: CAPIEvent[];
}

const RecentEvents: React.FC<RecentEventsProps> = ({ events }) => {
  if (events.length === 0) {
    return (
      <div className="text-sm text-[hsl(var(--portal-text-muted))] text-center py-4">
        No recent events
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px]">
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--portal-bg-tertiary))] text-sm"
          >
            <div className="flex items-center gap-2">
              {getStatusIcon(event.status)}
              <div>
                <div className="font-medium text-[hsl(var(--portal-text-primary))]">
                  {event.eventName}
                  {event.donationAmount && (
                    <span className="ml-2 text-[hsl(var(--portal-success))]">
                      {formatCurrency(event.donationAmount)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[hsl(var(--portal-text-muted))]">
                  {event.refcode || "(no refcode)"} • {format(new Date(event.eventTime), "MMM d, h:mm a")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {event.matchQuality && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] text-white border-0",
                    getMatchQualityColor(event.matchQuality)
                  )}
                >
                  {event.matchQuality}
                </Badge>
              )}
              {getStatusBadge(event.status)}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const CAPIHealthPanel: React.FC<CAPIHealthPanelProps> = ({
  data,
  isLoading,
  className,
}) => {
  if (isLoading) {
    return <PanelSkeleton />;
  }

  const deliveryRate = data.totalSent > 0
    ? Math.round((data.delivered / data.totalSent) * 100)
    : 0;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
    >
      <Card className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium text-[hsl(var(--portal-text-primary))]">
            <Send className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
            Meta CAPI Delivery Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
              <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10">
                <Send className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
              </div>
              <div>
                <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                  {data.totalSent.toLocaleString()}
                </div>
                <div className="text-xs text-[hsl(var(--portal-text-muted))]">Total Sent</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
              <div className="p-2 rounded-lg bg-[hsl(var(--portal-success))]/10">
                <CheckCircle2 className="h-4 w-4 text-[hsl(var(--portal-success))]" />
              </div>
              <div>
                <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                  {data.delivered.toLocaleString()}
                </div>
                <div className="text-xs text-[hsl(var(--portal-text-muted))]">Delivered</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
              <div className="p-2 rounded-lg bg-[hsl(var(--portal-warning))]/10">
                <Clock className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
              </div>
              <div>
                <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                  {data.pending.toLocaleString()}
                </div>
                <div className="text-xs text-[hsl(var(--portal-text-muted))]">Pending</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
              <div className="p-2 rounded-lg bg-[hsl(var(--portal-error))]/10">
                <XCircle className="h-4 w-4 text-[hsl(var(--portal-error))]" />
              </div>
              <div>
                <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                  {data.failed.toLocaleString()}
                </div>
                <div className="text-xs text-[hsl(var(--portal-text-muted))]">Failed</div>
              </div>
            </div>
          </div>

          {/* Delivery Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[hsl(var(--portal-text-muted))]">Delivery Rate</span>
              <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                {deliveryRate}%
              </span>
            </div>
            <Progress
              value={deliveryRate}
              className="h-2 bg-[hsl(var(--portal-bg-tertiary))]"
            />
          </div>

          {/* Match Quality Distribution */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />
              <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                Match Quality Distribution
              </span>
              {data.avgMatchScore > 0 && (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  Avg Score: {data.avgMatchScore}
                </Badge>
              )}
            </div>
            <MatchQualityBar
              distribution={data.matchQualityDistribution}
              total={data.delivered}
            />
          </div>

          {/* Recent Events */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
              <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                Recent Events
              </span>
            </div>
            <RecentEvents events={data.recentEvents} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

CAPIHealthPanel.displayName = "CAPIHealthPanel";
