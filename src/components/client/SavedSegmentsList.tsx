import { useState } from "react";
import { BookMarked, Trash2, Play, Download, Calendar, Users, DollarSign } from "lucide-react";
import { V3Card, V3Button, V3EmptyState } from "@/components/v3";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/chart-formatters";
import { FilterCondition, SavedSegment } from "@/types/donorSegment";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SavedSegmentsListProps {
  organizationId: string;
  onLoadSegment: (filters: FilterCondition[]) => void;
}

export const SavedSegmentsList = ({ organizationId, onLoadSegment }: SavedSegmentsListProps) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: segments, isLoading } = useQuery({
    queryKey: ['saved-segments', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_donor_segments')
        .select('*')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      // Parse the JSONB filters field - cast through unknown for type safety
      return (data || []).map(row => ({
        ...row,
        filters: (Array.isArray(row.filters) ? row.filters : []) as unknown as FilterCondition[],
      })) as SavedSegment[];
    },
    enabled: !!organizationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saved_donor_segments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-segments'] });
      toast.success('Segment deleted');
      setDeleteId(null);
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error('Failed to delete segment');
    },
  });

  const handleExportSegment = async (segment: SavedSegment) => {
    // Re-run the segment query and export to CSV
    toast.info('Export functionality coming soon');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!segments?.length) {
    return (
      <V3EmptyState
        title="No Saved Segments"
        description="Create segments in the builder and save them for quick access"
        accent="purple"
      />
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {segments.map(segment => (
          <V3Card 
            key={segment.id} 
            className={cn(
              "p-5 hover:border-[hsl(var(--portal-accent-purple)/0.5)]",
              "transition-colors cursor-pointer"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <BookMarked className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />
                  <h3 className="font-semibold text-[hsl(var(--portal-text-primary))] truncate">
                    {segment.name}
                  </h3>
                </div>
                {segment.description && (
                  <p className="text-sm text-[hsl(var(--portal-text-muted))] mb-3 line-clamp-2">
                    {segment.description}
                  </p>
                )}
                
                {/* Stats */}
                <div className="flex items-center gap-4 text-sm">
                  {segment.donor_count_snapshot !== null && (
                    <div className="flex items-center gap-1 text-[hsl(var(--portal-text-muted))]">
                      <Users className="h-3.5 w-3.5" />
                      <span>{segment.donor_count_snapshot.toLocaleString()} donors</span>
                    </div>
                  )}
                  {segment.total_value_snapshot !== null && (
                    <div className="flex items-center gap-1 text-[hsl(var(--portal-text-muted))]">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>{formatCurrency(segment.total_value_snapshot)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[hsl(var(--portal-text-muted))]">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(segment.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Filter summary */}
                {segment.filters && segment.filters.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {segment.filters.slice(0, 4).map((filter, idx) => (
                      <span 
                        key={idx}
                        className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))]"
                      >
                        {filter.field.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {segment.filters.length > 4 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))]">
                        +{segment.filters.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <V3Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLoadSegment(segment.filters)}
                  title="Load in builder"
                >
                  <Play className="h-4 w-4" />
                </V3Button>
                <V3Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportSegment(segment)}
                  title="Export to CSV"
                >
                  <Download className="h-4 w-4" />
                </V3Button>
                <V3Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteId(segment.id)}
                  className="text-[hsl(var(--portal-error))] hover:text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)]"
                  title="Delete segment"
                >
                  <Trash2 className="h-4 w-4" />
                </V3Button>
              </div>
            </div>
          </V3Card>
        ))}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[hsl(var(--portal-bg-primary))] border-[hsl(var(--portal-border))]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[hsl(var(--portal-text-primary))]">
              Delete Segment?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[hsl(var(--portal-text-muted))]">
              This action cannot be undone. The saved segment will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-[hsl(var(--portal-error))] text-white hover:bg-[hsl(var(--portal-error)/0.9)]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
