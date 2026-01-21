import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { Download, MapPin, Briefcase, Users, DollarSign, TrendingUp, Share2, ArrowLeft } from "lucide-react";
import { ClientShell } from "@/components/client/ClientShell";
import {
  V3PageContainer,
  V3KPICard,
  V3ChartWrapper,
  V3LoadingState,
  V3EmptyState,
  V3Button,
  V3DataTable,
  V3InlineBarCell,
  V3PrimaryCell,
  type V3Column,
} from "@/components/v3";
import { V3DonutChart } from "@/components/charts/echarts";
import { V3BarChart, USChoroplethMap, type ChoroplethDataItem, type MapMetricMode } from "@/components/charts";
import { getStateName } from "@/lib/us-states";
import { formatCurrency, formatNumber } from "@/lib/chart-formatters";
import { escapeCSVValue, downloadCSV } from "@/lib/csv-utils";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

// Types for RPC response
type StateStats = {
  state_abbr: string;
  unique_donors: number;
  transaction_count: number;
  revenue: number;
};

type OccupationStats = {
  occupation: string;
  unique_donors: number;
  count: number;
  revenue: number;
};

type ChannelStats = {
  channel: string;
  count: number;
  revenue: number;
};

type CityStats = {
  city: string;
  unique_donors: number;
  transaction_count: number;
  revenue: number;
};

type DemographicsTotals = {
  unique_donor_count: number;
  transaction_count: number;
  total_revenue: number;
};

type DemographicsSummary = {
  totals: DemographicsTotals;
  state_stats: StateStats[];
  occupation_stats: OccupationStats[];
  channel_stats: ChannelStats[];
};

