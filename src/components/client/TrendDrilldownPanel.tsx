import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { motion } from "framer-motion";

import { useTrendEvidence, getConfidenceLabel, getConfidenceColor, getTrendStageInfo, generateWhyTrendingSummary, getTierLabel } from "@/hooks/useTrendEvents";
import { useSuggestedActionsQuery } from "@/queries/useSuggestedActionsQuery";
import { useTrendOutcomeByEventId, type OutcomeStats } from "@/hooks/useTrendOutcomes";
import type { TrendEvent, TrendEvidence } from "@/hooks/useTrendEvents";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { V3Badge, V3Button } from "@/components/v3";

import {
  Zap,
  TrendingUp,
  Clock,
  ExternalLink,
  Sparkles,
  Newspaper,
  MessageCircle,
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
  Shield,
  Layers,
  ShieldCheck,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface TrendDrilldownPanelProps {
  trend: TrendEvent;
  organizationId?: string;
  relevanceExplanation?: string;
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
  const tierInfo = getTierLabel(evidence.source_tier);
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg",
        "bg-[hsl(var(--portal-bg-elevated))]",
        "border border-[hsl(var(--portal-border))]",
        evidence.is_primary && "border-l-2 border-l-[hsl(var(--portal-accent-blue))]"
      )}
    >
      <div className={cn(
        "p-1.5 rounded-lg shrink-0",
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
          <div className="flex items-center gap-1 shrink-0">
            {evidence.source_tier && (
              <V3Badge variant="outline" size="sm" className={tierInfo.color}>
                {tierInfo.label}
              </V3Badge>
            )}
            {evidence.is_primary && (
              <V3Badge variant="outline" size="sm">Primary</V3Badge>
            )}
          </div>
        </div>
        
        <p className="text-xs text-[hsl(var(--portal-text-muted))] flex items-center gap-1.5">
          <span>{evidence.source_domain || evidence.source_type}</span>
          <span>·</span>
          <span>{formatDistanceToNow(publishedDate, { addSuffix: true })}</span>
          {evidence.contribution_score && (
            <>
              <span>·</span>
              <span>{Math.round(evidence.contribution_score * 10) / 10} score</span>
            </>
          )}
        </p>

        {(evidence.source_url || evidence.canonical_url) && (
          <a
            href={evidence.canonical_url || evidence.source_url || ''}
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
// Collapsible Section
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-sm font-medium text-[hsl(var(--portal-text-primary))] hover:text-[hsl(var(--portal-accent-blue))] transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
        )}
      </button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// Confidence Breakdown
// ============================================================================

interface ConfidenceBreakdownProps {
  trend: TrendEvent;
}

function ConfidenceBreakdown({ trend }: ConfidenceBreakdownProps) {
  const factors = trend.confidence_factors || {};
  const typedFactors = factors as Record<string, unknown>;

  const items = [
    { label: "Baseline Delta", value: Number(typedFactors.baseline_delta || 0), max: 25, description: "Spike vs 7-day average" },
    { label: "Cross-Source", value: Number(typedFactors.cross_source || 0), max: 25, description: "Multiple sources verify" },
    { label: "Volume", value: Number(typedFactors.volume || 0), max: 25, description: "Total mention count" },
    { label: "Recency", value: Number(typedFactors.recency || 0), max: 25, description: "Recent activity" },
  ];

  // Calculate z-score and baseline delta for display
  const zScore = trend.z_score_velocity || 0;
  const baselineDeltaPct = trend.baseline_7d > 0 
    ? ((trend.current_24h / 24 - trend.baseline_7d) / trend.baseline_7d * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Key Metrics Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-lg bg-[hsl(var(--portal-bg-secondary))] text-center">
          <p className={cn(
            "text-lg font-bold",
            zScore >= 3 ? "text-[hsl(var(--portal-error))]" :
            zScore >= 2 ? "text-[hsl(var(--portal-warning))]" :
            "text-[hsl(var(--portal-text-primary))]"
          )}>
            {zScore >= 0 ? '+' : ''}{zScore.toFixed(1)}σ
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Spike</p>
        </div>
        <div className="p-2 rounded-lg bg-[hsl(var(--portal-bg-secondary))] text-center">
          <p className={cn(
            "text-lg font-bold",
            baselineDeltaPct > 200 ? "text-[hsl(var(--portal-error))]" :
            baselineDeltaPct > 100 ? "text-[hsl(var(--portal-warning))]" :
            "text-[hsl(var(--portal-text-primary))]"
          )}>
            {baselineDeltaPct > 0 ? '+' : ''}{Math.round(baselineDeltaPct)}%
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">vs Baseline</p>
        </div>
        <div className="p-2 rounded-lg bg-[hsl(var(--portal-bg-secondary))] text-center">
          <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
            {trend.rank_score?.toFixed(0) || trend.trend_score?.toFixed(0) || '—'}
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Rank</p>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[hsl(var(--portal-text-secondary))]">{item.label}</span>
                <span className="text-[hsl(var(--portal-text-muted))]">({item.description})</span>
              </div>
              <span className="text-[hsl(var(--portal-text-muted))] font-mono">
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

      {/* Total Confidence */}
      <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--portal-border))]">
        <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Total Confidence</span>
        <span className="text-lg font-bold text-[hsl(var(--portal-accent-blue))]">{trend.confidence_score}%</span>
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
        <div className="h-20 rounded-lg bg-[hsl(var(--portal-bg-secondary))] animate-pulse" />
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
              {performanceDelta > 0 ? '+' : ''}{performanceDelta.toFixed(1)}% better than baseline
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
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Response</p>
        </div>
        <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] text-center">
          <DollarSign className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--portal-success))]" />
          <p className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">
            {donationRate.toFixed(1)}%
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Donation</p>
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
          {actionsSent.toLocaleString()} actions · {totalDonations} donations · ${totalAmount.toLocaleString()}
        </span>
        <V3Badge 
          variant={confidenceLevel === 'high' ? 'success' : 'warning'}
          size="sm"
        >
          {confidenceLevel === 'high' ? 'High Confidence' : 'Building'}
        </V3Badge>
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

  // Filter actions related to this trend
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
        <div className="h-16 rounded-lg bg-[hsl(var(--portal-bg-secondary))] animate-pulse" />
        <div className="h-16 rounded-lg bg-[hsl(var(--portal-bg-secondary))] animate-pulse" />
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
            <V3Badge
              variant={
                action.tier === "act_now" ? "red" : 
                action.tier === "consider" ? "amber" : "muted"
              }
              size="sm"
            >
              {action.tier === "act_now" ? "Act Now" : action.tier === "consider" ? "Consider" : "Watch"}
            </V3Badge>
            <V3Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(action.sms_copy, action.id)}
              leftIcon={copiedId === action.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            >
              {copiedId === action.id ? "Copied" : "Copy"}
            </V3Button>
          </div>
          <p className="text-sm text-[hsl(var(--portal-text-primary))]">
            {action.sms_copy}
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-2">
            {action.variant_type || "safe"} variant · {action.decision_score || 0}% score
          </p>
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
  relevanceExplanation,
  onClose 
}: TrendDrilldownPanelProps) {
  const { evidence, isLoading: evidenceLoading } = useTrendEvidence(trend.id);
  const { data: outcomeStats, isLoading: outcomeLoading } = useTrendOutcomeByEventId(organizationId, trend.id);
  const [showAllEvidence, setShowAllEvidence] = useState(false);

  const stageInfo = getTrendStageInfo(trend.trend_stage);

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
                <V3Badge variant="red" icon={<Zap className="h-3 w-3" />}>Breaking</V3Badge>
              )}
              <V3Badge variant="outline">{stageInfo.label}</V3Badge>
              <V3Badge variant="muted" className="font-mono">
                {trend.confidence_score}%
              </V3Badge>
            </div>
            <h2 className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">
              {trend.event_title}
            </h2>
            {relevanceExplanation && (
              <p className="text-sm text-[hsl(var(--portal-accent-blue))] flex items-center gap-1.5 mt-1">
                <Target className="h-3.5 w-3.5" />
                {relevanceExplanation}
              </p>
            )}
          </div>
          <V3Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </V3Button>
        </div>

        {trend.top_headline && (
          <blockquote className="border-l-2 border-[hsl(var(--portal-accent-blue))] pl-4 italic text-sm text-[hsl(var(--portal-text-secondary))]">
            "{trend.top_headline}"
          </blockquote>
        )}
      </div>

      <Separator className="bg-[hsl(var(--portal-border))]" />

      {/* Key Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
          <TrendingUp className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--portal-accent-blue))]" />
          <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
            {Math.round(trend.velocity)}%
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Velocity</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
          <Newspaper className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--portal-accent-purple))]" />
          <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
            {trend.evidence_count}
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Sources</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
          <BarChart3 className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--portal-success))]" />
          <p className={cn(
            "text-lg font-bold",
            baselineDelta >= 0 
              ? "text-[hsl(var(--portal-success))]" 
              : "text-[hsl(var(--portal-error))]"
          )}>
            {baselineDelta > 0 ? '+' : ''}{baselineDelta.toFixed(0)}%
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">vs 7d</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
          <Clock className="h-4 w-4 mx-auto mb-1 text-[hsl(var(--portal-text-muted))]" />
          <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
            {formatDistanceToNow(new Date(trend.first_seen_at), { addSuffix: false }).replace(' hours', 'h').replace(' minutes', 'm').replace('about ', '')}
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">Age</p>
        </div>
      </div>

      <Separator className="bg-[hsl(var(--portal-border))]" />

      {/* Why Trending Summary - Phase 4 */}
      <div className="p-4 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)] border border-[hsl(var(--portal-accent-blue)/0.2)]">
        <div className="flex items-start gap-3">
          <Target className="h-5 w-5 text-[hsl(var(--portal-accent-blue))] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Why This Is Trending</p>
            <p className="text-sm text-[hsl(var(--portal-text-secondary))] mt-1">{generateWhyTrendingSummary(trend)}</p>
          </div>
        </div>
      </div>

      {/* Source Tier Distribution - Phase 4 */}
      {(trend.tier1_count || trend.tier2_count || trend.tier3_count) && (
        <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Source Tier Distribution</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Shield className="h-4 w-4 text-[hsl(var(--portal-success))]" />
              <span className="font-medium text-[hsl(var(--portal-text-primary))]">{trend.tier1_count || 0}</span>
              <span className="text-[hsl(var(--portal-text-muted))]">Tier 1</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Shield className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
              <span className="font-medium text-[hsl(var(--portal-text-primary))]">{trend.tier2_count || 0}</span>
              <span className="text-[hsl(var(--portal-text-muted))]">Tier 2</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Shield className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
              <span className="font-medium text-[hsl(var(--portal-text-primary))]">{trend.tier3_count || 0}</span>
              <span className="text-[hsl(var(--portal-text-muted))]">Tier 3</span>
            </div>
          </div>
          {trend.has_tier12_corroboration && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-[hsl(var(--portal-success))]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Tier 1/2 corroboration confirmed</span>
            </div>
          )}
        </div>
      )}

      <Separator className="bg-[hsl(var(--portal-border))]" />

      {/* Collapsible Sections */}
      <div className="space-y-6">
        {/* Confidence Breakdown */}
        <CollapsibleSection
          title="Confidence Breakdown"
          icon={<Target className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />}
          defaultOpen
        >
          <ConfidenceBreakdown trend={trend} />
        </CollapsibleSection>

        {/* Outcome Learning */}
        <CollapsibleSection
          title="Outcome Learning"
          icon={<Award className="h-4 w-4 text-[hsl(var(--portal-success))]" />}
        >
          <OutcomeLearning outcomeStats={outcomeStats} isLoading={outcomeLoading} />
        </CollapsibleSection>

        {/* Suggested Actions */}
        <CollapsibleSection
          title="Suggested Actions"
          icon={<Sparkles className="h-4 w-4 text-[hsl(var(--portal-warning))]" />}
        >
          <SuggestedActions 
            trendTitle={trend.event_title} 
            organizationId={organizationId} 
          />
        </CollapsibleSection>

        {/* Evidence Timeline */}
        <CollapsibleSection
          title={`Evidence (${evidence.length})`}
          icon={<Newspaper className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />}
          defaultOpen
        >
          {evidenceLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-lg bg-[hsl(var(--portal-bg-secondary))] animate-pulse" />
              ))}
            </div>
          ) : evidence.length === 0 ? (
            <p className="text-sm text-[hsl(var(--portal-text-muted))] text-center py-4">
              No evidence sources available
            </p>
          ) : (
            <div className="space-y-2">
              {displayedEvidence.map((e) => (
                <EvidenceItem key={e.id} evidence={e} />
              ))}
              {evidence.length > 5 && (
                <V3Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllEvidence(!showAllEvidence)}
                  className="w-full"
                >
                  {showAllEvidence 
                    ? `Show less` 
                    : `Show all ${evidence.length} sources`}
                </V3Button>
              )}
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
