import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  Target,
  Sparkles,
  TrendingUp,
  DollarSign,
  Clock,
  Zap,
  RefreshCw,
  Filter,
  Copy,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

import { ClientShell } from "@/components/client/ClientShell";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { OpportunityCard } from "@/components/client/OpportunityCard";
import { LastRunStatus } from "@/components/client/LastRunStatus";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useLatestOpportunityRun } from "@/hooks/useOpportunityDetectorRuns";
import {
  useOpportunitiesQuery,
  useMarkOpportunityComplete,
  useDismissOpportunity,
  type Opportunity,
  type OpportunityStatus,
  type OpportunityType,
} from "@/queries/useOpportunitiesQuery";

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

type FilterStatus = "all" | "active" | "completed";

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

const TYPE_OPTIONS: { value: OpportunityType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "trending", label: "Trending" },
  { value: "event", label: "Events" },
  { value: "advocacy", label: "Advocacy" },
  { value: "partnership", label: "Partnership" },
];

// Local MetricChip and FilterPill removed - using V3 components from @/components/v3

// ============================================================================
// Opportunity Detail Dialog
// ============================================================================

interface OpportunityDetailDialogProps {
  opportunity: Opportunity | null;
  onClose: () => void;
  onCopyMessage: (opportunity: Opportunity) => void;
  onMarkComplete: (id: string) => void;
  onDismiss: (id: string) => void;
  isMarking: boolean;
  isDismissing: boolean;
}

