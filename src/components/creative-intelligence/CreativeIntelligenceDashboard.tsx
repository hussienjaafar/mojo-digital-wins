import { useState, useCallback } from "react";
import { format, subDays, formatDistanceToNow, isBefore, startOfDay } from "date-fns";
import { toast } from "sonner";

// Meta Ads API only allows fetching data from the last 13 months (approximately 395 days)
const MAX_META_LOOKBACK_DAYS = 395;

import {
  Calendar,
  RefreshCw,
  Settings2,
  Zap,
  Play,
  Brain,
  LayoutGrid,
  BarChart3,
  Gauge,
  Clock,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreativeIntelligence } from "@/hooks/useCreativeIntelligence";
import { V3Card, V3CardContent } from "@/components/v3/V3Card";
import { V3InsightBadge } from "@/components/v3/V3InsightBadge";
import { V3Button } from "@/components/v3";
import { cn } from "@/lib/utils";
import { exportToCSV } from "@/lib/csv-export";
import { CreativeIntelligenceSummary } from "./CreativeIntelligenceSummary";
import { IssuePerformanceChart } from "./IssuePerformanceChart";
import { StancePerformanceChart } from "./StancePerformanceChart";
import { FatigueAlertsPanel } from "./FatigueAlertsPanel";
import { LeadingIndicatorsCard } from "./LeadingIndicatorsCard";
import { RecommendationTable } from "./RecommendationTable";
import { CreativeGallery } from "./CreativeGallery";
import { PerformanceQuadrantChart } from "./PerformanceQuadrantChart";
import { DataFreshnessIndicator } from "./DataFreshnessIndicator";
import { CreativeComparisonPanel } from "./CreativeComparisonPanel";
import { DonorSegmentationCard } from "./DonorSegmentationCard";
import { ElectionDayBadge, ElectionCountdown } from "./ElectionCountdown";
import type { CreativeRecommendation } from "@/hooks/useCreativeIntelligence";

interface CreativeIntelligenceDashboardProps {
  organizationId: string;
  /** Election date for political campaigns (ISO format YYYY-MM-DD) */
  electionDate?: string | null;
  /** Election name (e.g., "General Election", "Primary") */
  electionName?: string;
  /** Callback when election date is updated */
  onElectionDateChange?: (date: string) => void;
  /** Whether the user can edit campaign settings */
  canEditCampaignSettings?: boolean;
}

type ViewType = "insights" | "gallery" | "analysis";

// CSV export column definitions
const CSV_EXPORT_COLUMNS = [
  { key: "creative_id", label: "Creative ID" },
  { key: "headline", label: "Headline" },
  { key: "issue_primary", label: "Primary Issue" },
  { key: "recommendation", label: "Recommendation" },
  { key: "roas", label: "ROAS" },
  { key: "ctr", label: "CTR" },
  { key: "total_spend", label: "Total Spend" },
  { key: "total_revenue", label: "Total Revenue" },
  { key: "total_impressions", label: "Total Impressions" },
  { key: "confidence_score", label: "Confidence Score" },
  { key: "fatigue_status", label: "Fatigue Status" },
  { key: "explanation", label: "Explanation" },
];

