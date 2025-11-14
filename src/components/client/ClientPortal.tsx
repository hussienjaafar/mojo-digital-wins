import { lazy, Suspense, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  MessageSquare, 
  TrendingUp, 
  Download, 
  RefreshCw,
  Filter,
  DollarSign,
  Target,
  Activity,
  Calendar
} from "lucide-react";
import { FilterProvider, useFilters } from "@/contexts/FilterContext";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";
import { useRealtimeMetrics } from "@/hooks/useRealtimeMetrics";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Lazy load analytics components
const ExecutiveDashboard = lazy(() => import("@/components/client/ExecutiveDashboard"));
const EnhancedSMSMetrics = lazy(() => import("@/components/client/EnhancedSMSMetrics"));
const EnhancedMetaAdsMetrics = lazy(() => import("@/components/client/EnhancedMetaAdsMetrics"));

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
    <Skeleton className="h-96 w-full" />
  </div>
);

const SummaryCards = () => {
  const { organizationId, startDate, endDate } = useFilters();
  const { metaMetrics, smsMetrics, transactions, isLoading } = useRealtimeMetrics(
    organizationId,
    startDate,
    endDate
  );

  const totalSpend = 
    metaMetrics.reduce((sum, m) => sum + Number(m.spend || 0), 0) +
    smsMetrics.reduce((sum, m) => sum + Number(m.cost || 0), 0);
  
  const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
  const totalConversions = transactions.length;

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground">Combined Meta + SMS</p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground">From donations</p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total ROI</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{roi.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            {roi > 0 ? 'Profitable' : roi < 0 ? 'Loss' : 'Break-even'}
          </p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Conversions</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalConversions.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Total donations</p>
        </CardContent>
      </Card>
    </div>
  );
};

const ClientPortalContent = () => {
  const { organizationId, startDate, endDate, updateDateRange } = useFilters();
  const [activeTab, setActiveTab] = useState("overview");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleExport = () => {
    // TODO: Implement unified export
    console.log("Exporting data...");
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const FilterControls = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Date Range
        </label>
        <DateRangeSelector
          startDate={startDate}
          endDate={endDate}
          onDateChange={updateDateRange}
          className="w-full"
        />
      </div>
      <div className="text-xs text-muted-foreground">
        Showing data from {format(new Date(startDate), 'MMM d, yyyy')} to {format(new Date(endDate), 'MMM d, yyyy')}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Unified performance insights
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {!isMobile && <FilterControls />}
              
              <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size={isMobile ? "icon" : "default"}>
                    <Filter className="h-4 w-4" />
                    {!isMobile && <span className="ml-2">Filters</span>}
                  </Button>
                </SheetTrigger>
                <SheetContent side={isMobile ? "bottom" : "right"}>
                  <SheetHeader>
                    <SheetTitle>Analytics Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterControls />
                  </div>
                </SheetContent>
              </Sheet>

              <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Button variant="default" size={isMobile ? "icon" : "default"} onClick={handleExport}>
                <Download className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Export</span>}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="mb-6">
          <SummaryCards />
        </div>

        {/* Tabbed Analytics */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={cn(
            "grid w-full",
            isMobile ? "grid-cols-3 sticky bottom-4 z-30 shadow-lg" : "grid-cols-3 mb-6"
          )}>
            <TabsTrigger value="overview" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              {!isMobile && "Overview"}
            </TabsTrigger>
            <TabsTrigger value="meta-ads" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              {!isMobile && "Meta Ads"}
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              {!isMobile && "SMS"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <Suspense fallback={<LoadingSkeleton />}>
              {organizationId ? (
                <ExecutiveDashboard
                  organizationId={organizationId}
                  startDate={startDate}
                  endDate={endDate}
                />
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                      <p className="text-muted-foreground">Please select an organization to view analytics</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </Suspense>
          </TabsContent>

          <TabsContent value="meta-ads" className="mt-6">
            <Suspense fallback={<LoadingSkeleton />}>
              {organizationId ? (
                <EnhancedMetaAdsMetrics
                  organizationId={organizationId}
                  startDate={startDate}
                  endDate={endDate}
                />
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                      <p className="text-muted-foreground">Please select an organization to view Meta Ads analytics</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </Suspense>
          </TabsContent>

          <TabsContent value="sms" className="mt-6">
            <Suspense fallback={<LoadingSkeleton />}>
              {organizationId ? (
                <EnhancedSMSMetrics
                  organizationId={organizationId}
                  startDate={startDate}
                  endDate={endDate}
                />
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                      <p className="text-muted-foreground">Please select an organization to view SMS analytics</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default function ClientPortal() {
  return (
    <FilterProvider>
      <ClientPortalContent />
    </FilterProvider>
  );
}
