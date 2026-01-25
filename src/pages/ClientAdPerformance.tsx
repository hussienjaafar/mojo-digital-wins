/**
 * ClientAdPerformance Page
 *
 * Granular Meta Ad + Message Performance page with drill-down capabilities.
 * Shows Campaign → Ad Set → Ad hierarchical navigation like Meta Ads Manager.
 * V3 Design System aligned.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { useClientOrganization } from '@/hooks/useClientOrganization';
import { ClientLayout } from '@/components/client/ClientLayout';
import { ProductionGate } from '@/components/client/ProductionGate';
import {
  AdPerformanceList,
  HierarchyLevelTabs,
  HierarchyBreadcrumb,
  CampaignRow,
  AdSetRow,
} from '@/components/client/AdPerformance';
import { useAdPerformanceQuery } from '@/hooks/useAdPerformanceQuery';
import { useAdHierarchy } from '@/hooks/useAdHierarchy';
import { DateRangeSelector } from '@/components/dashboard/DateRangeSelector';
import { useDashboardStore } from '@/stores/dashboardStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  AlertTriangle,
  Info,
  Search,
  SlidersHorizontal,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatRoas, formatPercentage, getRoasColor } from '@/utils/adPerformance';
import type { SortField, SortDirection } from '@/utils/adPerformance';
import { sortAds, filterByMinSpend } from '@/utils/adPerformance';
import type { AdPerformanceData, AdPerformanceStatus } from '@/types/adPerformance';
import type { HierarchyLevel, BreadcrumbItem } from '@/types/adHierarchy';

type StatusFilter = 'all' | AdPerformanceStatus;

export default function ClientAdPerformance() {
  // Use dashboard store for date range (V3 pattern)
  const { dateRange } = useDashboardStore();

  // Local state for filters
  const [sortField, setSortField] = useState<SortField>('spend');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [minSpendFilter, setMinSpendFilter] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Hierarchy navigation state
  const [hierarchyLevel, setHierarchyLevel] = useState<HierarchyLevel>('campaign');
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [selectedAdsets, setSelectedAdsets] = useState<string[]>([]);

  // Get organization ID - respects impersonation context for admins
  const { organizationId, isLoading: isLoadingOrg } = useClientOrganization();

  // DEV-ONLY: Log computed date range passed to hook
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AdPerformance:Page] Date range selector values:', {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        organizationId: organizationId || '(not yet loaded)',
      });
    }
  }, [dateRange, organizationId]);

  // Get ad performance data using dashboard store dates
  const {
    data: adPerformanceData,
    isLoading: isLoadingAds,
    error,
    refetch,
  } = useAdPerformanceQuery({
    organizationId: organizationId || '',
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const isLoading = isLoadingOrg || isLoadingAds;

  // Build lookup maps for hierarchy
  const campaignNamesMap = useMemo(() => 
    new Map(Object.entries(adPerformanceData?.campaignNames || {})),
    [adPerformanceData?.campaignNames]
  );
  const adsetNamesMap = useMemo(() => 
    new Map(Object.entries(adPerformanceData?.adsetNames || {})),
    [adPerformanceData?.adsetNames]
  );

  // Aggregate data into hierarchy
  const { campaigns, adsets, ads } = useAdHierarchy({
    ads: adPerformanceData?.ads || [],
    campaignNames: campaignNamesMap,
    adsetNames: adsetNamesMap,
  });

  // Filter adsets by selected campaigns
  const filteredAdsets = useMemo(() => {
    if (selectedCampaigns.length === 0) return adsets;
    return adsets.filter((adset) => selectedCampaigns.includes(adset.campaign_id));
  }, [adsets, selectedCampaigns]);

  // Filter ads by selected campaigns or adsets
  const filteredAds = useMemo(() => {
    let result = ads;
    
    if (selectedAdsets.length > 0) {
      result = result.filter((ad) => selectedAdsets.includes(ad.adset_id || ''));
    } else if (selectedCampaigns.length > 0) {
      result = result.filter((ad) => selectedCampaigns.includes(ad.campaign_id));
    }
    
    return result;
  }, [ads, selectedCampaigns, selectedAdsets]);

  // Process, filter, and search ads for display
  const processedAds = useMemo(() => {
    let filtered = filteredAds;

    // Filter by status (default: ALL)
    if (statusFilter !== 'all') {
      filtered = filtered.filter((ad) => ad.status === statusFilter);
    }

    // Filter by min spend
    filtered = filterByMinSpend(filtered, minSpendFilter);

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((ad) =>
        (ad.ad_copy_headline?.toLowerCase().includes(query)) ||
        (ad.ad_copy_primary_text?.toLowerCase().includes(query)) ||
        (ad.refcode?.toLowerCase().includes(query)) ||
        (ad.ad_id?.toLowerCase().includes(query)) ||
        (ad.topic?.toLowerCase().includes(query))
      );
    }

    // Sort
    return sortAds(filtered, sortField, sortDirection);
  }, [filteredAds, statusFilter, minSpendFilter, searchQuery, sortField, sortDirection]);

  // Deduplicate ads by ad_id to prevent rendering duplicates
  const deduplicatedAds = useMemo(() => {
    const seen = new Set<string>();
    return processedAds.filter((ad) => {
      const key = ad.ad_id || ad.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [processedAds]);

  // State detection for UI
  const hasData = !isLoading && !error && adPerformanceData?.ads && adPerformanceData.ads.length > 0;
  const showNoDataEmptyState = !isLoading && !error && (!adPerformanceData?.ads || adPerformanceData.ads.length === 0);
  const showEstimatedDistributionBanner = hasData && adPerformanceData?.isEstimatedDistribution;
  const showUnattributedDonationsBanner = hasData && adPerformanceData?.hasUnattributedDonations;

  // Calculate attributed donors for display
  const attributedDonors = useMemo(() => {
    return deduplicatedAds.reduce((sum, ad) => sum + ad.unique_donors, 0);
  }, [deduplicatedAds]);

  // Build breadcrumbs based on current navigation state
  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const crumbs: BreadcrumbItem[] = [
      { level: 'campaign', name: 'All Campaigns' },
    ];

    if (hierarchyLevel === 'adset' || hierarchyLevel === 'ad') {
      if (selectedCampaigns.length === 1) {
        const campaign = campaigns.find((c) => c.campaign_id === selectedCampaigns[0]);
        crumbs.push({
          level: 'adset',
          id: selectedCampaigns[0],
          name: campaign?.campaign_name || 'Campaign',
        });
      } else if (selectedCampaigns.length > 1) {
        crumbs.push({
          level: 'adset',
          name: `${selectedCampaigns.length} Campaigns`,
        });
      }
    }

    if (hierarchyLevel === 'ad') {
      if (selectedAdsets.length === 1) {
        const adset = adsets.find((a) => a.adset_id === selectedAdsets[0]);
        crumbs.push({
          level: 'ad',
          id: selectedAdsets[0],
          name: adset?.adset_name || 'Ad Set',
        });
      } else if (selectedAdsets.length > 1) {
        crumbs.push({
          level: 'ad',
          name: `${selectedAdsets.length} Ad Sets`,
        });
      } else if (selectedCampaigns.length > 0) {
        crumbs.push({
          level: 'ad',
          name: 'All Ads',
        });
      }
    }

    return crumbs;
  }, [hierarchyLevel, selectedCampaigns, selectedAdsets, campaigns, adsets]);

  // Handle breadcrumb navigation
  const handleBreadcrumbNavigate = useCallback((level: HierarchyLevel, id?: string) => {
    if (level === 'campaign') {
      setHierarchyLevel('campaign');
      setSelectedCampaigns([]);
      setSelectedAdsets([]);
    } else if (level === 'adset') {
      setHierarchyLevel('adset');
      setSelectedAdsets([]);
    }
  }, []);

  // Handle level tab change
  const handleLevelChange = useCallback((level: HierarchyLevel) => {
    setHierarchyLevel(level);
    // Clear selections when going back to a higher level
    if (level === 'campaign') {
      setSelectedCampaigns([]);
      setSelectedAdsets([]);
    } else if (level === 'adset') {
      setSelectedAdsets([]);
    }
  }, []);

  // Handle campaign selection
  const handleCampaignSelect = useCallback((campaignId: string, selected: boolean) => {
    setSelectedCampaigns((prev) =>
      selected ? [...prev, campaignId] : prev.filter((id) => id !== campaignId)
    );
  }, []);

  // Handle campaign drill-down
  const handleCampaignDrillDown = useCallback((campaignId: string) => {
    setSelectedCampaigns([campaignId]);
    setHierarchyLevel('adset');
  }, []);

  // Handle adset selection
  const handleAdsetSelect = useCallback((adsetId: string, selected: boolean) => {
    setSelectedAdsets((prev) =>
      selected ? [...prev, adsetId] : prev.filter((id) => id !== adsetId)
    );
  }, []);

  // Handle adset drill-down
  const handleAdsetDrillDown = useCallback((adsetId: string) => {
    setSelectedAdsets([adsetId]);
    setHierarchyLevel('ad');
  }, []);

  // Render the appropriate content based on hierarchy level
  const renderHierarchyContent = () => {
    switch (hierarchyLevel) {
      case 'campaign':
        return (
          <div className="space-y-2">
            {campaigns.length === 0 ? (
              <p className="text-center text-[hsl(var(--portal-text-muted))] py-8">
                No campaigns found
              </p>
            ) : (
              campaigns.map((campaign) => (
                <CampaignRow
                  key={campaign.campaign_id}
                  campaign={campaign}
                  isSelected={selectedCampaigns.includes(campaign.campaign_id)}
                  onSelect={handleCampaignSelect}
                  onDrillDown={handleCampaignDrillDown}
                />
              ))
            )}
          </div>
        );

      case 'adset':
        return (
          <div className="space-y-2">
            {filteredAdsets.length === 0 ? (
              <p className="text-center text-[hsl(var(--portal-text-muted))] py-8">
                No ad sets found
              </p>
            ) : (
              filteredAdsets.map((adset) => (
                <AdSetRow
                  key={adset.adset_id}
                  adset={adset}
                  isSelected={selectedAdsets.includes(adset.adset_id)}
                  onSelect={handleAdsetSelect}
                  onDrillDown={handleAdsetDrillDown}
                />
              ))
            )}
          </div>
        );

      case 'ad':
        return (
          <AdPerformanceList
            ads={deduplicatedAds}
            isEstimatedDistribution={adPerformanceData?.isEstimatedDistribution}
          />
        );

      default:
        return null;
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {/* Skeleton for Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-[hsl(var(--portal-bg-secondary))]">
                <CardContent className="p-3">
                  <div className="h-10 bg-[hsl(var(--portal-bg-tertiary))] rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Skeleton for List */}
          <AdPerformanceList isLoading={true} />
        </div>
      );
    }

    if (error) {
      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <h3 className="mt-4 text-xl font-semibold text-[hsl(var(--portal-text-primary))]">
              Error Loading Data
            </h3>
            <p className="text-[hsl(var(--portal-text-muted))] mt-2 max-w-md mx-auto">
              {error.message || 'An unexpected error occurred while fetching ad performance data.'}
            </p>
            <Button className="mt-6" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (showNoDataEmptyState) {
      return (
        <Card className="bg-[hsl(var(--portal-bg-secondary))]">
          <CardContent className="p-8 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-[hsl(var(--portal-text-muted))]" />
            <h3 className="mt-4 text-xl font-semibold text-[hsl(var(--portal-text-primary))]">
              No Ad Performance Data
            </h3>
            <p className="text-[hsl(var(--portal-text-muted))] mt-2 max-w-md mx-auto">
              There is no ad performance data available for the selected date range.
            </p>
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-[hsl(var(--portal-text-secondary))]">Suggestions:</p>
              <ul className="text-sm list-disc list-inside text-[hsl(var(--portal-text-muted))] inline-block text-left">
                <li>Try expanding the date range using the controls above.</li>
                <li>Check your Meta ad account connection status.</li>
                <li>Ensure you have active or recent campaigns.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Estimated Distribution Warning - HIGH PRIORITY */}
        {showEstimatedDistributionBanner && (
          <Card className="border-orange-500/50 bg-orange-500/5">
            <CardContent className="p-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-[hsl(var(--portal-text-primary))]">
                  Estimated Metrics
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                  Ad-level data is still syncing. Spend, impressions, and CTR shown below are{' '}
                  <strong>campaign-level estimates</strong> distributed across ads. True per-ad metrics will appear after the next sync.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unattributed Donations Warning */}
        {showUnattributedDonationsBanner && adPerformanceData?.unattributedRaised > 0 && (
          <Card className="border-blue-500/50 bg-blue-500/5">
            <CardContent className="p-3 flex items-start gap-3">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-[hsl(var(--portal-text-primary))]">
                  Unattributed Donations: {formatCurrency(adPerformanceData.unattributedRaised)}
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                  {adPerformanceData.unattributedDonationCount} donation(s) in this period couldn't be matched to specific ads.
                  Per-ad "Raised" may be lower than total fundraising.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attribution Quality Warning */}
        {adPerformanceData?.attributionFallbackMode && (
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="p-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm text-[hsl(var(--portal-text-primary))]">
                  Attribution Quality Notice
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                  No direct click or refcode attribution found. Results use modeled attribution.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards - Compact */}
        {adPerformanceData?.totals && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="bg-[hsl(var(--portal-bg-secondary))]">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-[hsl(var(--portal-text-muted))] mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">Total Spend</span>
                </div>
                <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                  {formatCurrency(adPerformanceData.totals.total_spend)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[hsl(var(--portal-bg-secondary))]">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-[hsl(var(--portal-text-muted))] mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">Net Raised</span>
                </div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(adPerformanceData.totals.total_raised)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[hsl(var(--portal-bg-secondary))]">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-[hsl(var(--portal-text-muted))] mb-1">
                  <Target className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">Overall ROAS</span>
                </div>
                <div className={cn('text-lg font-bold', getRoasColor(adPerformanceData.totals.total_roas))}>
                  {formatRoas(adPerformanceData.totals.total_roas)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[hsl(var(--portal-bg-secondary))]">
              <CardContent className="p-3">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-[hsl(var(--portal-text-muted))] mb-1 cursor-help">
                        <Users className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium uppercase tracking-wide">Donors (Period)</span>
                        <HelpCircle className="h-3 w-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px]">
                      <p className="text-xs">
                        <strong>Total:</strong> {adPerformanceData.totals.unique_donors} unique donors in period<br />
                        <strong>Attributed:</strong> {attributedDonors} matched to specific ads<br />
                        <span className="text-[hsl(var(--portal-text-muted))]">
                          Difference may be from untracked sources or attribution gaps.
                        </span>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                  {adPerformanceData.totals.unique_donors.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[hsl(var(--portal-bg-secondary))]">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 text-[hsl(var(--portal-text-muted))] mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">Avg CPA</span>
                </div>
                <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                  {formatCurrency(adPerformanceData.totals.avg_cpa)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[hsl(var(--portal-bg-secondary))]">
              <CardContent className="p-3">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-[hsl(var(--portal-text-muted))] mb-1 cursor-help">
                        <BarChart3 className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium uppercase tracking-wide">Link CTR</span>
                        <HelpCircle className="h-3 w-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px]">
                      <p className="text-xs">
                        <strong>Link CTR</strong> measures clicks to destination URL (outbound clicks), 
                        not all clicks on the ad. This is the industry standard for conversion-focused campaigns.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                  {formatPercentage(adPerformanceData.totals.avg_ctr)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Hierarchy Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <HierarchyBreadcrumb
            breadcrumbs={breadcrumbs}
            onNavigate={handleBreadcrumbNavigate}
          />
          <HierarchyLevelTabs
            activeLevel={hierarchyLevel}
            onLevelChange={handleLevelChange}
            campaignCount={campaigns.length}
            adsetCount={filteredAdsets.length}
            adCount={deduplicatedAds.length}
            selectedCampaigns={selectedCampaigns}
            selectedAdsets={selectedAdsets}
          />
        </div>

        {/* Filters Toolbar - Sticky (only show on Ad level) */}
        {hierarchyLevel === 'ad' && (
          <div className="sticky top-0 z-10 bg-[hsl(var(--portal-bg-primary))] py-3 -mx-6 px-6 border-b border-[hsl(var(--portal-border))]">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                <Input
                  type="text"
                  placeholder="Search ads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    'pl-9 h-9',
                    'bg-[hsl(var(--portal-bg-secondary))]',
                    'border-[hsl(var(--portal-border))]',
                    'text-sm',
                    'placeholder:text-[hsl(var(--portal-text-muted))]',
                    'focus-visible:ring-[hsl(var(--portal-accent-blue)/0.3)]'
                  )}
                />
              </div>

              {/* Filters Group */}
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />

                {/* Status Filter */}
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                  <SelectTrigger
                    className={cn(
                      'h-9 w-[100px] text-xs',
                      'bg-[hsl(var(--portal-bg-secondary))]',
                      'border-[hsl(var(--portal-border))]',
                      statusFilter !== 'all' && 'border-[hsl(var(--portal-accent-blue))]'
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>

                {/* Min Spend Filter */}
                <Select
                  value={String(minSpendFilter)}
                  onValueChange={(value) => setMinSpendFilter(Number(value))}
                >
                  <SelectTrigger
                    className={cn(
                      'h-9 w-[90px] text-xs',
                      'bg-[hsl(var(--portal-bg-secondary))]',
                      'border-[hsl(var(--portal-border))]',
                      minSpendFilter > 0 && 'border-[hsl(var(--portal-accent-blue))]'
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Spend</SelectItem>
                    <SelectItem value="10">$10+</SelectItem>
                    <SelectItem value="50">$50+</SelectItem>
                    <SelectItem value="100">$100+</SelectItem>
                    <SelectItem value="500">$500+</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort */}
                <Select
                  value={sortField}
                  onValueChange={(value) => setSortField(value as SortField)}
                >
                  <SelectTrigger className="h-9 w-[90px] text-xs bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spend">Spend</SelectItem>
                    <SelectItem value="raised">Raised</SelectItem>
                    <SelectItem value="roas">ROAS</SelectItem>
                    <SelectItem value="cpa">CPA</SelectItem>
                    <SelectItem value="ctr">CTR</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={sortDirection}
                  onValueChange={(value) => setSortDirection(value as SortDirection)}
                >
                  <SelectTrigger className="h-9 w-[80px] text-xs bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">High</SelectItem>
                    <SelectItem value="asc">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Results count */}
              <span className="text-xs text-[hsl(var(--portal-text-muted))] ml-auto">
                {deduplicatedAds.length} of {adPerformanceData?.ads?.length || 0} ads
              </span>
            </div>
          </div>
        )}

        {/* Render content based on hierarchy level */}
        {renderHierarchyContent()}
      </div>
    );
  };

  return (
    <ProductionGate
      title="Ad Performance"
      description="Granular ad performance analytics are coming soon. We're working on bringing you detailed campaign insights."
      icon={BarChart3}
    >
      <ClientLayout showDateControls={false}>
        <div className="container mx-auto p-6 space-y-4">
          {/* Header with V3 Date Range Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                Ad Performance
              </h1>
              <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
                Campaign → Ad Set → Ad drill-down with ActBlue attribution
              </p>
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-3">
              <DateRangeSelector
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onDateChange={(start, end) => useDashboardStore.getState().setDateRange(start, end)}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isLoading}
                className="h-9 w-9 shrink-0"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {renderContent()}
        </div>
      </ClientLayout>
    </ProductionGate>
  );
}
