import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Bell,
  AlertTriangle,
  TrendingUp,
  Activity,
  Zap,
  RefreshCw,
  CheckCircle,
  Filter,
  Info,
  Eye,
} from "lucide-react";
import { ProductionGate } from "@/components/client/ProductionGate";

import { ClientShell } from "@/components/client/ClientShell";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { AlertCard } from "@/components/client/AlertCard";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import {
  useClientAlertsQuery,
  useMarkAlertRead,
  useMarkAllAlertsRead,
  useDismissAlert,
  type AlertSeverity,
  type AlertType,
  type ClientAlert,
} from "@/queries/useClientAlertsQuery";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { V3MetricChip, V3FilterPill } from "@/components/v3";

// ============================================================================
// Types & Constants
// ============================================================================

type FilterTypeOption = AlertType | "all";
type FilterSeverityOption = AlertSeverity | "all";

const TYPE_OPTIONS: { value: FilterTypeOption; label: string; icon: typeof Activity }[] = [
  { value: "all", label: "All Types", icon: Filter },
  { value: "watchlist_match", label: "Watchlist", icon: Eye },
  { value: "velocity_spike", label: "Velocity Spike", icon: Zap },
  { value: "trending", label: "Trending", icon: TrendingUp },
  { value: "sentiment_shift", label: "Sentiment", icon: Activity },
];

