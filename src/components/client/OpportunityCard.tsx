import React, { memo, useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Sparkles,
  TrendingUp,
  DollarSign,
  Clock,
  Zap,
  Copy,
  Check,
  X,
  ChevronRight,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FeedbackButtons } from "./FeedbackButtons";
import { RelevanceReasons } from "./RelevanceReasons";
import type {
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  PriorityLevel,
} from "@/queries/useOpportunitiesQuery";

// ============================================================================
// Configuration
// ============================================================================

const priorityConfig: Record<PriorityLevel, {
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  high: {
    label: "High Priority",
    bg: "bg-[hsl(var(--portal-success)/0.1)]",
    text: "text-[hsl(var(--portal-success))]",
    border: "border-[hsl(var(--portal-success)/0.3)]",
  },
  medium: {
    label: "Medium",
    bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
    text: "text-[hsl(var(--portal-accent-blue))]",
    border: "border-[hsl(var(--portal-accent-blue)/0.3)]",
  },
  low: {
    label: "Low",
    bg: "bg-[hsl(var(--portal-text-muted)/0.1)]",
    text: "text-[hsl(var(--portal-text-muted))]",
    border: "border-[hsl(var(--portal-border))]",
  },
};

const statusConfig: Record<OpportunityStatus, {
  label: string;
  bg: string;
  text: string;
}> = {
  pending: {
    label: "Pending",
    bg: "bg-[hsl(var(--portal-warning)/0.1)]",
    text: "text-[hsl(var(--portal-warning))]",
  },
  live: {
    label: "Live",
    bg: "bg-[hsl(var(--portal-success)/0.1)]",
    text: "text-[hsl(var(--portal-success))]",
  },
  completed: {
    label: "Completed",
    bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
    text: "text-[hsl(var(--portal-accent-blue))]",
  },
  dismissed: {
    label: "Dismissed",
    bg: "bg-[hsl(var(--portal-text-muted)/0.1)]",
    text: "text-[hsl(var(--portal-text-muted))]",
  },
};

