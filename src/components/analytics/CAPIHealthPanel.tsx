import React from "react";
import { motion } from "framer-motion";
import {
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Zap,
  AlertTriangle,
  Info,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CAPIEventsData, MatchQuality, CAPIEvent } from "@/hooks/useCAPIEventsQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      return <CheckCircle2 className="h-3 w-3 text-[hsl(var(--portal-success))]" />;
    case "pending":
      return <Clock className="h-3 w-3 text-[hsl(var(--portal-warning))]" />;
    case "failed":
      return <XCircle className="h-3 w-3 text-[hsl(var(--portal-error))]" />;
  }
}

function getStatusBadge(status: "pending" | "delivered" | "failed"): React.ReactNode {
  const styles = {
    delivered: "bg-[hsl(var(--portal-success))]/10 text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success))]/20",
    pending: "bg-[hsl(var(--portal-warning))]/10 text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning))]/20",
    failed: "bg-[hsl(var(--portal-error))]/10 text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error))]/20",
  };
  return (
    <Badge variant="outline" className={cn("text-[9px] border px-1", styles[status])}>
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
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-24 w-full" />
    </CardContent>
  </Card>
);

// ============================================================================
// Empty State
// ============================================================================

const EmptyState: React.FC = () => (
  <div className="text-center py-6 px-4">
    <div className="w-12 h-12 rounded-full bg-[hsl(var(--portal-bg-tertiary))] flex items-center justify-center mx-auto mb-3">
      <Info className="h-6 w-6 text-[hsl(var(--portal-text-muted))]" />
    </div>
    <h3 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-1">
      No conversion events sent yet
    </h3>
    <p className="text-xs text-[hsl(var(--portal-text-muted))] max-w-sm mx-auto mb-3">
      Events are sent to Meta when donations are received via ActBlue. 
      Check back after donations have been processed.
    </p>
    <div className="bg-[hsl(var(--portal-bg-tertiary))] rounded-lg p-3 text-left max-w-sm mx-auto">
      <p className="text-[10px] font-medium text-[hsl(var(--portal-text-muted))] uppercase mb-2">
        What we send to Meta:
      </p>
      <ul className="text-xs text-[hsl(var(--portal-text-secondary))] space-y-1">
        <li>• Hashed email address</li>
        <li>• FBP/FBC browser cookies</li>
        <li>• Click ID (fbclid)</li>
        <li>• Donation amount & currency</li>
        <li>• Event timestamp</li>
      </ul>
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
      <div className="text-xs text-[hsl(var(--portal-text-muted))] text-center py-2">
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
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden bg-[hsl(var(--portal-bg-tertiary))]">
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
      <div className="flex flex-wrap gap-2 justify-center">
        {qualities.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1 text-[10px]">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-[hsl(var(--portal-text-muted))]">
              {label}: {distribution[key]}
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
      <div className="text-xs text-[hsl(var(--portal-text-muted))] text-center py-3">
        No recent events
      </div>
    );
  }

  return (
    <ScrollArea className="h-[140px]">
      <div className="space-y-1.5">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--portal-bg-tertiary))] text-xs"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {getStatusIcon(event.status)}
              <div className="min-w-0">
                <div className="font-medium text-[hsl(var(--portal-text-primary))] truncate">
                  {event.eventName}
                  {event.donationAmount && (
                    <span className="ml-1 text-[hsl(var(--portal-success))]">
                      {formatCurrency(event.donationAmount)}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[hsl(var(--portal-text-muted))] truncate">
                  {format(new Date(event.eventTime), "MMM d, h:mm a")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {event.matchQuality && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] text-white border-0 px-1",
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
// Info Tooltip
// ============================================================================

const CAPIInfoTooltip: React.FC = () => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))]">
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[250px] p-3">
        <p className="text-xs font-medium mb-2">Data sent to Meta:</p>
        <ul className="text-[11px] space-y-1 text-muted-foreground">
          <li>• Hashed email, phone, name</li>
          <li>• FBP/FBC browser cookies</li>
          <li>• Click ID (fbclid)</li>
          <li>• Donation amount</li>
          <li>• Event timestamp</li>
        </ul>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

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

  const hasNoEvents = data.totalSent === 0;
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
      <Card className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm sm:text-base font-medium text-[hsl(var(--portal-text-primary))]">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-[hsl(var(--portal-accent-blue))] shrink-0" />
              <span>Meta CAPI Status</span>
            </div>
            <CAPIInfoTooltip />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-4">
          {hasNoEvents ? (
            <EmptyState />
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
                  <div className="p-1.5 rounded bg-[hsl(var(--portal-accent-blue))]/10">
                    <Send className="h-3 w-3 text-[hsl(var(--portal-accent-blue))]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[hsl(var(--portal-text-primary))]">
                      {data.totalSent.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[hsl(var(--portal-text-muted))]">Total</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
                  <div className="p-1.5 rounded bg-[hsl(var(--portal-success))]/10">
                    <CheckCircle2 className="h-3 w-3 text-[hsl(var(--portal-success))]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[hsl(var(--portal-text-primary))]">
                      {data.delivered.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[hsl(var(--portal-text-muted))]">Delivered</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
                  <div className="p-1.5 rounded bg-[hsl(var(--portal-warning))]/10">
                    <Clock className="h-3 w-3 text-[hsl(var(--portal-warning))]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[hsl(var(--portal-text-primary))]">
                      {data.pending.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[hsl(var(--portal-text-muted))]">Pending</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--portal-bg-tertiary))]">
                  <div className="p-1.5 rounded bg-[hsl(var(--portal-error))]/10">
                    <XCircle className="h-3 w-3 text-[hsl(var(--portal-error))]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[hsl(var(--portal-text-primary))]">
                      {data.failed.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[hsl(var(--portal-text-muted))]">Failed</div>
                  </div>
                </div>
              </div>

              {/* Delivery Rate */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[hsl(var(--portal-text-muted))]">Delivery Rate</span>
                  <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                    {deliveryRate}%
                  </span>
                </div>
                <Progress
                  value={deliveryRate}
                  className="h-1.5 bg-[hsl(var(--portal-bg-tertiary))]"
                />
              </div>

              {/* Match Quality Distribution */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-purple))]" />
                  <span className="text-xs font-medium text-[hsl(var(--portal-text-primary))]">
                    Match Quality
                  </span>
                  {data.avgMatchScore > 0 && (
                    <Badge variant="outline" className="ml-auto text-[9px] px-1">
                      Avg: {data.avgMatchScore}
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
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--portal-warning))]" />
                  <span className="text-xs font-medium text-[hsl(var(--portal-text-primary))]">
                    Recent Events
                  </span>
                </div>
                <RecentEvents events={data.recentEvents} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

CAPIHealthPanel.displayName = "CAPIHealthPanel";
