import { useMemo } from "react";
import { V3BarChart } from "@/components/charts";
import { V3DataTable, V3InlineBarCell, V3PrimaryCell, V3LoadingState, V3EmptyState, type V3Column } from "@/components/v3";
import { formatCurrency, formatNumber } from "@/lib/chart-formatters";
import { Tag } from "lucide-react";

export interface RefcodeStat {
  refcode: string;
  count: number;
  revenue: number;
  unique_donors: number;
}

export interface TopRefcodesBreakdownProps {
  data: RefcodeStat[];
  isLoading?: boolean;
  variant?: "chart" | "table" | "both";
}

export function TopRefcodesBreakdown({
  data,
  isLoading = false,
  variant = "chart",
}: TopRefcodesBreakdownProps) {
  const { chartData, maxRevenue, totalRevenue } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], maxRevenue: 1, totalRevenue: 0 };
    }

    const total = data.reduce((sum, d) => sum + d.revenue, 0);
    const max = Math.max(...data.map((d) => d.revenue), 1);
    
    // Clean up refcode names for display
    const cleaned = data.map((d) => ({
      ...d,
      displayName: d.refcode.length > 30 
        ? d.refcode.substring(0, 27) + "..." 
        : d.refcode,
      avgGift: d.count > 0 ? d.revenue / d.count : 0,
    }));

    return { chartData: cleaned, maxRevenue: max, totalRevenue: total };
  }, [data]);

  // Table columns
  const columns: V3Column<typeof chartData[0]>[] = useMemo(() => [
    {
      key: "refcode",
      header: "Campaign/Refcode",
      primary: true,
      render: (row, index) => (
        <V3PrimaryCell
          label={row.displayName}
          sublabel={row.refcode !== row.displayName ? row.refcode : undefined}
          isTopRank={index < 3}
        />
      ),
      sortable: true,
      sortFn: (a, b) => a.refcode.localeCompare(b.refcode),
    },
    {
      key: "revenue",
      header: "Revenue",
      render: (row) => (
        <V3InlineBarCell
          value={row.revenue}
          maxValue={maxRevenue}
          valueType="currency"
          variant="success"
          percentOfTotal={totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0}
        />
      ),
      align: "right",
      sortable: true,
      sortFn: (a, b) => a.revenue - b.revenue,
    },
    {
      key: "unique_donors",
      header: "Donors",
      render: (row) => (
        <span className="text-[hsl(var(--portal-text-secondary))] tabular-nums">
          {formatNumber(row.unique_donors)}
        </span>
      ),
      align: "right",
      sortable: true,
      sortFn: (a, b) => a.unique_donors - b.unique_donors,
      hideOnMobile: true,
    },
    {
      key: "avgGift",
      header: "Avg Gift",
      render: (row) => (
        <span className="text-[hsl(var(--portal-text-secondary))] tabular-nums">
          {formatCurrency(row.avgGift)}
        </span>
      ),
      align: "right",
      sortable: true,
      sortFn: (a, b) => a.avgGift - b.avgGift,
      hideOnMobile: true,
    },
  ], [maxRevenue, totalRevenue]);

  if (isLoading) {
    return <V3LoadingState variant={variant === "table" ? "table" : "chart"} className="h-[300px]" />;
  }

  if (chartData.length === 0) {
    return (
      <V3EmptyState
        title="No Campaign Data"
        description="No refcode or campaign attribution data is available."
        icon={Tag}
        className="h-[300px]"
      />
    );
  }

  if (variant === "table") {
    return (
      <V3DataTable
        data={chartData}
        columns={columns}
        getRowKey={(row) => row.refcode}
        compact
        maxHeight="350px"
        showRowNumbers
        highlightTopN={3}
        defaultSortKey="revenue"
        defaultSortDirection="desc"
      />
    );
  }

  if (variant === "chart") {
    return (
      <V3BarChart
        data={chartData.slice(0, 10).map((d) => ({
          name: d.displayName,
          value: d.revenue,
        }))}
        nameKey="name"
        valueKey="value"
        valueName="Revenue"
        height={300}
        valueType="currency"
        horizontal
        topN={10}
        showRankBadges
      />
    );
  }

  // Both
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <V3BarChart
        data={chartData.slice(0, 8).map((d) => ({
          name: d.displayName,
          value: d.revenue,
        }))}
        nameKey="name"
        valueKey="value"
        valueName="Revenue"
        height={300}
        valueType="currency"
        horizontal
        topN={8}
        showRankBadges={false}
      />
      <V3DataTable
        data={chartData}
        columns={columns}
        getRowKey={(row) => row.refcode}
        compact
        maxHeight="300px"
        showRowNumbers
        highlightTopN={3}
        defaultSortKey="revenue"
        defaultSortDirection="desc"
      />
    </div>
  );
}

export default TopRefcodesBreakdown;
