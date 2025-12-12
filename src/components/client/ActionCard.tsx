import { memo, useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Copy,
  Check,
  X,
  ChevronRight,
  Zap,
  Target,
  TrendingUp,
  MessageSquare,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SuggestedAction } from "@/queries/useSuggestedActionsQuery";

// ============================================================================
// Configuration
// ============================================================================

type UrgencyLevel = "high" | "medium" | "low";

const urgencyConfig: Record<UrgencyLevel, {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: LucideIcon;
}> = {
  high: {
    label: "Urgent",
    bg: "bg-[hsl(var(--portal-error)/0.1)]",
    text: "text-[hsl(var(--portal-error))]",
    border: "border-[hsl(var(--portal-error)/0.3)]",
    icon: Zap,
  },
  medium: {
    label: "Medium",
    bg: "bg-[hsl(var(--portal-warning)/0.1)]",
    text: "text-[hsl(var(--portal-warning))]",
    border: "border-[hsl(var(--portal-warning)/0.3)]",
    icon: TrendingUp,
  },
  low: {
    label: "Low",
    bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
    text: "text-[hsl(var(--portal-accent-blue))]",
    border: "border-[hsl(var(--portal-accent-blue)/0.3)]",
    icon: Clock,
  },
};

const actionTypeConfig: Record<string, {
  label: string;
  icon: LucideIcon;
}> = {
  sms: { label: "SMS", icon: MessageSquare },
  email: { label: "Email", icon: MessageSquare },
  social: { label: "Social", icon: MessageSquare },
  call: { label: "Call", icon: MessageSquare },
  other: { label: "Action", icon: Zap },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getUrgencyLevel(score: number): UrgencyLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// ============================================================================
// Component Props
// ============================================================================

export interface ActionCardProps {
  action: SuggestedAction;
  onSelect: (action: SuggestedAction) => void;
  onCopy: (action: SuggestedAction) => Promise<void>;
  onDismiss: (id: string) => void;
  isCopying?: boolean;
  isDismissing?: boolean;
  variant?: "full" | "compact";
}

// ============================================================================
// Component
// ============================================================================

export const ActionCard = memo(
  ({
    action,
    onSelect,
    onCopy,
    onDismiss,
    isCopying = false,
    isDismissing = false,
    variant = "full",
  }: ActionCardProps) => {
    const [copied, setCopied] = useState(false);
    
    const urgencyLevel = getUrgencyLevel(action.urgency_score);
    const urgency = urgencyConfig[urgencyLevel];
    const actionType = actionTypeConfig[action.action_type] || actionTypeConfig.other;
    const UrgencyIcon = urgency.icon;
    const ActionTypeIcon = actionType.icon;

    const timeAgo = formatDistanceToNow(new Date(action.created_at), { addSuffix: true });
    const isHighRelevance = action.topic_relevance_score >= 70;

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
      onDismiss(action.id);
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

    // Full variant for pending actions
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
        onClick={() => onSelect(action)}
        role="article"
        aria-label={`${action.topic} - ${urgency.label} urgency action`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(action);
          }
        }}
      >
        {/* Accent border top */}
        <div
          className={cn(
            "absolute top-0 left-4 right-4 h-0.5 rounded-full",
            urgencyLevel === "high"
              ? "bg-[hsl(var(--portal-error)/0.5)]"
              : urgencyLevel === "medium"
              ? "bg-[hsl(var(--portal-warning)/0.5)]"
              : "bg-[hsl(var(--portal-accent-blue)/0.5)]"
          )}
        />

        <div className="p-4">
          {/* Header: Badges + Relevance Score */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("text-xs", urgency.border, urgency.text, urgency.bg)}
              >
                <UrgencyIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                {urgency.label}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))]"
              >
                <ActionTypeIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                {actionType.label}
              </Badge>
              {isHighRelevance && (
                <Badge className="text-xs bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border border-[hsl(var(--portal-success)/0.2)]">
                  High Relevance
                </Badge>
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs text-[hsl(var(--portal-text-muted))]">Relevance</div>
              <div className="text-xl font-bold text-[hsl(var(--portal-accent-blue))] tabular-nums">
                {action.topic_relevance_score}%
              </div>
            </div>
          </div>

          {/* Topic/Title */}
          <h3 className="font-semibold text-[hsl(var(--portal-text-primary))] mb-1 pr-8 line-clamp-2">
            {action.topic}
          </h3>

          {/* Entity Context */}
          {action.alert?.entity_name && (
            <p className="text-sm text-[hsl(var(--portal-text-secondary))] mb-3">
              Related to: <span className="font-medium">{action.alert.entity_name}</span>
              {action.alert.actionable_score > 0 && (
                <span className="text-[hsl(var(--portal-text-muted))]">
                  {" "}(Score: {action.alert.actionable_score})
                </span>
              )}
            </p>
          )}

          {/* SMS Preview */}
          <div className="bg-[hsl(var(--portal-bg-tertiary)/0.5)] rounded-lg p-3 mb-3 border border-[hsl(var(--portal-border)/0.5)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[hsl(var(--portal-text-secondary))]">
                SMS Preview
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

          {/* Scores Row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-[hsl(var(--portal-text-muted))] mb-3">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              Urgency: {action.urgency_score}%
            </span>
            <span className="flex items-center gap-1">
              <Target className="h-3.5 w-3.5" aria-hidden="true" />
              {action.estimated_impact}
            </span>
            <span className="text-xs">{timeAgo}</span>
          </div>

          {/* Value Proposition Preview */}
          {action.value_proposition && (
            <p className="text-sm text-[hsl(var(--portal-text-secondary))] line-clamp-2 mb-3">
              {action.value_proposition}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--portal-border)/0.5)]">
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleCopy}
                disabled={isCopying || copied}
                className={cn(
                  "h-9 px-3 gap-2",
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
                    <span>Copy</span>
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

            <div className="flex items-center gap-1 text-sm text-[hsl(var(--portal-text-muted))] group-hover:text-[hsl(var(--portal-accent-blue))] transition-colors">
              <span className="hidden sm:inline">Details</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
        </div>
      </motion.article>
    );
  }
);

ActionCard.displayName = "ActionCard";
