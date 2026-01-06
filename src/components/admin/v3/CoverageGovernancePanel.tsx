import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  TrendingDown, 
  Layers,
  RefreshCw,
  ChevronRight,
  BarChart3,
  Globe,
  Rss
} from "lucide-react";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminCard } from "./AdminCard";
import { AdminStatsGrid, AdminStatItem } from "./AdminStatsGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface CoverageKPIs {
  total_sources: number;
  active_sources: number;
  inactive_sources: number;
  healthy_sources: number;
  stale_sources: number;
  failing_sources: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
  unclassified_count: number;
  rss_count: number;
  google_news_count: number;
  overall_coverage_score: number;
}

interface CoverageSummary {
  source_type: string;
  tier: string;
  tag: string;
  source_count: number;
  active_count: number;
  inactive_count: number;
  sources_with_errors: number;
  healthy_24h: number;
  stale_24h: number;
  avg_consecutive_errors: number;
  avg_expected_cadence_mins: number;
  coverage_score: number;
}

// Thresholds for coverage gaps
const COVERAGE_THRESHOLDS = {
  tier1_min: 5,
  tier2_min: 10,
  tier3_min: 20,
  healthy_percent_warning: 70,
  healthy_percent_critical: 50,
};

function getCoverageStatus(score: number): { status: 'success' | 'warning' | 'error'; label: string } {
  if (score >= COVERAGE_THRESHOLDS.healthy_percent_warning) {
    return { status: 'success', label: 'Healthy' };
  }
  if (score >= COVERAGE_THRESHOLDS.healthy_percent_critical) {
    return { status: 'warning', label: 'Stale' };
  }
  return { status: 'error', label: 'Critical' };
}

function getTierGap(tier: string, count: number): { hasGap: boolean; needed: number } {
  const thresholds: Record<string, number> = {
    tier1: COVERAGE_THRESHOLDS.tier1_min,
    tier2: COVERAGE_THRESHOLDS.tier2_min,
    tier3: COVERAGE_THRESHOLDS.tier3_min,
  };
  const threshold = thresholds[tier] || 0;
  return {
    hasGap: count < threshold,
    needed: Math.max(0, threshold - count),
  };
}

