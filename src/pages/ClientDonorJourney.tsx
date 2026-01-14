import { useMemo, useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart3,
  Users,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Trophy,
  Heart,
  Sparkles,
  GitBranch,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Link,
  Search,
  Shuffle,
  Target,
} from "lucide-react";
import { ProductionGate } from "@/components/client/ProductionGate";
import { ClientShell } from "@/components/client/ClientShell";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useRefcodePerformance } from "@/hooks/useRefcodePerformance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  V3PageContainer,
  V3KPICard,
  V3ChartWrapper,
  V3LoadingState,
  V3EmptyState,
  V3Button,
  V3Card,
  V3CardHeader,
  V3CardTitle,
  V3CardContent,
} from "@/components/v3";
import { RefcodePerformanceTable } from "@/components/analytics/RefcodePerformanceTable";
import { RevenueByChannelChart } from "@/components/analytics/RevenueByChannelChart";
import { RetentionMetricsCard } from "@/components/analytics/RetentionMetricsCard";
import { TopRefcodesByLTVCard } from "@/components/analytics/TopRefcodesByLTVCard";
// CRITICAL: Single source of truth for attribution classification
import { isTruthMapping, getTruthRefcodeSet, filterHeuristicMappings, calculateAttributionCounts } from "@/utils/attributionTruth";

// ============================================================================
// Types for Attribution Management
// ============================================================================

interface Attribution {
  id: string;
  refcode: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  meta_campaign_id: string | null;
  switchboard_campaign_id: string | null;
  match_confidence: number | null;
  is_auto_matched: boolean | null;
  is_deterministic: boolean | null;
  attribution_type: string | null;
  match_reason: string | null;
  attributed_revenue: number | null;
  attributed_transactions: number | null;
  created_at: string | null;
}

interface SuggestedMatch {
  refcode: string;
  revenue: number;
  transactions: number;
  suggested_campaign: string;
  match_type: 'pattern' | 'fuzzy';
  reason: string;
}

// ============================================================================
// Match Type Badge Component (replaces confidence %)
// ============================================================================

const MatchTypeBadge = ({ attribution }: { attribution: Attribution }) => {
  const type = attribution.attribution_type;
  
  // =========================================================================
  // TRUTH TYPES: deterministic_url_refcode + manual_confirmed
  // These are included in KPI totals and shown with green/blue badges
  // =========================================================================
  
  // Deterministic URL matches (green) - URL-proven
  if (type === 'deterministic_url_refcode') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
              <Link className="h-3 w-3" />
              Exact URL Match
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-semibold">Deterministic Attribution (Truth)</p>
            <p className="text-xs text-muted-foreground mt-1">
              Refcode was found in Meta creative destination URL. This is a verified, traceable link.
            </p>
            <p className="text-xs text-green-400 mt-1">✓ Included in KPI totals</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Manual confirmations (blue) - Human-verified
  if (type === 'manual_confirmed') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Manual Confirmed
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-semibold">Manually Verified (Truth)</p>
            <p className="text-xs text-muted-foreground mt-1">
              This mapping was verified by a human analyst.
            </p>
            <p className="text-xs text-blue-400 mt-1">✓ Included in KPI totals</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // =========================================================================
  // HEURISTIC TYPES: Excluded from KPI totals, shown as suggestions
  // =========================================================================
  
  if (type === 'heuristic_partial_url') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 flex items-center gap-1">
              <Search className="h-3 w-3" />
              Partial Match
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-semibold">Heuristic - Partial URL Match</p>
            <p className="text-xs text-muted-foreground mt-1">
              Refcode partially matches a URL parameter. Verify in Meta creative URL.
            </p>
            <p className="text-xs text-yellow-400 mt-1">⚠ Not included in KPI totals</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (type === 'heuristic_pattern') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 flex items-center gap-1">
              <Target className="h-3 w-3" />
              Pattern Inferred
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-semibold">Heuristic - Pattern Match</p>
            <p className="text-xs text-muted-foreground mt-1">
              Matched based on naming patterns. Verify in Meta creative URL / naming.
            </p>
            <p className="text-xs text-orange-400 mt-1">⚠ Not included in KPI totals</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (type === 'heuristic_fuzzy') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 flex items-center gap-1">
              <Shuffle className="h-3 w-3" />
              Directional
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-semibold">Directional Only</p>
            <p className="text-xs text-muted-foreground mt-1">
              Fuzzy name similarity. Use for directional insights only, not precise measurement.
            </p>
            <p className="text-xs text-gray-400 mt-1">⚠ Not included in KPI totals</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Legacy deterministic_refcode (non-URL) - treat as heuristic until reclassified
  if (type === 'deterministic_refcode') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Legacy Match
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-semibold">Legacy Deterministic (Non-URL)</p>
            <p className="text-xs text-muted-foreground mt-1">
              This mapping predates URL-based verification. Consider re-verifying.
            </p>
            <p className="text-xs text-amber-400 mt-1">⚠ Not included in KPI totals until verified</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Unknown types
  return <Badge variant="outline">Unknown</Badge>;
};

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const inferCampaign = (refcode: string): string => {
  const code = refcode.toLowerCase();
  if (code.includes("meta") || code.includes("fb") || code.includes("facebook")) {
    return "Meta Ads Campaign";
  }
  if (code.includes("sms") || code.includes("text")) {
    return "SMS Campaign";
  }
  if (code.includes("email") || code.includes("em_")) {
    return "Email Campaign";
  }
  return "Unknown Source";
};