const SEVERITY_OPTIONS: { value: FilterSeverityOption; label: string }[] = [
  { value: "all", label: "All Severity" },
  { value: "high", label: "Critical" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

// ============================================================================
// Sub-components - Using V3 shared components
// ============================================================================

// ============================================================================
// Alert Detail Dialog
// ============================================================================

interface AlertDetailDialogProps {
  alert: ClientAlert | null;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  isMarkingRead: boolean;
}

const AlertDetailDialog = ({ alert, onClose, onMarkRead, isMarkingRead }: AlertDetailDialogProps) => {
  const navigate = useNavigate();

  if (!alert) return null;

  const getSeverityStyles = (severity: AlertSeverity) => {
    switch (severity) {
      case "high":
        return {
          bg: "bg-[hsl(var(--portal-error)/0.1)]",
          text: "text-[hsl(var(--portal-error))]",
          border: "border-[hsl(var(--portal-error)/0.2)]",
          icon: AlertTriangle,
        };
      case "medium":
        return {
          bg: "bg-[hsl(var(--portal-warning)/0.1)]",
          text: "text-[hsl(var(--portal-warning))]",
          border: "border-[hsl(var(--portal-warning)/0.2)]",
          icon: Info,
        };
      default:
        return {
          bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
          text: "text-[hsl(var(--portal-accent-blue))]",
          border: "border-[hsl(var(--portal-accent-blue)/0.2)]",
          icon: Info,
        };
    }
  };

  const severityStyles = getSeverityStyles(alert.severity);
  const SeverityIcon = severityStyles.icon;

  return (
    <Dialog open={!!alert} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--portal-text-primary))]">
            {alert.entity_name}
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--portal-text-secondary))] capitalize">
            {alert.alert_type.replace(/_/g, " ")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn("text-xs", severityStyles.bg, severityStyles.text, severityStyles.border)}
            >
              <SeverityIcon className="h-3 w-3 mr-1" aria-hidden="true" />
              {alert.severity === "high" ? "Critical" : alert.severity}
            </Badge>
            {alert.is_actionable && (
              <Badge className="text-xs bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border border-[hsl(var(--portal-success)/0.2)]">
                Actionable (Score: {alert.actionable_score})
              </Badge>
            )}
            {!alert.is_read && (
              <Badge className="bg-[hsl(var(--portal-accent-blue))] text-white text-xs">
                Unread
              </Badge>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 py-4 border-y border-[hsl(var(--portal-border))]">
            <div>
              <p className="text-sm text-[hsl(var(--portal-text-muted))]">Current Mentions</p>
              <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
                {alert.current_mentions || 0}
              </p>
            </div>
            {alert.velocity && alert.velocity > 0 && (
              <div>
                <p className="text-sm text-[hsl(var(--portal-text-muted))]">Velocity</p>
                <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
                  {alert.velocity.toFixed(1)}/hr
                </p>
              </div>
            )}
          </div>

          {/* Suggested Action */}
          {alert.suggested_action && (
            <div>
              <h4 className="font-semibold mb-2 text-[hsl(var(--portal-text-primary))]">
                Suggested Action
              </h4>
              <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                {alert.suggested_action}
              </p>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">
            Triggered: {format(new Date(alert.created_at), "MMM d, yyyy h:mm a")}
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {!alert.is_read && (
              <Button
                onClick={() => {
                  onMarkRead(alert.id);
                  onClose();
                }}
                disabled={isMarkingRead}
                className="flex-1 min-h-[44px] bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                Mark as Read
              </Button>
            )}
            {alert.is_actionable && (
              <Button
                variant="outline"
                onClick={() => navigate("/client/actions")}
                className="flex-1 min-h-[44px] border-[hsl(var(--portal-border))] hover:bg-[hsl(var(--portal-bg-hover))]"
              >
                View Actions
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onClose}
              className="min-h-[44px] border-[hsl(var(--portal-border))]"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const ClientAlerts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizationId, isLoading: orgLoading } = useClientOrganization();

  // Query and mutations
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useClientAlertsQuery(
    organizationId
  );
  const markReadMutation = useMarkAlertRead(organizationId);
  const markAllReadMutation = useMarkAllAlertsRead(organizationId);
  const dismissMutation = useDismissAlert(organizationId);

  // Local state
  const [selectedAlert, setSelectedAlert] = useState<ClientAlert | null>(null);
  const [filterType, setFilterType] = useState<FilterTypeOption>("all");
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverityOption>("all");

  // Filter alerts (exclude dismissed)
  const filteredAlerts = useMemo(() => {
    if (!data?.alerts) return [];

    return data.alerts
      .filter((a) => !a.is_dismissed)
      .filter((a) => filterType === "all" || a.alert_type === filterType)
      .filter((a) => filterSeverity === "all" || a.severity === filterSeverity);
  }, [data?.alerts, filterType, filterSeverity]);

  // Watchlist alerts for the tab
  const watchlistAlerts = useMemo(() => {
    if (!data?.alerts) return [];
    return data.alerts.filter((a) => !a.is_dismissed && a.alert_type === "watchlist_match");
  }, [data?.alerts]);

  // Handlers
  const handleMarkRead = useCallback(
    async (id: string) => {
      try {
        await markReadMutation.mutateAsync(id);
        toast({
          title: "Marked as Read",
          description: "Alert has been marked as read",
        });
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to mark alert as read",
          variant: "destructive",
        });
      }
    },
    [markReadMutation, toast]
  );

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllReadMutation.mutateAsync();
      toast({
        title: "All Marked Read",
        description: "All alerts have been marked as read",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to mark all alerts as read",
        variant: "destructive",
      });
    }
  }, [markAllReadMutation, toast]);

  const handleDismiss = useCallback(
    async (id: string) => {
      try {
        await dismissMutation.mutateAsync(id);
        toast({
          title: "Alert Dismissed",
          description: "Alert has been dismissed",
        });
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to dismiss alert",
          variant: "destructive",
        });
      }
    },
    [dismissMutation, toast]
  );

  const stats = data?.stats;
  const isPageLoading = orgLoading || isLoading;

  return (
    <ClientShell pageTitle="Critical Alerts" showDateControls={false}>
      <ProductionGate
        title="Critical Alerts"
        description="Real-time alerts for significant changes in your tracked entities and fundraising metrics."
        icon={Bell}
      >
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Hero Panel */}
        <ChartPanel
          title="Alert Intelligence"
          description="Monitor critical events and actionable opportunities"
          icon={Bell}
          isLoading={isPageLoading}
          error={error}
          onRetry={refetch}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2 border-[hsl(var(--portal-border))] hover:bg-[hsl(var(--portal-bg-hover))]"
              >
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              {(stats?.unread ?? 0) > 0 && (
                <Button
                  onClick={handleMarkAllRead}
                  size="sm"
                  disabled={markAllReadMutation.isPending}
                  className="gap-2 bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Mark All Read</span>
                </Button>
              )}
            </div>
          }
          minHeight={120}
        >
          {/* Hero Metrics */}
          <div className="flex flex-wrap gap-3">
            <V3MetricChip
              label="Unread Alerts"
              value={stats?.unread ?? 0}
              icon={Bell}
              variant="info"
            />
            <V3MetricChip
              label="Critical"
              value={stats?.critical ?? 0}
              icon={AlertTriangle}
              variant="error"
            />
            <V3MetricChip
              label="Actionable"
              value={`${stats?.actionablePercent ?? 0}%`}
              icon={TrendingUp}
              variant="success"
            />
            <V3MetricChip
              label="Avg Score"
              value={stats?.avgActionableScore ?? 0}
              icon={Activity}
              variant="default"
            />
          </div>
        </ChartPanel>

        {/* Filters Panel */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-[hsl(var(--portal-bg-elevated))] rounded-xl border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 text-[hsl(var(--portal-text-muted))]">
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          {/* Type Filters */}
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map(({ value, label }) => (
              <V3FilterPill
                key={value}
                label={label}
                isActive={filterType === value}
                onClick={() => setFilterType(value)}
                count={
                  value === "all"
                    ? stats?.total
                    : stats?.byType[value as AlertType]
                }
              />
            ))}
          </div>

          <div className="w-px h-6 bg-[hsl(var(--portal-border))] mx-1" />

          {/* Severity Filters */}
          <div className="flex flex-wrap gap-2">
            {SEVERITY_OPTIONS.map(({ value, label }) => (
              <V3FilterPill
                key={value}
                label={label}
                isActive={filterSeverity === value}
                onClick={() => setFilterSeverity(value)}
                variant={value === "high" ? "error" : value === "medium" ? "warning" : "default"}
                count={
                  value === "all"
                    ? undefined
                    : stats?.bySeverity[value as AlertSeverity]
                }
              />
            ))}
          </div>
        </div>

        {/* Alerts List Panel */}
        <ChartPanel
          title="Active Alerts"
          description={`${filteredAlerts.length} alerts matching your filters`}
          icon={Activity}
          isLoading={isPageLoading}
          isEmpty={data?.alerts.filter((a) => !a.is_dismissed).length === 0}
          emptyMessage="No alerts at this time. You're all caught up!"
          minHeight={400}
        >
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="h-auto bg-[hsl(var(--portal-bg-tertiary))] mb-4">
              <TabsTrigger value="all" className="min-h-[44px] px-4 data-[state=active]:bg-[hsl(var(--portal-bg-elevated))]">
                All Intelligence ({filteredAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="watchlist" className="min-h-[44px] px-4 data-[state=active]:bg-[hsl(var(--portal-bg-elevated))]">
                My Watchlist ({watchlistAlerts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              {filteredAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="h-12 w-12 text-[hsl(var(--portal-text-muted))] mb-4" />
                  <p className="text-[hsl(var(--portal-text-secondary))]">
                    No alerts match your current filters
                  </p>
                  <Button
                    variant="link"
                    onClick={() => {
                      setFilterType("all");
                      setFilterSeverity("all");
                    }}
                    className="mt-2 text-[hsl(var(--portal-accent-blue))]"
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {filteredAlerts.map((alert) => (
                        <AlertCard
                          key={alert.id}
                          alert={alert}
                          onSelect={setSelectedAlert}
                          onMarkRead={handleMarkRead}
                          onDismiss={handleDismiss}
                          isMarkingRead={markReadMutation.isPending}
                          isDismissing={dismissMutation.isPending}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="watchlist" className="mt-0">
              {watchlistAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Eye className="h-12 w-12 text-[hsl(var(--portal-text-muted))] mb-4" />
                  <p className="text-[hsl(var(--portal-text-secondary))]">
                    No watchlist alerts at this time
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/client/watchlist")}
                    className="mt-4 min-h-[44px] bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white border-0"
                  >
                    Manage Watchlist
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {watchlistAlerts.map((alert) => (
                        <AlertCard
                          key={alert.id}
                          alert={alert}
                          onSelect={setSelectedAlert}
                          onMarkRead={handleMarkRead}
                          onDismiss={handleDismiss}
                          isMarkingRead={markReadMutation.isPending}
                          isDismissing={dismissMutation.isPending}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </ChartPanel>
      </div>
      </ProductionGate>

      {/* Alert Detail Dialog */}
      <AlertDetailDialog
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onMarkRead={handleMarkRead}
        isMarkingRead={markReadMutation.isPending}
      />
    </ClientShell>
  );
};

export default ClientAlerts;
