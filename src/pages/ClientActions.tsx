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
  Rocket,
  Eye,
  Activity,
} from "lucide-react";

import { ClientShell } from "@/components/client/ClientShell";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { ActionCard, getTriageTier } from "@/components/client/ActionCard";
import { PipelineHealthPanel } from "@/components/client/actions/PipelineHealthPanel";
import { DismissReasonModal } from "@/components/client/actions/DismissReasonModal";
import { LastRunStatus } from "@/components/client/LastRunStatus";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useLatestActionGeneratorRun } from "@/hooks/useActionGeneratorRuns";
import { usePipelineHealth } from "@/hooks/usePipelineHealth";
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
type TriageView = "triage" | "list";

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
  const pipelineHealth = usePipelineHealth(organizationId);
  const markUsedMutation = useMarkActionUsed(organizationId);
  const markAllUsedMutation = useMarkAllActionsUsed(organizationId);
  const dismissMutation = useDismissAction(organizationId);

  // Local state
  const [selectedAction, setSelectedAction] = useState<SuggestedAction | null>(null);
  const [dismissActionId, setDismissActionId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [triageView, setTriageView] = useState<TriageView>("triage");

  // Group actions by triage tier
  const actionsByTier = useMemo(() => {
    if (!data?.actions) return { act_now: [], consider: [], watch: [] };

    const pending = data.actions.filter((a) => !a.is_dismissed && !a.is_used);
    
    return {
      act_now: pending.filter((a) => getTriageTier(a) === "act_now"),
      consider: pending.filter((a) => getTriageTier(a) === "consider"),
      watch: pending.filter((a) => getTriageTier(a) === "watch"),
    };
  }, [data?.actions]);

  // Filter actions for list view
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
    async (id: string, reasonCode?: string, reasonDetail?: string) => {
      try {
        await dismissMutation.mutateAsync({ actionId: id, reasonCode, reasonDetail });
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

  const handleDismissWithReason = useCallback((id: string) => {
    setDismissActionId(id);
  }, []);

  const handleConfirmDismiss = useCallback(
    async (reasonCode: string, reasonDetail?: string) => {
      if (dismissActionId) {
        await handleDismiss(dismissActionId, reasonCode, reasonDetail);
        setDismissActionId(null);
      }
    },
    [dismissActionId, handleDismiss]
  );

  const stats = data?.stats;
  const isPageLoading = orgLoading || isLoading;
  const totalPending = (stats?.pending ?? 0);

  // Triage section renderer
  const renderTriageSection = (
    tier: "act_now" | "consider" | "watch",
    actions: SuggestedAction[],
    icon: React.ReactNode,
    title: string,
    description: string,
    accentColor: string
  ) => {
    if (actions.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", accentColor)}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">
              {title} <span className="text-[hsl(var(--portal-text-muted))]">({actions.length})</span>
            </h3>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">{description}</p>
          </div>
        </div>
        <div className="space-y-3 pl-11">
          <AnimatePresence mode="popLayout">
            {actions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onSelect={setSelectedAction}
                onCopy={handleCopy}
                onDismiss={handleDismiss}
                onDismissWithReason={handleDismissWithReason}
                isCopying={markUsedMutation.isPending}
                isDismissing={dismissMutation.isPending}
                organizationId={organizationId}
                variant="full"
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <ClientShell pageTitle="Suggested Actions" showDateControls={false}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Pipeline Health Panel */}
        <PipelineHealthPanel 
          organizationId={organizationId}
          onRefresh={refetch}
        />

        {/* Hero Metrics */}
        <div className="flex flex-wrap gap-3 p-4 bg-[hsl(var(--portal-bg-elevated))] rounded-xl border border-[hsl(var(--portal-border))]">
          <V3MetricChip
            label="Act Now"
            value={actionsByTier.act_now.length}
            icon={Rocket}
            variant="success"
          />
          <V3MetricChip
            label="Consider"
            value={actionsByTier.consider.length}
            icon={Eye}
            variant="info"
          />
          <V3MetricChip
            label="Watch"
            value={actionsByTier.watch.length}
            icon={Clock}
            variant="warning"
          />
          <div className="w-px h-8 bg-[hsl(var(--portal-border))] mx-2 self-center" />
          <V3MetricChip
            label="Used"
            value={stats?.used ?? 0}
            icon={Check}
            variant="default"
          />
          <V3MetricChip
            label="Avg Relevance"
            value={`${stats?.avgRelevance ?? 0}%`}
            icon={Target}
            variant="default"
          />

          {/* View Toggle + Actions */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={triageView === "triage" ? "default" : "outline"}
              size="sm"
              onClick={() => setTriageView("triage")}
              className={cn(
                "gap-2 h-9",
                triageView === "triage" 
                  ? "bg-[hsl(var(--portal-accent-blue))] text-white" 
                  : "border-[hsl(var(--portal-border))]"
              )}
            >
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Triage</span>
            </Button>
            <Button
              variant={triageView === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setTriageView("list")}
              className={cn(
                "gap-2 h-9",
                triageView === "list" 
                  ? "bg-[hsl(var(--portal-accent-blue))] text-white" 
                  : "border-[hsl(var(--portal-border))]"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2 h-9 border-[hsl(var(--portal-border))] hover:bg-[hsl(var(--portal-bg-hover))]"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            {totalPending > 0 && (
              <Button
                onClick={handleMarkAllUsed}
                size="sm"
                disabled={markAllUsedMutation.isPending}
                className="gap-2 h-9 bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white"
              >
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">Mark All Used</span>
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        {triageView === "triage" ? (
          /* Triage View - Actions grouped by priority */
          <div className="space-y-6">
            {/* Act Now Section */}
            {renderTriageSection(
              "act_now",
              actionsByTier.act_now,
              <Rocket className="h-5 w-5 text-[hsl(var(--portal-success))]" />,
              "Act Now",
              "High opportunity, low risk, high confidence",
              "bg-[hsl(var(--portal-success)/0.1)]"
            )}

            {/* Consider Section */}
            {renderTriageSection(
              "consider",
              actionsByTier.consider,
              <Eye className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />,
              "Worth Considering",
              "Medium scores, worth reviewing",
              "bg-[hsl(var(--portal-accent-blue)/0.1)]"
            )}

            {/* Watch Section */}
            {renderTriageSection(
              "watch",
              actionsByTier.watch,
              <Clock className="h-5 w-5 text-[hsl(var(--portal-warning))]" />,
              "Watch",
              "Lower scores or flagged for review",
              "bg-[hsl(var(--portal-warning)/0.1)]"
            )}

            {/* Empty State */}
            {totalPending === 0 && (
              <ChartPanel
                title="No Pending Actions"
                description="Check the pipeline health above for status"
                icon={Lightbulb}
                isLoading={isPageLoading}
                isEmpty
                emptyMessage="No action suggestions yet. New AI-generated suggestions will appear here based on your alerts."
                minHeight={200}
              >
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Lightbulb className="h-12 w-12 text-[hsl(var(--portal-text-muted))] mb-4" />
                  <p className="text-[hsl(var(--portal-text-secondary))] mb-2">
                    No pending actions available.
                  </p>
                  {lastRun && (
                    <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-4 max-w-md">
                      Last run processed {lastRun.alerts_processed} alerts, created {lastRun.actions_created ?? 0} actions.
                      {lastRun.alerts_processed === 0 ? " No actionable alerts found." : ""}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => navigate("/client/alerts")}
                    className="mt-2 min-h-[44px] bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white border-0"
                  >
                    View Alerts
                  </Button>
                </div>
              </ChartPanel>
            )}

            {/* Used Actions (collapsed) */}
            {(stats?.used ?? 0) > 0 && (
              <ChartPanel
                title="Recently Used"
                description={`${stats?.used ?? 0} actions used`}
                icon={Check}
                minHeight={100}
              >
                <ScrollArea className="max-h-[300px]">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {data?.actions
                        .filter((a) => a.is_used && !a.is_dismissed)
                        .slice(0, 6)
                        .map((action) => (
                          <ActionCard
                            key={action.id}
                            action={action}
                            onSelect={setSelectedAction}
                            onCopy={handleCopy}
                            onDismiss={handleDismiss}
                            variant="compact"
                          />
                        ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              </ChartPanel>
            )}
          </div>
        ) : (
          /* List View - Traditional tabbed view */
          <>
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
                              onDismissWithReason={handleDismissWithReason}
                              isCopying={markUsedMutation.isPending}
                              isDismissing={dismissMutation.isPending}
                              organizationId={organizationId}
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
          </>
        )}
      </div>

      {/* Action Detail Dialog */}
      <ActionDetailDialog
        action={selectedAction}
        onClose={() => setSelectedAction(null)}
        onCopy={handleCopy}
        onDismiss={handleDismiss}
        isCopying={markUsedMutation.isPending}
      />

      {/* Dismiss Reason Modal */}
      <DismissReasonModal
        isOpen={!!dismissActionId}
        onClose={() => setDismissActionId(null)}
        onConfirm={handleConfirmDismiss}
        isLoading={dismissMutation.isPending}
      />
    </ClientShell>
  );
};

export default ClientActions;
