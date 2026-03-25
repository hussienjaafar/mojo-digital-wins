import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Video, Image as ImageIcon, Pin } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { V3Card, V3CardContent } from "@/components/v3/V3Card";
import { V3LoadingState, V3EmptyState } from "@/components/v3";
import type { CreativeRecommendation } from "@/hooks/useCreativeIntelligence";
import { ComplianceWarningBadge, analyzeComplianceIssues, type ComplianceIssue } from "./ComplianceWarning";

interface CreativeGalleryProps {
  organizationId: string;
  recommendations: CreativeRecommendation[];
  isLoading?: boolean;
  pinnedCreatives?: [CreativeRecommendation | null, CreativeRecommendation | null];
  onPinCreative?: (creative: CreativeRecommendation) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2 },
  },
};

const recommendationColors: Record<CreativeRecommendation["recommendation"], string> = {
  SCALE: "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.3)]",
  MAINTAIN: "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] border-[hsl(var(--portal-accent-blue)/0.3)]",
  WATCH: "bg-[hsl(var(--portal-bg-secondary))] text-[hsl(var(--portal-text-muted))] border-[hsl(var(--portal-border))]",
  GATHER_DATA: "bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))] border-[hsl(var(--portal-accent-purple)/0.3)]",
  REFRESH: "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning)/0.3)]",
  PAUSE: "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error)/0.3)]",
};

