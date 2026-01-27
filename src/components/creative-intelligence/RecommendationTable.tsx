import { useMemo, useState } from "react";
import { TrendingUp, Pause, Eye, RefreshCw, Clock, HelpCircle } from "lucide-react";
import { V3Card, V3CardHeader, V3CardTitle, V3CardDescription, V3CardContent } from "@/components/v3/V3Card";
import { V3DataTable, type V3Column } from "@/components/v3/V3DataTable";
import { V3LoadingState } from "@/components/v3/V3LoadingState";
import type { CreativeRecommendation } from "@/hooks/useCreativeIntelligence";

interface RecommendationTableProps {
  recommendations: CreativeRecommendation[];
  isLoading?: boolean;
}

const recommendationConfig: Record<
  CreativeRecommendation["recommendation"],
  { icon: typeof TrendingUp; color: string; bgColor: string }
> = {
  SCALE: {
    icon: TrendingUp,
    color: "text-[hsl(var(--portal-success))]",
    bgColor: "bg-[hsl(var(--portal-success)/0.1)]",
  },
  MAINTAIN: {
    icon: Eye,
    color: "text-[hsl(var(--portal-accent-blue))]",
    bgColor: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
  },
  WATCH: {
    icon: Eye,
    color: "text-[hsl(var(--portal-text-muted))]",
    bgColor: "bg-[hsl(var(--portal-bg-secondary))]",
  },
  GATHER_DATA: {
    icon: Clock,
    color: "text-[hsl(var(--portal-accent-purple))]",
    bgColor: "bg-[hsl(var(--portal-accent-purple)/0.1)]",
  },
  REFRESH: {
    icon: RefreshCw,
    color: "text-[hsl(var(--portal-warning))]",
    bgColor: "bg-[hsl(var(--portal-warning)/0.1)]",
  },
  PAUSE: {
    icon: Pause,
    color: "text-[hsl(var(--portal-error))]",
    bgColor: "bg-[hsl(var(--portal-error)/0.1)]",
  },
};

type FilterType = "all" | CreativeRecommendation["recommendation"];

export function RecommendationTable({ recommendations, isLoading }: RecommendationTableProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredData = useMemo(() => {
    if (filter === "all") return recommendations;
    return recommendations.filter((r) => r.recommendation === filter);
  }, [recommendations, filter]);

  const columns: V3Column<CreativeRecommendation>[] = useMemo(
    () => [
      {
        key: "creative",
        header: "Creative",
        primary: true,
        render: (row) => (
          <div className="flex items-center gap-3">
            {row.thumbnail_url && (
              <img
                src={row.thumbnail_url}
                alt=""
                className="w-10 h-10 rounded object-cover flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="font-medium text-sm truncate max-w-[200px]">
                {row.headline || row.issue_primary || "Unknown"}
              </div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))]">
                {row.creative_type}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "roas",
        header: "ROAS",
        sortable: true,
        align: "right",
        render: (row) => (
          <span
            className={
              row.roas >= 1.5
                ? "text-[hsl(var(--portal-success))] font-medium"
                : row.roas < 0.5
                ? "text-[hsl(var(--portal-error))]"
                : ""
            }
          >
            {row.roas.toFixed(2)}x
          </span>
        ),
      },
      {
        key: "ctr",
        header: "CTR",
        sortable: true,
        align: "right",
        hideOnMobile: true,
        render: (row) => `${(row.ctr * 100).toFixed(2)}%`,
      },
      {
        key: "spend",
        header: "Spend",
        sortable: true,
        align: "right",
        hideOnMobile: true,
        render: (row) => `$${row.total_spend.toLocaleString()}`,
      },
      {
        key: "impressions",
        header: "Impressions",
        sortable: true,
        align: "right",
        hideOnMobile: true,
        render: (row) => row.total_impressions.toLocaleString(),
      },
      {
        key: "confidence",
        header: "Confidence",
        sortable: true,
        align: "center",
        hideOnMobile: true,
        render: (row) => (
          <div className="flex items-center justify-center gap-1">
            <div
              className="h-2 rounded-full bg-[hsl(var(--portal-bg-secondary))]"
              style={{ width: 40 }}
            >
              <div
                className={`h-2 rounded-full ${
                  row.confidence_score >= 70
                    ? "bg-[hsl(var(--portal-success))]"
                    : row.confidence_score >= 40
                    ? "bg-[hsl(var(--portal-warning))]"
                    : "bg-[hsl(var(--portal-error))]"
                }`}
                style={{ width: `${row.confidence_score}%` }}
              />
            </div>
            <span className="text-xs text-[hsl(var(--portal-text-muted))]">
              {row.confidence_score}%
            </span>
          </div>
        ),
      },
      {
        key: "recommendation",
        header: "Action",
        render: (row) => {
          const config = recommendationConfig[row.recommendation];
          const Icon = config.icon;
          return (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
              >
                <Icon className="h-3 w-3" />
                {row.recommendation.replace(/_/g, " ")}
              </span>
              <button
                className="p-1 rounded hover:bg-[hsl(var(--portal-bg-secondary))] transition-colors"
                title={row.explanation}
              >
                <HelpCircle className="h-3.5 w-3.5 text-[hsl(var(--portal-text-muted))]" />
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: recommendations.length };
    for (const r of recommendations) {
      counts[r.recommendation] = (counts[r.recommendation] || 0) + 1;
    }
    return counts;
  }, [recommendations]);

  if (isLoading) {
    return (
      <V3Card>
        <V3CardHeader>
          <V3CardTitle>Creative Recommendations</V3CardTitle>
        </V3CardHeader>
        <V3CardContent>
          <V3LoadingState variant="table" />
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <V3Card>
      <V3CardHeader>
        <V3CardTitle>Creative Recommendations</V3CardTitle>
        <V3CardDescription>
          AI-powered recommendations based on performance and fatigue analysis
        </V3CardDescription>
      </V3CardHeader>
      <V3CardContent>
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(["all", "SCALE", "MAINTAIN", "WATCH", "GATHER_DATA", "REFRESH", "PAUSE"] as FilterType[]).map(
            (f) => {
              const count = filterCounts[f] || 0;
              if (f !== "all" && count === 0) return null;

              const config = f !== "all" ? recommendationConfig[f] : null;
              const Icon = config?.icon;

              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === f
                      ? "bg-[hsl(var(--portal-accent-blue))] text-white"
                      : "bg-[hsl(var(--portal-bg-secondary))] text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-elevated))]"
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {f === "all" ? "All" : f.replace(/_/g, " ")}
                  <span className="ml-1 text-xs opacity-70">({count})</span>
                </button>
              );
            }
          )}
        </div>

        <V3DataTable
          data={filteredData}
          columns={columns}
          pageSize={10}
          emptyMessage="No recommendations available"
          striped
        />
      </V3CardContent>
    </V3Card>
  );
}
