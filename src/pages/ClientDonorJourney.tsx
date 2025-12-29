import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  RefreshCw,
  Filter,
  ArrowRight,
  MessageSquare,
  Mail,
  MousePointerClick,
  Clock,
  Activity,
  ChevronRight,
  Layers,
  Heart,
  type LucideIcon,
} from "lucide-react";
import { ClientShell } from "@/components/client/ClientShell";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { DonorSegmentCard } from "@/components/client/DonorSegmentCard";
import { NoDataAvailable } from "@/components/client/NoDataAvailable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import {
  useDonorJourneyQuery,
  useRefreshJourneyData,
  type DonorJourneyRecord,
  type DonorSegmentSummary,
  type FunnelStage,
} from "@/queries/useDonorJourneyQuery";

// ============================================================================
// Local Components
// ============================================================================

interface MetricChipProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "error" | "info";
}

const MetricChip = ({ label, value, icon: Icon, variant = "default" }: MetricChipProps) => {
  const variantStyles = {
    default: "bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-primary))]",
    success: "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]",
    warning: "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]",
    error: "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))]",
    info: "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        variantStyles[variant]
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col">
        <span className="text-xs opacity-80">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
    </div>
  );
};

interface FilterPillProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}

const FilterPill = ({ label, isActive, onClick, count }: FilterPillProps) => (
  <button
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
      "border focus:outline-none focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.5)]",
      isActive
        ? "bg-[hsl(var(--portal-accent-blue))] text-white border-transparent"
        : "bg-transparent text-[hsl(var(--portal-text-secondary))] border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-hover))]"
    )}
    aria-pressed={isActive}
  >
    {label}
    {count !== undefined && (
      <span
        className={cn(
          "ml-1.5 px-1.5 py-0.5 rounded-full text-xs",
          isActive
            ? "bg-white/20 text-white"
            : "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))]"
        )}
      >
        {count}
      </span>
    )}
  </button>
);

// ============================================================================
// Touchpoint Icon Helper
// ============================================================================

const getTouchpointIcon = (type: string): LucideIcon => {
  switch (type) {
    case "meta_ad_click":
      return MousePointerClick;
    case "sms_send":
      return MessageSquare;
    case "email_open":
    case "email_click":
      return Mail;
    default:
      return Target;
  }
};

const getTouchpointColor = (type: string): string => {
  switch (type) {
    case "meta_ad_click":
      return "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] border-[hsl(var(--portal-accent-blue)/0.2)]";
    case "sms_send":
      return "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]";
    case "email_open":
    case "email_click":
      return "bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))] border-[hsl(var(--portal-accent-purple)/0.2)]";
    default:
      return "bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))] border-[hsl(var(--portal-border))]";
  }
};

// ============================================================================
// Journey Card Component
// ============================================================================

interface JourneyCardProps {
  journey: DonorJourneyRecord;
  onSelect: (journey: DonorJourneyRecord) => void;
}

