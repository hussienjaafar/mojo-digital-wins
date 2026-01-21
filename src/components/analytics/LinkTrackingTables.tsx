import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Link2, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { RefcodePerformance, CampaignPerformance } from "@/hooks/useEnhancedRedirectClicksQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ============================================================================
// Types
// ============================================================================

interface LinkTrackingTablesProps {
  byRefcode: RefcodePerformance[];
  byCampaign: CampaignPerformance[];
  isLoading?: boolean;
  className?: string;
}

type SortField = "clicks" | "sessions" | "metaClicks" | "cookieRate" | "conversions" | "revenue" | "cvr";
type SortDirection = "asc" | "desc";

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function getCookieRateBadge(rate: number): React.ReactNode {
  if (rate >= 70) {
    return <Badge variant="default" className="bg-[hsl(var(--portal-success))] text-white text-[10px]">Excellent</Badge>;
  } else if (rate >= 50) {
    return <Badge variant="default" className="bg-[hsl(var(--portal-accent-blue))] text-white text-[10px]">Good</Badge>;
  } else if (rate >= 30) {
    return <Badge variant="default" className="bg-[hsl(var(--portal-warning))] text-white text-[10px]">Fair</Badge>;
  } else {
    return <Badge variant="default" className="bg-[hsl(var(--portal-error))] text-white text-[10px]">Low</Badge>;
  }
}

// ============================================================================
// Sortable Header
// ============================================================================

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentSort: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  field,
  currentSort,
  direction,
  onSort,
}) => (
  <button
    onClick={() => onSort(field)}
    className="flex items-center gap-1 hover:text-[hsl(var(--portal-text-primary))] transition-colors"
  >
    {label}
    {currentSort === field && (
      direction === "asc" ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      )
    )}
  </button>
);

// ============================================================================
// Loading State
// ============================================================================

const TableSkeleton: React.FC = () => (
  <Card className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
    <CardHeader className="pb-2">
      <Skeleton className="h-5 w-48" />
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </CardContent>
  </Card>
);

// ============================================================================
// Refcode Table
// ============================================================================

