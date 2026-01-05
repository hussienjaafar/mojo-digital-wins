import { memo, useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  TrendingUp,
  MessageSquare,
  Clock,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldX,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { SuggestedAction } from "@/queries/useSuggestedActionsQuery";
import { useRecordFeedback } from "@/queries/useOrgFeedbackMutation";

// ============================================================================
// Configuration
// ============================================================================

type TriageTier = "act_now" | "consider" | "watch";

const tierConfig: Record<TriageTier, {
  label: string;
  description: string;
  accentClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  act_now: {
    label: "Act Now",
    description: "High opportunity, low risk, high confidence",
    accentClass: "bg-[hsl(var(--portal-success))]",
    bgClass: "bg-[hsl(var(--portal-success)/0.05)]",
    borderClass: "border-[hsl(var(--portal-success)/0.3)]",
  },
  consider: {
    label: "Consider",
    description: "Medium scores, worth reviewing",
    accentClass: "bg-[hsl(var(--portal-accent-blue))]",
    bgClass: "bg-[hsl(var(--portal-accent-blue)/0.05)]",
    borderClass: "border-[hsl(var(--portal-accent-blue)/0.3)]",
  },
  watch: {
    label: "Watch",
    description: "Lower scores or flagged for review",
    accentClass: "bg-[hsl(var(--portal-warning))]",
    bgClass: "bg-[hsl(var(--portal-bg-elevated))]",
    borderClass: "border-[hsl(var(--portal-border))]",
  },
};

const variantTypeConfig: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  safe: { label: "Safe", icon: Shield, color: "text-[hsl(var(--portal-success))]" },
  urgency: { label: "Urgency", icon: Zap, color: "text-[hsl(var(--portal-error))]" },
  values: { label: "Values", icon: Target, color: "text-[hsl(var(--portal-accent-purple))]" },
  contrast: { label: "Contrast", icon: AlertTriangle, color: "text-[hsl(var(--portal-warning))]" },
};

const complianceConfig: Record<string, { icon: LucideIcon; label: string; color: string; bg: string }> = {
  pass: { icon: ShieldCheck, label: "Compliant", color: "text-[hsl(var(--portal-success))]", bg: "bg-[hsl(var(--portal-success)/0.1)]" },
  review: { icon: Shield, label: "Review", color: "text-[hsl(var(--portal-warning))]", bg: "bg-[hsl(var(--portal-warning)/0.1)]" },
  blocked: { icon: ShieldX, label: "Blocked", color: "text-[hsl(var(--portal-error))]", bg: "bg-[hsl(var(--portal-error)/0.1)]" },
  pending: { icon: Shield, label: "Pending", color: "text-[hsl(var(--portal-text-muted))]", bg: "bg-[hsl(var(--portal-bg-tertiary))]" },
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getTriageTier(action: SuggestedAction): TriageTier {
  const decisionScore = action.decision_score ?? 0;
  const riskScore = action.risk_score ?? 50;
  const confidenceScore = action.confidence_score ?? 50;
  const complianceStatus = action.compliance_status ?? "pending";

  // Blocked compliance = always watch
  if (complianceStatus === "blocked") return "watch";

  // High decision score, low risk, high confidence = act now
  if (decisionScore >= 70 && riskScore <= 30 && confidenceScore >= 60) return "act_now";

  // Medium scores or review status = consider
  if (decisionScore >= 50 || (decisionScore >= 40 && complianceStatus === "pass")) return "consider";

  // Everything else = watch
  return "watch";
}

function getScoreColor(score: number): string {
  if (score >= 70) return "text-[hsl(var(--portal-success))]";
  if (score >= 40) return "text-[hsl(var(--portal-warning))]";
  return "text-[hsl(var(--portal-text-muted))]";
}

// ============================================================================
// Component Props
// ============================================================================

export interface ActionCardProps {
  action: SuggestedAction;
  onSelect: (action: SuggestedAction) => void;
  onCopy: (action: SuggestedAction) => Promise<void>;
  onDismiss: (id: string) => void;
  onDismissWithReason?: (id: string) => void;
  isCopying?: boolean;
  isDismissing?: boolean;
  variant?: "full" | "compact";
  organizationId?: string;
  showRationale?: boolean;
}

// ============================================================================
// Score Badge Component
// ============================================================================

interface ScoreBadgeProps {
  label: string;
  score: number;
  icon: LucideIcon;
  tooltip?: string;
}

const ScoreBadge = ({ label, score, icon: Icon, tooltip }: ScoreBadgeProps) => {
  const color = getScoreColor(score);
  const content = (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-md",
      "bg-[hsl(var(--portal-bg-tertiary)/0.5)] border border-[hsl(var(--portal-border)/0.5)]"
    )}>
      <Icon className={cn("h-3 w-3", color)} aria-hidden="true" />
      <span className="text-xs text-[hsl(var(--portal-text-muted))]">{label}</span>
      <span className={cn("text-xs font-semibold tabular-nums", color)}>{score}</span>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
};

// ============================================================================
// Rationale Section Component
// ============================================================================

interface RationaleSectionProps {
  rationale: SuggestedAction["generation_rationale"];
}

