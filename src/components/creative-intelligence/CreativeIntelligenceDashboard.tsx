import { useState } from "react";
import { format, subDays } from "date-fns";
import { Calendar, RefreshCw, Settings2 } from "lucide-react";
import { useCreativeIntelligence } from "@/hooks/useCreativeIntelligence";
import { V3Card, V3CardContent } from "@/components/v3/V3Card";
import { V3InsightBadge } from "@/components/v3/V3InsightBadge";
import { CreativeIntelligenceSummary } from "./CreativeIntelligenceSummary";
import { IssuePerformanceChart } from "./IssuePerformanceChart";
import { StancePerformanceChart } from "./StancePerformanceChart";
import { FatigueAlertsPanel } from "./FatigueAlertsPanel";
import { LeadingIndicatorsCard } from "./LeadingIndicatorsCard";
import { RecommendationTable } from "./RecommendationTable";

interface CreativeIntelligenceDashboardProps {
  organizationId: string;
}

export function CreativeIntelligenceDashboard({ organizationId }: CreativeIntelligenceDashboardProps) {
  // Default to last 30 days
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });

  const [settings, setSettings] = useState({
    minImpressions: 1000,
    earlyWindowDays: 3,
    fatigueThreshold: 0.2,
  });

  const [showSettings, setShowSettings] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useCreativeIntelligence({
    organizationId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    ...settings,
  });

  const dataQuality = data?.data_quality;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[hsl(var(--portal-text-primary))]">
            Creative Intelligence
          </h1>
          <p className="text-sm text-[hsl(var(--portal-text-muted))]">
            AI-powered creative performance analysis and recommendations
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date range selector */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
            <Calendar className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            <select
              className="bg-transparent text-sm focus:outline-none"
              value={`${dateRange.startDate}_${dateRange.endDate}`}
              onChange={(e) => {
                const [start, end] = e.target.value.split("_");
                setDateRange({ startDate: start, endDate: end });
              }}
            >
              <option value={`${format(subDays(new Date(), 7), "yyyy-MM-dd")}_${format(new Date(), "yyyy-MM-dd")}`}>
                Last 7 days
              </option>
              <option value={`${format(subDays(new Date(), 14), "yyyy-MM-dd")}_${format(new Date(), "yyyy-MM-dd")}`}>
                Last 14 days
              </option>
              <option value={`${format(subDays(new Date(), 30), "yyyy-MM-dd")}_${format(new Date(), "yyyy-MM-dd")}`}>
                Last 30 days
              </option>
              <option value={`${format(subDays(new Date(), 60), "yyyy-MM-dd")}_${format(new Date(), "yyyy-MM-dd")}`}>
                Last 60 days
              </option>
              <option value={`${format(subDays(new Date(), 90), "yyyy-MM-dd")}_${format(new Date(), "yyyy-MM-dd")}`}>
                Last 90 days
              </option>
            </select>
          </div>

          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg border transition-colors ${
              showSettings
                ? "bg-[hsl(var(--portal-accent-blue))] border-[hsl(var(--portal-accent-blue))] text-white"
                : "bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-elevated))]"
            }`}
          >
            <Settings2 className="h-4 w-4" />
          </button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-elevated))] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <V3Card>
          <V3CardContent className="py-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <label className="block text-xs font-medium text-[hsl(var(--portal-text-muted))] mb-1">
                  Min Impressions
                </label>
                <input
                  type="number"
                  value={settings.minImpressions}
                  onChange={(e) => setSettings({ ...settings, minImpressions: parseInt(e.target.value) || 1000 })}
                  className="w-28 px-3 py-1.5 rounded border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[hsl(var(--portal-text-muted))] mb-1">
                  Early Window (days)
                </label>
                <input
                  type="number"
                  value={settings.earlyWindowDays}
                  onChange={(e) => setSettings({ ...settings, earlyWindowDays: parseInt(e.target.value) || 3 })}
                  className="w-28 px-3 py-1.5 rounded border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[hsl(var(--portal-text-muted))] mb-1">
                  Fatigue Threshold
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={settings.fatigueThreshold}
                  onChange={(e) => setSettings({ ...settings, fatigueThreshold: parseFloat(e.target.value) || 0.2 })}
                  className="w-28 px-3 py-1.5 rounded border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] text-sm"
                />
              </div>
            </div>
          </V3CardContent>
        </V3Card>
      )}

      {/* Data quality indicator */}
      {dataQuality && (
        <div className="flex items-center gap-2 text-sm">
          <V3InsightBadge
            type={
              dataQuality.overall_confidence === "HIGH"
                ? "info"
                : dataQuality.overall_confidence === "MEDIUM"
                ? "anomaly-low"
                : "anomaly-high"
            }
          >
            {dataQuality.overall_confidence} confidence
          </V3InsightBadge>
          <span className="text-[hsl(var(--portal-text-muted))]">
            {dataQuality.creatives_with_issue_data} creatives with issue data ·{" "}
            {Math.round(dataQuality.avg_impressions_per_creative).toLocaleString()} avg impressions ·{" "}
            {Math.round(dataQuality.avg_days_active)} avg days active
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-[hsl(var(--portal-error)/0.1)] border border-[hsl(var(--portal-error)/0.3)] text-[hsl(var(--portal-error))]">
          Error loading creative intelligence: {error.message}
        </div>
      )}

      {/* Summary KPIs */}
      <CreativeIntelligenceSummary data={data} isLoading={isLoading} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IssuePerformanceChart
          data={data?.issue_performance || []}
          isLoading={isLoading}
          error={error}
        />
        <StancePerformanceChart
          data={data?.stance_performance || []}
          isLoading={isLoading}
          error={error}
        />
      </div>

      {/* Insights row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadingIndicatorsCard data={data?.leading_indicators} isLoading={isLoading} />
        <FatigueAlertsPanel alerts={data?.fatigue_alerts || []} isLoading={isLoading} />
      </div>

      {/* Recommendations table */}
      <RecommendationTable
        recommendations={data?.recommendations || []}
        isLoading={isLoading}
      />
    </div>
  );
}