const RefcodeTable: React.FC<{ data: RefcodePerformance[] }> = ({ data }) => {
  const [sortField, setSortField] = useState<SortField>("clicks");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAll, setShowAll] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case "clicks": aVal = a.totalClicks; bVal = b.totalClicks; break;
        case "sessions": aVal = a.uniqueSessions; bVal = b.uniqueSessions; break;
        case "metaClicks": aVal = a.metaAdClicks; bVal = b.metaAdClicks; break;
        case "cookieRate": aVal = a.cookieCaptureRate; bVal = b.cookieCaptureRate; break;
        case "conversions": aVal = a.conversions; bVal = b.conversions; break;
        case "revenue": aVal = a.revenue; bVal = b.revenue; break;
        case "cvr": aVal = a.conversionRate; bVal = b.conversionRate; break;
        default: aVal = a.totalClicks; bVal = b.totalClicks;
      }
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
    return showAll ? sorted : sorted.slice(0, 10);
  }, [data, sortField, sortDirection, showAll]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-[hsl(var(--portal-text-muted))]">
        No refcode data available
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[hsl(var(--portal-border))]">
              <TableHead className="text-[hsl(var(--portal-text-muted))]">Refcode</TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-right">
                <SortableHeader label="Clicks" field="clicks" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              </TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-right">
                <SortableHeader label="Sessions" field="sessions" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              </TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-right">
                <SortableHeader label="Meta %" field="metaClicks" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              </TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-center">
                <SortableHeader label="Cookie" field="cookieRate" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              </TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-right">
                <SortableHeader label="Conv." field="conversions" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              </TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-right">
                <SortableHeader label="Revenue" field="revenue" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              </TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-right">
                <SortableHeader label="CVR" field="cvr" currentSort={sortField} direction={sortDirection} onSort={handleSort} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row) => (
              <TableRow key={row.refcode} className="border-[hsl(var(--portal-border))]">
                <TableCell className="font-medium text-[hsl(var(--portal-text-primary))] max-w-[200px] truncate">
                  {row.refcode}
                </TableCell>
                <TableCell className="text-right text-[hsl(var(--portal-text-secondary))]">
                  {formatNumber(row.totalClicks)}
                </TableCell>
                <TableCell className="text-right text-[hsl(var(--portal-text-secondary))]">
                  {formatNumber(row.uniqueSessions)}
                </TableCell>
                <TableCell className="text-right text-[hsl(var(--portal-text-secondary))]">
                  {row.totalClicks > 0 ? Math.round((row.metaAdClicks / row.totalClicks) * 100) : 0}%
                </TableCell>
                <TableCell className="text-center">
                  {getCookieRateBadge(row.cookieCaptureRate)}
                </TableCell>
                <TableCell className="text-right text-[hsl(var(--portal-text-secondary))]">
                  {formatNumber(row.conversions)}
                </TableCell>
                <TableCell className="text-right text-[hsl(var(--portal-success))] font-medium">
                  {formatCurrency(row.revenue)}
                </TableCell>
                <TableCell className="text-right text-[hsl(var(--portal-text-secondary))]">
                  {row.conversionRate}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.length > 10 && (
        <div className="mt-4 text-center">
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
};

// ============================================================================
// Campaign Table
// ============================================================================

const CampaignTable: React.FC<{ data: CampaignPerformance[] }> = ({ data }) => {
  const [showAll, setShowAll] = useState(false);
  const displayData = showAll ? data : data.slice(0, 10);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-[hsl(var(--portal-text-muted))]">
        No campaign data available
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[hsl(var(--portal-border))]">
              <TableHead className="text-[hsl(var(--portal-text-muted))]">Campaign</TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-right">Clicks</TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-right">Sessions</TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-right">Meta %</TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-right">Conversions</TableHead>
              <TableHead className="text-[hsl(var(--portal-text-muted))] text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((row) => (
              <TableRow key={row.campaign} className="border-[hsl(var(--portal-border))]">
                <TableCell className="font-medium text-[hsl(var(--portal-text-primary))] max-w-[250px] truncate">
                  {row.campaign}
                </TableCell>
                <TableCell className="text-right text-[hsl(var(--portal-text-secondary))]">
                  {formatNumber(row.totalClicks)}
                </TableCell>
                <TableCell className="text-right text-[hsl(var(--portal-text-secondary))]">
                  {formatNumber(row.uniqueSessions)}
                </TableCell>
                <TableCell className="text-right text-[hsl(var(--portal-text-secondary))]">
                  {row.totalClicks > 0 ? Math.round((row.metaAdClicks / row.totalClicks) * 100) : 0}%
                </TableCell>
                <TableCell className="text-right text-[hsl(var(--portal-text-secondary))]">
                  {formatNumber(row.conversions)}
                </TableCell>
                <TableCell className="text-right text-[hsl(var(--portal-success))] font-medium">
                  {formatCurrency(row.revenue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.length > 10 && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-[hsl(var(--portal-accent-blue))]"
          >
            {showAll ? "Show Less" : `Show All ${data.length} Campaigns`}
          </Button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const LinkTrackingTables: React.FC<LinkTrackingTablesProps> = ({
  byRefcode,
  byCampaign,
  isLoading,
  className,
}) => {
  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <Card className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-[hsl(var(--portal-text-primary))]">
            Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="refcode" className="w-full">
            <TabsList className="mb-4 bg-[hsl(var(--portal-bg-tertiary))]">
              <TabsTrigger
                value="refcode"
                className="data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white"
              >
                <Link2 className="h-3.5 w-3.5 mr-1.5" />
                By Refcode
              </TabsTrigger>
              <TabsTrigger
                value="campaign"
                className="data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white"
              >
                <Megaphone className="h-3.5 w-3.5 mr-1.5" />
                By Campaign
              </TabsTrigger>
            </TabsList>
            <TabsContent value="refcode">
              <RefcodeTable data={byRefcode} />
            </TabsContent>
            <TabsContent value="campaign">
              <CampaignTable data={byCampaign} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
};

LinkTrackingTables.displayName = "LinkTrackingTables";
