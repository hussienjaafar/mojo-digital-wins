import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Zap,
  Lightbulb,
  Check,
  RefreshCw,
  Filter,
  Target,
  TrendingUp,
  MessageSquare,
  Clock,
  Copy,
  AlertCircle,
  X,
} from "lucide-react";

import { ClientShell } from "@/components/client/ClientShell";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { ActionCard } from "@/components/client/ActionCard";
import { LastRunStatus } from "@/components/client/LastRunStatus";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useLatestActionGeneratorRun } from "@/hooks/useActionGeneratorRuns";
import {
  useSuggestedActionsQuery,
  useMarkActionUsed,
  useMarkAllActionsUsed,
  useDismissAction,
  type SuggestedAction,
} from "@/queries/useSuggestedActionsQuery";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

type FilterStatus = "all" | "pending" | "used";
type FilterType = "all" | string;

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "used", label: "Used" },
];

// ============================================================================
// Sub-components - Using V3 shared components
// ============================================================================

// ============================================================================
// Action Detail Dialog
// ============================================================================

interface ActionDetailDialogProps {
  action: SuggestedAction | null;
  onClose: () => void;
  onCopy: (action: SuggestedAction) => Promise<void>;
  onDismiss: (id: string) => void;
  isCopying: boolean;
}

