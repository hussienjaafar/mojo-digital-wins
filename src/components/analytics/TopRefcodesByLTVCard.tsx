import { Trophy, TrendingUp, Users, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RefcodePerformance } from "@/hooks/useRefcodePerformance";

// ============================================================================
// Types
// ============================================================================

interface TopRefcodesByLTVCardProps {
  data: RefcodePerformance[];
  isLoading?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function TopRefcodesByLTVCard({ data, isLoading = false }: TopRefcodesByLTVCardProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse h-16 bg-[hsl(var(--portal-bg-tertiary))] rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[hsl(var(--portal-text-muted))]">
        <Trophy className="h-8 w-8 mb-2 opacity-50" />
        <p>Not enough data for LTV analysis</p>
        <p className="text-sm">Requires refcodes with at least 5 donors</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-4">
        Refcodes ranked by recurring rate (proxy for donor lifetime value). Only refcodes with 5+ donors shown.
      </p>
      
      {data.map((refcode, idx) => (
        <div
          key={refcode.refcode}
          className={cn(
            "flex items-center gap-4 p-3 rounded-lg border transition-colors",
            "bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]",
            "hover:bg-[hsl(var(--portal-bg-tertiary))]"
          )}
        >
          {/* Rank */}
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
            idx === 0 && "bg-[hsl(var(--portal-warning))] text-white",
            idx === 1 && "bg-[hsl(var(--portal-text-muted)/0.3)] text-[hsl(var(--portal-text-primary))]",
            idx === 2 && "bg-[hsl(var(--portal-warning)/0.5)] text-white",
            idx > 2 && "bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))]"
          )}>
            {idx + 1}
          </div>

          {/* Refcode Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono font-medium text-[hsl(var(--portal-text-primary))] truncate">
                {refcode.refcode}
              </code>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-[hsl(var(--portal-text-muted))]">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {refcode.uniqueDonors} donors
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${refcode.avgGift.toFixed(0)} avg
              </span>
            </div>
          </div>

          {/* Recurring Rate */}
          <div className="text-right">
            <div className={cn(
              "text-lg font-bold",
              refcode.recurringRate >= 25 && "text-[hsl(var(--portal-success))]",
              refcode.recurringRate >= 15 && refcode.recurringRate < 25 && "text-[hsl(var(--portal-accent-blue))]",
              refcode.recurringRate < 15 && "text-[hsl(var(--portal-text-primary))]"
            )}>
              {refcode.recurringRate.toFixed(0)}%
            </div>
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">
              recurring
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