const getMatchTypeFromPattern = (refcode: string): 'pattern' | 'fuzzy' => {
  const code = refcode.toLowerCase();
  if (code.includes("meta_") || code.includes("fb_") || code.includes("sms_")) {
    return 'pattern';
  }
  return 'fuzzy';
};

const generateReason = (refcode: string): string => {
  const code = refcode.toLowerCase();
  if (code.includes("meta") || code.includes("fb")) {
    return "Refcode contains Meta/Facebook identifier";
  }
  if (code.includes("sms")) {
    return "Refcode indicates SMS channel";
  }
  return "Pattern-based suggestion";
};

// ============================================================================
// Suggestion Match Type Badge
// ============================================================================

const SuggestionBadge = ({ matchType }: { matchType: 'pattern' | 'fuzzy' }) => {
  if (matchType === 'pattern') {
    return (
      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
        Pattern Inferred
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
      Directional
    </Badge>
  );
};

// ============================================================================
// Main Page Component
// ============================================================================

const ClientDonorJourney = () => {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();

  // Analytics data
  const {
    data,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useRefcodePerformance(organizationId);

  // Attribution management state
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [suggestedMatches, setSuggestedMatches] = useState<SuggestedMatch[]>([]);
  const [isLoadingAttribution, setIsLoadingAttribution] = useState(false);
  const [isRunningMatcher, setIsRunningMatcher] = useState(false);
  const [attributionStats, setAttributionStats] = useState({
    matchedRevenue: 0,
    unmatchedRevenue: 0,
    matchRate: 0,
    deterministicCount: 0,
    heuristicCount: 0,
  });
  const [lastMatcherRun, setLastMatcherRun] = useState<{
    started_at: string | null;
    finished_at: string | null;
    matches_deterministic: number;
    matches_heuristic_partial: number;
    matches_heuristic_pattern: number;
    matches_heuristic_fuzzy: number;
    total_matches: number;
    unmatched_count: number;
  } | null>(null);

  // Load attribution data when organization is available
  useEffect(() => {
    if (organizationId) {
      loadAttributions();
    }
  }, [organizationId]);

  const loadAttributions = async () => {
    if (!organizationId) return;
    setIsLoadingAttribution(true);

    try {
      // Load existing attributions with new fields
      const { data: attrData, error: attrError } = await supabase
        .from("campaign_attribution")
        .select("*")
        .eq("organization_id", organizationId)
        .order("attributed_revenue", { ascending: false, nullsFirst: false });

      if (attrError) throw attrError;
      setAttributions(attrData || []);

      // =========================================================================
      // TRUTH MAPPING: Use centralized helper for consistent classification
      // Truth = deterministic_url_refcode OR manual_confirmed
      // Heuristics = partial/pattern/fuzzy (excluded from default KPIs)
      // =========================================================================
      const attrCounts = calculateAttributionCounts(attrData || []);

      // Calculate stats from ActBlue transactions
      const { data: txData } = await supabase
        .from("actblue_transactions")
        .select("amount, refcode")
        .eq("organization_id", organizationId);

      if (txData) {
        const totalRevenue = txData.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        
        // TRUTH TOTALS: Use centralized helper - only deterministic_url_refcode + manual_confirmed
        const truthRefcodes = getTruthRefcodeSet(attrData || []);
        
        // Calculate revenue only from TRUTH matches (not heuristics)
        const matchedRevenue = txData
          .filter(tx => tx.refcode && truthRefcodes.has(tx.refcode.toLowerCase()))
          .reduce((sum, tx) => sum + (tx.amount || 0), 0);
        
        // Heuristic revenue (for display but NOT included in default KPIs)
        const heuristicMappings = filterHeuristicMappings(attrData || []);
        const heuristicRefcodes = new Set(
          heuristicMappings
            .map(a => a.refcode?.toLowerCase())
            .filter((r): r is string => Boolean(r))
        );
        const heuristicRevenue = txData
          .filter(tx => tx.refcode && heuristicRefcodes.has(tx.refcode.toLowerCase()))
          .reduce((sum, tx) => sum + (tx.amount || 0), 0);

        setAttributionStats({
          matchedRevenue, // TRUTH only: deterministic_url_refcode + manual_confirmed
          unmatchedRevenue: totalRevenue - matchedRevenue - heuristicRevenue,
          matchRate: totalRevenue > 0 ? (matchedRevenue / totalRevenue) * 100 : 0,
          deterministicCount: attrCounts.truthCount, // Truth count
          heuristicCount: attrCounts.heuristicCount,
        });
      }

      // Load last matcher run from audit log (Gate C)
      const { data: lastRun } = await supabase
        .from("attribution_matcher_runs")
        .select("started_at, finished_at, matches_deterministic, matches_heuristic_partial, matches_heuristic_pattern, matches_heuristic_fuzzy, total_matches, unmatched_count")
        .eq("organization_id", organizationId)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (lastRun) {
        setLastMatcherRun(lastRun);
      }

      // Find unmatched refcodes for suggestions
      await loadSuggestedMatches();
    } catch (error) {
      console.error("Error loading attributions:", error);
      toast.error("Failed to load attribution data");
    } finally {
      setIsLoadingAttribution(false);
    }
  };

  const loadSuggestedMatches = async () => {
    if (!organizationId) return;

    try {
      const { data: unmatchedData } = await supabase
        .from("actblue_transactions")
        .select("refcode, amount")
        .eq("organization_id", organizationId)
        .not("refcode", "is", null);

      if (!unmatchedData) return;

      const refcodeStats = unmatchedData.reduce((acc, tx) => {
        const code = tx.refcode?.toLowerCase() || "";
        if (!code) return acc;
        
        if (!acc[code]) {
          acc[code] = { revenue: 0, transactions: 0 };
        }
        acc[code].revenue += tx.amount || 0;
        acc[code].transactions += 1;
        return acc;
      }, {} as Record<string, { revenue: number; transactions: number }>);

      const { data: existingAttr } = await supabase
        .from("campaign_attribution")
        .select("refcode")
        .eq("organization_id", organizationId);

      const existingRefcodes = new Set((existingAttr || []).map(a => a.refcode?.toLowerCase()).filter(Boolean));

      const suggestions: SuggestedMatch[] = Object.entries(refcodeStats)
        .filter(([code]) => !existingRefcodes.has(code))
        .filter(([_, stats]) => stats.revenue > 100)
        .map(([code, stats]) => ({
          refcode: code,
          revenue: stats.revenue,
          transactions: stats.transactions,
          suggested_campaign: inferCampaign(code),
          match_type: getMatchTypeFromPattern(code),
          reason: generateReason(code),
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      setSuggestedMatches(suggestions);
    } catch (error) {
      console.error("Error loading suggestions:", error);
    }
  };

  const runAutoMatcher = async () => {
    setIsRunningMatcher(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-match-attribution", {
        body: { organizationId, dryRun: false },
      });

      if (error) throw error;

      const summary = data?.summary || {};
      const deterministicCount = summary.matchBreakdown?.deterministic_url_exact || 0;
      const heuristicCount = (summary.totalMatched || 0) - deterministicCount;
      
      toast.success(
        `Created ${summary.totalMatched || 0} matches (${deterministicCount} deterministic, ${heuristicCount} heuristic)`
      );
      await loadAttributions();
    } catch (error) {
      console.error("Error running auto-matcher:", error);
      toast.error("Failed to run auto-matcher");
    } finally {
      setIsRunningMatcher(false);
    }
  };

  // Confirm a suggested match manually
  const confirmSuggestion = async (suggestion: SuggestedMatch) => {
    if (!organizationId) return;
    
    try {
      const { error } = await supabase
        .from("campaign_attribution")
        .insert({
          organization_id: organizationId,
          refcode: suggestion.refcode,
          utm_source: suggestion.suggested_campaign.toLowerCase().includes('meta') ? 'facebook' : 
                      suggestion.suggested_campaign.toLowerCase().includes('sms') ? 'sms' : 'manual',
          match_confidence: 1.0,
          is_auto_matched: false,
          match_reason: `Manually confirmed: ${suggestion.reason}`,
          attributed_revenue: suggestion.revenue,
          attributed_transactions: suggestion.transactions,
          is_deterministic: false, // Manual confirmations are not URL-based
          attribution_type: 'manual_confirmed'
        });

      if (error) throw error;
      
      toast.success(`Confirmed mapping for ${suggestion.refcode}`);
      // Remove from suggestions and reload
      setSuggestedMatches(prev => prev.filter(s => s.refcode !== suggestion.refcode));
      await loadAttributions();
    } catch (error) {
      console.error("Error confirming suggestion:", error);
      toast.error("Failed to confirm mapping");
    }
  };

  // Derived stats
  const stats = useMemo(() => {
    if (!data) return null;
    
    const totalRevenue = data.refcodes.reduce((sum, r) => sum + r.totalRevenue, 0);
    const totalDonations = data.refcodes.reduce((sum, r) => sum + r.donationCount, 0);
    const avgGift = totalDonations > 0 ? totalRevenue / totalDonations : 0;
    
    return {
      totalRevenue,
      totalDonations,
      avgGift,
      totalDonors: data.retention.totalDonors,
      repeatRate: data.retention.repeatRate,
      recurringRate: data.retention.recurringRate,
    };
  }, [data]);

  const handleRefresh = async () => {
    try {
      await Promise.all([refetch(), loadAttributions()]);
      toast.success("Data refreshed");
    } catch {
      toast.error("Failed to refresh data");
    }
  };

  // Loading state
  if (orgLoading || !organizationId) {
    return (
      <ClientShell pageTitle="Attribution & Performance" showDateControls={false}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ClientShell>
    );
  }

  if (isLoading) {
    return (
      <ClientShell pageTitle="Attribution & Performance" showDateControls={false}>
        <V3PageContainer
          icon={GitBranch}
          title="Attribution & Performance"
          description="Track campaign performance and manage attribution mappings"
        >
          <V3LoadingState variant="kpi-grid" count={4} />
          <div className="mt-6">
            <V3LoadingState variant="chart" height={300} />
          </div>
        </V3PageContainer>
      </ClientShell>
    );
  }

  if (error) {
    return (
      <ClientShell pageTitle="Attribution & Performance" showDateControls={false}>
        <V3PageContainer
          icon={GitBranch}
          title="Attribution & Performance"
          description="Track campaign performance and manage attribution mappings"
        >
          <V3EmptyState
            title="Failed to Load Data"
            description={error?.message || "An error occurred while loading data"}
            accent="red"
          />
        </V3PageContainer>
      </ClientShell>
    );
  }

  return (
    <ClientShell pageTitle="Attribution & Performance" showDateControls={false}>
      <ProductionGate
        title="Attribution & Performance"
        description="Track donor journeys from first touch to conversion with multi-channel attribution modeling."
        icon={GitBranch}
      >
      <V3PageContainer
        icon={GitBranch}
        title="Attribution & Performance"
        description="Track which campaigns drive donations and manage attribution mappings"
        actions={
          <V3Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </V3Button>
        }
      >
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <V3KPICard
            icon={DollarSign}
            label="Total Revenue"
            value={`$${(stats?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            subtitle="All attributed donations"
            accent="green"
          />
          <V3KPICard
            icon={Users}
            label="Unique Donors"
            value={(stats?.totalDonors || 0).toLocaleString()}
            subtitle="Across all refcodes"
            accent="blue"
          />
          <V3KPICard
            icon={CheckCircle}
            label="Match Rate"
            value={`${attributionStats.matchRate.toFixed(1)}%`}
            subtitle={`${attributionStats.deterministicCount} verified links`}
            accent={attributionStats.matchRate >= 50 ? "green" : "amber"}
          />
          <V3KPICard
            icon={Heart}
            label="Recurring Rate"
            value={`${(stats?.recurringRate || 0).toFixed(0)}%`}
            subtitle="Monthly/sustaining donors"
            accent={(stats?.recurringRate || 0) >= 15 ? "green" : "purple"}
          />
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Retention Metrics */}
            <V3Card>
              <V3CardHeader>
                <V3CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Donor Retention Overview
                </V3CardTitle>
              </V3CardHeader>
              <V3CardContent>
                {data && (
                  <RetentionMetricsCard data={data.retention} isLoading={isLoading} />
                )}
              </V3CardContent>
            </V3Card>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <V3ChartWrapper
                title="Revenue by Channel"
                description="Total revenue grouped by acquisition channel"
                icon={BarChart3}
                isLoading={isLoading}
                ariaLabel="Bar chart showing revenue by channel"
              >
                {data && (
                  <RevenueByChannelChart data={data.channels} isLoading={isLoading} />
                )}
              </V3ChartWrapper>

              <V3ChartWrapper
                title="Top Sources by Recurring Rate"
                description="Which refcodes produce donors that keep giving"
                icon={Trophy}
                isLoading={isLoading}
                ariaLabel="List of top refcodes by lifetime value"
              >
                {data && (
                  <TopRefcodesByLTVCard data={data.topRefcodesByLTV} isLoading={isLoading} />
                )}
              </V3ChartWrapper>
            </div>

            {/* Refcode Performance Table */}
            <V3Card>
              <V3CardHeader>
                <V3CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Refcode Performance
                </V3CardTitle>
                <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
                  {data?.refcodes.length || 0} refcodes tracked • Sortable by any column
                </p>
              </V3CardHeader>
              <V3CardContent>
                {data && (
                  <RefcodePerformanceTable data={data.refcodes} isLoading={isLoading} />
                )}
              </V3CardContent>
            </V3Card>
          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage" className="space-y-6">
            {/* Smart Matcher Action */}
            <V3Card>
              <V3CardHeader>
                <V3CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Attribution Matcher
                  </span>
                  <V3Button
                    onClick={runAutoMatcher}
                    disabled={isRunningMatcher}
                    size="sm"
                  >
                    {isRunningMatcher ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Run Smart Matcher
                  </V3Button>
                </V3CardTitle>
                <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                  Match refcodes to Meta campaigns by analyzing ad destination URLs
                </p>
              </V3CardHeader>
              <V3CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-bg-subtle))]">
                    <p className="text-2xl font-bold text-green-500">{formatCurrency(attributionStats.matchedRevenue)}</p>
                    <p className="text-sm text-[hsl(var(--portal-text-muted))]">Attributed Revenue</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-bg-subtle))]">
                    <p className="text-2xl font-bold text-amber-500">{formatCurrency(attributionStats.unmatchedRevenue)}</p>
                    <p className="text-sm text-[hsl(var(--portal-text-muted))]">Unattributed Revenue</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-bg-subtle))]">
                    <p className="text-2xl font-bold text-green-400">{attributionStats.deterministicCount}</p>
                    <p className="text-sm text-[hsl(var(--portal-text-muted))]">Verified Links</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-[hsl(var(--portal-bg-subtle))]">
                    <p className="text-2xl font-bold text-orange-400">{attributionStats.heuristicCount}</p>
                    <p className="text-sm text-[hsl(var(--portal-text-muted))]">Inferred Matches</p>
                  </div>
                </div>

                {/* Last Matcher Run Info (Gate C requirement) */}
                {lastMatcherRun && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[hsl(var(--portal-text-muted))]">
                        Last run: {lastMatcherRun.finished_at 
                          ? formatDistanceToNow(new Date(lastMatcherRun.finished_at), { addSuffix: true })
                          : 'In progress...'}
                      </span>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-green-400">
                          {lastMatcherRun.matches_deterministic} deterministic
                        </span>
                        <span className="text-orange-400">
                          {(lastMatcherRun.matches_heuristic_partial || 0) + 
                           (lastMatcherRun.matches_heuristic_pattern || 0) + 
                           (lastMatcherRun.matches_heuristic_fuzzy || 0)} heuristic
                        </span>
                        <span className="text-gray-400">
                          {lastMatcherRun.unmatched_count} unmatched
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </V3CardContent>
            </V3Card>

            {/* Attribution Tables */}
            <Tabs defaultValue="matched" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="matched">Matched ({attributions.length})</TabsTrigger>
                <TabsTrigger value="suggestions">
                  Suggestions ({suggestedMatches.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="matched">
                <V3Card>
                  <V3CardHeader>
                    <V3CardTitle>Campaign Attribution Mappings</V3CardTitle>
                    <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                      Active mappings connecting refcodes to campaigns
                    </p>
                  </V3CardHeader>
                  <V3CardContent>
                    {isLoadingAttribution ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : attributions.length === 0 ? (
                      <V3EmptyState
                        icon={GitBranch}
                        title="No attribution mappings yet"
                        description="Run the Smart Matcher to create mappings automatically"
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Refcode</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Match Type</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Transactions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attributions.map((attr) => (
                            <TableRow key={attr.id}>
                              <TableCell className="font-mono text-sm">
                                {attr.refcode || "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {attr.utm_source || attr.meta_campaign_id || "Direct"}
                                  {attr.is_auto_matched && (
                                    <Badge variant="outline" className="text-xs">
                                      Auto
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <MatchTypeBadge attribution={attr} />
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(attr.attributed_revenue || 0)}
                              </TableCell>
                              <TableCell className="text-right">
                                {attr.attributed_transactions || 0}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </V3CardContent>
                </V3Card>
              </TabsContent>

              <TabsContent value="suggestions">
                <V3Card>
                  <V3CardHeader>
                    <V3CardTitle>Suggested Matches</V3CardTitle>
                    <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                      Unmatched refcodes that could be attributed to campaigns (requires verification)
                    </p>
                  </V3CardHeader>
                  <V3CardContent>
                    {isLoadingAttribution ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : suggestedMatches.length === 0 ? (
                      <V3EmptyState
                        icon={CheckCircle}
                        title="All matched!"
                        description="All significant refcodes have been matched"
                      />
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Refcode</TableHead>
                            <TableHead>Suggested Campaign</TableHead>
                            <TableHead>Match Type</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {suggestedMatches.map((match) => (
                            <TableRow key={match.refcode}>
                              <TableCell className="font-mono text-sm">
                                {match.refcode}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <ArrowRight className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                                  {match.suggested_campaign}
                                </div>
                                <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
                                  {match.reason}
                                </p>
                              </TableCell>
                              <TableCell>
                                <SuggestionBadge matchType={match.match_type} />
                              </TableCell>
                              <TableCell className="text-right font-medium text-green-500">
                                {formatCurrency(match.revenue)}
                              </TableCell>
                              <TableCell className="text-right">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <V3Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => confirmSuggestion(match)}
                                        className="h-7 px-2"
                                      >
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Confirm
                                      </V3Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Verify in Meta creative URL, then confirm to add to mappings</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </V3CardContent>
                </V3Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Data Freshness */}
        {dataUpdatedAt > 0 && (
          <p className="text-xs text-[hsl(var(--portal-text-muted))] text-center">
            Data updated {formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}
          </p>
        )}
      </V3PageContainer>
      </ProductionGate>
    </ClientShell>
  );
};

export default ClientDonorJourney;