const ActionDetailDialog = ({
  action,
  onClose,
  onCopy,
  onDismiss,
  isCopying,
}: ActionDetailDialogProps) => {
  const [copied, setCopied] = useState(false);

  if (!action) return null;

  const handleCopy = async () => {
    try {
      await onCopy(action);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Error handled in parent
    }
  };

  const urgencyLevel =
    action.urgency_score >= 70 ? "high" : action.urgency_score >= 40 ? "medium" : "low";

  const urgencyStyles = {
    high: {
      bg: "bg-[hsl(var(--portal-error)/0.1)]",
      text: "text-[hsl(var(--portal-error))]",
      border: "border-[hsl(var(--portal-error)/0.2)]",
    },
    medium: {
      bg: "bg-[hsl(var(--portal-warning)/0.1)]",
      text: "text-[hsl(var(--portal-warning))]",
      border: "border-[hsl(var(--portal-warning)/0.2)]",
    },
    low: {
      bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
      text: "text-[hsl(var(--portal-accent-blue))]",
      border: "border-[hsl(var(--portal-accent-blue)/0.2)]",
    },
  };

  const styles = urgencyStyles[urgencyLevel];

  return (
    <Dialog open={!!action} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--portal-text-primary))] pr-8">
            {action.topic}
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--portal-text-secondary))]">
            {action.action_type} • Generated {format(new Date(action.created_at), "MMM d, yyyy h:mm a")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn("text-xs", styles.bg, styles.text, styles.border)}
            >
              <Zap className="h-3 w-3 mr-1" aria-hidden="true" />
              {urgencyLevel === "high" ? "Urgent" : urgencyLevel === "medium" ? "Medium" : "Low"} Priority
            </Badge>
            {action.topic_relevance_score >= 70 && (
              <Badge className="text-xs bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border border-[hsl(var(--portal-success)/0.2)]">
                High Relevance
              </Badge>
            )}
            {/* Generation method indicator */}
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                action.generation_method === "ai" 
                  ? "bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))] border-[hsl(var(--portal-accent-purple)/0.2)]"
                  : "bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))] border-[hsl(var(--portal-border))]"
              )}
            >
              {action.generation_method === "ai" ? "AI-Generated" : "Template"}
            </Badge>
            {action.is_used && (
              <Badge className="bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border border-[hsl(var(--portal-success)/0.2)]">
                <Check className="h-3 w-3 mr-1" />
                Used
              </Badge>
            )}
          </div>

          {/* Entity Context */}
          {action.alert?.entity_name && (
            <div className="bg-[hsl(var(--portal-bg-tertiary)/0.5)] rounded-lg p-3 border border-[hsl(var(--portal-border)/0.5)]">
              <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                Related to: <span className="font-medium text-[hsl(var(--portal-text-primary))]">{action.alert.entity_name}</span>
                {action.alert.actionable_score > 0 && (
                  <span className="text-[hsl(var(--portal-text-muted))]">
                    {" "}(Actionable Score: {action.alert.actionable_score})
                  </span>
                )}
              </p>
            </div>
          )}

          {/* SMS Preview */}
          <div className="bg-[hsl(var(--portal-bg-tertiary)/0.5)] rounded-lg p-4 border border-[hsl(var(--portal-border)/0.5)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                SMS Text Preview
              </span>
              <Badge
                variant="outline"
                className="bg-transparent border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))]"
              >
                {action.character_count}/160
              </Badge>
            </div>
            <p className="text-sm font-mono text-[hsl(var(--portal-text-primary))] whitespace-pre-wrap">
              {action.sms_copy}
            </p>
            <Progress
              value={(action.character_count / 160) * 100}
              className="h-1 mt-3"
            />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 py-4 border-y border-[hsl(var(--portal-border))]">
            <div>
              <p className="text-sm text-[hsl(var(--portal-text-muted))] mb-1">Relevance Score</p>
              <div className="flex items-center gap-2">
                <Progress value={action.topic_relevance_score} className="h-2 flex-1" />
                <span className="text-lg font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
                  {action.topic_relevance_score}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-[hsl(var(--portal-text-muted))] mb-1">Urgency Score</p>
              <div className="flex items-center gap-2">
                <Progress value={action.urgency_score} className="h-2 flex-1" />
                <span className="text-lg font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
                  {action.urgency_score}%
                </span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-1">
                Estimated Impact
              </p>
              <Badge
                variant="secondary"
                className="bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-primary))]"
              >
                <Target className="h-3 w-3 mr-1" />
                {action.estimated_impact}
              </Badge>
            </div>

            <div>
              <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-1">
                Value Proposition
              </p>
              <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                {action.value_proposition}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-1">
                Target Audience
              </p>
              <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                {action.target_audience}
              </p>
            </div>

            {action.historical_context && (
              <div>
                <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-1">
                  Historical Context
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-secondary))]">
                  {action.historical_context}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            {!action.is_used && (
              <>
                <Button
                  onClick={handleCopy}
                  disabled={isCopying || copied}
                  className={cn(
                    "flex-1 min-h-[44px]",
                    copied
                      ? "bg-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success))]"
                      : "bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))]",
                    "text-white"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy SMS Text
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onDismiss(action.id);
                    onClose();
                  }}
                  className="min-h-[44px] border-[hsl(var(--portal-border))] hover:bg-[hsl(var(--portal-error)/0.1)] hover:text-[hsl(var(--portal-error))] hover:border-[hsl(var(--portal-error)/0.3)]"
                >
                  <X className="h-4 w-4 mr-2" />
                  Dismiss
                </Button>
              </>
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

const ClientActions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizationId, isLoading: orgLoading } = useClientOrganization();

  // Query and mutations
  const { data, isLoading, isFetching, error, refetch } = useSuggestedActionsQuery(
    organizationId
  );
  const { data: lastRun, isLoading: lastRunLoading } = useLatestActionGeneratorRun(organizationId);
  const markUsedMutation = useMarkActionUsed(organizationId);
  const markAllUsedMutation = useMarkAllActionsUsed(organizationId);
  const dismissMutation = useDismissAction(organizationId);

  // Local state
  const [selectedAction, setSelectedAction] = useState<SuggestedAction | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending");
  const [filterType, setFilterType] = useState<FilterType>("all");

  // Filter actions (exclude dismissed for main view)
  const filteredActions = useMemo(() => {
    if (!data?.actions) return [];

    return data.actions
      .filter((a) => !a.is_dismissed)
      .filter((a) => {
        if (filterStatus === "pending") return !a.is_used;
        if (filterStatus === "used") return a.is_used;
        return true;
      })
      .filter((a) => filterType === "all" || a.action_type === filterType);
  }, [data?.actions, filterStatus, filterType]);

  // Get unique action types for filter
  const actionTypes = useMemo(() => {
    if (!data?.actions) return [];
    const types = new Set(data.actions.map((a) => a.action_type).filter(Boolean));
    return Array.from(types);
  }, [data?.actions]);

  // Handlers
  const handleCopy = useCallback(
    async (action: SuggestedAction) => {
      try {
        await navigator.clipboard.writeText(action.sms_copy);
        await markUsedMutation.mutateAsync(action.id);
        toast({
          title: "Copied to Clipboard",
          description: "SMS text copied and marked as used",
        });
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to copy text",
          variant: "destructive",
        });
        throw err;
      }
    },
    [markUsedMutation, toast]
  );

  const handleMarkAllUsed = useCallback(async () => {
    try {
      await markAllUsedMutation.mutateAsync();
      toast({
        title: "All Marked Used",
        description: "All pending actions have been marked as used",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to mark all as used",
        variant: "destructive",
      });
    }
  }, [markAllUsedMutation, toast]);

  const handleDismiss = useCallback(
    async (id: string) => {
      try {
        await dismissMutation.mutateAsync(id);
        toast({
          title: "Action Dismissed",
          description: "This suggestion has been hidden",
        });
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to dismiss action",
          variant: "destructive",
        });
      }
    },
    [dismissMutation, toast]
  );

  const stats = data?.stats;
  const isPageLoading = orgLoading || isLoading;

  return (
    <ClientShell pageTitle="Suggested Actions" showDateControls={false}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Hero Panel */}
        <ChartPanel
          title="AI-Powered Suggestions"
          description="Campaign recommendations based on your alerts and intelligence"
          icon={Zap}
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
              {(stats?.pending ?? 0) > 0 && (
                <Button
                  onClick={handleMarkAllUsed}
                  size="sm"
                  disabled={markAllUsedMutation.isPending}
                  className="gap-2 bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white"
                >
                  <Check className="h-4 w-4" />
                  <span className="hidden sm:inline">Mark All Used</span>
                </Button>
              )}
            </div>
          }
          minHeight={140}
        >
          {/* Last Run Status */}
          <div className="mb-4">
            <LastRunStatus lastRun={lastRun} isLoading={lastRunLoading} variant="actions" />
          </div>
          {/* Hero Metrics */}
          <div className="flex flex-wrap gap-3">
            <V3MetricChip
              label="Pending Actions"
              value={stats?.pending ?? 0}
              icon={Lightbulb}
              variant="warning"
            />
            <V3MetricChip
              label="Used This Period"
              value={stats?.used ?? 0}
              icon={Check}
              variant="success"
            />
            <V3MetricChip
              label="High Urgency"
              value={stats?.highUrgencyCount ?? 0}
              icon={Zap}
              variant="error"
            />
            <V3MetricChip
              label="Avg Relevance"
              value={`${stats?.avgRelevance ?? 0}%`}
              icon={Target}
              variant="info"
            />
          </div>
        </ChartPanel>

        {/* Filters Panel */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-[hsl(var(--portal-bg-elevated))] rounded-xl border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 text-[hsl(var(--portal-text-muted))]">
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <V3FilterPill
                key={value}
                label={label}
                isActive={filterStatus === value}
                onClick={() => setFilterStatus(value)}
                count={
                  value === "all"
                    ? stats?.total
                    : value === "pending"
                    ? stats?.pending
                    : stats?.used
                }
              />
            ))}
          </div>

          {actionTypes.length > 1 && (
            <>
              <div className="w-px h-6 bg-[hsl(var(--portal-border))] mx-1" />

              {/* Type Filters */}
              <div className="flex flex-wrap gap-2">
                <V3FilterPill
                  label="All Types"
                  isActive={filterType === "all"}
                  onClick={() => setFilterType("all")}
                />
                {actionTypes.map((type) => (
                  <V3FilterPill
                    key={type}
                    label={type}
                    isActive={filterType === type}
                    onClick={() => setFilterType(type)}
                    count={stats?.byType[type]}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Actions List Panel */}
        <ChartPanel
          title="Action Suggestions"
          description={`${filteredActions.length} ${filterStatus === "all" ? "total" : filterStatus} actions`}
          icon={MessageSquare}
          isLoading={isPageLoading}
          isEmpty={data?.actions.filter((a) => !a.is_dismissed).length === 0}
          emptyMessage="No action suggestions yet. New AI-generated suggestions will appear here based on your alerts."
          minHeight={400}
        >
          <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)} className="w-full">
            <TabsList className="h-auto bg-[hsl(var(--portal-bg-tertiary))] mb-4">
              <TabsTrigger
                value="pending"
                className="min-h-[44px] px-4 data-[state=active]:bg-[hsl(var(--portal-bg-elevated))]"
              >
                Pending ({stats?.pending ?? 0})
              </TabsTrigger>
              <TabsTrigger
                value="used"
                className="min-h-[44px] px-4 data-[state=active]:bg-[hsl(var(--portal-bg-elevated))]"
              >
                Used ({stats?.used ?? 0})
              </TabsTrigger>
              <TabsTrigger
                value="all"
                className="min-h-[44px] px-4 data-[state=active]:bg-[hsl(var(--portal-bg-elevated))]"
              >
                All ({stats?.total ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filterStatus} className="mt-0">
              {filteredActions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
                  <Lightbulb className="h-12 w-12 text-[hsl(var(--portal-text-muted))] mb-4" />
                  <p className="text-[hsl(var(--portal-text-secondary))] mb-2">
                    {filterStatus === "pending"
                      ? "No pending actions available."
                      : filterStatus === "used"
                      ? "No used actions yet."
                      : "No actions match your filters."}
                  </p>
                  {filterStatus === "pending" && lastRun && (
                    <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-4">
                      Last run processed {lastRun.alerts_processed} alerts, created {lastRun.actions_created ?? 0} actions
                      ({lastRun.ai_generated_count ?? 0} AI, {lastRun.template_generated_count ?? 0} template).
                      {lastRun.alerts_processed === 0 ? " No actionable alerts found in the last 7 days." : ""}
                    </p>
                  )}
                  {filterStatus === "pending" && (
                    <Button
                      variant="outline"
                      onClick={() => navigate("/client/alerts")}
                      className="mt-2 min-h-[44px] bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white border-0"
                    >
                      View Alerts
                    </Button>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className={cn(
                    filterStatus === "used"
                      ? "grid gap-4 sm:grid-cols-2"
                      : "space-y-4"
                  )}>
                    <AnimatePresence mode="popLayout">
                      {filteredActions.map((action) => (
                        <ActionCard
                          key={action.id}
                          action={action}
                          onSelect={setSelectedAction}
                          onCopy={handleCopy}
                          onDismiss={handleDismiss}
                          isCopying={markUsedMutation.isPending}
                          isDismissing={dismissMutation.isPending}
                          variant={action.is_used ? "compact" : "full"}
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

      {/* Action Detail Dialog */}
      <ActionDetailDialog
        action={selectedAction}
        onClose={() => setSelectedAction(null)}
        onCopy={handleCopy}
        onDismiss={handleDismiss}
        isCopying={markUsedMutation.isPending}
      />
    </ClientShell>
  );
};

export default ClientActions;
