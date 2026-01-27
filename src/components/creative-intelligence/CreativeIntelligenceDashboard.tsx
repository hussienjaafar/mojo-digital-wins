import { useState, useCallback } from "react";
import { format, subDays, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreativeIntelligence } from "@/hooks/useCreativeIntelligence";
import { V3Card, V3CardContent } from "@/components/v3/V3Card";
import { V3InsightBadge } from "@/components/v3/V3InsightBadge";
import { V3Button } from "@/components/v3";
import { cn } from "@/lib/utils";
import { CreativeIntelligenceSummary } from "./CreativeIntelligenceSummary";
import { IssuePerformanceChart } from "./IssuePerformanceChart";
import { StancePerformanceChart } from "./StancePerformanceChart";
import { FatigueAlertsPanel } from "./FatigueAlertsPanel";
import { LeadingIndicatorsCard } from "./LeadingIndicatorsCard";
import { RecommendationTable } from "./RecommendationTable";
import { CreativeGallery } from "./CreativeGallery";
import { PerformanceQuadrantChart } from "./PerformanceQuadrantChart";

interface CreativeIntelligenceDashboardProps {
  organizationId: string;
}

type ViewType = "insights" | "gallery" | "analysis";

export function CreativeIntelligenceDashboard({ organizationId }: CreativeIntelligenceDashboardProps) {
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

  const { data, isLoading, error, refetch, isFetching } = useCreativeIntelligence({
    organizationId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    ...settings,
  });

  const dataQuality = data?.data_quality;

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

  const viewTabs = [
    { key: "insights" as const, label: "Insights", icon: Gauge },
    { key: "gallery" as const, label: "Gallery", icon: LayoutGrid },
    { key: "analysis" as const, label: "Analysis", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[hsl(var(--portal-accent-purple))] to-[hsl(var(--portal-accent-blue))]">
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
        <div className="flex flex-wrap items-center gap-2">
          <V3Button
            variant="secondary"
            size="sm"
            onClick={handleSyncData}
            disabled={isSyncing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing..." : "Sync Data"}
          </V3Button>

          <V3Button
            variant="secondary"
            size="sm"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            <Zap className={cn("h-4 w-4 mr-2", isAnalyzing && "animate-pulse")} />
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </V3Button>

          {pendingTranscriptions > 0 && (
            <V3Button
              variant="secondary"
              size="sm"
              onClick={handleTranscribe}
              disabled={isTranscribing}
            >
              <Play className={cn("h-4 w-4 mr-2", isTranscribing && "animate-pulse")} />
              Transcribe ({pendingTranscriptions})
            </V3Button>
          )}
        </div>
      </div>

      {/* View tabs + controls row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* View tabs */}
        <div className="flex items-center gap-1 p-1 bg-[hsl(var(--portal-bg-elevated))] rounded-xl border border-[hsl(var(--portal-border))] w-fit">
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                activeView === tab.key
                  ? "bg-[hsl(var(--portal-accent-blue))] text-white shadow-md"
                  : "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-secondary))]"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
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
            <Calendar className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            <select
              className="bg-transparent text-sm focus:outline-none cursor-pointer"
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
            className={cn(
              "p-2 rounded-lg border transition-colors",
              showSettings
                ? "bg-[hsl(var(--portal-accent-blue))] border-[hsl(var(--portal-accent-blue))] text-white"
                : "bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-elevated))]"
            )}
          >
            <Settings2 className="h-4 w-4" />
          </button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-elevated))] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
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

      {/* === INSIGHTS VIEW === */}
      {activeView === "insights" && (
        <>
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
        </>
      )}

      {/* === GALLERY VIEW === */}
      {activeView === "gallery" && (
        <CreativeGallery
          organizationId={organizationId}
          recommendations={data?.recommendations || []}
          isLoading={isLoading}
        />
      )}

      {/* === ANALYSIS VIEW === */}
      {activeView === "analysis" && (
        <div className="space-y-6">
          <PerformanceQuadrantChart
            recommendations={data?.recommendations || []}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
