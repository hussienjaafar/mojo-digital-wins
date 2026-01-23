import React from "react";
import { Users, DollarSign, TrendingUp, RefreshCw, AlertTriangle, MapPin, BarChart3, Megaphone, Heart, Lightbulb, MessageCircle } from "lucide-react";
import { V3Card, V3CardContent, V3CardHeader, V3CardTitle, V3KPICard, V3LoadingState, V3EmptyState } from "@/components/v3";
import { V3DonutChart } from "@/components/charts/echarts";
import { V3BarChart } from "@/components/charts/V3BarChart";
import { formatCurrency } from "@/lib/chart-formatters";
import { cn } from "@/lib/utils";
import type { SegmentDonor, SegmentAggregates } from "@/types/donorSegment";
import { useVirtualizer } from "@tanstack/react-virtual";

// Format snake_case segment names to Title Case
const formatSegmentLabel = (name: string): string => {
  if (!name) return "Unknown";
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

interface DonorSegmentResultsProps {
  data: {
    donors: SegmentDonor[];
    aggregates: SegmentAggregates;
    totalCount: number;
  } | undefined;
  isLoading: boolean;
  isFetching: boolean;
  viewMode: 'aggregate' | 'table';
  activeFilterCount: number;
}

export function DonorSegmentResults({
  data,
  isLoading,
  isFetching,
  viewMode,
  activeFilterCount,
}: DonorSegmentResultsProps) {
  if (isLoading) {
    return (
      <V3Card>
        <V3CardContent className="p-6">
          <V3LoadingState variant="kpi-grid" count={4} />
          <div className="mt-6">
            <V3LoadingState variant="chart" height={200} />
          </div>
        </V3CardContent>
      </V3Card>
    );
  }

  if (!data || data.totalCount === 0) {
    return (
      <V3Card>
        <V3CardContent className="p-6">
          <V3EmptyState
            title={activeFilterCount === 0 ? "All Donors" : "No Matching Donors"}
            description={
              activeFilterCount === 0
                ? "Add filters to segment your donor base"
                : "Try adjusting your filter criteria"
            }
            accent="blue"
          />
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <V3Card>
        <V3CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[hsl(var(--portal-success)/0.1)]">
                <Users className="h-5 w-5 text-[hsl(var(--portal-success))]" />
              </div>
              <div>
                <V3CardTitle className="flex items-center gap-2">
                  {data.totalCount.toLocaleString()} Donors
                  {isFetching && (
                    <RefreshCw className="h-4 w-4 animate-spin text-[hsl(var(--portal-text-muted))]" />
                  )}
                </V3CardTitle>
                <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                  {formatCurrency(data.aggregates.totalLifetimeValue)} total lifetime value
                </p>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <span className="px-2 py-1 text-xs rounded-full bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
              </span>
            )}
          </div>
        </V3CardHeader>
      </V3Card>

      {viewMode === 'aggregate' ? (
        <AggregateView aggregates={data.aggregates} />
      ) : (
        <TableView donors={data.donors} />
      )}
    </div>
  );
}