export function CreativeGallery({ recommendations, isLoading, pinnedCreatives, onPinCreative }: CreativeGalleryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "video" | "image">("all");
  const [recommendationFilter, setRecommendationFilter] = useState<"all" | CreativeRecommendation["recommendation"]>("all");

  const filteredCreatives = useMemo(() => {
    return recommendations.filter((creative) => {
      // Type filter
      if (typeFilter !== "all") {
        const isVideo = creative.creative_type?.toLowerCase().includes("video");
        if (typeFilter === "video" && !isVideo) return false;
        if (typeFilter === "image" && isVideo) return false;
      }

      // Recommendation filter
      if (recommendationFilter !== "all" && creative.recommendation !== recommendationFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesHeadline = creative.headline?.toLowerCase().includes(query);
        const matchesIssue = creative.issue_primary?.toLowerCase().includes(query);
        if (!matchesHeadline && !matchesIssue) return false;
      }

      return true;
    });
  }, [recommendations, typeFilter, recommendationFilter, searchQuery]);

  if (isLoading) {
    return (
      <V3Card>
        <V3CardContent className="p-6">
          <V3LoadingState variant="table" />
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <V3Card role="region" aria-label="Creative gallery">
      <V3CardContent className="p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6" role="search" aria-label="Filter creatives">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
            <Input
              placeholder="Search by headline or issue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]"
              aria-label="Search creatives by headline or issue"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger
                className="w-[130px] bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]"
                aria-label="Filter by creative type"
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="image">Images</SelectItem>
              </SelectContent>
            </Select>
            <Select value={recommendationFilter} onValueChange={(v) => setRecommendationFilter(v as typeof recommendationFilter)}>
              <SelectTrigger
                className="w-[150px] bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]"
                aria-label="Filter by recommended action"
              >
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="SCALE">Scale</SelectItem>
                <SelectItem value="MAINTAIN">Maintain</SelectItem>
                <SelectItem value="WATCH">Watch</SelectItem>
                <SelectItem value="GATHER_DATA">Gather Data</SelectItem>
                <SelectItem value="REFRESH">Refresh</SelectItem>
                <SelectItem value="PAUSE">Pause</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4" aria-live="polite" aria-atomic="true">
          <p className="text-sm text-[hsl(var(--portal-text-muted))]">
            Showing {filteredCreatives.length} of {recommendations.length} creatives
          </p>
        </div>

        {/* Creative Grid */}
        {filteredCreatives.length === 0 ? (
          <V3EmptyState
            icon={Search}
            title="No Matches"
            description="No creatives match your current filters"
            accent="blue"
          />
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            key={`gallery-${typeFilter}-${recommendationFilter}-${searchQuery}`}
          >
            {filteredCreatives.map((creative) => {
              const isPinned = pinnedCreatives?.some(p => p?.creative_id === creative.creative_id);
              return (
                <motion.div key={creative.creative_id} variants={cardVariants}>
                  <CreativeCard
                    creative={creative}
                    isPinned={isPinned}
                    onPin={onPinCreative ? () => onPinCreative(creative) : undefined}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </V3CardContent>
    </V3Card>
  );
}

function CreativeCard({
  creative,
  isPinned,
  onPin,
}: {
  creative: CreativeRecommendation;
  isPinned?: boolean;
  onPin?: () => void;
}) {
  const isVideo = creative.creative_type?.toLowerCase().includes("video");

  // Analyze compliance issues for this creative
  const complianceIssues = useMemo(() => {
    return analyzeComplianceIssues(
      creative.primary_text,
      creative.headline,
      creative.target_attacked
    );
  }, [creative.primary_text, creative.headline, creative.target_attacked]);

  const creativeTitle = creative.headline || creative.issue_primary || "Untitled Creative";

  return (
    <article
      className={`group rounded-xl border bg-[hsl(var(--portal-bg-card))] overflow-hidden hover:shadow-lg transition-all duration-200 ${isPinned ? "border-[hsl(var(--portal-accent-blue))] ring-2 ring-[hsl(var(--portal-accent-blue)/0.3)]" : "border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-hover))]"}`}
      aria-label={`${creativeTitle} - ${isVideo ? "Video" : "Image"} creative with ${creative.recommendation.replace(/_/g, " ")} recommendation`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-[hsl(var(--portal-bg-secondary))]">
        {creative.thumbnail_url ? (
          <img
            src={creative.thumbnail_url}
            alt={`Thumbnail for ${creativeTitle}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" aria-label={`No thumbnail available for ${isVideo ? "video" : "image"} creative`}>
            {isVideo ? (
              <Video className="h-8 w-8 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-8 w-8 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
            )}
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-black/60 text-white backdrop-blur-sm">
            {isVideo ? <Video className="h-3 w-3" aria-hidden="true" /> : <ImageIcon className="h-3 w-3" aria-hidden="true" />}
            {isVideo ? "Video" : "Image"}
          </span>
        </div>

        {/* Recommendation badge */}
        <div className="absolute top-2 right-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${recommendationColors[creative.recommendation]}`}
            role="status"
            aria-label={`Recommendation: ${creative.recommendation.replace(/_/g, " ")}`}
          >
            {creative.recommendation.replace(/_/g, " ")}
          </span>
        </div>

        {/* Compliance warning badge */}
        {complianceIssues.length > 0 && (
          <div className="absolute bottom-2 left-2">
            <ComplianceWarningBadge issues={complianceIssues} />
          </div>
        )}

        {/* Pin button */}
        {onPin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin();
              toast.success(isPinned ? "Creative unpinned" : "Creative pinned for comparison");
            }}
            aria-label={isPinned ? "Unpin creative from comparison" : "Pin creative for comparison"}
            aria-pressed={isPinned}
            className={`absolute bottom-2 right-2 p-2 rounded-full transition-all ${
              isPinned
                ? "bg-[hsl(var(--portal-accent-blue))] text-white"
                : "bg-black/60 text-white opacity-0 group-hover:opacity-100"
            }`}
          >
            <Pin className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Headline */}
        <h3 className="font-medium text-sm text-[hsl(var(--portal-text-primary))] line-clamp-2 mb-2">
          {creativeTitle}
        </h3>

        {/* Issue tag */}
        {creative.issue_primary && (
          <div className="mb-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))]">
              {creative.issue_primary}
            </span>
          </div>
        )}

        {/* Metrics */}
        <dl className="grid grid-cols-2 gap-2 text-xs" aria-label="Creative performance metrics">
          <div>
            <dt className="text-[hsl(var(--portal-text-muted))]">ROAS</dt>
            <dd className={`font-semibold ${creative.roas >= 1.5 ? "text-[hsl(var(--portal-success))]" : creative.roas < 0.5 ? "text-[hsl(var(--portal-error))]" : "text-[hsl(var(--portal-text-primary))]"}`}>
              {creative.roas.toFixed(2)}x
              <span className="sr-only">{creative.roas >= 1.5 ? " (high performance)" : creative.roas < 0.5 ? " (low performance)" : ""}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[hsl(var(--portal-text-muted))]">CTR</dt>
            <dd className="font-semibold text-[hsl(var(--portal-text-primary))]">
              {(creative.ctr * 100).toFixed(2)}%
            </dd>
          </div>
          <div>
            <dt className="text-[hsl(var(--portal-text-muted))]">Spend</dt>
            <dd className="font-semibold text-[hsl(var(--portal-text-primary))]">
              ${creative.total_spend.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-[hsl(var(--portal-text-muted))]">Revenue</dt>
            <dd className="font-semibold text-[hsl(var(--portal-success))]">
              ${creative.total_revenue.toLocaleString()}
            </dd>
          </div>
        </dl>

        {/* Confidence bar */}
        <div className="mt-3 pt-3 border-t border-[hsl(var(--portal-border))]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[hsl(var(--portal-text-muted))]" id={`confidence-label-${creative.creative_id}`}>Confidence</span>
            <span className="text-[hsl(var(--portal-text-secondary))]">{creative.confidence_score}%</span>
          </div>
          <div
            className="h-1.5 rounded-full bg-[hsl(var(--portal-bg-secondary))]"
            role="progressbar"
            aria-valuenow={creative.confidence_score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-labelledby={`confidence-label-${creative.creative_id}`}
          >
            <div
              className={`h-1.5 rounded-full ${
                creative.confidence_score >= 70
                  ? "bg-[hsl(var(--portal-success))]"
                  : creative.confidence_score >= 40
                  ? "bg-[hsl(var(--portal-warning))]"
                  : "bg-[hsl(var(--portal-error))]"
              }`}
              style={{ width: `${creative.confidence_score}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