const typeConfig: Record<OpportunityType, {
  label: string;
  icon: LucideIcon;
}> = {
  trending: { label: "Trending", icon: TrendingUp },
  event: { label: "Event", icon: Clock },
  advocacy: { label: "Advocacy", icon: Target },
  partnership: { label: "Partnership", icon: Users },
  other: { label: "Opportunity", icon: Sparkles },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getPriorityLevel(score: number): PriorityLevel {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

// ============================================================================
// Component Props
// ============================================================================

export interface OpportunityCardProps {
  opportunity: Opportunity;
  onSelect: (opportunity: Opportunity) => void;
  onCopyMessage?: (opportunity: Opportunity) => void;
  onMarkComplete: (id: string) => void;
  onDismiss: (id: string) => void;
  isMarking?: boolean;
  isDismissing?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const OpportunityCard = memo(
  ({
    opportunity,
    onSelect,
    onCopyMessage,
    onMarkComplete,
    onDismiss,
    isMarking = false,
    isDismissing = false,
  }: OpportunityCardProps) => {
    const [copied, setCopied] = useState(false);

    const priorityLevel = getPriorityLevel(opportunity.opportunity_score);
    const priority = priorityConfig[priorityLevel];
    const status = statusConfig[opportunity.status];
    const oppType = typeConfig[opportunity.opportunity_type];
    const TypeIcon = oppType.icon;

    const timeAgo = formatDistanceToNow(new Date(opportunity.detected_at), { addSuffix: true });

    const handleCopy = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onCopyMessage) {
        onCopyMessage(opportunity);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    const handleComplete = (e: React.MouseEvent) => {
      e.stopPropagation();
      onMarkComplete(opportunity.id);
    };

    const handleDismiss = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDismiss(opportunity.id);
    };

    // Score color based on priority
    const scoreColor =
      priorityLevel === "high"
        ? "text-[hsl(var(--portal-success))]"
        : priorityLevel === "medium"
        ? "text-[hsl(var(--portal-accent-blue))]"
        : "text-[hsl(var(--portal-accent-purple))]";

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
          !opportunity.is_active && "opacity-60"
        )}
        onClick={() => onSelect(opportunity)}
        role="article"
        aria-label={`${opportunity.entity_name} - ${priority.label} opportunity`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(opportunity);
          }
        }}
      >
        {/* Accent border top */}
        <div
          className={cn(
            "absolute top-0 left-4 right-4 h-0.5 rounded-full",
            priorityLevel === "high"
              ? "bg-[hsl(var(--portal-success)/0.5)]"
              : priorityLevel === "medium"
              ? "bg-[hsl(var(--portal-accent-blue)/0.5)]"
              : "bg-[hsl(var(--portal-accent-purple)/0.5)]"
          )}
        />

        {/* Magic sparkle for high priority */}
        {priorityLevel === "high" && opportunity.is_active && (
          <motion.div
            className="absolute top-4 right-4 z-10"
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
            <Sparkles className="h-5 w-5 text-[hsl(var(--portal-accent-purple))]" aria-hidden="true" />
          </motion.div>
        )}

        <div className="p-4">
          {/* Header: Badges + Score */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("text-xs", status.bg, status.text)}>
                {status.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-xs", priority.border, priority.text, priority.bg)}
              >
                {priority.label}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))]"
              >
                <TypeIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                {oppType.label}
              </Badge>
            </div>

            <div className="text-right shrink-0 pr-6">
              <div className="text-xs text-[hsl(var(--portal-text-muted))]">Score</div>
              <div className={cn("text-xl font-bold tabular-nums", scoreColor)}>
                {opportunity.opportunity_score}
              </div>
            </div>
          </div>

          {/* Entity Name */}
          <h3 className="font-semibold text-[hsl(var(--portal-text-primary))] mb-1 pr-8">
            {opportunity.entity_name}
          </h3>

          {/* Entity Type */}
          <p className="text-sm text-[hsl(var(--portal-text-secondary))] mb-3 capitalize">
            {opportunity.entity_type}
          </p>

          {/* Metrics Row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-[hsl(var(--portal-text-muted))] mb-3">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              {opportunity.velocity.toFixed(1)}% velocity
            </span>
            {opportunity.current_mentions > 0 && (
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                {opportunity.current_mentions} mentions
              </span>
            )}
            {opportunity.estimated_value && opportunity.estimated_value > 0 && (
              <span className="flex items-center gap-1 text-[hsl(var(--portal-success))]">
                <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />
                ${opportunity.estimated_value.toLocaleString()}
              </span>
            )}
            <span className="text-xs">{timeAgo}</span>
          </div>

          {/* Relevance and Feedback */}
          <div className="flex items-center justify-between mb-3">
            <RelevanceReasons 
              score={opportunity.org_relevance_score} 
              reasons={opportunity.org_relevance_reasons} 
            />
            <FeedbackButtons
              objectType="opportunity"
              objectId={opportunity.id}
              entityName={opportunity.entity_name}
              relevanceScore={opportunity.org_relevance_score ?? undefined}
              size="sm"
            />
          </div>

          {/* Historical Context */}
          {opportunity.similar_past_events > 0 && (
            <p className="text-sm text-[hsl(var(--portal-text-secondary))] line-clamp-2 mb-3">
              Similar events raised funds {opportunity.similar_past_events} time(s)
              {opportunity.historical_success_rate &&
                ` with ${opportunity.historical_success_rate.toFixed(0)}% success rate`}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--portal-border)/0.5)]">
            <div className="flex items-center gap-2">
              {opportunity.is_active && onCopyMessage && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCopy}
                  disabled={copied}
                  className={cn(
                    "h-8 px-3 gap-1.5",
                    copied
                      ? "bg-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success))]"
                      : "bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))]",
                    "text-white"
                  )}
                  aria-label="Copy suggested message"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Copy</span>
                    </>
                  )}
                </Button>
              )}
              {opportunity.is_active && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleComplete}
                  disabled={isMarking}
                  className="h-8 px-2 gap-1 text-[hsl(var(--portal-success))] hover:text-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success)/0.1)]"
                  aria-label="Mark as complete"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Done</span>
                </Button>
              )}
              {opportunity.is_active && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  disabled={isDismissing}
                  className="h-8 px-2 gap-1 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)]"
                  aria-label="Dismiss opportunity"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Dismiss</span>
                </Button>
              )}
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

OpportunityCard.displayName = "OpportunityCard";