export function CreativeIntelligenceDashboard({
  organizationId,
  electionDate,
  electionName = "Election Day",
  onElectionDateChange,
  canEditCampaignSettings = false,
}: CreativeIntelligenceDashboardProps) {
  // View state
  const [activeView, setActiveView] = useState<ViewType>("insights");

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

  // Action states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingTranscriptions, setPendingTranscriptions] = useState(0);
  const [pinnedCreatives, setPinnedCreatives] = useState<[CreativeRecommendation | null, CreativeRecommendation | null]>([null, null]);

  const { data, isLoading, error, refetch, isFetching } = useCreativeIntelligence({
    organizationId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    ...settings,
  });

  const dataQuality = data?.data_quality;

  // Validate and clamp date range to Meta's 13-month lookback limit
  const validateAndSetDateRange = useCallback((startDate: string, endDate: string) => {
    const minAllowedDate = startOfDay(subDays(new Date(), MAX_META_LOOKBACK_DAYS));
    const parsedStartDate = new Date(startDate);

    // Check if start date is older than 13 months
    if (isBefore(parsedStartDate, minAllowedDate)) {
      toast.warning(
        `Meta Ads API only allows data from the last 13 months. Date range has been adjusted.`,
        { duration: 5000 }
      );
      // Clamp the start date to the minimum allowed date
      const clampedStartDate = format(minAllowedDate, "yyyy-MM-dd");
      setDateRange({ startDate: clampedStartDate, endDate });
    } else {
      setDateRange({ startDate, endDate });
    }
  }, []);

  // Handle pinning creatives for comparison
  const handlePinCreative = useCallback((creative: CreativeRecommendation) => {
    setPinnedCreatives((prev) => {
      // If already pinned, unpin it
      if (prev[0]?.creative_id === creative.creative_id) return [null, prev[1]];
      if (prev[1]?.creative_id === creative.creative_id) return [prev[0], null];
      // Fill first empty slot
      if (!prev[0]) return [creative, prev[1]];
      if (!prev[1]) return [prev[0], creative];
      // Replace first slot if both are full
      return [creative, prev[1]];
    });
  }, []);

  // Sync performance data from Meta
  const handleSyncData = useCallback(async () => {
    setIsSyncing(true);
    try {
      toast.info("Syncing performance data from Meta Ads...");

      const { error: syncError } = await supabase.functions.invoke("sync-meta-ads", {
        body: { organization_id: organizationId },
      });
      if (syncError) throw syncError;

      const { error: aggError } = await supabase.functions.invoke("aggregate-creative-metrics", {
        body: { organization_id: organizationId },
      });
      if (aggError) console.error("Aggregation error (non-fatal):", aggError);

      setLastSyncedAt(new Date().toISOString());
      toast.success("Performance data synced!");
      await refetch();
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to sync performance data");
    } finally {
      setIsSyncing(false);
    }
  }, [organizationId, refetch]);

  // Analyze creatives with AI
  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      toast.info("Analyzing creatives with AI...");

      const { data: result, error } = await supabase.functions.invoke("analyze-meta-creatives", {
        body: { organization_id: organizationId, batch_size: 20 },
      });
      if (error) throw error;

      toast.success(`Analyzed ${result?.analyzed || 0} creatives`);
      await refetch();
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze creatives");
    } finally {
      setIsAnalyzing(false);
    }
  }, [organizationId, refetch]);

  // Transcribe video creatives
  const handleTranscribe = useCallback(async () => {
    setIsTranscribing(true);
    try {
      toast.info("Transcribing video creatives...");

      const { data: result, error } = await supabase.functions.invoke("transcribe-video-creative", {
        body: { organization_id: organizationId, batch_size: 5 },
      });
      if (error) throw error;

      toast.success(`Transcribed ${result?.transcribed || 0} videos`);
      setPendingTranscriptions((prev) => Math.max(0, prev - (result?.transcribed || 0)));
      await refetch();
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Failed to transcribe videos");
    } finally {
      setIsTranscribing(false);
    }
  }, [organizationId, refetch]);

  // Export recommendations to CSV
  const handleExportCSV = useCallback(() => {
    const recommendations = data?.recommendations || [];
    if (recommendations.length === 0) {
      toast.warning("No recommendations to export");
      return;
    }

    const filename = `creative-intelligence-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
    exportToCSV(recommendations, filename, CSV_EXPORT_COLUMNS);
    toast.success(`Exported ${recommendations.length} recommendations to CSV`);
  }, [data?.recommendations, dateRange.startDate, dateRange.endDate]);

  const viewTabs = [
    { key: "insights" as const, label: "Insights", icon: Gauge },
    { key: "gallery" as const, label: "Gallery", icon: LayoutGrid },
    { key: "analysis" as const, label: "Analysis", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6" role="main" aria-label="Creative Intelligence Dashboard">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[hsl(var(--portal-accent-purple))] to-[hsl(var(--portal-accent-blue))]" aria-hidden="true">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[hsl(var(--portal-text-primary))]">
              Creative Intelligence
            </h1>
            <p className="text-sm text-[hsl(var(--portal-text-muted))]">
              AI-powered creative performance analysis and recommendations
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <nav className="flex flex-wrap items-center gap-2" aria-label="Dashboard actions">
          {/* Election Day Badge */}
          <ElectionDayBadge
            electionDate={electionDate ?? null}
            electionName={electionName}
            onElectionDateChange={onElectionDateChange}
            canEdit={canEditCampaignSettings}
          />

          <V3Button
            variant="secondary"
            size="sm"
            onClick={handleSyncData}
            disabled={isSyncing}
            aria-label={isSyncing ? "Syncing performance data from Meta Ads" : "Sync performance data from Meta Ads"}
            aria-busy={isSyncing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} aria-hidden="true" />
            {isSyncing ? "Syncing..." : "Sync Data"}
          </V3Button>

          <V3Button
            variant="secondary"
            size="sm"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            aria-label={isAnalyzing ? "Analyzing creatives with AI" : "Analyze creatives with AI"}
            aria-busy={isAnalyzing}
          >
            <Zap className={cn("h-4 w-4 mr-2", isAnalyzing && "animate-pulse")} aria-hidden="true" />
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </V3Button>

          {pendingTranscriptions > 0 && (
            <V3Button
              variant="secondary"
              size="sm"
              onClick={handleTranscribe}
              disabled={isTranscribing}
              aria-label={isTranscribing ? `Transcribing ${pendingTranscriptions} video creatives` : `Transcribe ${pendingTranscriptions} video creatives`}
              aria-busy={isTranscribing}
            >
              <Play className={cn("h-4 w-4 mr-2", isTranscribing && "animate-pulse")} aria-hidden="true" />
              Transcribe ({pendingTranscriptions})
            </V3Button>
          )}

          <V3Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={isLoading || !data?.recommendations?.length}
            aria-label="Export recommendations to CSV"
          >
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            Export
          </V3Button>
        </nav>
      </header>

      {/* View tabs + controls row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* View tabs */}
        <div
          className="flex items-center gap-1 p-1 bg-[hsl(var(--portal-bg-elevated))] rounded-xl border border-[hsl(var(--portal-border))] w-fit"
          role="tablist"
          aria-label="Dashboard view options"
        >
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              role="tab"
              aria-selected={activeView === tab.key}
              aria-controls={`${tab.key}-panel`}
              id={`${tab.key}-tab`}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                activeView === tab.key
                  ? "bg-[hsl(var(--portal-accent-blue))] text-white shadow-md"
                  : "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-secondary))]"
              )}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sr-only sm:hidden">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Last synced indicator */}
          {lastSyncedAt && (
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--portal-text-muted))]">
              <Clock className="h-3.5 w-3.5" />
              Synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
            </div>
          )}

          {/* Date range selector */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
            <Calendar className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
            <label htmlFor="date-range-select" className="sr-only">Select date range</label>
            <select
              id="date-range-select"
              className="bg-transparent text-sm focus:outline-none cursor-pointer"
              value={`${dateRange.startDate}_${dateRange.endDate}`}
              onChange={(e) => {
                const [start, end] = e.target.value.split("_");
                validateAndSetDateRange(start, end);
              }}
              aria-label="Date range for creative intelligence data"
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
            aria-label={showSettings ? "Hide analysis settings" : "Show analysis settings"}
            aria-expanded={showSettings}
            aria-controls="settings-panel"
            className={cn(
              "p-2 rounded-lg border transition-colors",
              showSettings
                ? "bg-[hsl(var(--portal-accent-blue))] border-[hsl(var(--portal-accent-blue))] text-white"
                : "bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-elevated))]"
            )}
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label={isFetching ? "Refreshing data" : "Refresh dashboard data"}
            aria-busy={isFetching}
            className="p-2 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-elevated))] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <V3Card id="settings-panel" role="region" aria-label="Analysis settings">
          <V3CardContent className="py-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <label htmlFor="min-impressions" className="block text-xs font-medium text-[hsl(var(--portal-text-muted))] mb-1">
                  Min Impressions
                </label>
                <input
                  id="min-impressions"
                  type="number"
                  value={settings.minImpressions}
                  onChange={(e) => setSettings({ ...settings, minImpressions: parseInt(e.target.value) || 1000 })}
                  className="w-28 px-3 py-1.5 rounded border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] text-sm"
                  aria-describedby="min-impressions-desc"
                />
                <span id="min-impressions-desc" className="sr-only">Minimum impressions required for creative analysis</span>
              </div>
              <div>
                <label htmlFor="early-window" className="block text-xs font-medium text-[hsl(var(--portal-text-muted))] mb-1">
                  Early Window (days)
                </label>
                <input
                  id="early-window"
                  type="number"
                  value={settings.earlyWindowDays}
                  onChange={(e) => setSettings({ ...settings, earlyWindowDays: parseInt(e.target.value) || 3 })}
                  className="w-28 px-3 py-1.5 rounded border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] text-sm"
                  aria-describedby="early-window-desc"
                />
                <span id="early-window-desc" className="sr-only">Number of days for early performance window analysis</span>
              </div>
              <div>
                <label htmlFor="fatigue-threshold" className="block text-xs font-medium text-[hsl(var(--portal-text-muted))] mb-1">
                  Fatigue Threshold
                </label>
                <input
                  id="fatigue-threshold"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={settings.fatigueThreshold}
                  onChange={(e) => setSettings({ ...settings, fatigueThreshold: parseFloat(e.target.value) || 0.2 })}
                  className="w-28 px-3 py-1.5 rounded border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] text-sm"
                  aria-describedby="fatigue-threshold-desc"
                />
                <span id="fatigue-threshold-desc" className="sr-only">Threshold percentage for creative fatigue detection, between 0 and 1</span>
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
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 rounded-lg bg-[hsl(var(--portal-error)/0.1)] border border-[hsl(var(--portal-error)/0.3)] text-[hsl(var(--portal-error))]"
        >
          Error loading creative intelligence: {error.message}
        </div>
      )}

      {/* Data freshness indicator */}
      <DataFreshnessIndicator
        organizationId={organizationId}
        totalCreatives={data?.summary?.total_creatives || 0}
        analyzedCreatives={dataQuality?.creatives_with_issue_data || 0}
        lastSyncedAt={lastSyncedAt}
      />

      {/* === INSIGHTS VIEW === */}
      {activeView === "insights" && (
        <div
          id="insights-panel"
          role="tabpanel"
          aria-labelledby="insights-tab"
          tabIndex={0}
        >
          {/* Summary KPIs */}
          <CreativeIntelligenceSummary data={data} isLoading={isLoading} />

          {/* Political Campaign Features Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <DonorSegmentationCard
              data={data?.donor_segmentation}
              isLoading={isLoading}
            />
            <ElectionCountdown
              electionDate={electionDate ?? null}
              electionName={electionName}
              onElectionDateChange={onElectionDateChange}
              canEdit={canEditCampaignSettings}
              variant="card"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <LeadingIndicatorsCard data={data?.leading_indicators} isLoading={isLoading} />
            <FatigueAlertsPanel alerts={data?.fatigue_alerts || []} isLoading={isLoading} />
          </div>

          {/* Recommendations table */}
          <div className="mt-6">
            <RecommendationTable
              recommendations={data?.recommendations || []}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}

      {/* === GALLERY VIEW === */}
      {activeView === "gallery" && (
        <div
          id="gallery-panel"
          role="tabpanel"
          aria-labelledby="gallery-tab"
          tabIndex={0}
        >
          <CreativeGallery
            organizationId={organizationId}
            recommendations={data?.recommendations || []}
            isLoading={isLoading}
            pinnedCreatives={pinnedCreatives}
            onPinCreative={handlePinCreative}
          />
          <CreativeComparisonPanel
            pinnedCreatives={pinnedCreatives}
            onRemove={(slot) => setPinnedCreatives((prev) => slot === 0 ? [null, prev[1]] : [prev[0], null])}
            onClear={() => setPinnedCreatives([null, null])}
          />
        </div>
      )}

      {/* === ANALYSIS VIEW === */}
      {activeView === "analysis" && (
        <div
          id="analysis-panel"
          role="tabpanel"
          aria-labelledby="analysis-tab"
          tabIndex={0}
          className="space-y-6"
        >
          <PerformanceQuadrantChart
            recommendations={data?.recommendations || []}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