export function CoverageGovernancePanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'by-tier' | 'by-tag'>('overview');

  // Fetch KPIs
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['source-coverage-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('source_coverage_kpis')
        .select('*')
        .single();
      
      if (error) throw error;
      return data as CoverageKPIs;
    },
    staleTime: 60000, // 1 minute
  });

  // Fetch detailed coverage summary
  const { data: coverageSummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['source-coverage-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('source_coverage_summary')
        .select('*')
        .order('source_type')
        .order('tier')
        .order('tag');
      
      if (error) throw error;
      return data as CoverageSummary[];
    },
    staleTime: 60000,
  });

  const isLoading = kpisLoading || summaryLoading;

  const handleRefresh = () => {
    refetchKpis();
    refetchSummary();
  };

  // Aggregate by tier for tier view
  const tierAggregates = coverageSummary?.reduce((acc, item) => {
    const key = `${item.source_type}-${item.tier}`;
    if (!acc[key]) {
      acc[key] = {
        source_type: item.source_type,
        tier: item.tier,
        total: 0,
        active: 0,
        healthy: 0,
        stale: 0,
        errors: 0,
      };
    }
    acc[key].total += item.source_count;
    acc[key].active += item.active_count;
    acc[key].healthy += item.healthy_24h;
    acc[key].stale += item.stale_24h;
    acc[key].errors += item.sources_with_errors;
    return acc;
  }, {} as Record<string, { source_type: string; tier: string; total: number; active: number; healthy: number; stale: number; errors: number }>);

  // Get unique tags and their coverage
  const tagAggregates = coverageSummary?.reduce((acc, item) => {
    if (!acc[item.tag]) {
      acc[item.tag] = {
        tag: item.tag,
        total: 0,
        healthy: 0,
        stale: 0,
        avgScore: 0,
        scoreCount: 0,
      };
    }
    acc[item.tag].total += item.source_count;
    acc[item.tag].healthy += item.healthy_24h;
    acc[item.tag].stale += item.stale_24h;
    acc[item.tag].avgScore += item.coverage_score;
    acc[item.tag].scoreCount += 1;
    return acc;
  }, {} as Record<string, { tag: string; total: number; healthy: number; stale: number; avgScore: number; scoreCount: number }>);

  const tagList = Object.values(tagAggregates || {}).map(t => ({
    ...t,
    avgScore: t.scoreCount > 0 ? Math.round(t.avgScore / t.scoreCount) : 0,
  })).sort((a, b) => a.avgScore - b.avgScore);

  // Identify coverage gaps
  const coverageGaps: Array<{ type: string; message: string; severity: 'warning' | 'error' }> = [];
  
  if (kpis) {
    // Tier gaps
    const tier1Gap = getTierGap('tier1', kpis.tier1_count);
    const tier2Gap = getTierGap('tier2', kpis.tier2_count);
    
    if (tier1Gap.hasGap) {
      coverageGaps.push({
        type: 'Tier 1',
        message: `Need ${tier1Gap.needed} more Tier 1 sources (have ${kpis.tier1_count})`,
        severity: 'error',
      });
    }
    if (tier2Gap.hasGap) {
      coverageGaps.push({
        type: 'Tier 2',
        message: `Need ${tier2Gap.needed} more Tier 2 sources (have ${kpis.tier2_count})`,
        severity: 'warning',
      });
    }
    
    // Health gaps
    if (kpis.failing_sources > 0) {
      coverageGaps.push({
        type: 'Failing',
        message: `${kpis.failing_sources} sources have 3+ consecutive errors`,
        severity: 'error',
      });
    }
    if (kpis.stale_sources > kpis.healthy_sources * 0.3) {
      coverageGaps.push({
        type: 'Freshness',
        message: `${kpis.stale_sources} sources haven't updated in 24+ hours`,
        severity: 'warning',
      });
    }
    
    // Unclassified sources
    if (kpis.unclassified_count > 10) {
      coverageGaps.push({
        type: 'Classification',
        message: `${kpis.unclassified_count} sources are unclassified`,
        severity: 'warning',
      });
    }
  }

  // Stats for the grid
  const statsItems: AdminStatItem[] = kpis ? [
    {
      id: 'total',
      label: 'Total Sources',
      value: kpis.total_sources,
      icon: Database,
      subtitle: `${kpis.rss_count} RSS • ${kpis.google_news_count} Google News`,
    },
    {
      id: 'coverage',
      label: 'Coverage Score',
      value: `${kpis.overall_coverage_score}%`,
      icon: kpis.overall_coverage_score >= 70 ? CheckCircle : AlertTriangle,
      accent: kpis.overall_coverage_score >= 70 ? 'green' : 'amber',
      subtitle: getCoverageStatus(kpis.overall_coverage_score).label,
    },
    {
      id: 'healthy',
      label: 'Healthy (24h)',
      value: kpis.healthy_sources,
      icon: CheckCircle,
      accent: 'green',
      subtitle: `${kpis.stale_sources} stale`,
    },
    {
      id: 'failing',
      label: 'Failing',
      value: kpis.failing_sources,
      icon: TrendingDown,
      accent: kpis.failing_sources > 0 ? 'red' : 'default',
      subtitle: '3+ consecutive errors',
    },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          title="Coverage Governance"
          description="Source diversity and gap analysis across tiers, tags, and types"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* KPI Stats Grid */}
      <AdminStatsGrid items={statsItems} isLoading={isLoading} columns={4} />

      {/* Coverage Gaps Alert */}
      {coverageGaps.length > 0 && (
        <AdminCard
          title="Coverage Gaps Detected"
          icon={AlertTriangle}
          accent="amber"
          className="border-status-warning/30"
        >
          <div className="space-y-2">
            {coverageGaps.map((gap, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md",
                  gap.severity === 'error' ? "bg-status-error/10" : "bg-status-warning/10"
                )}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    gap.severity === 'error' 
                      ? "border-status-error text-status-error" 
                      : "border-status-warning text-status-warning"
                  )}
                >
                  {gap.type}
                </Badge>
                <span className="text-sm">{gap.message}</span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="by-tier" className="gap-2">
            <Layers className="h-4 w-4" />
            By Tier
          </TabsTrigger>
          <TabsTrigger value="by-tag" className="gap-2">
            <Globe className="h-4 w-4" />
            By Tag
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tier Distribution */}
            <AdminCard title="Tier Distribution" icon={Layers}>
              <div className="space-y-4">
                {['tier1', 'tier2', 'tier3', 'unclassified'].map((tier) => {
                  const count = kpis?.[`${tier}_count` as keyof CoverageKPIs] as number || 0;
                  const total = kpis?.total_sources || 1;
                  const percent = Math.round((count / total) * 100);
                  const gap = getTierGap(tier, count);
                  
                  return (
                    <div key={tier} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{tier.replace('tier', 'Tier ')}</span>
                        <span className={cn(
                          gap.hasGap && tier !== 'unclassified' ? "text-status-warning" : "text-muted-foreground"
                        )}>
                          {count} sources ({percent}%)
                          {gap.hasGap && tier !== 'unclassified' && (
                            <span className="text-status-warning ml-2">
                              (need +{gap.needed})
                            </span>
                          )}
                        </span>
                      </div>
                      <Progress 
                        value={percent} 
                        className={cn(
                          "h-2",
                          tier === 'tier1' && "[&>div]:bg-primary",
                          tier === 'tier2' && "[&>div]:bg-secondary",
                          tier === 'tier3' && "[&>div]:bg-muted-foreground",
                          tier === 'unclassified' && "[&>div]:bg-status-warning"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </AdminCard>

            {/* Source Type Distribution */}
            <AdminCard title="Source Types" icon={Rss}>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Rss className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">RSS Feeds</p>
                      <p className="text-xs text-muted-foreground">Traditional RSS sources</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg font-semibold">
                    {kpis?.rss_count || 0}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-accent" />
                    <div>
                      <p className="font-medium">Google News</p>
                      <p className="text-xs text-muted-foreground">Aggregated news sources</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg font-semibold">
                    {kpis?.google_news_count || 0}
                  </Badge>
                </div>
              </div>
            </AdminCard>
          </div>
        </TabsContent>

        <TabsContent value="by-tier" className="mt-4">
          <AdminCard title="Coverage by Source Type & Tier" icon={Layers}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Healthy</TableHead>
                  <TableHead className="text-right">Stale</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(tierAggregates || {}).map((row, idx) => {
                  const healthPercent = row.total > 0 
                    ? Math.round((row.healthy / row.total) * 100) 
                    : 0;
                  const status = getCoverageStatus(healthPercent);
                  
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium capitalize">{row.source_type}</TableCell>
                      <TableCell className="capitalize">{row.tier.replace('tier', 'Tier ')}</TableCell>
                      <TableCell className="text-right">{row.total}</TableCell>
                      <TableCell className="text-right">{row.active}</TableCell>
                      <TableCell className="text-right text-status-success">{row.healthy}</TableCell>
                      <TableCell className="text-right text-status-warning">{row.stale}</TableCell>
                      <TableCell className="text-right text-status-error">{row.errors}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            status.status === 'success' && "border-status-success text-status-success",
                            status.status === 'warning' && "border-status-warning text-status-warning",
                            status.status === 'error' && "border-status-error text-status-error"
                          )}
                        >
                          {healthPercent}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AdminCard>
        </TabsContent>

        <TabsContent value="by-tag" className="mt-4">
          <AdminCard title="Coverage by Tag (sorted by coverage)" icon={Globe}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead className="text-right">Sources</TableHead>
                  <TableHead className="text-right">Healthy</TableHead>
                  <TableHead className="text-right">Stale</TableHead>
                  <TableHead>Avg Coverage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tagList.slice(0, 20).map((row, idx) => {
                  const status = getCoverageStatus(row.avgScore);
                  
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.tag}</TableCell>
                      <TableCell className="text-right">{row.total}</TableCell>
                      <TableCell className="text-right text-status-success">{row.healthy}</TableCell>
                      <TableCell className="text-right text-status-warning">{row.stale}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={row.avgScore} 
                            className={cn(
                              "h-2 w-16",
                              status.status === 'success' && "[&>div]:bg-status-success",
                              status.status === 'warning' && "[&>div]:bg-status-warning",
                              status.status === 'error' && "[&>div]:bg-status-error"
                            )}
                          />
                          <span className="text-sm text-muted-foreground">{row.avgScore}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            status.status === 'success' && "border-status-success text-status-success",
                            status.status === 'warning' && "border-status-warning text-status-warning",
                            status.status === 'error' && "border-status-error text-status-error"
                          )}
                        >
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {tagList.length > 20 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Showing top 20 of {tagList.length} tags
              </p>
            )}
          </AdminCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CoverageGovernancePanel;