// Aggregate view with KPIs and charts
function AggregateView({ aggregates }: { aggregates: SegmentAggregates }) {
  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <V3KPICard
          icon={DollarSign}
          label="Avg Donation"
          value={formatCurrency(aggregates.avgDonation)}
          subtitle="per transaction"
          accent="green"
        />
        <V3KPICard
          icon={TrendingUp}
          label="Avg Donations"
          value={aggregates.avgDonationCount.toFixed(1)}
          subtitle="per donor"
          accent="blue"
        />
        <V3KPICard
          icon={RefreshCw}
          label="Recurring Rate"
          value={`${aggregates.recurringRate.toFixed(1)}%`}
          subtitle={`${aggregates.recurringDonors} donors`}
          accent="purple"
        />
        <V3KPICard
          icon={AlertTriangle}
          label="Avg Recency"
          value={`${Math.round(aggregates.avgDaysSinceDonation)}d`}
          subtitle="since last donation"
          accent="amber"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Distribution */}
        {aggregates.byTier.length > 0 && (
          <V3Card>
            <V3CardHeader className="pb-2">
              <V3CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Donor Tiers
              </V3CardTitle>
            </V3CardHeader>
            <V3CardContent>
              <V3DonutChart
                data={aggregates.byTier}
                height={220}
                valueType="number"
                centerLabel="Donors"
                legendPosition="bottom"
                topN={5}
              />
            </V3CardContent>
          </V3Card>
        )}

        {/* Churn Risk Distribution */}
        {aggregates.byChurnRisk.length > 0 && (
          <V3Card>
            <V3CardHeader className="pb-2">
              <V3CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Churn Risk
              </V3CardTitle>
            </V3CardHeader>
            <V3CardContent>
              <V3DonutChart
                data={aggregates.byChurnRisk.filter(d => d.name !== 'Unknown Risk')}
                height={220}
                valueType="number"
                centerLabel="Donors"
                legendPosition="bottom"
                topN={4}
              />
            </V3CardContent>
          </V3Card>
        )}

        {/* RFM Segment Distribution - Horizontal bar for readability */}
        {aggregates.bySegment.length > 0 && (
          <V3Card>
            <V3CardHeader className="pb-2">
              <V3CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                RFM Segments
              </V3CardTitle>
            </V3CardHeader>
            <V3CardContent>
              <V3BarChart
                data={aggregates.bySegment.map(item => ({
                  ...item,
                  name: formatSegmentLabel(item.name)
                }))}
                nameKey="name"
                valueKey="value"
                valueName="Donors"
                height={300}
                valueType="number"
                horizontal={true}
                topN={10}
                maxLabelLength={18}
              />
            </V3CardContent>
          </V3Card>
        )}

        {/* State Distribution - Horizontal bar for readability */}
        {aggregates.byState.length > 0 && (
          <V3Card>
            <V3CardHeader className="pb-2">
              <V3CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Top States
              </V3CardTitle>
            </V3CardHeader>
            <V3CardContent>
              <V3BarChart
                data={aggregates.byState}
                nameKey="name"
                valueKey="value"
                valueName="Donors"
                height={300}
                valueType="number"
                horizontal={true}
                topN={10}
              />
            </V3CardContent>
          </V3Card>
        )}

        {/* Attribution Channel Distribution */}
        {(aggregates.byChannel || []).length > 0 && (aggregates.byChannel || []).some(c => c.name !== 'Unknown') && (
          <V3Card>
            <V3CardHeader className="pb-2">
              <V3CardTitle className="text-sm flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Donation Channels
              </V3CardTitle>
              <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-0.5">
                Which channels drove these donations
              </p>
            </V3CardHeader>
            <V3CardContent>
              <V3DonutChart
                data={aggregates.byChannel.filter(c => c.name !== 'Unknown')}
                height={220}
                valueType="number"
                centerLabel="Channels"
                legendPosition="bottom"
                topN={5}
              />
            </V3CardContent>
          </V3Card>
        )}

        {/* Donor Motivation Insights Section */}
        {((aggregates.byTopic || []).length > 0 || (aggregates.byPainPoint || []).length > 0 || (aggregates.byValue || []).length > 0) && (
          <>
            <div className="col-span-full">
              <h3 className="text-sm font-semibold text-[hsl(var(--portal-text-primary))] mb-4 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[hsl(var(--portal-accent-amber))]" />
                What Motivated These Donors
                <span className="text-xs font-normal text-[hsl(var(--portal-text-muted))]">
                  (Based on AI analysis of ads/SMS that drove their donations)
                </span>
              </h3>
            </div>

            {/* Topic Distribution */}
            {(aggregates.byTopic || []).length > 0 && (
              <V3Card>
                <V3CardHeader className="pb-2">
                  <V3CardTitle className="text-sm flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Acquisition Topics
                  </V3CardTitle>
                </V3CardHeader>
                <V3CardContent>
                  <V3DonutChart
                    data={aggregates.byTopic}
                    height={220}
                    valueType="number"
                    centerLabel="Topics"
                    legendPosition="bottom"
                    topN={6}
                  />
                </V3CardContent>
              </V3Card>
            )}

            {/* Pain Points */}
            {(aggregates.byPainPoint || []).length > 0 && (
              <V3Card>
                <V3CardHeader className="pb-2">
                  <V3CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Pain Points That Drove Giving
                  </V3CardTitle>
                </V3CardHeader>
                <V3CardContent>
                  <V3BarChart
                    data={aggregates.byPainPoint}
                    nameKey="name"
                    valueKey="value"
                    valueName="Donors"
                    height={280}
                    valueType="number"
                    horizontal={true}
                    topN={6}
                    maxLabelLength={40}
                  />
                </V3CardContent>
              </V3Card>
            )}

            {/* Values */}
            {(aggregates.byValue || []).length > 0 && (
              <V3Card>
                <V3CardHeader className="pb-2">
                  <V3CardTitle className="text-sm flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Values That Resonate
                  </V3CardTitle>
                </V3CardHeader>
                <V3CardContent>
                  <V3DonutChart
                    data={aggregates.byValue}
                    height={220}
                    valueType="number"
                    centerLabel="Values"
                    legendPosition="bottom"
                    topN={6}
                  />
                </V3CardContent>
              </V3Card>
            )}

            {/* Emotions */}
            {(aggregates.byEmotion || []).length > 0 && (
              <V3Card>
                <V3CardHeader className="pb-2">
                  <V3CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Emotional Triggers
                  </V3CardTitle>
                </V3CardHeader>
                <V3CardContent>
                  <V3BarChart
                    data={aggregates.byEmotion}
                    nameKey="name"
                    valueKey="value"
                    valueName="Donors"
                    height={220}
                    valueType="number"
                    horizontal={true}
                    topN={6}
                  />
                </V3CardContent>
              </V3Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Virtualized table view for donor list
function TableView({ donors }: { donors: SegmentDonor[] }) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: donors.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  const columns = [
    { key: 'name', label: 'Name', width: '20%' },
    { key: 'email', label: 'Email', width: '20%' },
    { key: 'state', label: 'State', width: '8%' },
    { key: 'total_donated', label: 'Lifetime $', width: '12%' },
    { key: 'donation_count', label: 'Donations', width: '10%' },
    { key: 'segment', label: 'Segment', width: '15%' },
    { key: 'churn_risk', label: 'Risk', width: '10%' },
  ];

  return (
    <V3Card>
      <V3CardHeader className="pb-2">
        <V3CardTitle className="text-sm">
          Donor List ({donors.length.toLocaleString()} donors)
        </V3CardTitle>
      </V3CardHeader>
      <V3CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center px-4 py-3 bg-[hsl(var(--portal-bg-elevated))] border-b border-[hsl(var(--portal-border))] text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider">
          {columns.map(col => (
            <div key={col.key} style={{ width: col.width }} className="truncate">
              {col.label}
            </div>
          ))}
        </div>

        {/* Virtualized rows */}
        <div
          ref={parentRef}
          className="h-[500px] overflow-auto"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const donor = donors[virtualRow.index];
              return (
                <div
                  key={donor.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={cn(
                    "flex items-center px-4 py-2 border-b border-[hsl(var(--portal-border))]",
                    "hover:bg-[hsl(var(--portal-bg-hover))] transition-colors"
                  )}
                >
                  <div style={{ width: '20%' }} className="truncate text-sm text-[hsl(var(--portal-text-primary))]">
                    {donor.name || '—'}
                  </div>
                  <div style={{ width: '20%' }} className="truncate text-sm text-[hsl(var(--portal-text-muted))]">
                    {donor.email || '—'}
                  </div>
                  <div style={{ width: '8%' }} className="text-sm text-[hsl(var(--portal-text-muted))]">
                    {donor.state || '—'}
                  </div>
                  <div style={{ width: '12%' }} className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                    {formatCurrency(donor.total_donated)}
                  </div>
                  <div style={{ width: '10%' }} className="text-sm text-[hsl(var(--portal-text-muted))]">
                    {donor.donation_count}
                  </div>
                  <div style={{ width: '15%' }}>
                    {donor.segment ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]">
                        {donor.segment.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    ) : (
                      <span className="text-sm text-[hsl(var(--portal-text-muted))]">—</span>
                    )}
                  </div>
                  <div style={{ width: '10%' }}>
                    {donor.churn_risk_label ? (
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        donor.churn_risk_label === 'high' && "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))]",
                        donor.churn_risk_label === 'medium' && "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]",
                        donor.churn_risk_label === 'low' && "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]"
                      )}>
                        {donor.churn_risk_label.charAt(0).toUpperCase() + donor.churn_risk_label.slice(1)}
                      </span>
                    ) : (
                      <span className="text-sm text-[hsl(var(--portal-text-muted))]">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </V3CardContent>
    </V3Card>
  );
}