const JourneyCard = ({ journey, onSelect }: JourneyCardProps) => {
  const timeAgo = formatDistanceToNow(new Date(journey.transaction_date), { addSuffix: true });

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
        "transition-all duration-200 hover:shadow-md cursor-pointer"
      )}
      onClick={() => onSelect(journey)}
      role="article"
      aria-label={`Donor journey: ${journey.donor_email}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(journey);
        }
      }}
    >
      {/* Accent border top */}
      <div className="absolute top-0 left-4 right-4 h-0.5 rounded-full bg-[hsl(var(--portal-success)/0.5)]" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[hsl(var(--portal-text-primary))] truncate">
              {journey.donor_email}
            </h3>
            <p className="text-xs text-[hsl(var(--portal-text-muted))] flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {timeAgo}
            </p>
          </div>

          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 text-xl font-bold text-[hsl(var(--portal-success))]">
              <DollarSign className="h-5 w-5" aria-hidden="true" />
              {journey.amount.toFixed(2)}
            </div>
            <Badge
              variant="outline"
              className="text-xs border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))]"
            >
              {journey.touchpoints.length} touchpoints
            </Badge>
          </div>
        </div>

        {/* Touchpoint Preview */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {journey.touchpoints.slice(0, 4).map((tp, idx) => {
            const Icon = getTouchpointIcon(tp.touchpoint_type);
            return (
              <Badge
                key={tp.id}
                variant="outline"
                className={cn("text-xs shrink-0", getTouchpointColor(tp.touchpoint_type))}
              >
                <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
                {tp.touchpoint_type.replace("_", " ")}
              </Badge>
            );
          })}
          {journey.touchpoints.length > 4 && (
            <Badge
              variant="outline"
              className="text-xs border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))]"
            >
              +{journey.touchpoints.length - 4} more
            </Badge>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 mt-3 border-t border-[hsl(var(--portal-border)/0.5)]">
          <div className="flex items-center gap-1 text-sm text-[hsl(var(--portal-text-muted))] group-hover:text-[hsl(var(--portal-accent-blue))] transition-colors">
            <span className="hidden sm:inline">View journey</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
      </div>
    </motion.article>
  );
};

// ============================================================================
// Funnel Stage Component
// ============================================================================

interface FunnelStageBarProps {
  stage: FunnelStage;
  maxCount: number;
}

const FunnelStageBar = ({ stage, maxCount }: FunnelStageBarProps) => {
  const widthPercent = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;

  const stageColors: Record<string, string> = {
    awareness: "bg-[hsl(var(--portal-accent-blue))]",
    engagement: "bg-[hsl(var(--portal-accent-purple))]",
    conversion: "bg-[hsl(var(--portal-success))]",
    retention: "bg-[hsl(var(--portal-warning))]",
    advocacy: "bg-[hsl(var(--portal-error))]",
  };

  return (
    <div className="flex items-center gap-4">
      <div className="w-24 shrink-0">
        <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
          {stage.label}
        </span>
      </div>
      <div className="flex-1 h-8 bg-[hsl(var(--portal-bg-tertiary))] rounded-lg overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${widthPercent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={cn("h-full rounded-lg", stageColors[stage.stage] || "bg-[hsl(var(--portal-accent-blue))]")}
        />
        <div className="absolute inset-0 flex items-center justify-between px-3">
          <span className="text-xs font-medium text-white drop-shadow-sm">
            {stage.count.toLocaleString()}
          </span>
          {stage.dropoffRate > 0 && (
            <span className="text-xs text-[hsl(var(--portal-text-muted))]">
              -{stage.dropoffRate}%
            </span>
          )}
        </div>
      </div>
      <div className="w-16 shrink-0 text-right">
        <span className="text-sm font-semibold text-[hsl(var(--portal-success))] tabular-nums">
          ${(stage.value / 1000).toFixed(1)}k
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// Journey Detail Dialog
// ============================================================================

interface JourneyDetailDialogProps {
  journey: DonorJourneyRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const JourneyDetailDialog = ({ journey, open, onOpenChange }: JourneyDetailDialogProps) => {
  if (!journey) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[hsl(var(--portal-bg-primary))] border-[hsl(var(--portal-border))]">
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--portal-text-primary))]">
            Donor Journey
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--portal-text-muted))]">
            {journey.donor_email} - {format(new Date(journey.transaction_date), "MMM d, yyyy h:mm a")}
          </DialogDescription>
        </DialogHeader>

        {/* Donation Summary */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--portal-success)/0.1)] border border-[hsl(var(--portal-success)/0.2)]">
          <div>
            <p className="text-sm text-[hsl(var(--portal-text-muted))]">Total Donation</p>
            <p className="text-2xl font-bold text-[hsl(var(--portal-success))]">
              ${journey.amount.toFixed(2)}
            </p>
          </div>
          <Badge className="bg-[hsl(var(--portal-success))] text-white">
            {journey.touchpoints.length} Touchpoints
          </Badge>
        </div>

        {/* Attribution Model */}
        <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
          <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-3">
            Attribution Model (40/20/40)
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--portal-accent-blue))]">40%</div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))]">First Touch</div>
              <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                ${journey.attribution_weights.first_touch.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--portal-success))]">20%</div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))]">Middle Touches</div>
              <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                ${(journey.attribution_weights.middle_touch * Math.max(0, journey.touchpoints.length - 2)).toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[hsl(var(--portal-accent-purple))]">40%</div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))]">Last Touch</div>
              <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                ${journey.attribution_weights.last_touch.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Journey Timeline */}
        <div className="relative">
          <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-4">
            Journey Timeline
          </h4>
          <div className="absolute left-6 top-10 bottom-4 w-0.5 bg-[hsl(var(--portal-border))]" />
          <div className="space-y-4">
            {journey.touchpoints.map((touchpoint, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === journey.touchpoints.length - 1;
              const Icon = getTouchpointIcon(touchpoint.touchpoint_type);
              const weight = isFirst
                ? journey.attribution_weights.first_touch
                : isLast
                ? journey.attribution_weights.last_touch
                : journey.attribution_weights.middle_touch;

              return (
                <div key={touchpoint.id} className="relative flex items-start gap-4">
                  <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-[hsl(var(--portal-bg-elevated))] border-2 border-[hsl(var(--portal-accent-blue))]">
                    <Icon className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" aria-hidden="true" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={getTouchpointColor(touchpoint.touchpoint_type)}>
                        {touchpoint.touchpoint_type.replace("_", " ")}
                      </Badge>
                      {isFirst && (
                        <Badge className="bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] border border-[hsl(var(--portal-accent-blue)/0.2)]">
                          First Touch (40%)
                        </Badge>
                      )}
                      {isLast && (
                        <Badge className="bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))] border border-[hsl(var(--portal-accent-purple)/0.2)]">
                          Last Touch (40%)
                        </Badge>
                      )}
                      {!isFirst && !isLast && (
                        <Badge variant="secondary">Middle (20%)</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
                      {format(new Date(touchpoint.occurred_at), "MMM d, yyyy h:mm a")}
                    </p>
                    {(touchpoint.utm_source || touchpoint.utm_campaign) && (
                      <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-0.5">
                        {touchpoint.utm_source && `Source: ${touchpoint.utm_source}`}
                        {touchpoint.utm_campaign && ` • Campaign: ${touchpoint.utm_campaign}`}
                      </p>
                    )}
                    <p className="text-sm font-medium text-[hsl(var(--portal-accent-blue))] mt-1">
                      Attribution: ${weight.toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Final Conversion */}
            <div className="relative flex items-start gap-4">
              <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-[hsl(var(--portal-success))]">
                <DollarSign className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <div className="flex-1 pt-1">
                <Badge className="bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border border-[hsl(var(--portal-success)/0.2)]">
                  Donation
                </Badge>
                <p className="text-lg font-bold text-[hsl(var(--portal-success))] mt-1">
                  ${journey.amount.toFixed(2)}
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                  {format(new Date(journey.transaction_date), "MMM d, yyyy h:mm a")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Main Page Component
// ============================================================================

const ClientDonorJourney = () => {
  const { toast } = useToast();
  const { organizationId } = useClientOrganization();

  // State
  const [minAmount, setMinAmount] = useState(0);
  const [activeTab, setActiveTab] = useState<"journeys" | "segments">("journeys");
  const [selectedJourney, setSelectedJourney] = useState<DonorJourneyRecord | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<DonorSegmentSummary | null>(null);

  // Query
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useDonorJourneyQuery(organizationId, minAmount);

  const refreshMutation = useRefreshJourneyData(organizationId);

  // Derived data
  const stats = data?.stats;
  const journeys = data?.journeys || [];
  const segments = data?.segments || [];
  const funnel = data?.funnel || [];

  const maxFunnelCount = useMemo(
    () => Math.max(...funnel.map((f) => f.count), 1),
    [funnel]
  );

  // Handlers
  const handleRefresh = useCallback(async () => {
    try {
      await refreshMutation.mutateAsync();
      toast({
        title: "Journey data refreshed",
        description: "The donor journey analytics have been updated.",
      });
    } catch {
      toast({
        title: "Refresh failed",
        description: "Unable to refresh journey data. Please try again.",
        variant: "destructive",
      });
    }
  }, [refreshMutation, toast]);

  const handleInviteToCampaign = useCallback((segment: DonorSegmentSummary) => {
    toast({
      title: "Campaign invitation",
      description: `Preparing to invite ${segment.count} donors from "${segment.name}" segment.`,
    });
  }, [toast]);

  // Amount filter options
  const amountFilters = [
    { label: "All", value: 0 },
    { label: "$25+", value: 25 },
    { label: "$50+", value: 50 },
    { label: "$100+", value: 100 },
    { label: "$250+", value: 250 },
  ];

  return (
    <ClientShell pageTitle="Donor Journey" showDateControls={false}>
      <div className="space-y-6">
        {/* Hero Panel */}
        <ChartPanel
          title="Donor Journey & Attribution"
          description="Multi-touch attribution insights and donor lifecycle analytics"
          icon={Activity}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          minHeight={120}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Refresh
            </Button>
          }
        >
          <div className="flex flex-wrap gap-3">
            <MetricChip
              label="Total Donors"
              value={stats?.totalDonors.toLocaleString() || "0"}
              icon={Users}
            />
            <MetricChip
              label="New vs Returning"
              value={`${stats?.newVsReturningRatio.toFixed(0)}% new`}
              icon={TrendingUp}
              variant="info"
            />
            <MetricChip
              label="Retention Rate"
              value={`${stats?.retentionMetrics.retentionRate.toFixed(0)}%`}
              icon={Heart}
              variant={
                (stats?.retentionMetrics.retentionRate || 0) >= 50
                  ? "success"
                  : "warning"
              }
            />
            <MetricChip
              label="Avg Donation"
              value={`$${stats?.avgDonation.toFixed(0) || "0"}`}
              icon={DollarSign}
              variant="success"
            />
            <MetricChip
              label="Avg Touchpoints"
              value={stats?.avgTouchpointsBeforeConversion.toFixed(1) || "0"}
              icon={Layers}
            />
          </div>
        </ChartPanel>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 px-1">
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--portal-text-muted))]">
            <Filter className="h-4 w-4" />
            <span>Min Amount:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {amountFilters.map((filter) => (
              <FilterPill
                key={filter.value}
                label={filter.label}
                isActive={minAmount === filter.value}
                onClick={() => setMinAmount(filter.value)}
              />
            ))}
          </div>
        </div>

        {/* Journey Funnel Panel */}
        <ChartPanel
          title="Conversion Funnel"
          description="Donor progression through acquisition stages"
          icon={Target}
          isLoading={isLoading}
          isEmpty={funnel.length === 0}
          emptyMessage="No funnel data available"
          minHeight={200}
          status={
            funnel.length > 0 && funnel[2]?.percentage >= 30
              ? { text: "Healthy", variant: "success" }
              : funnel.length > 0
              ? { text: "Needs Attention", variant: "warning" }
              : undefined
          }
        >
          <div className="space-y-3">
            {funnel.map((stage) => (
              <FunnelStageBar key={stage.stage} stage={stage} maxCount={maxFunnelCount} />
            ))}
          </div>
        </ChartPanel>

        {/* Journeys & Segments Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "journeys" | "segments")}>
          <TabsList className="bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
            <TabsTrigger
              value="journeys"
              className="data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white"
            >
              Recent Journeys
              {journeys.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {journeys.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="segments"
              className="data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white"
            >
              Donor Segments
              {segments.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {segments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="journeys" className="mt-4">
            <ChartPanel
              title="Recent Donor Journeys"
              description="Multi-touch attribution paths leading to conversions"
              icon={ArrowRight}
              isLoading={isLoading}
              isEmpty={journeys.length === 0}
              emptyMessage="No donor journeys found for the selected filters"
              minHeight={300}
            >
              <ScrollArea className="h-[400px] pr-4">
                <AnimatePresence mode="popLayout">
                  <div className="space-y-4">
                    {journeys.map((journey) => (
                      <JourneyCard
                        key={journey.id}
                        journey={journey}
                        onSelect={setSelectedJourney}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              </ScrollArea>
            </ChartPanel>
          </TabsContent>

          <TabsContent value="segments" className="mt-4">
            <ChartPanel
              title="Donor Segments"
              description="Behavioral cohorts and retention insights"
              icon={Users}
              isLoading={isLoading}
              isEmpty={segments.length === 0}
              emptyMessage="No donor segments available"
              minHeight={300}
            >
              <ScrollArea className="h-[400px] pr-4">
                <AnimatePresence mode="popLayout">
                  <div className="grid gap-4 md:grid-cols-2">
                    {segments.map((segment) => (
                      <DonorSegmentCard
                        key={segment.id}
                        segment={segment}
                        onSelect={setSelectedSegment}
                        onInviteToCampaign={handleInviteToCampaign}
                      />
                    ))}
                  </div>
                </AnimatePresence>
              </ScrollArea>
            </ChartPanel>
          </TabsContent>
        </Tabs>

        {/* Attribution Model Info */}
        <ChartPanel
          title="Multi-Touch Attribution Model"
          description="40% First Touch • 20% Middle Touches • 40% Last Touch"
          icon={Layers}
          minHeight={100}
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
              <div className="text-3xl font-bold text-[hsl(var(--portal-accent-blue))]">40%</div>
              <div className="text-sm text-[hsl(var(--portal-text-muted))]">First Touch</div>
              <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">Initial awareness</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-success)/0.1)]">
              <div className="text-3xl font-bold text-[hsl(var(--portal-success))]">20%</div>
              <div className="text-sm text-[hsl(var(--portal-text-muted))]">Middle Touches</div>
              <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">Nurturing phase</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-accent-purple)/0.1)]">
              <div className="text-3xl font-bold text-[hsl(var(--portal-accent-purple))]">40%</div>
              <div className="text-sm text-[hsl(var(--portal-text-muted))]">Last Touch</div>
              <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">Final conversion</p>
            </div>
          </div>
        </ChartPanel>

        {/* Data Freshness */}
        {dataUpdatedAt > 0 && (
          <p className="text-xs text-[hsl(var(--portal-text-muted))] text-center">
            Data updated {formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}
          </p>
        )}
      </div>

      {/* Journey Detail Dialog */}
      <JourneyDetailDialog
        journey={selectedJourney}
        open={!!selectedJourney}
        onOpenChange={(open) => !open && setSelectedJourney(null)}
      />
    </ClientShell>
  );
};

export default ClientDonorJourney;
