import React, { useState, useCallback, useMemo } from "react";
import { Filter, Download, Save, RotateCcw, List, BarChart3, Play, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { V3Card, V3CardContent, V3CardHeader, V3CardTitle, V3Button } from "@/components/v3";
import { DonorSegmentFilters } from "./DonorSegmentFilters";
import { DonorSegmentResults } from "./DonorSegmentResults";
import { SaveSegmentDialog } from "./SaveSegmentDialog";
import { 
  useDonorSegmentQuery, 
  useSavedSegmentsQuery, 
  useSaveSegmentMutation,
  useDeleteSegmentMutation,
  exportDonorsToCSV 
} from "@/queries/useDonorSegmentQuery";
import type { FilterCondition, SavedSegment } from "@/types/donorSegment";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DonorSegmentBuilderProps {
  organizationId: string;
}

export function DonorSegmentBuilder({ organizationId }: DonorSegmentBuilderProps) {
  // Pending filters (unapplied changes) vs Applied filters (what's currently queried)
  const [pendingFilters, setPendingFilters] = useState<FilterCondition[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<FilterCondition[]>([]);
  const [viewMode, setViewMode] = useState<'aggregate' | 'table'>('aggregate');
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [selectedSavedSegment, setSelectedSavedSegment] = useState<string | null>(null);

  // Check if there are unapplied changes
  const hasUnappliedChanges = useMemo(() => 
    JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters),
    [pendingFilters, appliedFilters]
  );

  // Query hooks - now uses APPLIED filters only (no debounce needed)
  const { 
    data: segmentData, 
    isLoading: isLoadingSegment,
    isFetching: isFetchingSegment,
  } = useDonorSegmentQuery(organizationId, appliedFilters, true);

  const { 
    data: savedSegments, 
    isLoading: isLoadingSaved 
  } = useSavedSegmentsQuery(organizationId);

  const saveSegmentMutation = useSaveSegmentMutation();
  const deleteSegmentMutation = useDeleteSegmentMutation();

  // Handlers
  const handleFiltersChange = useCallback((newFilters: FilterCondition[]) => {
    setPendingFilters(newFilters);
    setSelectedSavedSegment(null); // Clear saved segment selection when filters change
  }, []);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters(pendingFilters);
  }, [pendingFilters]);

  const handleClearFilters = useCallback(() => {
    setPendingFilters([]);
    setAppliedFilters([]);
    setSelectedSavedSegment(null);
  }, []);

  const handleLoadSavedSegment = useCallback((segmentId: string) => {
    const segment = savedSegments?.find(s => s.id === segmentId);
    if (segment) {
      setPendingFilters(segment.filters);
      setAppliedFilters(segment.filters); // Apply immediately when loading saved
      setSelectedSavedSegment(segmentId);
      toast.success(`Loaded segment: ${segment.name}`);
    }
  }, [savedSegments]);

  const handleSaveSegment = useCallback(async (name: string, description: string) => {
    if (!segmentData) return;

    try {
      await saveSegmentMutation.mutateAsync({
        organizationId,
        name,
        description,
        filters: appliedFilters,
        donorCount: segmentData.totalCount,
        totalValue: segmentData.aggregates.totalLifetimeValue,
      });
      toast.success(`Segment "${name}" saved successfully`);
      setIsSaveDialogOpen(false);
    } catch (error) {
      console.error('Error saving segment:', error);
      toast.error('Failed to save segment');
    }
  }, [organizationId, appliedFilters, segmentData, saveSegmentMutation]);

  const handleDeleteSavedSegment = useCallback(async (segmentId: string) => {
    try {
      await deleteSegmentMutation.mutateAsync({ 
        segmentId, 
        organizationId 
      });
      toast.success('Segment deleted');
      if (selectedSavedSegment === segmentId) {
        setSelectedSavedSegment(null);
      }
    } catch (error) {
      console.error('Error deleting segment:', error);
      toast.error('Failed to delete segment');
    }
  }, [organizationId, selectedSavedSegment, deleteSegmentMutation]);

  const handleExport = useCallback(() => {
    if (!segmentData?.donors.length) {
      toast.error('No donors to export');
      return;
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `donor-segment-${timestamp}.csv`;
    exportDonorsToCSV(segmentData.donors, filename);
    toast.success(`Exported ${segmentData.donors.length} donors`);
  }, [segmentData]);

  // Memoized values
  const activeFilterCount = useMemo(() => appliedFilters.length, [appliedFilters]);
  const pendingFilterCount = useMemo(() => pendingFilters.length, [pendingFilters]);
  const isQuerying = isLoadingSegment || isFetchingSegment;

  return (
    <div className="space-y-6">
      {/* Header with saved segments and actions */}
      <V3Card>
        <V3CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
                <Filter className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
              </div>
              <div>
                <V3CardTitle>Segment Builder</V3CardTitle>
                <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-0.5">
                  Filter and analyze your donor base
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Saved Segments Dropdown */}
              <Select
                value={selectedSavedSegment || ""}
                onValueChange={(value) => {
                  if (value) handleLoadSavedSegment(value);
                }}
              >
                <SelectTrigger className="w-[180px] bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
                  <SelectValue placeholder="Load saved..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingSaved ? (
                    <div className="p-2">
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ) : savedSegments?.length === 0 ? (
                    <div className="p-2 text-sm text-[hsl(var(--portal-text-muted))]">
                      No saved segments
                    </div>
                  ) : (
                    savedSegments?.map((segment) => (
                      <SelectItem key={segment.id} value={segment.id}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="truncate">{segment.name}</span>
                          <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                            {segment.donor_count_snapshot?.toLocaleString() || '?'} donors
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex items-center border border-[hsl(var(--portal-border))] rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('aggregate')}
                  className={cn(
                    "px-3 py-1.5 text-sm transition-colors",
                    viewMode === 'aggregate'
                      ? "bg-[hsl(var(--portal-accent-blue))] text-white"
                      : "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))] hover:bg-[hsl(var(--portal-bg-hover))]"
                  )}
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    "px-3 py-1.5 text-sm transition-colors",
                    viewMode === 'table'
                      ? "bg-[hsl(var(--portal-accent-blue))] text-white"
                      : "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))] hover:bg-[hsl(var(--portal-bg-hover))]"
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {/* Apply Filters button with pending indicator */}
              <div className="flex items-center gap-2">
                {hasUnappliedChanges && pendingFilterCount > 0 && (
                  <span className="text-xs text-[hsl(var(--portal-warning))] flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Unapplied
                  </span>
                )}
                <V3Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplyFilters}
                  disabled={!hasUnappliedChanges || pendingFilterCount === 0}
                >
                  <Play className="h-4 w-4 mr-1.5" />
                  Apply Filters
                </V3Button>
              </div>

              {/* Action buttons */}
              <V3Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaveDialogOpen(true)}
                disabled={appliedFilters.length === 0 || !segmentData?.totalCount}
              >
                <Save className="h-4 w-4 mr-1.5" />
                Save
              </V3Button>
              <V3Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={!segmentData?.donors.length}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Export
              </V3Button>
              {(pendingFilterCount > 0 || activeFilterCount > 0) && (
                <V3Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Clear
                </V3Button>
              )}
            </div>
          </div>
        </V3CardHeader>
      </V3Card>

      {/* Main content: Filters + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Filters Panel */}
        <div className="lg:col-span-4 xl:col-span-3">
          <DonorSegmentFilters
            filters={pendingFilters}
            onFiltersChange={handleFiltersChange}
            onApply={handleApplyFilters}
            isLoading={isQuerying}
          />
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-8 xl:col-span-9">
          <DonorSegmentResults
            data={segmentData}
            isLoading={isLoadingSegment}
            isFetching={isFetchingSegment}
            viewMode={viewMode}
            activeFilterCount={activeFilterCount}
          />
        </div>
      </div>

      {/* Save Segment Dialog */}
      <SaveSegmentDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        onSave={handleSaveSegment}
        donorCount={segmentData?.totalCount || 0}
        isLoading={saveSegmentMutation.isPending}
      />
    </div>
  );
}