const RationaleSection = ({ rationale }: RationaleSectionProps) => {
  if (!rationale) return null;

  const signals = rationale.signals;
  const assumptions = rationale.assumptions;
  const risks = rationale.risks;

  const opportunitySignals = signals?.opportunity ?? [];
  const fitSignals = signals?.fit ?? [];
  const riskSignals = signals?.risk ?? [];

  return (
    <div className="space-y-3 pt-3 border-t border-[hsl(var(--portal-border)/0.5)]">
      <p className="text-xs font-medium text-[hsl(var(--portal-text-primary))] flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-purple))]" />
        Why we recommend this
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {opportunitySignals.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[hsl(var(--portal-text-secondary))] mb-1">Opportunity Signals</p>
            <ul className="text-xs text-[hsl(var(--portal-text-muted))] space-y-0.5">
              {opportunitySignals.slice(0, 3).map((s, i) => (
                <li key={i} className="flex items-start gap-1">
                  <TrendingUp className="h-3 w-3 mt-0.5 shrink-0 text-[hsl(var(--portal-accent-blue))]" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {fitSignals.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[hsl(var(--portal-text-secondary))] mb-1">Fit Signals</p>
            <ul className="text-xs text-[hsl(var(--portal-text-muted))] space-y-0.5">
              {fitSignals.slice(0, 3).map((r, i) => (
                <li key={i} className="flex items-start gap-1">
                  <Target className="h-3 w-3 mt-0.5 shrink-0 text-[hsl(var(--portal-success))]" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {((assumptions && assumptions.length > 0) || (risks && risks.length > 0) || riskSignals.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2 pt-2">
          {assumptions && assumptions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[hsl(var(--portal-text-secondary))] mb-1">Assumptions</p>
              <ul className="text-xs text-[hsl(var(--portal-text-muted))] space-y-0.5">
                {assumptions.slice(0, 2).map((a, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(risks && risks.length > 0) || riskSignals.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-[hsl(var(--portal-text-secondary))] mb-1">Risks</p>
              <ul className="text-xs text-[hsl(var(--portal-text-muted))] space-y-0.5">
                {[...(risks ?? []), ...riskSignals].slice(0, 2).map((r, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-[hsl(var(--portal-warning))]" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ActionCard = memo(
  ({
    action,
    onSelect,
    onCopy,
    onDismiss,
    onDismissWithReason,
    isCopying = false,
    isDismissing = false,
    variant = "full",
    organizationId,
    showRationale = false,
  }: ActionCardProps) => {
    const [copied, setCopied] = useState(false);
    const [rationaleOpen, setRationaleOpen] = useState(showRationale);
    const recordFeedback = useRecordFeedback(organizationId);

    const tier = getTriageTier(action);
    const tierStyle = tierConfig[tier];
    const variantType = action.variant_type ? variantTypeConfig[action.variant_type] : null;
    const compliance = complianceConfig[action.compliance_status ?? "pending"];
    const ComplianceIcon = compliance.icon;

    const timeAgo = formatDistanceToNow(new Date(action.created_at), { addSuffix: true });
    const hasDecisionScores = action.decision_score !== undefined && action.decision_score !== null;

    const handleCopy = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await onCopy(action);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Error handled in parent
      }
    };

    const handleDismiss = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDismissWithReason) {
        onDismissWithReason(action.id);
      } else {
        onDismiss(action.id);
      }
    };

    const handleRelevantFeedback = async (e: React.MouseEvent) => {
      e.stopPropagation();
      await recordFeedback.mutateAsync({
        event_type: 'relevant_feedback',
        object_type: 'suggested_action',
        object_id: action.id,
        entity_name: action.alert?.entity_name,
        topic_tags: [action.topic],
        relevance_score_at_time: action.topic_relevance_score,
        urgency_score_at_time: action.urgency_score,
      });
    };

    const handleIrrelevantFeedback = async (e: React.MouseEvent) => {
      e.stopPropagation();
      await recordFeedback.mutateAsync({
        event_type: 'irrelevant_feedback',
        object_type: 'suggested_action',
        object_id: action.id,
        entity_name: action.alert?.entity_name,
        topic_tags: [action.topic],
        relevance_score_at_time: action.topic_relevance_score,
        urgency_score_at_time: action.urgency_score,
      });
    };

    // Compact variant for "used" actions
    if (variant === "compact") {
      return (
        <motion.article
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "group relative rounded-xl border bg-[hsl(var(--portal-bg-elevated))]",
            "border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-hover))]",
            "transition-all duration-200 hover:shadow-sm cursor-pointer opacity-75"
          )}
          onClick={() => onSelect(action)}
          role="article"
          aria-label={`${action.topic} - Used action`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(action);
            }
          }}
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-[hsl(var(--portal-text-primary))] line-clamp-1">
                  {action.topic}
                </h4>
                <p className="text-sm text-[hsl(var(--portal-text-secondary))] line-clamp-2 mt-1">
                  {action.sms_copy}
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-2">
                  Used {timeAgo}
                </p>
              </div>
              <Badge className="shrink-0 bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border border-[hsl(var(--portal-success)/0.2)]">
                <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                Used
              </Badge>
            </div>
          </div>
        </motion.article>
      );
    }

    // Full variant for pending actions - Redesigned with triage focus
    return (
      <Collapsible open={rationaleOpen} onOpenChange={setRationaleOpen}>
        <motion.article
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "group relative rounded-xl border",
            tierStyle.bgClass,
            tierStyle.borderClass,
            "transition-all duration-200 hover:shadow-md"
          )}
          role="article"
          aria-label={`${action.topic} - ${tierStyle.label}`}
        >
          {/* Accent border top */}
          <div className={cn("absolute top-0 left-4 right-4 h-0.5 rounded-full", tierStyle.accentClass)} />

          <div className="p-4">
            {/* Header: Topic + Why Now */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[hsl(var(--portal-text-primary))] line-clamp-1">
                  {action.topic}
                </h3>
                {action.alert?.entity_name && (
                  <p className="text-sm text-[hsl(var(--portal-text-secondary))] mt-0.5 line-clamp-1">
                    📊 Related to: {action.alert.entity_name}
                    {action.alert.actionable_score > 0 && ` (Score: ${action.alert.actionable_score})`}
                  </p>
                )}
              </div>

              {/* Compliance Badge */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={cn("shrink-0", compliance.bg, compliance.color, "border-0")}>
                    <ComplianceIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                    {compliance.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {action.compliance_status === "pass" && "Passes all compliance checks"}
                  {action.compliance_status === "review" && "Needs manual review before sending"}
                  {action.compliance_status === "blocked" && "Has compliance issues, do not send"}
                  {(!action.compliance_status || action.compliance_status === "pending") && "Compliance check pending"}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Score Badges Row */}
            <TooltipProvider>
              <div className="flex flex-wrap gap-2 mb-3">
                {hasDecisionScores ? (
                  <>
                    <ScoreBadge
                      label="Opportunity"
                      score={action.opportunity_score ?? 0}
                      icon={TrendingUp}
                      tooltip="Why now: velocity, volume, sentiment signals"
                    />
                    <ScoreBadge
                      label="Fit"
                      score={action.fit_score ?? 0}
                      icon={Target}
                      tooltip="Why you: mission, topics, entities alignment"
                    />
                    <ScoreBadge
                      label="Risk"
                      score={action.risk_score ?? 0}
                      icon={AlertTriangle}
                      tooltip="Lower is better: compliance/reputational risk"
                    />
                  </>
                ) : (
                  <>
                    <ScoreBadge label="Relevance" score={action.topic_relevance_score} icon={Target} />
                    <ScoreBadge label="Urgency" score={action.urgency_score} icon={Zap} />
                  </>
                )}
                {variantType && (
                  <Badge variant="outline" className={cn("text-xs", variantType.color, "border-current/30")}>
                    <variantType.icon className="h-3 w-3 mr-1" />
                    {variantType.label}
                  </Badge>
                )}
              </div>
            </TooltipProvider>

            {/* SMS Preview */}
            <div className="bg-[hsl(var(--portal-bg-tertiary)/0.5)] rounded-lg p-3 mb-3 border border-[hsl(var(--portal-border)/0.5)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[hsl(var(--portal-text-secondary))]">
                  {action.generation_method === "ai" ? "AI-Generated SMS" : "Template SMS"}
                </span>
                <Badge
                  variant="outline"
                  className="text-xs bg-transparent border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))]"
                >
                  {action.character_count}/160
                </Badge>
              </div>
              <p className="text-sm font-mono text-[hsl(var(--portal-text-primary))] line-clamp-3">
                {action.sms_copy}
              </p>
              <Progress
                value={(action.character_count / 160) * 100}
                className="h-1 mt-2"
              />
            </div>

            {/* Actions Row */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCopy}
                  disabled={isCopying || copied}
                  className={cn(
                    "h-9 px-4 gap-2",
                    copied
                      ? "bg-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success))]"
                      : "bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))]",
                    "text-white"
                  )}
                  aria-label="Copy SMS text"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Use</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  disabled={isDismissing}
                  className="h-9 px-2 gap-1 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)]"
                  aria-label="Dismiss action"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Dismiss</span>
                </Button>
              </div>

              {/* Feedback + Expand */}
              <TooltipProvider>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRelevantFeedback}
                        className="h-8 w-8 p-0 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success)/0.1)]"
                        aria-label="Mark as relevant"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Relevant - show more like this</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleIrrelevantFeedback}
                        className="h-8 w-8 p-0 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)]"
                        aria-label="Mark as not relevant"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Not relevant - show less like this</TooltipContent>
                  </Tooltip>

                  {action.generation_rationale && (
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-accent-blue))]"
                      >
                        <span className="text-xs">Why</span>
                        {rationaleOpen ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  )}
                </div>
              </TooltipProvider>
            </div>

            {/* Expandable Rationale */}
            <CollapsibleContent>
              <RationaleSection rationale={action.generation_rationale} />
            </CollapsibleContent>
          </div>
        </motion.article>
      </Collapsible>
    );
  }
);

ActionCard.displayName = "ActionCard";
