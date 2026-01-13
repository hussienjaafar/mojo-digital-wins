/**
 * ClientAdPerformance Page
 *
 * Granular Meta Ad + Message Performance page with drill-down capabilities.
 * Shows individual ad performance with ActBlue attribution data.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { ClientLayout } from '@/components/client/ClientLayout';
import { AdPerformanceList, AdPerformanceSummaryCard } from '@/components/client/AdPerformance';
import { useAdPerformanceQuery } from '@/hooks/useAdPerformanceQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  Calendar as CalendarIcon,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatRoas, formatPercentage, getRoasColor } from '@/utils/adPerformance';
import type { SortField, SortDirection } from '@/utils/adPerformance';
import { sortAds, filterByMinSpend } from '@/utils/adPerformance';

type DateRange = {
  from: Date;
  to: Date;
};

const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export default function ClientAdPerformance() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [sortField, setSortField] = useState<SortField>('spend');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [minSpendFilter, setMinSpendFilter] = useState<number>(0);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Get organization ID
  const { data: orgData, isLoading: isLoadingOrg } = useQuery({
    queryKey: ['client-organization'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: clientUser, error } = await (supabase as any)
        .from('client_users')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!clientUser) throw new Error('Client user not found');

      return { organizationId: clientUser.organization_id };
    },
  });

  useEffect(() => {
    if (orgData?.organizationId) {
      setOrganizationId(orgData.organizationId);
    }
  }, [orgData]);

  // Get ad performance data
  const {
    data: adPerformanceData,
    isLoading: isLoadingAds,
    error,
    refetch,
  } = useAdPerformanceQuery({
    organizationId: organizationId || '',
    startDate: format(dateRange.from, 'yyyy-MM-dd'),
    endDate: format(dateRange.to, 'yyyy-MM-dd'),
  });

  const isLoading = isLoadingOrg || isLoadingAds;

  // Process and filter ads
  const processedAds = adPerformanceData?.ads
    ? sortAds(
        filterByMinSpend(adPerformanceData.ads, minSpendFilter),
        sortField,
        sortDirection
      )
    : [];

  const handleDatePreset = (days: number) => {
    setDateRange({
      from: subDays(new Date(), days),
      to: new Date(),
    });
  };

  return (
    <ClientLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Ad Performance</h1>
            <p className="text-muted-foreground mt-1">
              Drill down into individual ad metrics with ActBlue attribution
            </p>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex">
                  <div className="border-r p-2 space-y-1">
                    {DATE_PRESETS.map((preset) => (
                      <Button
                        key={preset.days}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleDatePreset(preset.days)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Attribution Quality Warning */}
        {adPerformanceData?.attributionFallbackMode && (
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Attribution Quality Notice</p>
                <p className="text-sm text-muted-foreground">
                  No direct click or refcode attribution data found. Results are based on modeled
                  attribution which may be less accurate.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        {adPerformanceData?.totals && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Total Spend</span>
                </div>
                <div className="text-xl font-bold">
                  {formatCurrency(adPerformanceData.totals.total_spend)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">Total Raised</span>
                </div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(adPerformanceData.totals.total_raised)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Target className="h-4 w-4" />
                  <span className="text-xs">Overall ROAS</span>
                </div>
                <div
                  className={cn(
                    'text-xl font-bold',
                    getRoasColor(adPerformanceData.totals.total_roas)
                  )}
                >
                  {formatRoas(adPerformanceData.totals.total_roas)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Unique Donors</span>
                </div>
                <div className="text-xl font-bold">
                  {adPerformanceData.totals.unique_donors.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Avg CPA</span>
                </div>
                <div className="text-xl font-bold">
                  {formatCurrency(adPerformanceData.totals.avg_cpa)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs">Avg CTR</span>
                </div>
                <div className="text-xl font-bold">
                  {formatPercentage(adPerformanceData.totals.avg_ctr)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Attribution Quality Info */}
        {adPerformanceData?.attribution_quality && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                Attribution Quality
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Deterministic Rate:</span>{' '}
                <strong>
                  {formatPercentage(adPerformanceData.attribution_quality.deterministic_rate)}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Click Attribution:</span>{' '}
                <Badge variant="outline">
                  {adPerformanceData.attribution_quality.click_attributed}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Refcode Attribution:</span>{' '}
                <Badge variant="outline">
                  {adPerformanceData.attribution_quality.refcode_attributed}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Modeled:</span>{' '}
                <Badge variant="secondary">
                  {adPerformanceData.attribution_quality.modeled_attributed}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters & Sort */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select
              value={sortField}
              onValueChange={(value) => setSortField(value as SortField)}
            >
              <SelectTrigger className="w-32">
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
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">High to Low</SelectItem>
                <SelectItem value="asc">Low to High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Min Spend:</span>
            <Select
              value={String(minSpendFilter)}
              onValueChange={(value) => setMinSpendFilter(Number(value))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All</SelectItem>
                <SelectItem value="10">$10+</SelectItem>
                <SelectItem value="50">$50+</SelectItem>
                <SelectItem value="100">$100+</SelectItem>
                <SelectItem value="500">$500+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {processedAds.length > 0 && (
            <span className="text-sm text-muted-foreground ml-auto">
              Showing {processedAds.length} of {adPerformanceData?.ads.length || 0} ads
            </span>
          )}
        </div>

        {/* Ad List */}
        <AdPerformanceList
          ads={processedAds}
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    </ClientLayout>
  );
}
