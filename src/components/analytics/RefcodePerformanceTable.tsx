import { useState, useMemo } from "react";
import { ArrowUpDown, TrendingUp, Users, DollarSign, RefreshCw, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RefcodePerformance, ChannelType } from "@/hooks/useRefcodePerformance";

// ============================================================================
// Types
// ============================================================================

type SortField = "refcode" | "donationCount" | "uniqueDonors" | "totalRevenue" | "avgGift" | "recurringRate";
type SortDirection = "asc" | "desc";

interface RefcodePerformanceTableProps {
  data: RefcodePerformance[];
  isLoading?: boolean;
  maxRows?: number;
}

// ============================================================================
// Channel Badge Component
// ============================================================================

const CHANNEL_COLORS: Record<ChannelType, string> = {
  meta: "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] border-[hsl(var(--portal-accent-blue)/0.2)]",
  sms: "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]",
  email: "bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))] border-[hsl(var(--portal-accent-purple)/0.2)]",
  organic: "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))] border-[hsl(var(--portal-warning)/0.2)]",
  direct: "bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))] border-[hsl(var(--portal-border))]",
};

const CHANNEL_LABELS: Record<ChannelType, string> = {
  meta: "Meta",
  sms: "SMS",
  email: "Email",
  organic: "Organic",
  direct: "Direct",
};

function ChannelBadge({ channel }: { channel: ChannelType }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", CHANNEL_COLORS[channel])}>
      {CHANNEL_LABELS[channel]}
    </Badge>
  );
}

// ============================================================================
// Table Header Component
// ============================================================================

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentSort: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  align?: "left" | "right";
}

function SortableHeader({ label, field, currentSort, direction, onSort, align = "left" }: SortableHeaderProps) {
  const isActive = currentSort === field;
  
  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors",
        "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))]",
        align === "right" && "ml-auto",
        isActive && "text-[hsl(var(--portal-accent-blue))]"
      )}
    >
      {label}
      <ArrowUpDown className={cn(
        "h-3 w-3",
        isActive && direction === "asc" && "rotate-180"
      )} />
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RefcodePerformanceTable({ 
  data, 
  isLoading = false,
  maxRows = 15 
}: RefcodePerformanceTableProps) {
  const [sortField, setSortField] = useState<SortField>("totalRevenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAll, setShowAll] = useState(false);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });
    
    return showAll ? sorted : sorted.slice(0, maxRows);
  }, [data, sortField, sortDirection, showAll, maxRows]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-[hsl(var(--portal-bg-tertiary))] rounded" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--portal-text-muted))]">
        <ExternalLink className="h-8 w-8 mb-2 opacity-50" />
        <p>No refcode data available</p>
        <p className="text-sm">Donations without refcodes cannot be attributed</p>
      </div>
    );
  }

  const totalRevenue = data.reduce((sum, r) => sum + r.totalRevenue, 0);

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--portal-border))]">
              <th className="py-3 px-2 text-left">
                <SortableHeader 
                  label="Refcode" 
                  field="refcode" 
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="py-3 px-2 text-left">
                <span className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--portal-text-muted))]">
                  Channel
                </span>
              </th>
              <th className="py-3 px-2 text-right">
                <SortableHeader 
                  label="Donations" 
                  field="donationCount" 
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
              </th>
              <th className="py-3 px-2 text-right">
                <SortableHeader 
                  label="Revenue" 
                  field="totalRevenue" 
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
              </th>
              <th className="py-3 px-2 text-right">
                <SortableHeader 
                  label="Donors" 
                  field="uniqueDonors" 
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
              </th>
              <th className="py-3 px-2 text-right">
                <SortableHeader 
                  label="Avg Gift" 
                  field="avgGift" 
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
              </th>
              <th className="py-3 px-2 text-right">
                <SortableHeader 
                  label="Recurring %" 
                  field="recurringRate" 
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((refcode, idx) => {
              const revenueShare = totalRevenue > 0 ? (refcode.totalRevenue / totalRevenue) * 100 : 0;
              
              return (
                <tr 
                  key={refcode.refcode} 
                  className={cn(
                    "border-b border-[hsl(var(--portal-border)/0.5)] transition-colors",
                    "hover:bg-[hsl(var(--portal-bg-tertiary)/0.5)]",
                    idx < 3 && "bg-[hsl(var(--portal-accent-blue)/0.02)]"
                  )}
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      {idx < 3 && (
                        <span className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                          idx === 0 && "bg-[hsl(var(--portal-warning))] text-white",
                          idx === 1 && "bg-[hsl(var(--portal-text-muted)/0.3)] text-[hsl(var(--portal-text-primary))]",
                          idx === 2 && "bg-[hsl(var(--portal-warning)/0.5)] text-white"
                        )}>
                          {idx + 1}
                        </span>
                      )}
                      <code className="text-sm font-mono text-[hsl(var(--portal-text-primary))]">
                        {refcode.refcode}
                      </code>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <ChannelBadge channel={refcode.channel} />
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="text-sm text-[hsl(var(--portal-text-primary))] tabular-nums">
                      {refcode.donationCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold text-[hsl(var(--portal-success))] tabular-nums">
                        ${refcode.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                        {revenueShare.toFixed(1)}% of total
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="text-sm text-[hsl(var(--portal-text-primary))] tabular-nums">
                      {refcode.uniqueDonors.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="text-sm text-[hsl(var(--portal-text-primary))] tabular-nums">
                      ${refcode.avgGift.toFixed(0)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className={cn(
                      "text-sm font-medium tabular-nums",
                      refcode.recurringRate >= 20 && "text-[hsl(var(--portal-success))]",
                      refcode.recurringRate >= 10 && refcode.recurringRate < 20 && "text-[hsl(var(--portal-accent-blue))]",
                      refcode.recurringRate < 10 && "text-[hsl(var(--portal-text-muted))]"
                    )}>
                      {refcode.recurringRate.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Show More */}
      {data.length > maxRows && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-[hsl(var(--portal-accent-blue))]"
          >
            {showAll ? "Show Less" : `Show All ${data.length} Refcodes`}
          </Button>
        </div>
      )}
    </div>
  );
}