const OpportunityDetailDialog = ({
  opportunity,
  onClose,
  onCopyMessage,
  onMarkComplete,
  onDismiss,
  isMarking,
  isDismissing,
}: OpportunityDetailDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(0);

  if (!opportunity) return null;

  // Generate message variants
  const messageVariants = [
    `${opportunity.entity_name} is trending with ${opportunity.current_mentions} mentions. Act now to mobilize support.`,
    `URGENT: ${opportunity.entity_name} needs us NOW. Every voice matters. Reply YES to donate and stand with us.`,
    `${opportunity.entity_name} is making headlines. This is our chance to show strength. Donate now to make an impact.`,
  ];

  const currentMessage = messageVariants[selectedVariant];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopyMessage(opportunity);
  };

  const scoreColor =
    opportunity.opportunity_score >= 80
      ? "text-[hsl(var(--portal-success))]"
      : opportunity.opportunity_score >= 50
      ? "text-[hsl(var(--portal-accent-blue))]"
      : "text-[hsl(var(--portal-accent-purple))]";

  return (
    <Dialog open={!!opportunity} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--portal-text-primary))] flex items-center gap-3">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Sparkles className="h-6 w-6 text-[hsl(var(--portal-accent-purple))]" />
            </motion.div>
            Magic Moment Detected
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--portal-text-secondary))]">
            {formatDistanceToNow(new Date(opportunity.detected_at), { addSuffix: true })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header with score */}
          <div className="flex items-start justify-between">
            <div>
              <Badge
                variant="outline"
                className="text-sm capitalize bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))] mb-2"
              >
                {opportunity.entity_type}
              </Badge>
              <h3 className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">
                {opportunity.entity_name}
              </h3>
            </div>
            <div className="text-right">
              <div className={cn("text-3xl font-bold tabular-nums", scoreColor)}>
                {opportunity.opportunity_score}
              </div>
              <p className="text-xs text-[hsl(var(--portal-text-muted))]">Score</p>
            </div>
          </div>

          {/* Trigger Event */}
          <div className="p-4 bg-[hsl(var(--portal-bg-tertiary)/0.5)] rounded-lg border border-[hsl(var(--portal-border))]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
              <span className="font-semibold text-sm text-[hsl(var(--portal-text-primary))]">
                Trigger Event
              </span>
            </div>
            <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
              {opportunity.entity_name} is surging with {opportunity.velocity.toFixed(0)}% velocity.
              {opportunity.similar_past_events > 0 &&
                ` Similar moments raised funds ${opportunity.similar_past_events} time(s) before.`}
            </p>
          </div>

          {/* Historical Performance */}
          {(opportunity.estimated_value || opportunity.historical_success_rate) && (
            <div className="p-4 bg-[hsl(var(--portal-success)/0.05)] rounded-lg border border-[hsl(var(--portal-success)/0.2)]">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                <span className="font-semibold text-sm text-[hsl(var(--portal-text-primary))]">
                  Historical Performance
                </span>
              </div>
              {opportunity.estimated_value && (
                <p className="text-sm mb-2">
                  <span className="text-2xl font-bold text-[hsl(var(--portal-success))]">
                    ${opportunity.estimated_value.toLocaleString()}
                  </span>
                  <span className="text-[hsl(var(--portal-text-secondary))] ml-2">
                    raised in similar 48h windows
                  </span>
                </p>
              )}
              {opportunity.historical_success_rate && (
                <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                  {opportunity.historical_success_rate.toFixed(0)}% historical success rate
                </p>
              )}
            </div>
          )}

          {/* Draft Message Templates - NOT AI-Generated */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
                <span className="font-semibold text-[hsl(var(--portal-text-primary))]">
                  Draft Message Templates
                </span>
                <Badge variant="outline" className="text-xs bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))]">
                  Template
                </Badge>
              </div>
              <div className="flex gap-1">
                {messageVariants.map((_, idx) => (
                  <motion.button
                    key={idx}
                    className={cn(
                      "h-8 w-8 rounded-md text-sm font-medium transition-colors",
                      selectedVariant === idx
                        ? "bg-[hsl(var(--portal-accent-blue))] text-white"
                        : "bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-hover))]"
                    )}
                    onClick={() => setSelectedVariant(idx)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {idx + 1}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[hsl(var(--portal-bg-primary))] rounded-lg border-2 border-[hsl(var(--portal-accent-purple)/0.2)]">
              <AnimatePresence mode="wait">
                <motion.p
                  key={selectedVariant}
                  className="text-base leading-relaxed text-[hsl(var(--portal-text-primary))]"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {currentMessage}
                </motion.p>
              </AnimatePresence>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[hsl(var(--portal-border))]">
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                  {currentMessage.length}/160 characters
                </span>
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                  Variant {selectedVariant + 1} of {messageVariants.length}
                </span>
              </div>
            </div>
          </div>

          {/* Optimal Send Time */}
          <div className="flex items-center gap-3 p-3 bg-[hsl(var(--portal-bg-tertiary)/0.5)] rounded-lg border border-[hsl(var(--portal-border))]">
            <Clock className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            <div className="flex-1">
              <div className="font-semibold text-sm text-[hsl(var(--portal-text-primary))]">
                Best Time to Send
              </div>
              <div className="text-sm text-[hsl(var(--portal-text-secondary))]">
                2-4 PM EST - Peak donor engagement based on your history
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {opportunity.is_active && (
              <>
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="flex-1 gap-2 border-[hsl(var(--portal-border))] hover:bg-[hsl(var(--portal-bg-hover))]"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Message
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCopy}
                  className="flex-1 gap-2 bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white"
                >
                  <Zap className="h-4 w-4" />
                  Use This Message
                </Button>
              </>
            )}
          </div>

          {opportunity.is_active && (
            <div className="flex gap-2 pt-2 border-t border-[hsl(var(--portal-border))]">
              <Button
                variant="outline"
                onClick={() => {
                  onMarkComplete(opportunity.id);
                  onClose();
                }}
                disabled={isMarking}
                className="flex-1 gap-2 text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.3)] hover:bg-[hsl(var(--portal-success)/0.1)]"
              >
                <Check className="h-4 w-4" />
                Mark Complete
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onDismiss(opportunity.id);
                  onClose();
                }}
                disabled={isDismissing}
                className="flex-1 gap-2 text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error)/0.3)] hover:bg-[hsl(var(--portal-error)/0.1)]"
              >
                <X className="h-4 w-4" />
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export default function ClientOpportunities() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();

  // Query and mutations
  const { data, isLoading, isFetching, error, refetch } = useOpportunitiesQuery(
    organizationId
  );
  const { data: lastRun, isLoading: lastRunLoading } = useLatestOpportunityRun(organizationId);
  const markCompleteMutation = useMarkOpportunityComplete(organizationId);
  const dismissMutation = useDismissOpportunity(organizationId);

  // Local state
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("active");
  const [filterType, setFilterType] = useState<OpportunityType | "all">("all");

  // Filter opportunities
  const filteredOpportunities = useMemo(() => {
    if (!data?.opportunities) return [];

    return data.opportunities
      .filter((o) => {
        if (filterStatus === "active") return o.is_active;
        if (filterStatus === "completed") return !o.is_active;
        return true;
      })
      .filter((o) => filterType === "all" || o.opportunity_type === filterType);
  }, [data?.opportunities, filterStatus, filterType]);

  // Handlers
  const handleCopyMessage = useCallback((opportunity: Opportunity) => {
    const message = `${opportunity.entity_name} is trending with ${opportunity.current_mentions} mentions. Act now to mobilize support.`;
    navigator.clipboard.writeText(message);
    toast.success("Message copied to clipboard");
  }, []);

  const handleMarkComplete = useCallback(
    async (id: string) => {
      try {
        await markCompleteMutation.mutateAsync(id);
        toast.success("Opportunity marked as complete");
      } catch (err: any) {
        toast.error(err.message || "Failed to mark as complete");
      }
    },
    [markCompleteMutation]
  );

  const handleDismiss = useCallback(
    async (id: string) => {
      try {
        await dismissMutation.mutateAsync(id);
        toast.success("Opportunity dismissed");
      } catch (err: any) {
        toast.error(err.message || "Failed to dismiss opportunity");
      }
    },
    [dismissMutation]
  );

  const stats = data?.stats;
  const isPageLoading = orgLoading || isLoading;

  return (
    <ClientShell pageTitle="Opportunities" showDateControls={false}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Hero Panel */}
        <ChartPanel
          title="Fundraising Opportunities"
          description="Real-time opportunities based on trending topics and historical performance"
          icon={Target}
          isLoading={isPageLoading}
          error={error}
          onRetry={refetch}
          actions={
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
          }
          minHeight={140}
        >
          {/* Last Run Status */}
          <div className="mb-4">
            <LastRunStatus lastRun={lastRun} isLoading={lastRunLoading} variant="opportunities" />
          </div>
          {/* Hero Metrics */}
          <div className="flex flex-wrap gap-3">
            <V3MetricChip
              label="Active Opportunities"
              value={stats?.active ?? 0}
              icon={Target}
              variant="info"
            />
            <V3MetricChip
              label="High Priority"
              value={stats?.highPriority ?? 0}
              icon={Sparkles}
              variant="success"
            />
            <V3MetricChip
              label="Ready to Launch"
              value={stats?.readyToLaunch ?? 0}
              icon={Zap}
              variant="warning"
            />
            <V3MetricChip
              label="Avg Est. Value"
              value={stats?.avgEstimatedValue ? `$${stats.avgEstimatedValue.toLocaleString()}` : "$0"}
              icon={DollarSign}
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

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <V3FilterPill
                key={value}
                label={label}
                isActive={filterStatus === value}
                onClick={() => setFilterStatus(value)}
                count={
                  value === "active"
                    ? stats?.active
                    : value === "completed"
                    ? (stats?.byStatus.completed ?? 0) + (stats?.byStatus.dismissed ?? 0)
                    : stats?.total
                }
              />
            ))}
          </div>

          <div className="w-px h-6 bg-[hsl(var(--portal-border))] mx-1" />

          {/* Type Filters */}
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map(({ value, label }) => (
              <V3FilterPill
                key={value}
                label={label}
                isActive={filterType === value}
                onClick={() => setFilterType(value)}
                count={value === "all" ? undefined : stats?.byType[value as OpportunityType]}
              />
            ))}
          </div>
        </div>

        {/* Opportunities List Panel */}
        <ChartPanel
          title="Magic Moments"
          description={`${filteredOpportunities.length} opportunities ${filterStatus === "all" ? "total" : filterStatus}`}
          icon={Sparkles}
          isLoading={isPageLoading}
          isEmpty={data?.opportunities.length === 0}
          emptyMessage="No opportunities detected yet. Our AI monitors news trends, social media, and polling data 24/7. When high-impact fundraising moments emerge, you'll see them here."
          minHeight={400}
        >
          <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)} className="w-full">
            <TabsList className="h-auto bg-[hsl(var(--portal-bg-tertiary))] mb-4">
              <TabsTrigger
                value="active"
                className="min-h-[44px] px-4 data-[state=active]:bg-[hsl(var(--portal-bg-elevated))]"
              >
                Active ({stats?.active ?? 0})
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="min-h-[44px] px-4 data-[state=active]:bg-[hsl(var(--portal-bg-elevated))]"
              >
                Completed ({(stats?.byStatus.completed ?? 0) + (stats?.byStatus.dismissed ?? 0)})
              </TabsTrigger>
              <TabsTrigger
                value="all"
                className="min-h-[44px] px-4 data-[state=active]:bg-[hsl(var(--portal-bg-elevated))]"
              >
                All ({stats?.total ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filterStatus} className="mt-0">
              {filteredOpportunities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
                  <Sparkles className="h-12 w-12 text-[hsl(var(--portal-accent-purple))] mb-4" />
                  <p className="text-[hsl(var(--portal-text-secondary))] mb-2">
                    {filterStatus === "active"
                      ? "No active opportunities detected yet."
                      : filterStatus === "completed"
                      ? "No completed opportunities yet."
                      : "No opportunities match your filters."}
                  </p>
                  {filterStatus === "active" && lastRun && (
                    <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                      Last scan processed {lastRun.trends_processed} trends, created {lastRun.created_count ?? 0}, skipped {lastRun.skipped_count ?? 0} (below threshold).
                      {lastRun.skipped_count && lastRun.skipped_count > lastRun.created_count ? " Scores may be low due to limited historical correlation data." : ""}
                    </p>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {filteredOpportunities.map((opportunity) => (
                        <OpportunityCard
                          key={opportunity.id}
                          opportunity={opportunity}
                          onSelect={setSelectedOpportunity}
                          onCopyMessage={handleCopyMessage}
                          onMarkComplete={handleMarkComplete}
                          onDismiss={handleDismiss}
                          isMarking={markCompleteMutation.isPending}
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

      {/* Opportunity Detail Dialog */}
      <OpportunityDetailDialog
        opportunity={selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
        onCopyMessage={handleCopyMessage}
        onMarkComplete={handleMarkComplete}
        onDismiss={handleDismiss}
        isMarking={markCompleteMutation.isPending}
        isDismissing={dismissMutation.isPending}
      />
    </ClientShell>
  );
}