const ClientDemographics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [summary, setSummary] = useState<DemographicsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [mapMetricMode, setMapMetricMode] = useState<MapMetricMode>("donations");
  
  // City data caching for drilldown
  const [cityCache, setCityCache] = useState<Map<string, CityStats[]>>(new Map());
  const [isCityLoading, setIsCityLoading] = useState(false);

  // Load data when organizationId is available
  useEffect(() => {
    if (organizationId) {
      loadData(organizationId);
    }
  }, [organizationId]);

  // Load city data on-demand when state is selected
  useEffect(() => {
    if (selectedState && organizationId && !cityCache.has(selectedState)) {
      loadCityData(selectedState);
    }
  }, [selectedState, organizationId]);

  const loadData = async (orgId: string) => {
    try {
      setIsLoading(true);
      
      const { data: org } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();

      setOrganization(org);

      // Use server-side aggregation RPC
      const { data: summaryData, error } = await supabase.rpc(
        'get_donor_demographics_summary',
        { _organization_id: orgId }
      );

      if (error) throw error;

      setSummary(summaryData as DemographicsSummary);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCityData = async (stateAbbr: string) => {
    if (!organizationId) return;
    
    try {
      setIsCityLoading(true);
      
      const { data, error } = await supabase.rpc(
        'get_state_city_breakdown',
        { 
          _organization_id: organizationId,
          _state_abbr: stateAbbr 
        }
      );

      if (error) throw error;

      const cities = (data as { state: string; cities: CityStats[] })?.cities || [];
      setCityCache(prev => new Map(prev).set(stateAbbr, cities));
    } catch (error: any) {
      toast({
        title: "Error loading city data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCityLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!summary) return;
    
    setIsExporting(true);
    try {
      // Export aggregated summary (safe, no PII)
      const headers = ['State', 'Unique Donors', 'Donations', 'Revenue'];
      const rows = summary.state_stats.map(s => [
        escapeCSVValue(s.state_abbr),
        escapeCSVValue(s.unique_donors),
        escapeCSVValue(s.transaction_count),
        escapeCSVValue(s.revenue),
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      downloadCSV(csv, `donor-demographics-summary-${new Date().toISOString().split('T')[0]}.csv`);

      toast({
        title: "Success",
        description: "Demographics summary exported to CSV",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate derived values
  const totals = useMemo(() => {
    if (!summary?.totals) return null;
    const { unique_donor_count, transaction_count, total_revenue } = summary.totals;
    // Average donation per transaction (correct formula with guard)
    const avgDonation = transaction_count > 0 ? total_revenue / transaction_count : 0;
    return {
      uniqueDonors: unique_donor_count,
      transactionCount: transaction_count,
      totalRevenue: total_revenue,
      avgDonation,
    };
  }, [summary]);

  // Prepare map data with all metrics
  const mapData: ChoroplethDataItem[] = useMemo(() => {
    if (!summary?.state_stats) return [];
    return summary.state_stats.map((s) => ({
      name: s.state_abbr,
      value: s.transaction_count,
      donors: s.unique_donors,
      revenue: s.revenue,
    }));
  }, [summary]);

  // Get cities for selected state (from cache)
  const selectedStateCities = useMemo(() => {
    if (!selectedState) return [];
    return cityCache.get(selectedState) || [];
  }, [selectedState, cityCache]);

  // Calculate max values for inline bars
  const maxStateRevenue = useMemo(() => 
    Math.max(...(summary?.state_stats || []).map(s => s.revenue), 1),
    [summary]
  );
  const totalStateRevenue = useMemo(() => 
    (summary?.state_stats || []).reduce((sum, s) => sum + s.revenue, 0),
    [summary]
  );

  // Table column definitions
  const locationColumns: V3Column<StateStats>[] = [
    {
      key: "state_abbr",
      header: "State",
      primary: true,
      render: (row, index) => (
        <V3PrimaryCell
          label={row.state_abbr}
          sublabel={getStateName(row.state_abbr)}
          isTopRank={index < 3}
        />
      ),
      sortable: true,
      sortFn: (a, b) => a.state_abbr.localeCompare(b.state_abbr),
    },
    {
      key: "revenue",
      header: "Revenue",
      render: (row) => (
        <V3InlineBarCell
          value={row.revenue}
          maxValue={maxStateRevenue}
          valueType="currency"
          variant="success"
          percentOfTotal={(row.revenue / totalStateRevenue) * 100}
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
  ];

  // Calculate max values for occupation inline bars
  const maxOccupationRevenue = useMemo(() => 
    Math.max(...(summary?.occupation_stats || []).map(s => s.revenue), 1),
    [summary]
  );
  const totalOccupationRevenue = useMemo(() => 
    (summary?.occupation_stats || []).reduce((sum, s) => sum + s.revenue, 0),
    [summary]
  );

  const occupationColumns: V3Column<OccupationStats>[] = [
    {
      key: "occupation",
      header: "Occupation",
      primary: true,
      render: (row, index) => (
        <V3PrimaryCell
          label={row.occupation}
          isTopRank={index < 3}
        />
      ),
      sortable: true,
      sortFn: (a, b) => a.occupation.localeCompare(b.occupation),
    },
    {
      key: "revenue",
      header: "Revenue",
      render: (row) => (
        <V3InlineBarCell
          value={row.revenue}
          maxValue={maxOccupationRevenue}
          valueType="currency"
          variant="success"
          percentOfTotal={(row.revenue / totalOccupationRevenue) * 100}
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
  ];

  // Calculate max values for city inline bars
  const maxCityRevenue = useMemo(() => 
    Math.max(...selectedStateCities.map(s => s.revenue), 1),
    [selectedStateCities]
  );
  const totalCityRevenue = useMemo(() => 
    selectedStateCities.reduce((sum, s) => sum + s.revenue, 0),
    [selectedStateCities]
  );

  // City table columns
  const cityColumns: V3Column<CityStats>[] = [
    {
      key: "city",
      header: "City",
      primary: true,
      render: (row, index) => (
        <V3PrimaryCell
          label={row.city}
          isTopRank={index < 3}
        />
      ),
      sortable: true,
      sortFn: (a, b) => a.city.localeCompare(b.city),
    },
    {
      key: "revenue",
      header: "Revenue",
      render: (row) => (
        <V3InlineBarCell
          value={row.revenue}
          maxValue={maxCityRevenue}
          valueType="currency"
          variant="success"
          percentOfTotal={totalCityRevenue > 0 ? (row.revenue / totalCityRevenue) * 100 : 0}
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
  ];

  // Loading state
  if (isLoading || orgLoading) {
    return (
      <ClientShell showDateControls={false}>
        <div className="p-6">
          <V3LoadingState variant="kpi-grid" count={3} />
          <div className="mt-6">
            <V3LoadingState variant="chart" />
          </div>
        </div>
      </ClientShell>
    );
  }

  // Empty state
  if (!organization || !summary || !totals) {
    return (
      <ClientShell showDateControls={false}>
        <V3EmptyState
          title="No Donor Data"
          description="There is no transaction data available to analyze demographics."
          accent="blue"
        />
      </ClientShell>
    );
  }

  // Handle state click on map
  const handleStateClick = (stateAbbr: string, stateName: string) => {
    setSelectedState(stateAbbr);
  };

  // Prepare pie chart data
  const occupationPieData = summary.occupation_stats.slice(0, 6).map(item => ({
    name: item.occupation.length > 20 ? item.occupation.slice(0, 20) + '...' : item.occupation,
    value: item.count,
  }));

  const channelPieData = summary.channel_stats.map(item => ({
    name: item.channel,
    value: item.revenue,
  }));

  return (
    <ClientShell showDateControls={false}>
      <V3PageContainer
        title="Donor Demographics"
        description="Analyze your donor base by location, occupation, and acquisition channel"
        actions={
          <V3Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exporting..." : "Export Summary"}
          </V3Button>
        }
      >
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <V3KPICard
            label="Unique Donors"
            value={formatNumber(totals.uniqueDonors)}
            icon={Users}
            accent="blue"
          />
          <V3KPICard
            label="Total Revenue"
            value={formatCurrency(totals.totalRevenue)}
            icon={DollarSign}
            accent="green"
          />
          <V3KPICard
            label="Avg. Donation"
            value={formatCurrency(totals.avgDonation)}
            icon={TrendingUp}
            accent="purple"
          />
        </div>

        {/* Donor Locations - US Heat Map */}
        <V3ChartWrapper
          title="Donor Locations"
          icon={MapPin}
          ariaLabel="Heat map of the United States showing donor distribution by state"
          description="Click on a state to see city-level breakdown"
          className="mb-6"
        >
          <div className="space-y-4">
            {selectedState && (
              <div className="flex items-center gap-3 pb-4 border-b border-[hsl(var(--portal-border))]">
                <V3Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedState(null)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to US Map
                </V3Button>
                <span className="text-[hsl(var(--portal-text-secondary))]">
                  Viewing: <span className="font-semibold text-[hsl(var(--portal-text-primary))]">{getStateName(selectedState)}</span>
                </span>
              </div>
            )}
            
            {!selectedState ? (
              <USChoroplethMap
                data={mapData}
                height={420}
                metricMode={mapMetricMode}
                onMetricModeChange={setMapMetricMode}
                showMetricToggle
                onStateClick={handleStateClick}
                selectedState={selectedState}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* City Bar Chart */}
                <div>
                  <h4 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))] mb-3">
                    Top Cities in {getStateName(selectedState)}
                  </h4>
                  {isCityLoading ? (
                    <V3LoadingState variant="chart" className="h-[300px]" />
                  ) : selectedStateCities.length > 0 ? (
                    <V3BarChart
                      data={[...selectedStateCities]
                        .sort((a, b) => b.unique_donors - a.unique_donors)
                        .slice(0, 10)
                        .map(c => ({
                          name: c.city,
                          value: c.unique_donors,
                        }))}
                      nameKey="name"
                      valueKey="value"
                      valueName="Donors"
                      height={300}
                      valueType="number"
                      horizontal
                      topN={10}
                      showRankBadges={false}
                    />
                  ) : (
                    <V3EmptyState
                      title="No City Data"
                      description={`No city-level data available for ${getStateName(selectedState)}`}
                      className="h-[300px]"
                    />
                  )}
                </div>
                
                {/* City Table */}
                <div>
                  <h4 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))] mb-3">
                    City Details
                  </h4>
                  {isCityLoading ? (
                    <V3LoadingState variant="table" className="h-[300px]" />
                  ) : selectedStateCities.length > 0 ? (
                    <V3DataTable
                      data={selectedStateCities}
                      columns={cityColumns}
                      getRowKey={(row) => row.city}
                      compact
                      maxHeight="300px"
                      showRowNumbers
                      highlightTopN={3}
                      defaultSortKey="revenue"
                      defaultSortDirection="desc"
                    />
                  ) : (
                    <V3EmptyState
                      title="No Data"
                      description="No city data available"
                      className="h-[300px]"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </V3ChartWrapper>

        {/* Pie Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Occupation Breakdown - Pie Chart */}
          <V3ChartWrapper
            title="Top Occupations"
            icon={Briefcase}
            ariaLabel="Pie chart showing donor distribution by occupation"
          >
            <V3DonutChart
              data={occupationPieData}
              height={300}
              valueType="number"
              centerLabel="Total Donors"
              topN={8}
              legendPosition="bottom"
            />
          </V3ChartWrapper>

          {/* Channel Breakdown - Pie Chart */}
          <V3ChartWrapper
            title="Acquisition Channels"
            icon={Share2}
            ariaLabel="Pie chart showing donor distribution by acquisition channel"
          >
            <V3DonutChart
              data={channelPieData}
              height={300}
              valueType="currency"
              centerLabel="Total Revenue"
              topN={8}
              legendPosition="bottom"
            />
          </V3ChartWrapper>
        </div>

        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <V3ChartWrapper
            title="Top States by Revenue"
            icon={MapPin}
            ariaLabel="Table showing top donor statistics by state"
          >
            <V3DataTable
              data={summary.state_stats.slice(0, 10)}
              columns={locationColumns}
              getRowKey={(row) => row.state_abbr}
              compact
              maxHeight="400px"
              showRowNumbers
              highlightTopN={3}
              defaultSortKey="revenue"
              defaultSortDirection="desc"
            />
          </V3ChartWrapper>

          <V3ChartWrapper
            title="Occupation Details"
            icon={Briefcase}
            ariaLabel="Table showing detailed donor statistics by occupation"
          >
            <V3DataTable
              data={summary.occupation_stats.slice(0, 15)}
              columns={occupationColumns}
              getRowKey={(row) => row.occupation}
              compact
              maxHeight="400px"
              showRowNumbers
              highlightTopN={3}
              defaultSortKey="revenue"
              defaultSortDirection="desc"
            />
          </V3ChartWrapper>
        </div>
      </V3PageContainer>
    </ClientShell>
  );
};

export default ClientDemographics;
