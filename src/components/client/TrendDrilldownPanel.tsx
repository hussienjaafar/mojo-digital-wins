import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { motion } from "framer-motion";

import { useTrendEvidence, getConfidenceLabel, getConfidenceColor, getTrendStageInfo } from "@/hooks/useTrendEvents";
import { useSuggestedActionsQuery } from "@/queries/useSuggestedActionsQuery";
import { useTrendOutcomeByEventId, type OutcomeStats } from "@/hooks/useTrendOutcomes";
import type { TrendEvent, TrendEvidence } from "@/hooks/useTrendEvents";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { V3Badge } from "@/components/v3";

import {
  Zap,
  TrendingUp,
  Clock,
  ExternalLink,
  Sparkles,
  Newspaper,
  MessageCircle,
  Radio,
  Target,
  Activity,
  BarChart3,
  Users,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
  Check,
  Award,
  TrendingDown,
  DollarSign,
  MousePointerClick,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface TrendDrilldownPanelProps {
  trend: TrendEvent;
  organizationId?: string;
  onClose: () => void;
}

// ============================================================================
// Evidence Timeline Item
// ============================================================================

interface EvidenceItemProps {
  evidence: TrendEvidence;
}

function EvidenceItem({ evidence }: EvidenceItemProps) {
  const SourceIcon = evidence.source_type === 'bluesky' ? MessageCircle : Newspaper;
  const publishedDate = new Date(evidence.published_at);
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg",
        "bg-[hsl(var(--portal-bg-elevated))]",
        "border border-[hsl(var(--portal-border))]",
        evidence.is_primary && "border-l-4 border-l-[hsl(var(--portal-accent-blue))]"
      )}
    >
      <div className={cn(
        "p-2 rounded-lg shrink-0",
        evidence.source_type === 'bluesky' 
          ? "bg-blue-500/10 text-blue-500" 
          : "bg-[hsl(var(--portal-accent-purple)/0.15)] text-[hsl(var(--portal-accent-purple))]"
      )}>
        <SourceIcon className="h-4 w-4" />
      </div>
      
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] line-clamp-2">
            {evidence.source_title || "Untitled"}
          </h4>
          {evidence.is_primary && (
            <Badge variant="outline" className="shrink-0 text-xs">
              Primary
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--portal-text-muted))]">
          <span>{evidence.source_domain || evidence.source_type}</span>
          <span>•</span>
          <span>{formatDistanceToNow(publishedDate, { addSuffix: true })}</span>
          {evidence.contribution_score && (
            <>
              <span>•</span>
              <span>{Math.round(evidence.contribution_score)}% weight</span>
            </>
          )}
        </div>

        {evidence.source_url && (
          <a
            href={evidence.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[hsl(var(--portal-accent-blue))] hover:underline"
          >
            View source
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Confidence Breakdown
// ============================================================================

interface ConfidenceBreakdownProps {
  trend: TrendEvent;
}

function ConfidenceBreakdown({ trend }: ConfidenceBreakdownProps) {
  const factors = trend.confidence_factors || {
    baseline_delta: 0,
    cross_source: 0,
    volume: 0,
    velocity: 0
  };

  const items = [
    { label: "Baseline Delta", value: factors.baseline_delta || 0, max: 30 },
    { label: "Cross-Source", value: factors.cross_source || 0, max: 30 },
    { label: "Volume", value: factors.volume || 0, max: 20 },
    { label: "Velocity", value: factors.velocity || 0, max: 20 },
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] flex items-center gap-2">
        <Target className="h-4 w-4" />
        Confidence Breakdown
      </h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[hsl(var(--portal-text-secondary))]">{item.label}</span>
              <span className="text-[hsl(var(--portal-text-muted))]">
                {Math.round(item.value)}/{item.max}
              </span>
            </div>
            <Progress 
              value={(item.value / item.max) * 100} 
              className="h-1.5"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Outcome Learning Section
// ============================================================================

interface OutcomeLearningProps {
  outcomeStats: OutcomeStats | null | undefined;
  isLoading?: boolean;
}

function OutcomeLearning({ outcomeStats, isLoading }: OutcomeLearningProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!outcomeStats || outcomeStats.confidenceLevel === 'low') {
    return (
      <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center">
        <Activity className="h-8 w-8 mx-auto text-[hsl(var(--portal-text-muted))] mb-2" />
        <p className="text-sm text-[hsl(var(--portal-text-muted))]">
          No outcome data yet. Send actions on this topic to build learning signals.
        </p>
      </div>
    );
  }

  const { 
    responseRate, 
    donationRate, 
    performanceDelta, 
    actionsSent, 
    totalDonations,
    totalAmount,
    learningSignal,
    isHighPerforming,
    confidenceLevel
  } = outcomeStats;

  return (
    <div className="space-y-4">
      {/* High Performing Badge */}
      {isHighPerforming && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-lg",
          "bg-[hsl(var(--portal-success)/0.1)] border border-[hsl(var(--portal-success)/0.3)]"
        )}>
          <Award className="h-5 w-5 text-[hsl(var(--portal-success))]" />
          <div>
            <p className="text-sm font-medium text-[hsl(var(--portal-success))]">
              High Performing Topic
            </p>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              This topic shows {performanceDelta > 0 ? '+' : ''}{performanceDelta.toFixed(1)}% better response than baseline
            </p>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center">
          <MousePointerClick className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--portal-accent-blue))]" />
          <p className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">
            {responseRate.toFixed(1)}%
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Response Rate</p>
        </div>
        <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center">
          <DollarSign className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--portal-success))]" />
          <p className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">
            {donationRate.toFixed(1)}%
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Donation Rate</p>
        </div>
        <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center">
          {performanceDelta >= 0 ? (
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--portal-success))]" />
          ) : (
            <TrendingDown className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--portal-error))]" />
          )}
          <p className={cn(
            "text-xl font-bold",
            performanceDelta >= 0 
              ? "text-[hsl(var(--portal-success))]" 
              : "text-[hsl(var(--portal-error))]"
          )}>
            {performanceDelta > 0 ? '+' : ''}{performanceDelta.toFixed(1)}%
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">vs Baseline</p>
        </div>
      </div>

      {/* Sample Size & Confidence */}
      <div className="flex items-center justify-between text-xs p-2 rounded bg-[hsl(var(--portal-bg-secondary))]">
        <span className="text-[hsl(var(--portal-text-muted))]">
          Based on {actionsSent.toLocaleString()} actions • {totalDonations} donations • ${totalAmount.toLocaleString()}
        </span>
        <Badge 
          variant="outline" 
          className={cn(
            "text-xs",
            confidenceLevel === 'high' && "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]",
            confidenceLevel === 'medium' && "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]"
          )}
        >
          {confidenceLevel === 'high' ? 'High Confidence' : 'Building Confidence'}
        </Badge>
      </div>

      {/* Learning Signal */}
      {learningSignal && (
        <p className="text-xs text-[hsl(var(--portal-text-secondary))] italic">
          💡 {learningSignal}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Suggested Actions Section
// ============================================================================

interface SuggestedActionsProps {
  trendTitle: string;
  organizationId?: string;
}

function SuggestedActions({ trendTitle, organizationId }: SuggestedActionsProps) {
  const { data, isLoading } = useSuggestedActionsQuery(organizationId);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter actions related to this trend (using topic and alert entity_name)
  const relatedActions = data?.actions.filter(action => {
    const searchTerm = trendTitle.toLowerCase().slice(0, 20);
    const topicMatch = action.topic?.toLowerCase().includes(searchTerm);
    const entityMatch = action.alert?.entity_name?.toLowerCase().includes(searchTerm);
    return topicMatch || entityMatch;
  }).slice(0, 3);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!relatedActions || relatedActions.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center">
        <Sparkles className="h-8 w-8 mx-auto text-[hsl(var(--portal-text-muted))] mb-2" />
        <p className="text-sm text-[hsl(var(--portal-text-muted))]">
          No suggested actions for this trend yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {relatedActions.map((action) => (
        <div
          key={action.id}
          className={cn(
            "p-3 rounded-lg",
            "bg-[hsl(var(--portal-bg-elevated))]",
            "border border-[hsl(var(--portal-border))]"
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                action.tier === "act_now" && "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))]",
                action.tier === "consider" && "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]",
                action.tier === "watch" && "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))]"
              )}
            >
              {action.tier === "act_now" ? "Act Now" : action.tier === "consider" ? "Consider" : "Watch"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(action.sms_copy, action.id)}
              className="h-7 px-2 text-xs gap-1"
            >
              {copiedId === action.id ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-[hsl(var(--portal-text-primary))]">
            {action.sms_copy}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-[hsl(var(--portal-text-muted))]">
            <span>{action.variant_type || "safe"} variant</span>
            <span>•</span>
            <span>{action.decision_score || 0}% decision score</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TrendDrilldownPanel({ 
  trend, 
  organizationId, 
  onClose 
}: TrendDrilldownPanelProps) {
  const { evidence, isLoading: evidenceLoading } = useTrendEvidence(trend.id);
  const { data: outcomeStats, isLoading: outcomeLoading } = useTrendOutcomeByEventId(organizationId, trend.id);
  const [showAllEvidence, setShowAllEvidence] = useState(false);

  const stageInfo = getTrendStageInfo(trend.trend_stage);
  const hoursAgo = Math.floor(
    (Date.now() - new Date(trend.first_seen_at).getTime()) / (1000 * 60 * 60)
  );

  // Calculate baseline delta
  const baselineDelta = trend.baseline_7d > 0 
    ? ((trend.current_1h - trend.baseline_7d) / trend.baseline_7d * 100)
    : 0;

  const displayedEvidence = showAllEvidence ? evidence : evidence.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {trend.is_breaking && (
                <Badge className="bg-[hsl(var(--portal-error))] text-white gap-1">
                  <Zap className="h-3 w-3" />
                  Breaking
                </Badge>
              )}
              <Badge variant="outline" className={cn(stageInfo.bgColor, stageInfo.color)}>
                {stageInfo.label}
              </Badge>
              <Badge 
                variant="outline" 
                className={cn("font-mono", getConfidenceColor(trend.confidence_score))}
              >
                {trend.confidence_score}% confidence
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">
              {trend.event_title}
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {trend.top_headline && (
          <blockquote className="border-l-4 border-[hsl(var(--portal-accent-blue))] pl-4 italic text-sm text-[hsl(var(--portal-text-secondary))]">
            "{trend.top_headline}"
          </blockquote>
        )}
      </div>

      <Separator />

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center">
          <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
            {baselineDelta > 0 ? '+' : ''}{Math.round(baselineDelta)}%
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">vs 7d Baseline</p>
        </div>
        <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center">
          <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
            {trend.source_count}
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Source Types</p>
        </div>
        <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center">
          <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
            {trend.evidence_count}
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Evidence Docs</p>
        </div>
      </div>

      {/* Velocity Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
          <div className="flex items-center gap-1 mb-1 text-xs text-[hsl(var(--portal-text-muted))]">
            <Clock className="h-3 w-3" />
            1h
          </div>
          <p className="font-semibold text-[hsl(var(--portal-text-primary))]">
            {trend.current_1h} mentions
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">
            {Math.round(trend.velocity_1h)}% velocity
          </p>
        </div>
        <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
          <div className="flex items-center gap-1 mb-1 text-xs text-[hsl(var(--portal-text-muted))]">
            <Clock className="h-3 w-3" />
            6h
          </div>
          <p className="font-semibold text-[hsl(var(--portal-text-primary))]">
            {trend.current_6h} mentions
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">
            {Math.round(trend.velocity_6h)}% velocity
          </p>
        </div>
        <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
          <div className="flex items-center gap-1 mb-1 text-xs text-[hsl(var(--portal-text-muted))]">
            <Activity className="h-3 w-3" />
            Accel
          </div>
          <p className="font-semibold text-[hsl(var(--portal-text-primary))]">
            {trend.acceleration > 0 ? '+' : ''}{Math.round(trend.acceleration)}%
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">
            {trend.acceleration > 20 ? 'Speeding up' : trend.acceleration < -20 ? 'Slowing' : 'Steady'}
          </p>
        </div>
      </div>

      <Separator />

      {/* Confidence Breakdown */}
      <ConfidenceBreakdown trend={trend} />

      <Separator />

      {/* Outcome Learning Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] flex items-center gap-2">
          <Award className="h-4 w-4" />
          Outcome Learning
        </h4>
        <OutcomeLearning outcomeStats={outcomeStats} isLoading={outcomeLoading} />
      </div>

      <Separator />

      {/* Evidence Timeline */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] flex items-center gap-2">
          <Newspaper className="h-4 w-4" />
          Evidence Timeline ({evidence.length})
        </h4>
        
        {evidenceLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : evidence.length === 0 ? (
          <p className="text-sm text-[hsl(var(--portal-text-muted))] text-center py-4">
            No evidence documents available
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {displayedEvidence.map((e) => (
                <EvidenceItem key={e.id} evidence={e} />
              ))}
            </div>
            {evidence.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllEvidence(!showAllEvidence)}
                className="w-full text-xs"
              >
                {showAllEvidence ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show all {evidence.length} sources
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </div>

      <Separator />

      {/* Suggested Actions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Suggested Actions
        </h4>
        <SuggestedActions 
          trendTitle={trend.event_title} 
          organizationId={organizationId} 
        />
      </div>

      {/* Timing Info */}
      <div className="text-xs text-[hsl(var(--portal-text-muted))] flex items-center gap-2 pt-2 border-t border-[hsl(var(--portal-border))]">
        <Clock className="h-3 w-3" />
        <span>First seen {hoursAgo}h ago</span>
        {trend.freshness && (
          <Badge variant="outline" className="text-xs ml-auto">
            {trend.freshness}
          </Badge>
        )}
      </div>
    </div>
  );
}
